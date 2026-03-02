import { readdir, readFile } from "node:fs/promises";
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
 * Validates all JSON files for a given game against the unified schema.
 *
 * @param game - The game identifier (e.g. borderlands).
 * @param quiet - Whether to suppress per-file output.
 * @returns The array of validated (category, slug) compound keys.
 */
async function validateGame(
  game: string,
  quiet: boolean
): Promise<Array<{ category: string; slug: string }>> {
  const gameDir = join(GAMES_DIR, game);
  const files = await findJsonFiles(gameDir);

  const keys: Array<{ category: string; slug: string }> = [];
  if (files.length === 0) return keys;

  if (!quiet) {
    console.log(style(`\nValidating ${game} (${files.length} files)...\n`, colors.cyan));
  }

  for (const file of files) {
    const filePath = join(gameDir, file);
    const fileContent = await readFile(filePath, "utf-8");

    let jsonData: unknown;
    try {
      jsonData = JSON.parse(fileContent);
    } catch (error) {
      console.error(style(`✗ ${game}/${file}`, colors.red));
      console.error(style(`  Invalid JSON: ${error instanceof Error ? error.message : String(error)}`, colors.red));
      process.exit(1);
    }

    const slug = typeof jsonData === "object" && jsonData !== null && "slug" in jsonData
      ? String(jsonData.slug)
      : file.replace(/\.json$/, "").split("/").pop() ?? file;

    const result = Schema.safeParse(jsonData);

    if (!result.success) {
      console.error(style(`✗ ${game}/${file}`, colors.red));
      if (slug && slug !== file.replace(/\.json$/, "").split("/").pop()) {
        console.error(style(`  Slug: ${slug}`, colors.yellow));
      }
      console.error(style("  Validation failed:", colors.red));
      result.error.issues.forEach(issue => {
        const path = issue.path.join(".");
        console.error(style(`    - ${path}: ${issue.message}`, colors.red));
      });
      process.exit(1);
    }

    const category =
      typeof result.data === "object" &&
        result.data !== null &&
        "category" in result.data
        ? String((result.data as { category: string }).category)
        : file.split("/")[0] ?? "unknown";

    keys.push({ category, slug });

    if (!quiet) {
      console.log(style(`✓ ${game}/${file}`, colors.green));
    }
  }

  return keys;
}

/**
 * Validates all item JSON files across all games in data/games.
 * Ensures no duplicate (category, slug) compound keys exist within each game.
 */
async function validateItems(): Promise<void> {
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

  let totalItems = 0;

  for (const game of gameDirs) {
    const keys = await validateGame(game, quiet);

    const seen = new Set<string>();
    for (const { category, slug } of keys) {
      const key = `${category}/${slug}`;
      if (seen.has(key)) {
        console.error(style(`\n✗ Duplicate compound key (category/slug) in ${game}: ${category}/${slug}`, colors.red));
        process.exit(1);
      }
      seen.add(key);
    }

    totalItems += keys.length;
  }

  if (totalItems === 0) {
    console.log(style("\nNo item files found to validate.\n", colors.yellow));
    return;
  }

  if (quiet) {
    console.log(style(`✓ Successfully validated ${totalItems} items across ${gameDirs.length} game(s)`, colors.green));
  } else {
    console.log(style(`\n✓ All ${totalItems} item files validated successfully!\n`, colors.green + colors.bold));
  }
}

validateItems().catch(error => {
  console.error(style(`\n✗ Unexpected error: ${error instanceof Error ? error.message : String(error)}\n`, colors.red));
  process.exit(1);
});
