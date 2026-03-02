import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

type Element = "Incendiary" | "Corrosive" | "Shock" | "Explosive" | "Slag";

type SourceEntry = {
  name: string;
  tags: string[];
};

type SpecialEntry = {
  description: string;
  title?: string;
};

type WeaponItem = {
  aliases?: string[];
  category: "weapons";
  content: string;
  description: string;
  dlc: boolean;
  elements?: Element[];
  image: string;
  manufacturers: string[];
  name: string;
  notes?: string;
  parts?: Record<string, unknown>;
  rarities: string[];
  resources: {
    lootlemon?: string;
    wiki?: string;
  };
  slug: string;
  sources?: SourceEntry[];
  special?: SpecialEntry;
  type: string;
};

type LootlemonData = {
  aboutText?: string;
  content?: string;
  elements: Element[];
  manufacturer?: string;
  rarity?: string;
  sources: SourceEntry[];
  specialDescription?: string;
  specialTitle?: string;
  type?: string;
};

type WikiData = {
  color?: string;
  elements: Element[];
  manufacturer?: string;
  notesSection?: string;
  rarity?: string;
  specialSection?: string;
  specialTitle?: string;
  type?: string;
  usageSection?: string;
};

type ReportEntry = {
  changed: string[];
  file: string;
  name: string;
  skippedReason?: string;
};

type Report = {
  completedAt: string;
  entries: ReportEntry[];
  limit: number;
  offset: number;
  processed: number;
  updated: number;
};

const WEAPONS_DIR = join(process.cwd(), "data/games/borderlands2/weapons");
const REPORT_DIR = join(process.cwd(), ".agent/bl2/weapons");

const USER_AGENT = "Mozilla/5.0 (compatible; BorderlensBot/1.0)";
const WIKI_API_URL = "https://borderlands.fandom.com/api.php";

const MANUFACTURERS = [
  "Anshin",
  "Atlas",
  "Bandit",
  "Dahl",
  "Eridian",
  "Gearbox",
  "Hyperion",
  "Jakobs",
  "Maliwan",
  "Pangolin",
  "Scav",
  "S&S Munitions",
  "Tediore",
  "Torgue",
  "Vladof",
] as const;

const CONTENT_VALUES = [
  "Base Game",
  "Mechromancer Pack",
  "Psycho Pack",
  "Collector's Edition Pack",
  "Premiere Club",
  "Captain Scarlett and Her Pirate's Booty",
  "Mr. Torgue's Campaign of Carnage",
  "Sir Hammerlock's Big Game Hunt",
  "Tiny Tina's Assault on Dragon Keep",
  "Creature Slaughterdome",
  "Ultimate Vault Hunter Upgrade Pack",
  "Ultimate Vault Hunter Upgrade Pack Two: Digistruct Peak Challenge",
  "T.K. Baha's Bloody Harvest",
  "The Horrible Hunger of the Ravenous Wattle Gobbler",
  "How Marcus Saved Mercenary Day",
  "Mad Moxxi and the Wedding Day Massacre",
  "Sir Hammerlock vs. the Son of Crawmerax",
  "Commander Lilith & the Fight for Sanctuary",
] as const;

function decodeHtml(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&nbsp;", " ")
    .replaceAll("\u00a0", " ")
    .replaceAll("\u200d", "")
    .replaceAll("\u200b", "")
    .trim();
}

function stripTags(html: string): string {
  const withoutNav = html
    .replace(/<table[^>]*class="[^"]*navbox[^"]*"[^>]*>[\s\S]*?<\/table>/gi, " ")
    .replace(/<div[^>]*class="[^"]*navbox[^"]*"[^>]*>[\s\S]*?<\/div>/gi, " ")
    .replace(/<div[^>]*class="[^"]*(?:reflist|hatnote)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, " ");

  return decodeHtml(
    withoutNav
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\[[0-9]+\]/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s*\n\s*/g, "\n")
      .trim()
  );
}

function cleanText(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = stripTags(value).replace(/\s+/g, " ").trim();
  return cleaned || undefined;
}

function splitSentences(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.!?;])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 20)
    .filter(sentence => !/\bv\s*•\s*d\s*•\s*e\b/i.test(sentence))
    .filter(sentence => (sentence.match(/•/g)?.length ?? 0) < 2)
    .filter(sentence => !/borderlands wiki|fandom/i.test(sentence));
}

