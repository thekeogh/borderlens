import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

type GrenadeItem = {
  image: string;
  name: string;
  resources: {
    wiki?: string;
  };
  slug: string;
};

type ImageCandidate = {
  descriptorX: number;
  descriptorW: number;
  source: "src" | "srcset";
  url: string;
  widthHint: number;
};

type ProcessResult = {
  imageUrl?: string;
  reason?: string;
  slug: string;
  status: "downloaded" | "failed" | "skipped";
  wikiUrl?: string;
};

const WIKI_API_URL = "https://borderlands.fandom.com/api.php";
const GRENADE_DIR = join(process.cwd(), "data/games/borderlands2/grenade-mods");
const IMAGE_DIR = join(GRENADE_DIR, "img");
const REPORT_DIR = join(process.cwd(), ".agent/bl2/grenade-mods");
const REPORT_PATH = join(REPORT_DIR, "image-report.json");

const USER_AGENT = "Mozilla/5.0 (compatible; BorderlensBot/1.0)";
const execFileAsync = promisify(execFile);

function parseArgs(): { concurrency: number; force: boolean; limit?: number } {
  const args = process.argv.slice(2);
  let concurrency = 4;
  let force = false;
  let limit: number | undefined;

  for (const arg of args) {
    if (arg === "--force") {
      force = true;
      continue;
    }
    if (arg.startsWith("--concurrency=")) {
      const parsed = Number(arg.split("=")[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        concurrency = Math.floor(parsed);
      }
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const parsed = Number(arg.split("=")[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = Math.floor(parsed);
      }
    }
  }

  return { concurrency, force, limit };
}

function decodeHtml(text: string): string {
  return text
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .trim();
}

function parseAttributes(raw: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const attributeRegex = /([a-zA-Z0-9:-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = attributeRegex.exec(raw)) !== null) {
    attributes[match[1]] = decodeHtml(match[2]);
  }
  return attributes;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithRetry(url: string, retries = 4): Promise<Response> {
  let attempt = 0;
  let lastError: string | undefined;

  while (attempt <= retries) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": USER_AGENT,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt === retries) {
        break;
      }
      const backoff = 500 * (2 ** attempt);
      const jitter = Math.floor(Math.random() * 250);
      await sleep(backoff + jitter);
      attempt += 1;
    }
  }

  throw new Error(`Request failed for ${url}${lastError ? ` (${lastError})` : ""}`);
}

function normalizeWikiImageUrl(rawUrl: string): string {
  const value = decodeHtml(rawUrl);
  if (!value) return value;
  if (value.startsWith("//")) {
    return `https:${value}`;
  }
  if (value.startsWith("/")) {
    return `https://static.wikia.nocookie.net${value}`;
  }
  return value;
}

function parseSrcset(srcset: string): ImageCandidate[] {
  if (!srcset) return [];

  const candidates: ImageCandidate[] = [];
  const parts = srcset.split(",");

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const pieces = trimmed.split(/\s+/);
    const rawUrl = pieces[0];
    const descriptor = pieces[1] ?? "";
    const descriptorMatch = descriptor.match(/^([\d.]+)(x|w)$/i);

    const descriptorValue = descriptorMatch ? Number(descriptorMatch[1]) : 0;
    const unit = descriptorMatch?.[2]?.toLowerCase() ?? "";
    const url = normalizeWikiImageUrl(rawUrl);
    const widthHint = Number(url.match(/\/scale-to-width-down\/(\d+)/)?.[1] ?? "0");

    candidates.push({
      descriptorW: unit === "w" ? descriptorValue : 0,
      descriptorX: unit === "x" ? descriptorValue : 0,
      source: "srcset",
      url,
      widthHint,
    });
  }

  return candidates;
}

function chooseLargestImage(attrs: Record<string, string>): ImageCandidate | undefined {
  const srcCandidates = attrs.src
    ? [{
      descriptorW: 0,
      descriptorX: 0,
      source: "src" as const,
      url: normalizeWikiImageUrl(attrs.src),
      widthHint: Number(normalizeWikiImageUrl(attrs.src).match(/\/scale-to-width-down\/(\d+)/)?.[1] ?? "0"),
    }]
    : [];

  const candidates = [
    ...parseSrcset(attrs.srcset ?? ""),
    ...srcCandidates,
  ].filter(candidate => candidate.url.startsWith("http"));

  if (candidates.length === 0) {
    return undefined;
  }

  candidates.sort((a, b) => {
    if (b.descriptorX !== a.descriptorX) return b.descriptorX - a.descriptorX;
    if (b.descriptorW !== a.descriptorW) return b.descriptorW - a.descriptorW;
    return b.widthHint - a.widthHint;
  });

  return candidates[0];
}

function wikiTitleFromUrl(wikiUrl: string): string | undefined {
  try {
    const url = new URL(wikiUrl);
    const titleFromQuery = url.searchParams.get("title");
    if (titleFromQuery) {
      return decodeURIComponent(titleFromQuery).replaceAll("_", " ");
    }

    const pathMatch = url.pathname.match(/\/wiki\/(.+)$/);
    if (!pathMatch?.[1]) {
      return undefined;
    }

    return decodeURIComponent(pathMatch[1]).replaceAll("_", " ");
  } catch {
    return undefined;
  }
}

