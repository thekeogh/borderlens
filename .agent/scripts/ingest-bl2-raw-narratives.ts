import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

type WeaponItem = {
  description: string;
  name: string;
  notes?: string;
  resources: {
    lootlemon?: string;
    wiki?: string;
  };
  slug: string;
  special?: {
    description: string;
    title?: string;
  };
};

type LootRaw = {
  description?: string;
  notes?: string;
  specialDescription?: string;
};

type WikiRaw = {
  description?: string;
  notes?: string;
  specialDescription?: string;
};

type ReportEntry = {
  changed: string[];
  file: string;
  lootlemon: boolean;
  name: string;
  wiki: boolean;
};

type Report = {
  completedAt: string;
  failed: Array<{ file: string; name: string; reason: string }>;
  processed: number;
  scanned: number;
  updated: number;
  warnings: Array<{ file: string; name: string; reason: string }>;
};

const WEAPONS_DIR = join(process.cwd(), "data/games/borderlands2/weapons");
const REPORT_PATH = join(process.cwd(), ".agent/bl2/weapons/raw-narrative-ingest-report.json");
const USER_AGENT = "Mozilla/5.0 (compatible; BorderlensBot/1.0)";
const WIKI_API_URL = "https://borderlands.fandom.com/api.php";
const CONCURRENCY = 8;

function decodeHtml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&mdash;", "—")
    .replaceAll("&ndash;", "–")
    .replaceAll("\u00a0", " ")
    .replaceAll("\u200d", "")
    .replaceAll("\u200b", "");
}

function htmlToRawText(html: string | undefined): string | undefined {
  if (!html) return undefined;

  const text = decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<div[^>]*class="[^"]*(?:navbox|reflist|hatnote)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, " ")
      .replace(/<table[^>]*class="[^"]*navbox[^"]*"[^>]*>[\s\S]*?<\/table>/gi, " ")
      .replace(/<sup[^>]*class="[^"]*reference[^"]*"[^>]*>[\s\S]*?<\/sup>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<\/h[1-6]>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
      .replace(/\r/g, "")
  );

  const lines = text
    .split("\n")
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (lines.length === 0) return undefined;
  return lines.join("\n");
}

function joinRaw(parts: Array<string | undefined>): string | undefined {
  const cleaned = parts
    .map(part => part?.trim())
    .filter((part): part is string => Boolean(part));

  if (cleaned.length === 0) return undefined;
  return cleaned.join("\n\n");
}

