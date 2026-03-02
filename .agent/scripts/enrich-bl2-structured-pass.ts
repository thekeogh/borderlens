import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const WIKI_API = 'https://borderlands.fandom.com/api.php';
const WEAPONS_DIR = join(process.cwd(), 'data/games/borderlands2/weapons');

type Weapon = {
  content: string;
  description: string;
  elements?: string[];
  name: string;
  notes?: string;
  rarities: string[];
  resources: { lootlemon?: string; wiki?: string };
  slug: string;
  sources?: Array<{name:string;tags:string[]}>;
  special?: {title?: string; description: string};
};

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

function clean(html: string): string {
  return decode(
    html
      .replace(/<table[^>]*class="[^"]*navbox[^"]*"[^>]*>[\s\S]*?<\/table>/gi, ' ')
      .replace(/<div[^>]*class="[^"]*navbox[^"]*"[^>]*>[\s\S]*?<\/div>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\[[0-9]+\]/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\s+\n/g, '\n')
      .replace(/\n\s+/g, '\n')
      .trim()
  );
}

function wikiTitle(url: string): string | undefined {
  try {
    const u = new URL(url);
    const q = u.searchParams.get('title');
    if (q) return decodeURIComponent(q).replaceAll('_', ' ');
    const m = u.pathname.match(/\/wiki\/(.+)$/);
    return m ? decodeURIComponent(m[1]).replaceAll('_', ' ') : undefined;
  } catch {
    return undefined;
  }
}

function parseSections(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const headers: Array<{id:string;start:number;end:number}> = [];
  const re = /<h2[^>]*>[\s\S]*?<span class="mw-headline" id="([^"]+)"[^>]*>[\s\S]*?<\/span>[\s\S]*?<\/h2>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    headers.push({ id: m[1], start: m.index, end: re.lastIndex });
  }
  for (let i = 0; i < headers.length; i += 1) {
    const cur = headers[i];
    const next = headers[i + 1];
    const raw = html.slice(cur.end, next ? next.start : html.length);
    const text = clean(raw);
    if (text) out[cur.id] = text;
  }
  return out;
}

function parseInfobox(html: string): Record<string, string> {
  const info: Record<string, string> = {};
  const re = /<div[^>]*data-source="([^"]+)"[^>]*>[\s\S]*?<div class="pi-data-value[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/div>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    info[m[1].toLowerCase()] = clean(m[2]);
  }
  return info;
}

function toElements(raw: string | undefined): string[] {
  if (!raw) return [];
  const t = raw.toLowerCase();
  const out: string[] = [];
  if (/(shock)/.test(t)) out.push('Shock');
  if (/(incendiary|fire)/.test(t)) out.push('Incendiary');
  if (/(corrosive)/.test(t)) out.push('Corrosive');
  if (/(slag)/.test(t)) out.push('Slag');
  if (/(explosive)/.test(t)) out.push('Explosive');
  return [...new Set(out)];
}

function mapColorToRarity(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const t = raw.toLowerCase();
  if (t.includes('white') || t.includes('common')) return 'Common';
  if (t.includes('green') || t.includes('uncommon')) return 'Uncommon';
  if (t.includes('blue') || t.includes('rare')) return 'Rare';
  if (t.includes('purple') || t.includes('violet') || t.includes('epic') || t.includes('very rare')) return 'Epic';
  if (t.includes('cursed')) return 'Cursed';
  if (t.includes('gem')) return 'Gemstone';
  if (t.includes('e-tech') || t.includes('cyan') || t.includes('teal')) return 'E-tech';
  if (t.includes('legendary') || t.includes('orange') || t.includes('gold')) return 'Legendary';
  if (t.includes('effervescent') || t.includes('rainbow')) return 'Effervescent';
  if (t.includes('seraph') || t.includes('pink') || t.includes('magenta')) return 'Seraph';
  if (t.includes('pearl')) return 'Pearlescent';
  return undefined;
}

function firstSentences(text: string | undefined, max = 2): string {
  if (!text) return '';
  const s = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(v => v.trim())
    .filter(v => v.length > 30)
    .filter(v => !/borderlands wiki|fandom|v\s*•\s*d\s*•\s*e/i.test(v));
  return s.slice(0, max).join(' ').trim();
}

function cap(text: string, max = 510): string {
  if (text.length <= max) return text;
  const c = text.slice(0, max);
  const i = Math.max(c.lastIndexOf('.'), c.lastIndexOf(';'));
  if (i > 120) return `${c.slice(0, i + 1).trim()}`;
  return `${c.trimEnd()}...`;
}

function cleanNarrative(text: string | undefined, name: string): string | undefined {
  if (!text) return undefined;
  let out = text
    .replace(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'g'), 'this weapon')
    .replace(/\bThe this weapon\b/g, 'This weapon')
    .replace(/\bthe this weapon\b/g, 'this weapon')
    .replace(/\s+/g, ' ')
    .trim();
  out = out.replace(/^[-•]\s*/, '');
  return cap(out);
}