function rewriteSentence(sentence: string, name: string): string {
  let value = sentence;

  const namePattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "gi");
  value = value.replace(namePattern, "This weapon");

  const replacements: Array<[RegExp, string]> = [
    [/\bis manufactured by\b/gi, "comes from"],
    [/\bcomes from\b/gi, "belongs to"],
    [/\bdeals\b/gi, "inflicts"],
    [/\bhas\b/gi, "offers"],
    [/\bdoes have\b/gi, "offers"],
    [/\btrue strength lies in\b/gi, "main strength is"],
    [/\bnoticeably\b/gi, "consistently"],
  ];

  for (const [pattern, replacement] of replacements) {
    value = value.replace(pattern, replacement);
  }

  return value
    .replace(/\bThe This weapon\b/g, "This weapon")
    .replace(/\bthe This weapon\b/g, "this weapon")
    .replace(/\s+/g, " ")
    .trim();
}

function sentencePool(name: string, ...sources: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const source of sources) {
    for (const sentence of splitSentences(source)) {
      const rewritten = rewriteSentence(sentence, name);
      const key = rewritten.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(rewritten);
    }
  }

  return out;
}

function collectSignals(...sources: Array<string | undefined>): {
  lines: string[];
  numbers: string[];
} {
  const raw = sources.filter(Boolean).join(" ");
  const text = raw.toLowerCase();
  const lines: string[] = [];

  if (/\bcritical\b/.test(text)) lines.push("Critical hits are a core part of this weapon's payoff.");
  if (/\baccuracy|accurate|spread\b/.test(text)) lines.push("Handling trends favor reliable shot placement.");
  if (/\brecoil\b/.test(text)) lines.push("Recoil behavior is tuned for steadier follow-up shots.");
  if (/\bsplash|explod|aoe|area damage\b/.test(text)) lines.push("Its damage profile includes explosive or splash-style output.");
  if (/\breload|thrown|tediore\b/.test(text)) lines.push("Reload behavior is a major part of how this weapon converts damage.");
  if (/\belement|status|ignite|shock|corrosive|slag|incendiary\b/.test(text)) {
    lines.push("Elemental/status pressure is part of its practical strength.");
  }
  if (/\bpellet\b/.test(text)) lines.push("Pellet behavior influences close-range burst consistency.");
  if (/\bprojectile speed\b/.test(text)) lines.push("Projectile travel characteristics are notably modified.");
  if (/\bmag(?:azine)?\b/.test(text)) lines.push("Magazine behavior is relevant to sustained uptime.");
  if (/\bpatch|hotfix|updated|buff|nerf\b/.test(text)) lines.push("It has seen balance changes over time.");

  const numberMatches = [...raw.matchAll(/\b\d+(?:\.\d+)?(?:%|x|s)?\b/gi)]
    .map(match => match[0]);
  const numbers = [...new Set(numberMatches)].slice(0, 5);

  return {
    lines: [...new Set(lines)].slice(0, 3),
    numbers,
  };
}

function capText(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const capped = text.slice(0, limit);
  const lastBoundary = Math.max(capped.lastIndexOf("."), capped.lastIndexOf(";"), capped.lastIndexOf(","));
  if (lastBoundary > 120) {
    return `${capped.slice(0, lastBoundary).trim()}.`;
  }
  return `${capped.trimEnd()}...`;
}

function normalizeType(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const value = raw.toLowerCase();
  if (value.includes("submachine") || value.includes("smg")) return "SMG";
  if (value.includes("assault")) return "Assault Rifle";
  if (value.includes("shotgun")) return "Shotgun";
  if (value.includes("sniper")) return "Sniper";
  if (value.includes("rocket") || value.includes("launcher")) return "Launcher";
  if (value.includes("machine pistol") || value.includes("pistol")) return "Pistol";
  if (value.includes("revolver")) return "Revolver";
  if (value.includes("repeater")) return "Repeater";
  return undefined;
}

function normalizeManufacturer(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/\s+/g, " ").trim();
  for (const name of MANUFACTURERS) {
    if (cleaned.toLowerCase() === name.toLowerCase()) return name;
    if (cleaned.toLowerCase().includes(name.toLowerCase())) return name;
  }
  if (cleaned.toLowerCase() === "s and s munitions") return "S&S Munitions";
  return undefined;
}

