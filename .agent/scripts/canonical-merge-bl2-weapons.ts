import { readdir, readFile, unlink, writeFile } from "node:fs/promises";
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

type ItemFile = {
  fileName: string;
  imagePath: string;
  item: Item;
};

type MergeLog = {
  canonical: string;
  merged: string[];
  reason: string;
};

type SkipLog = {
  files: string[];
  reason: string;
};

const WEAPONS_DIR = join(process.cwd(), "data/games/borderlands2/weapons");
const IMAGES_DIR = join(WEAPONS_DIR, "img");
const REPORT_DIR = join(process.cwd(), ".agent/bl2/weapons");
const REPORT_PATH = join(REPORT_DIR, "canonical-merge-report.json");

function normalizeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\(borderlands\s*2\)\s*/gi, " ")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function hasParenthetical(name: string): boolean {
  return /\([^)]*\)/.test(name);
}

function compareCanonicalPriority(a: ItemFile, b: ItemFile): number {
  const score = (entry: ItemFile): number => {
    let value = 0;
    if (entry.item.resources.lootlemon) value += 100;
    if (entry.item.resources.wiki) value += 30;
    if (entry.item.type !== "Unknown") value += 20;
    if (!hasParenthetical(entry.item.name)) value += 10;
    return value;
  };

  const diff = score(b) - score(a);
  if (diff !== 0) return diff;

  if (a.item.name.length !== b.item.name.length) {
    return a.item.name.length - b.item.name.length;
  }

  return a.fileName.localeCompare(b.fileName);
}

function toSet(values: string[] | undefined): Set<string> {
  return new Set((values ?? []).map(value => value.trim()).filter(Boolean));
}

function addAlias(item: Item, alias: string): void {
  const candidate = alias.trim();
  if (!candidate) return;
  if (candidate.localeCompare(item.name, undefined, { sensitivity: "accent" }) === 0) return;

  const aliases = toSet(item.aliases);
  aliases.add(candidate);
  item.aliases = [...aliases].sort((a, b) => a.localeCompare(b));
}

function unionSorted(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])].sort((left, right) => left.localeCompare(right));
}

function safeToMerge(canonical: Item, other: Item): { ok: true } | { ok: false; reason: string } {
  if (
    canonical.type !== "Unknown"
    && other.type !== "Unknown"
    && canonical.type !== other.type
  ) {
    return {
      ok: false,
      reason: `type conflict (${canonical.type} vs ${other.type})`,
    };
  }

  if (
    canonical.resources.lootlemon
    && other.resources.lootlemon
    && canonical.resources.lootlemon !== other.resources.lootlemon
  ) {
    return {
      ok: false,
      reason: "different lootlemon URLs",
    };
  }

  if (
    canonical.resources.wiki
    && other.resources.wiki
    && canonical.resources.wiki !== other.resources.wiki
  ) {
    return {
      ok: false,
      reason: "different wiki URLs",
    };
  }

  return { ok: true };
}

async function tryDelete(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // Ignore absent files.
  }
}

function buildCandidateGroups(items: ItemFile[]): ItemFile[][] {
  const groups = new Map<string, ItemFile[]>();

  for (const entry of items) {
    const normalizedName = normalizeName(entry.item.name);
    if (normalizedName) {
      if (!groups.has(`name:${normalizedName}`)) {
        groups.set(`name:${normalizedName}`, []);
      }
      groups.get(`name:${normalizedName}`)?.push(entry);
    }

    if (entry.item.resources.lootlemon) {
      const key = `loot:${entry.item.resources.lootlemon}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(entry);
    }

    if (entry.item.resources.wiki) {
      const key = `wiki:${entry.item.resources.wiki}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(entry);
    }
  }

  const unique = new Map<string, ItemFile[]>();
  for (const entries of groups.values()) {
    const deduped = [...new Map(entries.map(entry => [entry.fileName, entry])).values()]
      .sort((a, b) => a.fileName.localeCompare(b.fileName));
    if (deduped.length < 2) continue;

    const signature = deduped.map(entry => entry.fileName).join("|");
    unique.set(signature, deduped);
  }

  return [...unique.values()];
}