async function fetchWiki(wikiUrl: string): Promise<{infobox: Record<string, string>; sections: Record<string, string>; figcaption?: string}> {
  const title = wikiTitle(wikiUrl);
  if (!title) throw new Error(`No wiki title for ${wikiUrl}`);
  const params = new URLSearchParams({ action: 'parse', format: 'json', formatversion: '2', page: title, prop: 'text', redirects: '1' });
  const res = await fetch(`${WIKI_API}?${params.toString()}`, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; BorderlensBot/1.0)' } });
  if (!res.ok) throw new Error(`Wiki parse failed ${res.status}`);
  const payload = await res.json() as { parse?: { text?: string } };
  const html = payload.parse?.text ?? '';
  const figcaption = clean(html.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? '');
  return { infobox: parseInfobox(html), sections: parseSections(html), figcaption: figcaption || undefined };
}

async function main(): Promise<void> {
  const files = (await readdir(WEAPONS_DIR)).filter(f => f.endsWith('.json')).sort();
  let changed = 0;

  for (const file of files) {
    const path = join(WEAPONS_DIR, file);
    const item = JSON.parse(await readFile(path, 'utf8')) as Weapon;
    if (!item.resources.wiki) continue;

    const wiki = await fetchWiki(item.resources.wiki);
    const updates: string[] = [];

    if (!item.elements || item.elements.length === 0) {
      const elems = toElements(wiki.infobox.element || wiki.infobox.elements);
      if (elems.length > 0) {
        item.elements = elems;
        updates.push('elements');
      }
    }

    // Wiki rule: if infobox rarity is Unique, use infobox color as the canonical single rarity.
    const wikiRarity = (wiki.infobox.rarity ?? '').toLowerCase();
    if (wikiRarity.includes('unique')) {
      const mapped = mapColorToRarity(wiki.infobox.color);
      if (mapped) {
        const next = [mapped];
        if (JSON.stringify(item.rarities) !== JSON.stringify(next)) {
          item.rarities = next;
          updates.push('rarities');
        }
      }
    }

    if (!item.sources || item.sources.length === 0) {
      const mission = wiki.infobox.mission;
      const usage = (wiki.sections['Usage_&amp;_Description'] || wiki.sections['Usage_Description'] || '').toLowerCase();
      const notes = (wiki.sections.Notes || '').toLowerCase();
      if (mission) {
        item.sources = [{ name: mission, tags: ['Mission', 'Quest Reward'] }];
      } else if (usage.includes('obtained randomly from any suitable loot source') || notes.includes('obtained randomly from any suitable loot source')) {
        item.sources = [{ name: 'World Drop', tags: ['General', 'Any suitable loot source'] }];
      } else {
        item.sources = [{ name: 'World Drop', tags: ['General'] }];
      }
      updates.push('sources');
    }

    if ((!item.notes || !item.notes.trim())) {
      const noteRaw = firstSentences(wiki.sections.Notes, 2) || firstSentences(wiki.sections['Usage_&amp;_Description'] || wiki.sections['Usage_Description'], 1);
      if (noteRaw) {
        item.notes = cleanNarrative(noteRaw, item.name);
        updates.push('notes');
      }
    }

    if ((!item.special || !item.special.description) && wiki.sections['Special_Weapon_Effects']) {
      const specialRaw = firstSentences(wiki.sections['Special_Weapon_Effects'], 2);
      if (specialRaw) {
        const existingTitle = item.special?.title;
        const fig = wiki.figcaption;
        item.special = {
          ...(existingTitle ? { title: existingTitle } : (fig ? { title: fig } : {})),
          description: cleanNarrative(specialRaw, item.name) as string,
        };
        updates.push('special');
      }
    }

    // Cleanup lingering synthetic phrase artifacts.
    const descClean = cleanNarrative(item.description, item.name);
    if (descClean && descClean !== item.description) {
      item.description = descClean;
      updates.push('description');
    }
    if (item.notes) {
      const notesClean = cleanNarrative(item.notes, item.name);
      if (notesClean && notesClean !== item.notes) {
        item.notes = notesClean;
        updates.push('notes-clean');
      }
    }
    if (item.special?.description) {
      const specialClean = cleanNarrative(item.special.description, item.name);
      if (specialClean && specialClean !== item.special.description) {
        item.special.description = specialClean;
        updates.push('special-clean');
      }
    }

    if (updates.length > 0) {
      changed += 1;
      await writeFile(path, `${JSON.stringify(item, null, 2)}\n`, 'utf8');
    }
  }

  console.log(`Structured pass changed ${changed} files.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
