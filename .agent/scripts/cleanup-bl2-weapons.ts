import { access, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";

type Item = {
  aliases?: string[];
  category: "weapons";
  content: string;
  description: string;
  dlc: boolean;
  image: string;
  manufacturers: string[];
  name: string;
  notes?: string;
  rarities: string[];
  resources: {
    lootlemon?: string;
    wiki?: string;
  };
  slug: string;
  type: string;
};

type Entry = {
  fileName: string;
  filePath: string;
  imagePath: string;
  item: Item;
  wikiTitle?: string;
};

type RemovalLog = {
  file: string;
  name: string;
  reason: string;
  wiki?: string;
};

type RenameLog = {
  fromFile: string;
  fromName: string;
  fromSlug: string;
  toFile: string;
  toName: string;
  toSlug: string;
};

type SkipLog = {
  file: string;
  name: string;
  reason: string;
};

type AliasBackfillLog = {
  alias: string;
  file: string;
  name: string;
};

const WIKI_API_URL = "https://borderlands.fandom.com/api.php";
const WEAPONS_DIR = join(process.cwd(), "data/games/borderlands2/weapons");
const IMAGES_DIR = join(WEAPONS_DIR, "img");
const REPORT_PATH = join(process.cwd(), ".agent/bl2/weapons/cleanup-report.json");

const META_TITLE_PATTERNS = [
  /^borderlands\s*2\s*weapons$/i,
  /weapons?\s+by\s+prefix/i,
  /weapons?\s+by\s+suffix/i,
  /weapon\s+prefixes?/i,
  /weapon\s+suffixes?/i,
  /weapon\s+parts?/i,
];

const NON_WEAPON_CATEGORY_PATTERNS = [
  /\brelics?\b/i,
  /\bgrenade\b/i,
  /\bshields?\b/i,
  /\bclass mods?\b/i,
  /\bartifacts?\b/i,
  /\boz kits?\b/i,
  /\bheads?\b/i,
  /\bskins?\b/i,
  /\bcustomization\b/i,
];

const META_CATEGORY_PATTERNS = [
  /weapons?\s+by\s+prefix/i,
  /weapons?\s+by\s+suffix/i,
  /weapon\s+prefixes?/i,
  /weapon\s+suffixes?/i,
  /weapon\s+parts?/i,
  /templates?/i,
  /disambiguation/i,
  /lists?/i,
  /redirects?/i,
];

function parseArgs(): { dryRun: boolean } {
  return { dryRun: process.argv.includes("--dry-run") };
}

function normalizeName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['".,!?():/\\]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function addAlias(item: Item, alias: string): void {
  const candidate = alias.trim();
  if (!candidate) return;
  if (candidate.localeCompare(item.name, undefined, { sensitivity: "accent" }) === 0) return;

  const aliases = new Set([...(item.aliases ?? [])]);
  aliases.add(candidate);
  item.aliases = [...aliases].sort((a, b) => a.localeCompare(b));
}

function wikiTitleFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    const pathMatch = parsed.pathname.match(/\/wiki\/(.+)$/);
    if (!pathMatch?.[1]) return undefined;
    return decodeURIComponent(pathMatch[1]).replaceAll("_", " ");
  } catch {
    return undefined;
  }
}

function chunk<T>(values: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    groups.push(values.slice(index, index + size));
  }
  return groups;
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

