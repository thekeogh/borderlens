import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Schema } from "#database/schema";

/**
 * ANSI color codes for terminal output.
 */
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

const GAMES_DIR = join(process.cwd(), "data/games");
const DATABASE_DIR = join(process.cwd(), "src/database");

/** Top-level item keys in schema order for consistent output. */
const ITEM_KEYS = [
  "game", "category", "content", "dlc", "image", "resources", "name", "aliases",
  "slug", "type", "description", "skills", "notes", "abilities", "manufacturers",
  "elements", "rarities", "special", "ranges", "parts", "max", "sources",
] as const;

/**
 * Rounds a number to minimal precision, stripping floating-point noise.
 */
function roundNum(n: number): number {
  const fixed = parseFloat(n.toFixed(10));
  return Number.isInteger(fixed) ? Math.round(fixed) : fixed;
}

/**
 * Returns true if the value should be omitted (falsy per user preference).
 */
function isOmittable(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value as object).length === 0) return true;
  if (value === "") return true;
  return false;
}

/**
 * Recursively optimises an item: omits falsy values, rounds numbers, applies consistent key order.
 *
 * @param obj - The value to optimise.
 * @param isRoot - Whether this is the root item (uses schema key order).
 */
function optimiseItem(obj: unknown, isRoot = false): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "number") return roundNum(obj);
  if (typeof obj === "string" || typeof obj === "boolean") return obj;

  if (Array.isArray(obj)) {
    return obj.map(v => optimiseItem(v, false)).filter(v => !isOmittable(v));
  }

  if (typeof obj === "object") {
    const record = obj as Record<string, unknown>;
    const keys = Object.keys(record).filter(k => !isOmittable(record[k]));
    const orderedKeys = isRoot
      ? [...ITEM_KEYS].filter(k => keys.includes(k))
      : [...keys].sort();
    const result: Record<string, unknown> = {};
    for (const k of orderedKeys) {
      const v = optimiseItem(record[k], false);
      if (!isOmittable(v)) result[k] = v;
    }
    return result;
  }

  return obj;
}

/**
 * Applies color styling to text.
 *
 * @param text - The text to style.
 * @param color - The color to apply.
 * @returns The styled text.
 */
function style(text: string, color: string): string {
  return `${color}${text}${colors.reset}`;
}

/**
 * Recursively finds all JSON file paths within a directory.
 *
 * @param dir - The directory to search.
 * @returns The array of relative paths to JSON files.
 */
async function findJsonFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true });
  return entries
    .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".json"))
    .sort();
}

/**
 * Bundles all validated items for a given game into an array.
 *
 * @param game - The game identifier (e.g. borderlands).
 * @param quiet - Whether to suppress per-file output.
 * @returns The array of validated item schemas.
 */
async function bundleGame(game: string, quiet: boolean): Promise<unknown[]> {
  const gameDir = join(GAMES_DIR, game);
  const files = await findJsonFiles(gameDir);

  const items: unknown[] = [];
  if (files.length === 0) return items;

  if (!quiet) {
    console.log(style(`\nBundling ${game} (${files.length} files)...\n`, colors.cyan));
  }

  for (const file of files) {
    const filePath = join(gameDir, file);
    const fileContent = await readFile(filePath, "utf-8");

    let jsonData: unknown;
    try {
      jsonData = JSON.parse(fileContent);
    } catch (error) {
      console.error(style(`✗ ${game}/${file} - Invalid JSON: ${error instanceof Error ? error.message : String(error)}`, colors.red));
      process.exit(1);
    }

    const result = Schema.safeParse(jsonData);
    if (!result.success) {
      console.error(style(`✗ ${game}/${file} - Validation failed:`, colors.red));
      result.error.issues.forEach(issue => {
        const path = issue.path.join(".");
        console.error(style(`    - ${path}: ${issue.message}`, colors.red));
      });
      process.exit(1);
    }

    const slug = typeof jsonData === "object" && jsonData !== null && "slug" in jsonData
      ? String(jsonData.slug)
      : file.replace(/\.json$/, "").split("/").pop() ?? file;

    if (!slug) {
      console.error(style(`✗ ${game}/${file} - Missing slug`, colors.red));
      process.exit(1);
    }

    items.push(optimiseItem(jsonData, true));
    if (!quiet) {
      console.log(style(`✓ ${game}/${file} → ${slug}`, colors.green));
    }
  }

  return items;
}

/**
 * Bundles all item JSON files across all games into a single database.json.
 * Output is written to src/database/database.json.
 */
async function bundleItems(): Promise<void> {
  const quiet = process.argv.includes("--quiet") || process.argv.includes("-q");

  let gameDirs: string[];
  try {
    const entries = await readdir(GAMES_DIR, { withFileTypes: true });
    gameDirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
  } catch {
    console.log(style("\nNo games directory found.\n", colors.yellow));
    return;
  }

  if (gameDirs.length === 0) {
    console.log(style("\nNo game folders found in data/games.\n", colors.yellow));
    return;
  }

  const allItems: unknown[] = [];

  for (const game of gameDirs) {
    const items = await bundleGame(game, quiet);
    allItems.push(...items);
  }

  if (allItems.length === 0) {
    console.log(style("\nNo item files found to bundle.\n", colors.yellow));
    return;
  }

  const outputPath = join(DATABASE_DIR, "database.json");
  const outputContent = JSON.stringify(allItems);
  await writeFile(outputPath, outputContent, "utf-8");

  const bytes = Buffer.byteLength(outputContent, "utf-8");
  const mb = (bytes / 1000 / 1000).toFixed(2);
  const sizeStr = `${mb}MB (${bytes}B)`;

  if (quiet) {
    console.log(style(`✓ Bundled ${allItems.length} items`, colors.green));
    console.log(style(`  ${sizeStr}`, colors.cyan));
  } else {
    console.log(style(`  → ${outputPath}`, colors.cyan));
    console.log(style(`\n✓ Bundled ${allItems.length} items into src/database/database.json`, colors.green + colors.bold));
    console.log(style(`  ${sizeStr}\n`, colors.cyan));
  }
}

bundleItems().catch(error => {
  console.error(style(`\n✗ Unexpected error: ${error instanceof Error ? error.message : String(error)}\n`, colors.red));
  process.exit(1);
});
