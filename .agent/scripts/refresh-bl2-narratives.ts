import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type Weapon = {
  content: string;
  description: string;
  elements?: string[];
  manufacturers: string[];
  name: string;
  notes?: string;
  rarities: string[];
  slug: string;
  sources?: Array<{name:string;tags:string[]}>;
  special?: {title?: string; description: string};
  type: string;
};

const DIR = join(process.cwd(), 'data/games/borderlands2/weapons');

const GENERIC = [
  'Critical hits are a core part of this weapon\'s payoff.',
  'Handling trends favor reliable shot placement.',
  'Recoil behaviour is tuned for steadier follow-up shots.',
  'Its damage profile includes explosive or splash-style output.',
  'Reload behaviour is a major part of how this weapon converts damage.',
  'Elemental/status pressure is part of its practical strength.',
  'Magazine behaviour is relevant to sustained uptime.',
];

function titleCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function cap(text: string, max = 510): string {
  const value = text.replace(/\s+/g, ' ').trim();
  if (value.length <= max) return value;
  const slice = value.slice(0, max);
  const cut = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf(';'));
  if (cut > 120) return slice.slice(0, cut + 1).trim();
  return `${slice.trimEnd()}...`;
}

function formatContent(content: string): string {
  return content === 'Base Game' ? 'the base game' : content;
}

function inferMechanic(item: Weapon): string | undefined {
  const blob = [item.description, item.special?.description, item.notes]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/lifesteal|heal/.test(blob)) return 'It provides sustain utility while dealing damage.';
  if (/ignore enemy shields|penetrate.*shield|shield/.test(blob)) return 'Its effect interacts strongly with shields, making it valuable against protected targets.';
  if (/ammo regeneration|regenerat/.test(blob)) return 'It adds ammo-economy utility that helps longer engagements.';
  if (/reload|thrown|tediore/.test(blob)) return 'Its unique behaviour is tied to reload handling and thrown-weapon interactions.';
  if (/explode|splash|rocket|launcher|harpoon/.test(blob)) return 'It emphasizes splash-heavy burst damage and rewards deliberate impact placement.';
  if (/critical|crit/.test(blob)) return 'Its performance improves noticeably when built around precision critical hits.';
  if (/accuracy|recoil/.test(blob)) return 'Its handling profile favors controlled fire over raw spray output.';
  if (/element|incendiary|corrosive|shock|slag/.test(blob)) return 'Its damage profile leans heavily on elemental application and status pressure.';
  return undefined;
}

function makeDescription(item: Weapon): string {
  const rarity = (item.rarities[0] || 'Unknown').toLowerCase();
  const manufacturer = item.manufacturers[0] || 'Unknown';
  const type = item.type.toLowerCase();
  const content = formatContent(item.content);

  const sentences: string[] = [];
  sentences.push(`${item.name} is a ${rarity} ${manufacturer} ${type} from ${content}.`);

  const mechanic = inferMechanic(item);
  if (mechanic) sentences.push(mechanic);

  const elements = item.elements ?? [];
  if (elements.length === 1) {
    sentences.push(`It is fixed to ${elements[0].toLowerCase()} damage.`);
  } else if (elements.length > 1 && elements.length <= 5) {
    sentences.push(`It can roll with ${elements.map(v => v.toLowerCase()).join(', ')} damage variants.`);
  }

  return cap(sentences.join(' '));
}

function cleanText(text: string, name: string): string {
  let out = text
    .replace(/\bthis weapon\b/gi, name)
    .replace(/\bThe\s+The\b/g, 'The')
    .replace(/\s+/g, ' ')
    .replace(/^[-•]\s*/, '')
    .trim();
  out = out.replace(new RegExp(`\b${name}\s+${name}\b`, 'g'), name);
  return cap(out);
}

function rewriteNotes(item: Weapon): string | undefined {
  const source = item.sources?.[0];
  let notes = item.notes?.trim() || '';

  if (!notes || /obtained randomly from any suitable loot source/i.test(notes)) {
    if (source?.name && source.name !== 'World Drop') {
      return `Primary acquisition is tied to ${source.name}${source.tags?.length ? ` (${source.tags.join(', ')})` : ''}.`;
    }
    return 'Typically obtained from general world-drop loot sources.';
  }

  notes = cleanText(notes, item.name);
  if (notes.toLowerCase() === item.description.toLowerCase()) {
    return source?.name && source.name !== 'World Drop'
      ? `Primary acquisition is tied to ${source.name}.`
      : 'Typically obtained from general world-drop loot sources.';
  }
  return notes;
}

function rewriteSpecial(item: Weapon): {title?: string; description: string} | undefined {
  if (!item.special?.description) return undefined;
  let text = item.special.description;

  for (const phrase of GENERIC) {
    text = text.replace(phrase, '').trim();
  }

  const blob = [text, item.description, item.notes].join(' ').toLowerCase();
  const pieces: string[] = [];

  if (/reload|thrown|tediore/.test(blob)) pieces.push('Its special behaviour modifies reload interactions for burst damage or utility.');
  if (/lifesteal|heal/.test(blob)) pieces.push('While equipped, it grants a direct sustain effect from dealt damage.');
  if (/shield|penetrate/.test(blob)) pieces.push('Its effect alters shield interaction, allowing more reliable pressure through defenses.');
  if (/ammo regeneration|regenerat/.test(blob)) pieces.push('It also adds passive ammo utility while held.');
  if (/rocket|explode|splash|harpoon/.test(blob)) pieces.push('Projectiles and impact behaviour are tuned for explosive splash output.');
  if (/critical|crit/.test(blob)) pieces.push('It includes a notable critical-damage modifier.');

  let description = cleanText(text, item.name);
  if (!description || description.length < 45) {
    description = cap(pieces.slice(0, 2).join(' '));
  }
  if (!description || description.length < 45) return undefined;

  return {
    ...(item.special.title ? { title: item.special.title } : {}),
    description,
  };
}

async function main(): Promise<void> {
  const files = (await readdir(DIR)).filter(f => f.endsWith('.json')).sort();
  let changed = 0;

  for (const file of files) {
    const path = join(DIR, file);
    const item = JSON.parse(await readFile(path, 'utf8')) as Weapon;
    const before = JSON.stringify(item);

    const needsDescRewrite =
      /^this weapon is\b/i.test(item.description)
      || GENERIC.some(phrase => item.description.includes(phrase));

    if (needsDescRewrite) {
      item.description = makeDescription(item);
    } else {
      item.description = cleanText(item.description, item.name);
      if (/^this weapon is\b/i.test(item.description)) {
        item.description = `${item.name}${item.description.slice('this weapon'.length)}`;
        item.description = titleCase(item.description);
      }
      item.description = cap(item.description);
    }

    const rewrittenNotes = rewriteNotes(item);
    if (rewrittenNotes) item.notes = rewrittenNotes;

    const rewrittenSpecial = rewriteSpecial(item);
    if (rewrittenSpecial) item.special = rewrittenSpecial;

    if (item.special?.description) {
      item.special.description = cleanText(item.special.description, item.name);
    }
    if (item.notes) {
      item.notes = cleanText(item.notes, item.name);
    }

    const after = JSON.stringify(item);
    if (before !== after) {
      changed += 1;
      await writeFile(path, `${JSON.stringify(item, null, 2)}\n`, 'utf8');
    }
  }

  console.log(`Narrative refresh changed ${changed} files.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