async function fetchInfoboxImageAttributes(title: string): Promise<Record<string, string>> {
  const params = new URLSearchParams({
    action: "parse",
    format: "json",
    formatversion: "2",
    page: title,
    prop: "text",
    redirects: "1",
  });

  const response = await fetchWithRetry(`${WIKI_API_URL}?${params.toString()}`);
  const payload = await response.json() as {
    error?: { info?: string };
    parse?: { text?: string };
  };

  if (payload.error?.info) {
    throw new Error(payload.error.info);
  }

  const html = payload.parse?.text;
  if (!html) {
    throw new Error("Wiki parse response did not include HTML");
  }

  const figureMatch = html.match(/<figure[^>]*data-source=["'](?:img|image)["'][^>]*>[\s\S]*?<img\b([^>]*?)>/i);
  if (figureMatch?.[1]) {
    return parseAttributes(figureMatch[1]);
  }

  const asideMatch = html.match(/<aside\b[^>]*>[\s\S]*?<img\b([^>]*?)>/i);
  if (!asideMatch?.[1]) {
    throw new Error("No infobox image found on wiki page");
  }

  return parseAttributes(asideMatch[1]);
}

async function convertToPng(imageBuffer: Buffer): Promise<Buffer> {
  const basePath = join(tmpdir(), `borderlens-bl2-grenade-mods-${randomUUID()}`);
  const inputPath = `${basePath}.input`;
  const outputPath = `${basePath}.png`;

  await writeFile(inputPath, imageBuffer);
  try {
    await execFileAsync("sips", ["-s", "format", "png", inputPath, "--out", outputPath]);
    return await readFile(outputPath);
  } finally {
    await Promise.allSettled([
      unlink(inputPath),
      unlink(outputPath),
    ]);
  }
}

async function loadGrenadeItems(limit?: number): Promise<GrenadeItem[]> {
  const entries = await readdir(GRENADE_DIR, { withFileTypes: true });
  const fileNames = entries
    .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const chosenFiles = typeof limit === "number" ? fileNames.slice(0, limit) : fileNames;
  const items: GrenadeItem[] = [];

  for (const fileName of chosenFiles) {
    const raw = await readFile(join(GRENADE_DIR, fileName), "utf-8");
    items.push(JSON.parse(raw) as GrenadeItem);
  }

  return items;
}

async function runWithConcurrency<T>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<void>,
): Promise<void> {
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (true) {
      const current = index;
      index += 1;
      if (current >= values.length) {
        return;
      }
      await worker(values[current]);
    }
  });

  await Promise.all(workers);
}

async function main(): Promise<void> {
  const { concurrency, force, limit } = parseArgs();

  await mkdir(IMAGE_DIR, { recursive: true });
  await mkdir(REPORT_DIR, { recursive: true });

  const items = await loadGrenadeItems(limit);
  const results: ProcessResult[] = [];

  await runWithConcurrency(items, concurrency, async item => {
    const outputPath = join(IMAGE_DIR, `${item.slug}.png`);

    if (!force) {
      try {
        await readFile(outputPath);
        results.push({ slug: item.slug, status: "skipped", reason: "image exists" });
        return;
      } catch {
        // Continue when file does not exist.
      }
    }

    const expectedImagePath = `/img/games/borderlands2/grenade-mods/${item.slug}.png`;
    if (item.image !== expectedImagePath) {
      results.push({
        slug: item.slug,
        status: "failed",
        reason: `JSON image path mismatch (${item.image})`,
      });
      return;
    }

    if (!item.resources.wiki) {
      results.push({
        slug: item.slug,
        status: "failed",
        reason: "missing wiki URL",
      });
      return;
    }

    try {
      const wikiTitle = wikiTitleFromUrl(item.resources.wiki);
      if (!wikiTitle) {
        throw new Error("could not derive wiki title from URL");
      }

      const attrs = await fetchInfoboxImageAttributes(wikiTitle);
      const candidate = chooseLargestImage(attrs);
      if (!candidate?.url) {
        throw new Error("no usable image URL from src/srcset");
      }

      const imageResponse = await fetchWithRetry(candidate.url);
      const sourceBuffer = Buffer.from(await imageResponse.arrayBuffer());
      const pngBuffer = await convertToPng(sourceBuffer);

      await writeFile(outputPath, pngBuffer);
      results.push({
        imageUrl: candidate.url,
        slug: item.slug,
        status: "downloaded",
        wikiUrl: item.resources.wiki,
      });
    } catch (error) {
      results.push({
        slug: item.slug,
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
        wikiUrl: item.resources.wiki,
      });
    }
  });

  const downloaded = results.filter(result => result.status === "downloaded");
  const skipped = results.filter(result => result.status === "skipped");
  const failed = results.filter(result => result.status === "failed");

  const report = {
    completedAt: new Date().toISOString(),
    concurrency,
    downloaded: downloaded.length,
    failed: failed.length,
    force,
    limit,
    skipped: skipped.length,
    totalProcessed: items.length,
    failures: failed,
  };

  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  console.log(
    [
      `Processed: ${report.totalProcessed}`,
      `Downloaded: ${report.downloaded}`,
      `Skipped: ${report.skipped}`,
      `Failed: ${report.failed}`,
      `Report: ${REPORT_PATH}`,
    ].join("\n"),
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