function normalizeContent(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const text = raw.toLowerCase();

  if (text.includes("base game")) return "Base Game";
  if (text.includes("captain scarlett")) return "Captain Scarlett and Her Pirate's Booty";
  if (text.includes("campaign of carnage") || text.includes("mr. torgue")) return "Mr. Torgue's Campaign of Carnage";
  if (text.includes("big game hunt") || text.includes("sir hammerlock's big game hunt")) return "Sir Hammerlock's Big Game Hunt";
  if (text.includes("dragon keep")) return "Tiny Tina's Assault on Dragon Keep";
  if (text.includes("creature slaughterdome")) return "Creature Slaughterdome";
  if (text.includes("ultimate vault hunter upgrade pack two") || text.includes("digistruct peak")) {
    return "Ultimate Vault Hunter Upgrade Pack Two: Digistruct Peak Challenge";
  }
  if (text.includes("ultimate vault hunter upgrade pack")) return "Ultimate Vault Hunter Upgrade Pack";
  if (text.includes("fight for sanctuary") || text.includes("commander lilith")) {
    return "Commander Lilith & the Fight for Sanctuary";
  }
  if (text.includes("t.k. baha")) return "T.K. Baha's Bloody Harvest";
  if (text.includes("wattle gobbler")) return "The Horrible Hunger of the Ravenous Wattle Gobbler";
  if (text.includes("mercenary day")) return "How Marcus Saved Mercenary Day";
  if (text.includes("wedding day massacre")) return "Mad Moxxi and the Wedding Day Massacre";
  if (text.includes("son of crawmerax")) return "Sir Hammerlock vs. the Son of Crawmerax";
  if (text.includes("mechromancer")) return "Mechromancer Pack";
  if (text.includes("psycho pack")) return "Psycho Pack";
  if (text.includes("collector") && text.includes("edition")) return "Collector's Edition Pack";
  if (text.includes("premiere club")) return "Premiere Club";

  for (const value of CONTENT_VALUES) {
    if (text.includes(value.toLowerCase())) return value;
  }

  return undefined;
}

function normalizeElement(raw: string | undefined): Element | undefined {
  if (!raw) return undefined;
  const value = raw.toLowerCase();
  if (value.includes("non-elemental")) return undefined;
  if (value.includes("fire") || value.includes("incendiary")) return "Incendiary";
  if (value.includes("corrosive")) return "Corrosive";
  if (value.includes("shock")) return "Shock";
  if (value.includes("explosive") || value.includes("blast")) return "Explosive";
  if (value.includes("slag")) return "Slag";
  return undefined;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }

  return response.text();
}

async function fetchWikiHtml(wikiUrl: string): Promise<string> {
  const title = wikiTitleFromUrl(wikiUrl);
  if (!title) throw new Error(`Unable to derive wiki title from ${wikiUrl}`);

  const params = new URLSearchParams({
    action: "parse",
    format: "json",
    formatversion: "2",
    page: title,
    prop: "text",
    redirects: "1",
  });

  const payloadText = await fetchText(`${WIKI_API_URL}?${params.toString()}`);
  const payload = JSON.parse(payloadText) as {
    error?: { info?: string };
    parse?: { text?: string };
  };

  if (payload.error?.info) {
    throw new Error(payload.error.info);
  }

  if (!payload.parse?.text) {
    throw new Error(`Missing wiki parse HTML for ${wikiUrl}`);
  }

  return payload.parse.text;
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

function parseWikiSections(html: string): Record<string, string> {
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
    const rawSlice = html.slice(current.end, next ? next.index : html.length);
    const raw = rawSlice
      .replace(/<table[^>]*class="[^"]*navbox[^"]*"[^>]*>[\s\S]*?<\/table>/gi, " ")
      .replace(/<div[^>]*class="[^"]*navbox[^"]*"[^>]*>[\s\S]*?<\/div>/gi, " ");
    const text = cleanText(raw);
    if (!text) continue;
    out[current.id] = text;
  }

  return out;
}

