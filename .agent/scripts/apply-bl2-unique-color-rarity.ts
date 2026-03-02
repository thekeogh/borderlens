import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type Weapon = {
  name: string;
  rarities: string[];
  resources: {
    wiki?: string;
  };
  slug: string;
};

type Change = {
  file: string;
  name: string;
  old: string[];
  new: string[];
  wikiColor: string;
  wikiRarity: string;
};

const WIKI_API = 'https://borderlands.fandom.com/api.php';
const WEAPONS_DIR = join(process.cwd(), 'data/games/borderlands2/weapons');
const REPORT_PATH = join(process.cwd(), '.agent/bl2/weapons/unique-color-rarity-report.json');

function decode(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, d) => String.fromCodePoint(Number.parseInt(d, 10)))
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('\u00a0', ' ')
    .replaceAll('\u200b', '')
    .replaceAll('\u200d', '')
    .trim();
}

function stripTags(value: string): string {
  return decode(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function wikiTitleFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const queryTitle = parsed.searchParams.get('title');
    if (queryTitle) return decodeURIComponent(queryTitle).replaceAll('_', ' ');

    const pathMatch = parsed.pathname.match(/\/wiki\/(.+)$/);
    return pathMatch?.[1] ? decodeURIComponent(pathMatch[1]).replaceAll('_', ' ') : undefined;
  } catch {
    return undefined;
  }
}

function mapColorToRarity(color: string): string | undefined {
  const text = color.toLowerCase();

  if (text.includes('white') || text.includes('common')) return 'Common';
  if (text.includes('green') || text.includes('uncommon')) return 'Uncommon';
  if (text.includes('blue') || text.includes('rare')) return 'Rare';
  if (text.includes('purple') || text.includes('violet') || text.includes('epic') || text.includes('very rare')) return 'Epic';
  if (text.includes('cursed')) return 'Cursed';
  if (text.includes('gem')) return 'Gemstone';
  if (text.includes('e-tech') || text.includes('cyan') || text.includes('teal')) return 'E-tech';
  if (text.includes('legendary') || text.includes('orange') || text.includes('gold')) return 'Legendary';
  if (text.includes('effervescent') || text.includes('rainbow')) return 'Effervescent';
  if (text.includes('seraph') || text.includes('pink') || text.includes('magenta')) return 'Seraph';
  if (text.includes('pearl')) return 'Pearlescent';

  return undefined;
}

async function fetchWikiInfobox(wikiUrl: string): Promise<{ rarity?: string; color?: string }> {
  const title = wikiTitleFromUrl(wikiUrl);
  if (!title) return {};

  const params = new URLSearchParams({
    action: 'parse',
    format: 'json',
    formatversion: '2',
    page: title,
    prop: 'text',
    redirects: '1',
  });

  const response = await fetch(`${WIKI_API}?${params.toString()}`, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; BorderlensBot/1.0)',
    },
  });

  if (!response.ok) return {};
  const payload = await response.json() as { parse?: { text?: string } };
  const html = payload.parse?.text ?? '';

  const rarityRaw = html.match(/data-source="rarity"[\s\S]*?<div class="pi-data-value[^\"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  const colorRaw = html.match(/data-source="color"[\s\S]*?<div class="pi-data-value[^\"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1];

  const rarity = rarityRaw ? stripTags(rarityRaw) : undefined;
  const color = colorRaw ? stripTags(colorRaw) : undefined;

  return {
    color,
    rarity,
  };
}

async function main(): Promise<void> {
  const files = (await readdir(WEAPONS_DIR))
    .filter(name => name.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));

  let scanned = 0;
  let uniquePages = 0;
  let changed = 0;
  let skippedNoWiki = 0;
  let skippedNoColor = 0;
  let skippedUnmappedColor = 0;
  const changes: Change[] = [];

  for (const file of files) {
    const path = join(WEAPONS_DIR, file);
    const item = JSON.parse(await readFile(path, 'utf8')) as Weapon;

    scanned += 1;
    if (!item.resources.wiki) {
      skippedNoWiki += 1;
      continue;
    }

    const info = await fetchWikiInfobox(item.resources.wiki);
    const rarity = info.rarity ?? '';
    const color = info.color ?? '';

    if (!/\bunique\b/i.test(rarity)) {
      continue;
    }

    uniquePages += 1;

    if (!color) {
      skippedNoColor += 1;
      continue;
    }

    const mapped = mapColorToRarity(color);
    if (!mapped) {
      skippedUnmappedColor += 1;
      continue;
    }

    const next = [mapped];
    const old = item.rarities ?? [];
    if (JSON.stringify(old) === JSON.stringify(next)) {
      continue;
    }

    item.rarities = next;
    changed += 1;
    changes.push({
      file,
      name: item.name,
      new: next,
      old,
      wikiColor: color,
      wikiRarity: rarity,
    });

    await writeFile(path, `${JSON.stringify(item, null, 2)}\n`, 'utf8');
  }

  await mkdir(join(process.cwd(), '.agent/bl2/weapons'), { recursive: true });
  await writeFile(
    REPORT_PATH,
    `${JSON.stringify({
      changed,
      changes,
      completedAt: new Date().toISOString(),
      scanned,
      skippedNoColor,
      skippedNoWiki,
      skippedUnmappedColor,
      uniquePages,
    }, null, 2)}\n`,
    'utf8'
  );

  console.log([
    `Scanned: ${scanned}`,
    `Wiki Unique pages: ${uniquePages}`,
    `Changed: ${changed}`,
    `Skipped (no wiki): ${skippedNoWiki}`,
    `Skipped (unique but no color): ${skippedNoColor}`,
    `Skipped (unique with unmapped color): ${skippedUnmappedColor}`,
    `Report: ${REPORT_PATH}`,
  ].join('\n'));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