async function fetchWikiCategories(titles: string[]): Promise<Map<string, string[]>> {
  const byNormalizedTitle = new Map<string, string[]>();

  for (const group of chunk(titles, 30)) {
    const params = new URLSearchParams({
      action: "query",
      cllimit: "max",
      format: "json",
      prop: "categories",
      redirects: "1",
      titles: group.join("|"),
    });

    const payloadText = await fetchText(`${WIKI_API_URL}?${params.toString()}`);
    const payload = JSON.parse(payloadText) as {
      query?: {
        pages?: Record<string, {
          categories?: Array<{ title?: string }>;
          title?: string;
        }>;
      };
    };

    for (const page of Object.values(payload.query?.pages ?? {})) {
      if (!page.title) continue;
      const categories = (page.categories ?? [])
        .map(category => category.title?.replace(/^Category:/i, "").trim())
        .filter((value): value is string => Boolean(value));

      byNormalizedTitle.set(normalizeName(page.title), categories);
    }
  }

  return byNormalizedTitle;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function isHighConfidenceMeta(wikiTitle: string, categories: string[]): { isMeta: boolean; reason?: string } {
  if (META_TITLE_PATTERNS.some(pattern => pattern.test(wikiTitle))) {
    return { isMeta: true, reason: "meta title pattern" };
  }

  for (const category of categories) {
    if (NON_WEAPON_CATEGORY_PATTERNS.some(pattern => pattern.test(category))) {
      return { isMeta: true, reason: `non-weapon category (${category})` };
    }

    if (META_CATEGORY_PATTERNS.some(pattern => pattern.test(category))) {
      return { isMeta: true, reason: `meta category (${category})` };
    }
  }

  return { isMeta: false };
}

async function main(): Promise<void> {
  const { dryRun } = parseArgs();

  const fileNames = (await readdir(WEAPONS_DIR))
    .filter(fileName => fileName.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  const entries: Entry[] = [];
  for (const fileName of fileNames) {
    const filePath = join(WEAPONS_DIR, fileName);
    const payload = JSON.parse(await readFile(filePath, "utf-8")) as Item;
    entries.push({
      fileName,
      filePath,
      imagePath: join(IMAGES_DIR, `${payload.slug}.png`),
      item: payload,
      wikiTitle: wikiTitleFromUrl(payload.resources.wiki),
    });
  }

  const wikiOnlyEntries = entries.filter(entry => entry.item.resources.wiki && !entry.item.resources.lootlemon);
  const wikiTitles = wikiOnlyEntries
    .map(entry => entry.wikiTitle)
    .filter((value): value is string => Boolean(value));

  const categoriesByTitle = await fetchWikiCategories(wikiTitles);

  const removalLogs: RemovalLog[] = [];
  const renameLogs: RenameLog[] = [];
  const skipLogs: SkipLog[] = [];
  const aliasBackfillLogs: AliasBackfillLog[] = [];
  const removedFiles = new Set<string>();

  for (const entry of wikiOnlyEntries) {
    if (!entry.wikiTitle) continue;

    const categories = categoriesByTitle.get(normalizeName(entry.wikiTitle)) ?? [];
    const metaCheck = isHighConfidenceMeta(entry.wikiTitle, categories);
    if (!metaCheck.isMeta) continue;

    removalLogs.push({
      file: entry.fileName,
      name: entry.item.name,
      reason: metaCheck.reason ?? "meta/non-weapon",
      wiki: entry.item.resources.wiki,
    });

    if (dryRun) continue;

    removedFiles.add(entry.fileName);
    await unlink(entry.filePath).catch(() => undefined);
    await unlink(entry.imagePath).catch(() => undefined);
  }

  const activeEntries = entries.filter(entry => !removedFiles.has(entry.fileName));
  const normalizedNameCounts = new Map<string, number>();
  const activeSlugs = new Set(activeEntries.map(entry => entry.item.slug));
  const parentheticalBaseCounts = new Map<string, number>();

  for (const entry of activeEntries) {
    const key = normalizeName(entry.item.name);
    normalizedNameCounts.set(key, (normalizedNameCounts.get(key) ?? 0) + 1);

    if (!entry.item.resources.lootlemon && /\([^)]*\)/.test(entry.item.name)) {
      const baseName = entry.item.name.replace(/\s*\([^)]*\)\s*/g, " ").trim().replace(/\s+/g, " ");
      if (baseName) {
        const baseKey = normalizeName(baseName);
        parentheticalBaseCounts.set(baseKey, (parentheticalBaseCounts.get(baseKey) ?? 0) + 1);
      }
    }
  }

  for (const entry of activeEntries) {
    if (removedFiles.has(entry.fileName)) continue;
    if (entry.item.resources.lootlemon) continue;

    const originalName = entry.item.name;
    const baseName = originalName.replace(/\s*\([^)]*\)\s*/g, " ").trim().replace(/\s+/g, " ");

    if (!baseName || baseName === originalName) continue;

    const baseKey = normalizeName(baseName);
    const currentKey = normalizeName(originalName);
    const currentCount = normalizedNameCounts.get(currentKey) ?? 1;
    const baseCount = normalizedNameCounts.get(baseKey) ?? 0;
    const baseVariantCount = parentheticalBaseCounts.get(baseKey) ?? 0;

    if (baseVariantCount > 1) {
      skipLogs.push({
        file: entry.fileName,
        name: entry.item.name,
        reason: `multiple variants share base (${baseName})`,
      });
      continue;
    }

    if (baseCount > 0) {
      skipLogs.push({
        file: entry.fileName,
        name: entry.item.name,
        reason: `base name conflict (${baseName})`,
      });
      continue;
    }

    const nextSlug = slugify(baseName);
    if (!nextSlug) {
      skipLogs.push({
        file: entry.fileName,
        name: entry.item.name,
        reason: "empty slug after cleanup",
      });
      continue;
    }

    if (nextSlug !== entry.item.slug && activeSlugs.has(nextSlug)) {
      skipLogs.push({
        file: entry.fileName,
        name: entry.item.name,
        reason: `slug conflict (${nextSlug})`,
      });
      continue;
    }

    const previousSlug = entry.item.slug;
    const previousFileName = entry.fileName;

    entry.item.name = baseName;
    addAlias(entry.item, originalName);
    entry.item.slug = nextSlug;
    entry.item.image = `/img/games/borderlands2/weapons/${nextSlug}.png`;

    const nextFileName = `${nextSlug}.json`;
    const nextFilePath = join(WEAPONS_DIR, nextFileName);
    const nextImagePath = join(IMAGES_DIR, `${nextSlug}.png`);

    renameLogs.push({
      fromFile: previousFileName,
      fromName: originalName,
      fromSlug: previousSlug,
      toFile: nextFileName,
      toName: baseName,
      toSlug: nextSlug,
    });

    normalizedNameCounts.set(currentKey, Math.max(0, currentCount - 1));
    normalizedNameCounts.set(baseKey, (normalizedNameCounts.get(baseKey) ?? 0) + 1);

    activeSlugs.delete(previousSlug);
    activeSlugs.add(nextSlug);

    if (dryRun) continue;

    if (previousFileName !== nextFileName) {
      await rename(entry.filePath, nextFilePath);
      entry.fileName = nextFileName;
      entry.filePath = nextFilePath;
    }

    if (previousSlug !== nextSlug && await fileExists(entry.imagePath)) {
      await rename(entry.imagePath, nextImagePath);
      entry.imagePath = nextImagePath;
    }

    await writeFile(entry.filePath, `${JSON.stringify(entry.item, null, 2)}\n`, "utf-8");
  }

  for (const entry of activeEntries) {
    if (removedFiles.has(entry.fileName)) continue;
    if (entry.item.resources.lootlemon) continue;
    if (!entry.wikiTitle) continue;
    if (!/\([^)]*\)/.test(entry.wikiTitle)) continue;
    const qualifier = entry.wikiTitle.match(/\(([^)]*)\)/)?.[1]?.trim().toLowerCase();
    if (qualifier === "borderlands 2") continue;

    const baseTitle = entry.wikiTitle.replace(/\s*\([^)]*\)\s*/g, " ").trim().replace(/\s+/g, " ");
    if (normalizeName(baseTitle) !== normalizeName(entry.item.name)) continue;

    const aliasCandidate = entry.wikiTitle.trim();
    const beforeAliases = new Set(entry.item.aliases ?? []);
    addAlias(entry.item, aliasCandidate);
    const afterAliases = new Set(entry.item.aliases ?? []);

    if (afterAliases.size === beforeAliases.size) continue;

    aliasBackfillLogs.push({
      alias: aliasCandidate,
      file: entry.fileName,
      name: entry.item.name,
    });

    if (!dryRun) {
      await writeFile(entry.filePath, `${JSON.stringify(entry.item, null, 2)}\n`, "utf-8");
    }
  }

  const report = {
    aliasesBackfilled: aliasBackfillLogs.length,
    completedAt: new Date().toISOString(),
    dryRun,
    renamed: renameLogs.length,
    removed: removalLogs.length,
    scannedWikiOnly: wikiOnlyEntries.length,
    renamedItems: renameLogs,
    removedItems: removalLogs,
    aliasBackfilledItems: aliasBackfillLogs,
    skippedRenames: skipLogs,
  };

  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  console.log(
    [
      `Scanned wiki-only items: ${report.scannedWikiOnly}`,
      `Removed (meta/non-weapon): ${report.removed}`,
      `Renamed (noise cleanup): ${report.renamed}`,
      `Aliases backfilled: ${report.aliasesBackfilled}`,
      `Skipped renames: ${report.skippedRenames.length}`,
      `Report: ${REPORT_PATH}`,
    ].join("\n")
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