function parseWikiData(html: string): WikiData {
  const info: Record<string, string> = {};
  const valueRegex = /<div[^>]*data-source="([^"]+)"[^>]*>[\s\S]*?<div class="pi-data-value[^\"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<\/div>/gi;
  let match: RegExpExecArray | null;
  while ((match = valueRegex.exec(html)) !== null) {
    info[match[1].toLowerCase()] = cleanText(match[2]) ?? "";
  }

  const sectionMap = parseWikiSections(html);

  const specialId = Object.keys(sectionMap).find(key => key.toLowerCase().includes("special_weapon_effect"));
  const usageId = Object.keys(sectionMap).find(key => key.toLowerCase().includes("usage") || key.toLowerCase().includes("description"));
  const notesId = Object.keys(sectionMap).find(key => key.toLowerCase() === "notes");

  const figcaption = cleanText(html.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1]);

  const elements: Element[] = [];
  for (const key of ["element", "elements"]) {
    const raw = info[key];
    if (!raw) continue;
    for (const part of raw.split(/[\/,|]/)) {
      const parsed = normalizeElement(part);
      if (parsed && !elements.includes(parsed)) elements.push(parsed);
    }
  }

  return {
    color: info.color,
    elements,
    manufacturer: normalizeManufacturer(info.manufacturer),
    notesSection: notesId ? sectionMap[notesId] : undefined,
    rarity: info.rarity,
    specialSection: specialId ? sectionMap[specialId] : undefined,
    specialTitle: figcaption,
    type: normalizeType(info.type),
    usageSection: usageId ? sectionMap[usageId] : undefined,
  };
}

function parseLootSources(html: string): SourceEntry[] {
  const dropRates = new Map<string, { multiplier?: string; rate?: string }>();

  const dropBlockMatch = html.match(/Drop Rates<\/h3>[\s\S]*?<ul class="stat_list"[^>]*>([\s\S]*?)<\/ul>/i);
  const dropBlock = dropBlockMatch?.[1] ?? "";
  const dropLiRegex = /<li class="stat_container">([\s\S]*?)<\/li>/gi;
  let dropMatch: RegExpExecArray | null;
  while ((dropMatch = dropLiRegex.exec(dropBlock)) !== null) {
    const body = dropMatch[1];
    const attributes = [...body.matchAll(/<div class="stat_attribute">([\s\S]*?)<\/div>/gi)]
      .map(raw => cleanText(raw[1]))
      .filter((value): value is string => Boolean(value));

    if (attributes.length === 0) continue;

    const name = attributes[attributes.length - 1];
    const multiplier = attributes.length > 1 && /×|x/i.test(attributes[0]) ? attributes[0] : undefined;
    const rateValue = cleanText(body.match(/<span class="txt-size-medium txt-weight-bold">([\s\S]*?)<\/span>/i)?.[1]);
    const rateUnit = cleanText(body.match(/<span class="stat_unit">([\s\S]*?)<\/span>/i)?.[1]);

    dropRates.set(name, {
      multiplier,
      rate: rateValue ? `${rateValue}${rateUnit ?? ""}` : undefined,
    });
  }

  const out: SourceEntry[] = [];

  const sourceGridStart = html.indexOf('id="loot-source-grid"');
  if (sourceGridStart >= 0) {
    const tail = html.slice(sourceGridStart, sourceGridStart + 140_000);
    const chunks = tail.split('<div role="listitem" class="card w-dyn-item">').slice(1);

    for (const chunk of chunks) {
      const name = cleanText(chunk.match(/<h3>([\s\S]*?)<\/h3>/i)?.[1]);
      if (!name) continue;

      const tags = [...chunk.matchAll(/<div class="card_tag[^\"]*">([\s\S]*?)<\/div>/gi)]
        .map(raw => cleanText(raw[1]))
        .filter((value): value is string => Boolean(value))
        .filter(value => value !== name);

      const rate = dropRates.get(name);
      if (rate?.multiplier) tags.push(rate.multiplier.replace("×", "x"));
      if (rate?.rate) tags.push(`Drop rate: ${rate.rate}`);

      const uniqueTags = [...new Set(tags)];
      out.push({
        name,
        tags: uniqueTags,
      });
    }
  }

  if (out.length === 0 && dropRates.size > 0) {
    for (const [name, rate] of dropRates.entries()) {
      const tags: string[] = [];
      if (rate.multiplier) tags.push(rate.multiplier.replace("×", "x"));
      if (rate.rate) tags.push(`Drop rate: ${rate.rate}`);
      out.push({ name, tags });
    }
  }

  return out;
}