async function main(): Promise<void> {
  const fileNames = (await readdir(WEAPONS_DIR))
    .filter(fileName => fileName.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  const entries: ItemFile[] = [];
  for (const fileName of fileNames) {
    const filePath = join(WEAPONS_DIR, fileName);
    const raw = await readFile(filePath, "utf-8");
    const item = JSON.parse(raw) as Item;
    entries.push({
      fileName,
      imagePath: join(IMAGES_DIR, `${item.slug}.png`),
      item,
    });
  }

  const mergeLogs: MergeLog[] = [];
  const skipLogs: SkipLog[] = [];
  const consumed = new Set<string>();

  for (const group of buildCandidateGroups(entries)) {
    const available = group.filter(entry => !consumed.has(entry.fileName));
    if (available.length < 2) continue;

    const sorted = [...available].sort(compareCanonicalPriority);
    const canonicalEntry = sorted[0];
    const mergeTargets = sorted.slice(1);
    const blocked: string[] = [];
    const mergedFiles: string[] = [];

    for (const target of mergeTargets) {
      const safety = safeToMerge(canonicalEntry.item, target.item);
      if (!safety.ok) {
        blocked.push(`${target.fileName}: ${safety.reason}`);
        continue;
      }

      if (!canonicalEntry.item.resources.lootlemon && target.item.resources.lootlemon) {
        canonicalEntry.item.resources.lootlemon = target.item.resources.lootlemon;
      }
      if (!canonicalEntry.item.resources.wiki && target.item.resources.wiki) {
        canonicalEntry.item.resources.wiki = target.item.resources.wiki;
      }

      if (canonicalEntry.item.type === "Unknown" && target.item.type !== "Unknown") {
        canonicalEntry.item.type = target.item.type;
      }

      if (canonicalEntry.item.content === "Base Game" && target.item.content !== "Base Game") {
        canonicalEntry.item.content = target.item.content;
      }

      canonicalEntry.item.dlc = canonicalEntry.item.dlc || target.item.dlc;
      canonicalEntry.item.manufacturers = unionSorted(
        canonicalEntry.item.manufacturers,
        target.item.manufacturers
      );
      canonicalEntry.item.rarities = unionSorted(
        canonicalEntry.item.rarities,
        target.item.rarities
      );

      addAlias(canonicalEntry.item, target.item.name);
      for (const alias of target.item.aliases ?? []) {
        addAlias(canonicalEntry.item, alias);
      }

      consumed.add(target.fileName);
      mergedFiles.push(target.fileName);

      await tryDelete(join(WEAPONS_DIR, target.fileName));
      await tryDelete(target.imagePath);
    }

    if (mergedFiles.length > 0) {
      await writeFile(
        join(WEAPONS_DIR, canonicalEntry.fileName),
        `${JSON.stringify(canonicalEntry.item, null, 2)}\n`,
        "utf-8"
      );
      mergeLogs.push({
        canonical: canonicalEntry.fileName,
        merged: mergedFiles,
        reason: "canonical merge by matching normalized identity/resources",
      });
    }

    if (blocked.length > 0) {
      skipLogs.push({
        files: available.map(entry => entry.fileName),
        reason: blocked.join("; "),
      });
    }
  }

  const report = {
    completedAt: new Date().toISOString(),
    groupsChecked: buildCandidateGroups(entries).length,
    mergedCount: mergeLogs.reduce((count, log) => count + log.merged.length, 0),
    merges: mergeLogs,
    skippedGroups: skipLogs,
  };

  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  console.log(
    [
      `Groups checked: ${report.groupsChecked}`,
      `Files merged: ${report.mergedCount}`,
      `Merge records: ${report.merges.length}`,
      `Skipped groups: ${report.skippedGroups.length}`,
      `Report: ${REPORT_PATH}`,
    ].join("\n")
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