function extractDivByDataTab(html: string, tabName: string): string | undefined {
  const pattern = new RegExp(`<div[^>]*data-w-tab="${tabName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`, "i");
  const startMatch = pattern.exec(html);
  if (!startMatch) return undefined;

  const startIndex = startMatch.index + startMatch[0].length;
  const tail = html.slice(startIndex);
  const tokenRegex = /<\/?div\b[^>]*>/gi;

  let depth = 1;
  let token: RegExpExecArray | null;
  while ((token = tokenRegex.exec(tail)) !== null) {
    const value = token[0].toLowerCase();
    if (value.startsWith("</div")) {
      depth -= 1;
      if (depth === 0) {
        return tail.slice(0, token.index);
      }
      continue;
    }

    depth += 1;
  }

  return undefined;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function fetchTextWithRetry(url: string, attempts = 4): Promise<string> {
  let lastError: unknown;
  for (let tryIndex = 1; tryIndex <= attempts; tryIndex += 1) {
    try {
      return await fetchText(url);
    } catch (error) {
      lastError = error;
      if (tryIndex < attempts) {
        await new Promise(resolve => setTimeout(resolve, 500 * tryIndex));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function wikiTitleFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const fromQuery = parsed.searchParams.get("title");
    if (fromQuery) return decodeURIComponent(fromQuery).replaceAll("_", " ");

    const pathMatch = parsed.pathname.match(/\/wiki\/(.+)$/);
    if (!pathMatch?.[1]) return undefined;
    return decodeURIComponent(pathMatch[1]).replaceAll("_", " ");
  } catch {
    return undefined;
  }
}

async function fetchWikiHtml(wikiUrl: string): Promise<string> {
  const title = wikiTitleFromUrl(wikiUrl);
  if (!title) {
    throw new Error("unable to derive wiki title");
  }

  const params = new URLSearchParams({
    action: "parse",
    format: "json",
    formatversion: "2",
    page: title,
    prop: "text",
    redirects: "1",
  });

  const payloadText = await fetchTextWithRetry(`${WIKI_API_URL}?${params.toString()}`);
  const payload = JSON.parse(payloadText) as {
    error?: { info?: string };
    parse?: { text?: string };
  };

  if (payload.error?.info) {
    throw new Error(payload.error.info);
  }

  if (!payload.parse?.text) {
    throw new Error("missing parse HTML");
  }

  return payload.parse.text;
}

function parseLootRaw(html: string): LootRaw {
  const details = extractDivByDataTab(html, "Details") ?? html;

  const aboutBlock = details.match(/<div[^>]*class="[^"]*margin-left[^"]*w-embed[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  const specialBlock = details.match(/<div[^>]*class="[^"]*margin-left[^"]*w-richtext[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1];

  const description = htmlToRawText(aboutBlock);
  const specialDescription = htmlToRawText(specialBlock);

  return {
    description,
    notes: undefined,
    specialDescription,
  };
}

function parseWikiSectionsRaw(html: string): Record<string, string> {
  const headings: Array<{ end: number; id: string; index: number }> = [];
  const headingRegex = /<h2[^>]*>[\s\S]*?<span class="mw-headline" id="([^"]+)"[^>]*>[\s\S]*?<\/span>[\s\S]*?<\/h2>/gi;

  let headingMatch: RegExpExecArray | null;
  while ((headingMatch = headingRegex.exec(html)) !== null) {
    headings.push({
      end: headingRegex.lastIndex,
      id: headingMatch[1],
      index: headingMatch.index,
    });
  }

  const out: Record<string, string> = {};
  for (let index = 0; index < headings.length; index += 1) {
    const current = headings[index];
    const next = headings[index + 1];
    out[current.id] = html.slice(current.end, next ? next.index : html.length);
  }

  return out;
}

function parseWikiRaw(html: string): WikiRaw {
  const sections = parseWikiSectionsRaw(html);
  const sectionKeys = Object.keys(sections);

  const usageKey = sectionKeys.find(key => key.toLowerCase().includes("usage") || key.toLowerCase().includes("description"));
  const notesKey = sectionKeys.find(key => key.toLowerCase() === "notes");
  const specialKey = sectionKeys.find(key => key.toLowerCase().includes("special_weapon_effect"));

  let description = usageKey ? htmlToRawText(sections[usageKey]) : undefined;
  const notes = notesKey ? htmlToRawText(sections[notesKey]) : undefined;
  const specialDescription = specialKey ? htmlToRawText(sections[specialKey]) : undefined;

  if (!description) {
    const firstH2Index = html.search(/<h2\b/i);
    const leadBlock = (firstH2Index >= 0 ? html.slice(0, firstH2Index) : html)
      .replace(/<aside[\s\S]*?<\/aside>/gi, " ");
    description = htmlToRawText(leadBlock);
  }

  return {
    description,
    notes,
    specialDescription,
  };
}

async function run(): Promise<void> {
  const names = (await readdir(WEAPONS_DIR))
    .filter(name => name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  const lootCache = new Map<string, LootRaw>();
  const wikiCache = new Map<string, WikiRaw>();
  const entries: ReportEntry[] = [];

  const report: Report = {
    completedAt: "",
    failed: [],
    processed: 0,
    scanned: names.length,
    updated: 0,
    warnings: [],
  };

  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= names.length) break;

      const file = names[index];
      const path = join(WEAPONS_DIR, file);

      try {
        const raw = await readFile(path, "utf8");
        const item = JSON.parse(raw) as WeaponItem;
        const changed: string[] = [];

        let lootRaw: LootRaw | undefined;
        if (item.resources.lootlemon) {
          if (!lootCache.has(item.resources.lootlemon)) {
            const html = await fetchTextWithRetry(item.resources.lootlemon);
            lootCache.set(item.resources.lootlemon, parseLootRaw(html));
          }
          lootRaw = lootCache.get(item.resources.lootlemon);
        }

        let wikiRaw: WikiRaw | undefined;
        if (item.resources.wiki) {
          if (!wikiCache.has(item.resources.wiki)) {
            const html = await fetchWikiHtml(item.resources.wiki);
            wikiCache.set(item.resources.wiki, parseWikiRaw(html));
          }
          wikiRaw = wikiCache.get(item.resources.wiki);
        }

        const nextDescription = joinRaw([lootRaw?.description, wikiRaw?.description]);
        const nextNotes = joinRaw([lootRaw?.notes, wikiRaw?.notes]);
        const nextSpecial = joinRaw([lootRaw?.specialDescription, wikiRaw?.specialDescription]);

        if (nextDescription && nextDescription !== item.description) {
          item.description = nextDescription;
          changed.push("description");
        }

        if (nextNotes) {
          if (nextNotes !== item.notes) {
            item.notes = nextNotes;
            changed.push("notes");
          }
        } else if (item.notes) {
          delete item.notes;
          changed.push("notes");
        }

        if (nextSpecial) {
          if (!item.special) item.special = { description: nextSpecial };
          if (item.special.description !== nextSpecial) {
            item.special.description = nextSpecial;
            changed.push("special.description");
          }
        } else if (item.special?.description) {
          item.special.description = "";
          changed.push("special.description");
        }

        if (!nextDescription) {
          report.warnings.push({
            file,
            name: item.name,
            reason: "no raw description extracted from either source",
          });
        }

        if (changed.length > 0) {
          await writeFile(path, `${JSON.stringify(item, null, 2)}\n`, "utf8");
          report.updated += 1;
        }

        report.processed += 1;
        entries.push({
          changed,
          file,
          lootlemon: Boolean(item.resources.lootlemon),
          name: item.name,
          wiki: Boolean(item.resources.wiki),
        });

        if (report.processed % 25 === 0 || report.processed === report.scanned) {
          console.log(`[raw-ingest] ${report.processed}/${report.scanned} processed, updated=${report.updated}, failed=${report.failed.length}`);
        }
      } catch (error) {
        report.processed += 1;
        report.failed.push({
          file,
          name: file,
          reason: error instanceof Error ? error.message : String(error),
        });
        console.error(`[raw-ingest] FAILED ${file}: ${report.failed[report.failed.length - 1].reason}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  report.completedAt = new Date().toISOString();
  await writeFile(REPORT_PATH, `${JSON.stringify({ ...report, entries }, null, 2)}\n`, "utf8");

  console.log("\nRaw ingest complete.");
  console.log(`Scanned: ${report.scanned}`);
  console.log(`Processed: ${report.processed}`);
  console.log(`Updated: ${report.updated}`);
  console.log(`Failed: ${report.failed.length}`);
  console.log(`Warnings: ${report.warnings.length}`);
  console.log(`Report: ${REPORT_PATH}`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