function parseLootlemonData(html: string): LootlemonData {
  const data: LootlemonData = {
    elements: [],
    sources: [],
  };

  const statHeader = html.match(/<ul role="list" class="stat_list">([\s\S]*?)<\/ul>/i)?.[1] ?? "";
  const statLiRegex = /<li class="stat_container">([\s\S]*?)<\/li>/gi;
  let statMatch: RegExpExecArray | null;
  while ((statMatch = statLiRegex.exec(statHeader)) !== null) {
    const li = statMatch[1];
    const label = cleanText(li.match(/<div class="stat_attribute">([\s\S]*?)<\/div>/i)?.[1])?.toLowerCase();
    if (!label) continue;

    if (label === "rarity") {
      data.rarity = cleanText(li.match(/class="stat_value">([\s\S]*?)<\/div>/i)?.[1]);
      continue;
    }

    if (label === "manufacturer") {
      data.manufacturer = normalizeManufacturer(cleanText(li.match(/id="item-manufacturer"[^>]*>([\s\S]*?)<\/div>/i)?.[1]));
      continue;
    }

    if (label === "elements") {
      const icons = [...li.matchAll(/alt="([^"]+)"\s+class="icon-round"/gi)]
        .map(raw => raw[1]);

      for (const icon of icons) {
        const parsed = normalizeElement(icon);
        if (parsed && !data.elements.includes(parsed)) data.elements.push(parsed);
      }
      continue;
    }
  }

  const detailsTab = html.match(/<div data-w-tab="Details" class="w-tab-pane[^\"]*">([\s\S]*?)<\/div>\s*<div data-w-tab="Variants"/i)?.[1] ?? "";
  const aboutRawHtml = detailsTab.match(/<div class="margin-left w-embed"><p>([\s\S]*?)<\/p><\/div>/i)?.[1];
  data.aboutText = cleanText(aboutRawHtml);

  if (data.aboutText) {
    const contentMatch = data.aboutText.match(/comes from (?:the )?(.+?)(?:\.|$)/i);
    if (contentMatch?.[1]) {
      data.content = normalizeContent(contentMatch[1]);
    }
  }

  const titleTag = cleanText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
  if (titleTag) {
    const titleHint = titleTag.match(/BL2\s*[–-]\s*([^|]+)/i)?.[1];
    if (titleHint) {
      const typeFromTitle = titleHint.match(/\b(SMG|Assault Rifle|Shotgun|Sniper|Launcher|Pistol|Revolver|Repeater)\b/i)?.[1];
      if (typeFromTitle) data.type = normalizeType(typeFromTitle);
      const rarityFromTitle = titleHint.match(/\b(Common|Uncommon|Rare|Epic|E-tech|Legendary|Seraph|Pearlescent|Effervescent|Cursed|Gemstone)\b/i)?.[1];
      if (rarityFromTitle) data.rarity = rarityFromTitle;
    }
  }

  if (!data.type && aboutRawHtml) {
    const typeMatch = aboutRawHtml.match(/<\/span>\s*([^<]+)\s*<strong>/i)?.[1];
    if (typeMatch) {
      data.type = normalizeType(cleanText(typeMatch));
    }
  }

  if (!data.type) {
    const looseTypeMatch = data.aboutText?.match(/\b(SMG|Assault Rifle|Shotgun|Sniper|Launcher|Pistol|Revolver|Repeater)\b/i)?.[1];
    if (looseTypeMatch) data.type = normalizeType(looseTypeMatch);
  }

  const specialTitleRaw = detailsTab.match(/<h4>([\s\S]*?)<\/h4>/i)?.[1];
  const specialDescriptionRaw = detailsTab.match(/<div class="margin-left w-richtext">([\s\S]*?)<\/div>/i)?.[1];
  data.specialTitle = cleanText(specialTitleRaw)?.replace(/\s*-\s*Unique Ability$/i, "");
  data.specialDescription = cleanText(specialDescriptionRaw);

  if (data.elements.length === 0) {
    const variantsTab = html.match(/<div data-w-tab="Variants" class="w-tab-pane[^\"]*">([\s\S]*?)<\/div>\s*<div data-w-tab="Parts"/i)?.[1] ?? "";
    const variantElementBlock = variantsTab.match(/<div class="stat_attribute">Elements<\/div>([\s\S]*?)<\/li>/i)?.[1] ?? "";
    const icons = [...variantElementBlock.matchAll(/alt="([^"]+)"\s+class="icon-round"/gi)]
      .map(raw => raw[1]);
    for (const icon of icons) {
      const parsed = normalizeElement(icon);
      if (parsed && !data.elements.includes(parsed)) data.elements.push(parsed);
    }
  }

  data.sources = parseLootSources(html);
  return data;
}

