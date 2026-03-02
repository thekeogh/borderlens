import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

type PartEntry = {
  modifiers: string[];
  name: string;
};

type Parts = Record<string, PartEntry[]>;

type WeaponItem = {
  parts?: Parts;
  resources: {
    lootlemon?: string;
  };
  slug: string;
};

type Report = {
  changed: number;
  completedAt: string;
  noPartsTab: string[];
  processedLootlemon: number;
  unknownGroups: Array<{ groups: string[]; slug: string }>;
};

const WEAPONS_DIR = join(process.cwd(), "data/games/borderlands2/weapons");
const REPORT_PATH = join(process.cwd(), ".agent/bl2/weapons/parts-enrich-report.json");

const GROUP_KEY_MAP: Record<string, string> = {
  Accessory: "Accessory",
  Barrel: "Barrel",
  Body: "Body",
  Element: "Element",
  Exhaust: "Exhaust",
  Grip: "Grip",
  Magazine: "Magazine",
  Material: "Material",
  Sight: "Sight",
  Stock: "Stock",
};

function decodeHtml(value: string): string {
  return value
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", "\"")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .trim();
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function normalizeGroupName(raw: string): string {
  const cleaned = stripTags(raw)
    .replace(/\s+\d+(?:\.\d+)?%\s*$/i, "")
    .replace(/\s+0-1\s*$/i, "")
    .trim();
  return cleaned;
}

function parsePartLineItem(raw: string): PartEntry | undefined {
  const name = stripTags(raw.match(/<strong>([\s\S]*?)<\/strong>/i)?.[1] ?? "");
  if (!name) return undefined;

  const afterStrong = raw.replace(/^[\s\S]*?<strong>[\s\S]*?<\/strong>/i, "");
  const chanceRaw = afterStrong.match(/^\s*<sup>([\s\S]*?)<\/sup>/i)?.[1] ?? "";
  const chance = stripTags(chanceRaw);

  const body = afterStrong
    .replace(/^\s*<sup>[\s\S]*?<\/sup>/i, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?em>/gi, "")
    .replace(/<\/?sub>/gi, "\n");

  const modifiers = decodeHtml(body.replace(/<[^>]*>/g, " "))
    .split("\n")
    .map(line => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (chance) {
    modifiers.unshift(`Chance: ${chance}`);
  }

  return {
    modifiers,
    name,
  };
}

function parsePartsFromHtml(html: string): { parts: Parts; unknownGroups: string[] } {
  const partsTab = html.match(
    /<div data-w-tab="Parts" class="w-tab-pane[^"]*">([\s\S]*?)<\/div>\s*<div data-w-tab="Changelog"/i
  )?.[1] ?? "";

  if (!partsTab) {
    return {
      parts: {},
      unknownGroups: [],
    };
  }

  const rich = partsTab.match(/<div class="rich-txt_parts-new w-richtext">([\s\S]*?)<\/div>/i)?.[1] ?? "";
  if (!rich) {
    return {
      parts: {},
      unknownGroups: [],
    };
  }

  const parts: Parts = {};
  const unknownGroups = new Set<string>();

  const sectionRegex = /<h4>([\s\S]*?)<\/h4>\s*<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  let sectionMatch: RegExpExecArray | null;

  while ((sectionMatch = sectionRegex.exec(rich)) !== null) {
    const sourceGroup = normalizeGroupName(sectionMatch[1]);
    const mappedGroup = GROUP_KEY_MAP[sourceGroup];

    if (!mappedGroup) {
      unknownGroups.add(sourceGroup);
      continue;
    }

    const entries: PartEntry[] = [];
    const lineRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let lineMatch: RegExpExecArray | null;

    while ((lineMatch = lineRegex.exec(sectionMatch[2])) !== null) {
      const parsed = parsePartLineItem(lineMatch[1]);
      if (!parsed) continue;
      entries.push(parsed);
    }

    if (entries.length > 0) {
      parts[mappedGroup] = entries;
    }
  }

  return {
    parts,
    unknownGroups: [...unknownGroups],
  };
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; BorderlensBot/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.text();
}

function stablePartsString(parts: Parts | undefined): string {
  if (!parts) return "";
  return JSON.stringify(parts);
}

async function main(): Promise<void> {
  const fileNames = (await readdir(WEAPONS_DIR))
    .filter(name => name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  const report: Report = {
    changed: 0,
    completedAt: new Date().toISOString(),
    noPartsTab: [],
    processedLootlemon: 0,
    unknownGroups: [],
  };

  for (const fileName of fileNames) {
    const filePath = join(WEAPONS_DIR, fileName);
    const item = JSON.parse(await readFile(filePath, "utf-8")) as WeaponItem;
    const lootUrl = item.resources.lootlemon;
    if (!lootUrl) continue;

    report.processedLootlemon += 1;

    const html = await fetchText(lootUrl);
    const parsed = parsePartsFromHtml(html);

    if (parsed.unknownGroups.length > 0) {
      report.unknownGroups.push({
        groups: parsed.unknownGroups,
        slug: item.slug,
      });
    }

    const hadPartsTab = html.includes('data-w-tab="Parts"');
    if (!hadPartsTab || Object.keys(parsed.parts).length === 0) {
      report.noPartsTab.push(item.slug);
      if (item.parts) {
        delete item.parts;
        report.changed += 1;
        await writeFile(filePath, `${JSON.stringify(item, null, 2)}\n`, "utf-8");
      }
      continue;
    }

    if (stablePartsString(item.parts) !== stablePartsString(parsed.parts)) {
      item.parts = parsed.parts;
      report.changed += 1;
      await writeFile(filePath, `${JSON.stringify(item, null, 2)}\n`, "utf-8");
    }
  }

  await mkdir(join(process.cwd(), ".agent/bl2/weapons"), { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  console.log(
    [
      `Lootlemon items processed: ${report.processedLootlemon}`,
      `Files changed: ${report.changed}`,
      `No parts found: ${report.noPartsTab.length}`,
      `Unknown part groups: ${report.unknownGroups.length}`,
      `Report: ${REPORT_PATH}`,
    ].join("\n")
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