function buildDescription(item: WeaponItem, loot: LootlemonData | undefined, wiki: WikiData | undefined): string {
  const rarity = item.rarities[0] ?? loot?.rarity;
  const manufacturer = item.manufacturers[0];
  const type = item.type;
  const content = item.content;

  const baseParts: string[] = [];
  if (rarity && manufacturer && type !== "Unknown") {
    baseParts.push(`${item.name} is a ${rarity.toLowerCase()} ${manufacturer} ${type.toLowerCase()}`);
  } else if (type !== "Unknown") {
    baseParts.push(`${item.name} is a ${type.toLowerCase()} weapon`);
  } else {
    baseParts.push(`${item.name} is a Borderlands 2 weapon`);
  }

  if (content === "Base Game") {
    baseParts.push("from the base game");
  } else {
    baseParts.push(`from ${content}`);
  }

  const intro = `${baseParts.join(" ")}.`;

  const signals = collectSignals(wiki?.usageSection, loot?.specialDescription, loot?.aboutText);
  const detail = signals.lines.slice(0, 2).join(" ");

  let elementLine = "";
  if (item.elements && item.elements.length > 0) {
    elementLine = item.elements.length === 1
      ? ` It is locked to ${item.elements[0].toLowerCase()} damage.`
      : ` It can roll in ${item.elements.map(element => element.toLowerCase()).join(", ")} damage variants.`;
  }

  return capText(`${intro}${detail ? ` ${detail}` : ""}${elementLine}`.replace(/\s+/g, " ").trim(), 510);
}

function buildSpecial(item: WeaponItem, loot: LootlemonData | undefined, wiki: WikiData | undefined): SpecialEntry | undefined {
  const signals = collectSignals(loot?.specialDescription, wiki?.specialSection);
  if (signals.lines.length === 0 && !loot?.specialDescription && !wiki?.specialSection) {
    return item.special;
  }

  const descriptionParts = [...signals.lines];
  if (signals.numbers.length > 0) {
    descriptionParts.push(`Notable listed values include ${signals.numbers.join(", ")}.`);
  }

  const description = capText(descriptionParts.join(" "), 510);
  if (!description) return undefined;

  let title = item.special?.title;
  if (!title || title.toLowerCase() === item.name.toLowerCase()) {
    title = loot?.specialTitle;
  }
  if (!title || title.toLowerCase() === item.name.toLowerCase()) {
    title = wiki?.specialTitle;
  }

  if (title && /unique ability/i.test(title)) {
    title = undefined;
  }

  return title
    ? { description, title }
    : { description };
}

function buildNotes(item: WeaponItem, loot: LootlemonData | undefined, wiki: WikiData | undefined): string | undefined {
  const fragments: string[] = [];

  if (wiki?.notesSection) {
    const noteSignals = collectSignals(wiki.notesSection);
    fragments.push(...noteSignals.lines.slice(0, 1));
  }

  if (loot?.sources && loot.sources.length > 0) {
    const top = loot.sources.slice(0, 2).map(source => {
      const dropTag = source.tags.find(tag => tag.toLowerCase().includes("drop rate"));
      return dropTag ? `${source.name} (${dropTag.replace(/^drop rate:\s*/i, "")})` : source.name;
    });
    fragments.push(`Notable dedicated drops include ${top.join(" and ")}.`);
  }

  if (!fragments.length) {
    return item.notes;
  }

  const unique = [...new Set(fragments.map(text => text.trim()).filter(Boolean))];
  return capText(unique.join(" "), 510);
}

async function parseRemote(item: WeaponItem): Promise<{ loot?: LootlemonData; wiki?: WikiData }> {
  const tasks: Array<Promise<void>> = [];
  const result: { loot?: LootlemonData; wiki?: WikiData } = {};

  if (item.resources.lootlemon) {
    tasks.push((async () => {
      const html = await fetchText(item.resources.lootlemon as string);
      result.loot = parseLootlemonData(html);
    })());
  }

  if (item.resources.wiki) {
    tasks.push((async () => {
      const html = await fetchWikiHtml(item.resources.wiki as string);
      result.wiki = parseWikiData(html);
    })());
  }

  await Promise.all(tasks);
  return result;
}

function applyFieldUpdates(item: WeaponItem, loot: LootlemonData | undefined, wiki: WikiData | undefined): string[] {
  const changed: string[] = [];

  const preferredManufacturer = loot?.manufacturer ?? wiki?.manufacturer;
  if (preferredManufacturer && !item.manufacturers.includes(preferredManufacturer)) {
    const next = [preferredManufacturer, ...item.manufacturers.filter(name => name !== preferredManufacturer)];
    if (JSON.stringify(next) !== JSON.stringify(item.manufacturers)) {
      item.manufacturers = next;
      changed.push("manufacturers");
    }
  }

  const preferredType = loot?.type ?? wiki?.type;
  if (preferredType && item.type !== preferredType) {
    item.type = preferredType;
    changed.push("type");
  }

  const mergedElements = [...new Set([...(loot?.elements ?? []), ...(wiki?.elements ?? []), ...(item.elements ?? [])])];
  if (mergedElements.length > 0) {
    if (JSON.stringify(item.elements ?? []) !== JSON.stringify(mergedElements)) {
      item.elements = mergedElements;
      changed.push("elements");
    }
  } else if (item.elements) {
    delete item.elements;
    changed.push("elements");
  }

  const preferredContent = loot?.content ?? normalizeContent(item.content);
  if (preferredContent && item.content !== preferredContent) {
    item.content = preferredContent;
    item.dlc = preferredContent !== "Base Game";
    changed.push("content");
    changed.push("dlc");
  }

  if (loot?.sources && loot.sources.length > 0) {
    if (JSON.stringify(item.sources ?? []) !== JSON.stringify(loot.sources)) {
      item.sources = loot.sources;
      changed.push("sources");
    }
  }

  const nextSpecial = buildSpecial(item, loot, wiki);
  if (nextSpecial) {
    if (JSON.stringify(item.special ?? undefined) !== JSON.stringify(nextSpecial)) {
      item.special = nextSpecial;
      changed.push("special");
    }
  }

  const nextNotes = buildNotes(item, loot, wiki);
  if (nextNotes && nextNotes !== item.notes) {
    item.notes = nextNotes;
    changed.push("notes");
  }

  const nextDescription = buildDescription(item, loot, wiki);
  if (nextDescription && nextDescription !== item.description) {
    item.description = nextDescription;
    changed.push("description");
  }

  return [...new Set(changed)];
}

function parseArgs(): { limit: number; offset: number } {
  const args = process.argv.slice(2);
  let offset = 0;
  let limit = 25;

  for (const arg of args) {
    if (arg.startsWith("--offset=")) {
      const value = Number(arg.slice("--offset=".length));
      if (Number.isFinite(value) && value >= 0) offset = Math.floor(value);
    }
    if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (Number.isFinite(value) && value > 0) limit = Math.floor(value);
    }
  }

  return { limit, offset };
}

async function main(): Promise<void> {
  const { limit, offset } = parseArgs();

  const fileNames = (await readdir(WEAPONS_DIR))
    .filter(fileName => fileName.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  const scopedNames = fileNames.slice(offset, offset + limit);
  const entries: ReportEntry[] = [];
  let updated = 0;

  for (const fileName of scopedNames) {
    const filePath = join(WEAPONS_DIR, fileName);
    const item = JSON.parse(await readFile(filePath, "utf-8")) as WeaponItem;

    try {
      const remote = await parseRemote(item);
      const changed = applyFieldUpdates(item, remote.loot, remote.wiki);

      if (changed.length > 0) {
        await writeFile(filePath, `${JSON.stringify(item, null, 2)}\n`, "utf-8");
        updated += 1;
      }

      entries.push({
        changed,
        file: fileName,
        name: item.name,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      entries.push({
        changed: [],
        file: fileName,
        name: item.name,
        skippedReason: reason,
      });
    }
  }

  await mkdir(REPORT_DIR, { recursive: true });
  const reportPath = join(REPORT_DIR, `full-enrich-report-${String(offset).padStart(3, "0")}-${String(limit).padStart(3, "0")}.json`);
  const report: Report = {
    completedAt: new Date().toISOString(),
    entries,
    limit,
    offset,
    processed: scopedNames.length,
    updated,
  };

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  console.log(
    [
      `Offset: ${offset}`,
      `Limit: ${limit}`,
      `Processed: ${report.processed}`,
      `Updated: ${report.updated}`,
      `Report: ${reportPath}`,
    ].join("\n")
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
