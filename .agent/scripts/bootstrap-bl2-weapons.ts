import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

const LOOTLEMON_URL = "https://www.lootlemon.com/db/borderlands-2/weapons";
const LOOTLEMON_HOST = "https://www.lootlemon.com";
const WIKI_API_URL = "https://borderlands.fandom.com/api.php";

const OUTPUT_DIR = join(process.cwd(), "data/games/borderlands2/weapons");
const OUTPUT_IMG_DIR = join(OUTPUT_DIR, "img");
const AGENT_REPORT_DIR = join(process.cwd(), ".agent/bl2/weapons");

const NON_WEAPON_TITLE_PATTERNS = [
  /weapons by prefix/i,
  /^borderlands 2 weapons$/i,
  /relic/i,
  /grenade/i,
  /\(shield\)/i,
  /amulet/i,
  /blood of/i,
  /breath of/i,
  /bone of/i,
  /heart of/i,
  /skin of/i,
  /\(title\)/i,
];

const NON_WEAPON_CATEGORY_PATTERNS = [
  /\brelics?\b/i,
  /\bgrenade\b/i,
  /\bshields?\b/i,
  /\bclass mods?\b/i,
  /\bartifacts?\b/i,
  /\boz kits?\b/i,
];

const WIKI_TO_LOOT_ALIAS: Record<string, string> = {
  lyudmila: "lyuda",
};

const CANONICAL_NAME_BY_LOOT_NAME: Record<string, string> = {
  lyuda: "Lyudmila",
};

type Content =
  | "Base Game"
  | "Captain Scarlett and Her Pirate's Booty"
  | "Mr. Torgue's Campaign of Carnage"
  | "Sir Hammerlock's Big Game Hunt"
  | "Tiny Tina's Assault on Dragon Keep"
  | "Creature Slaughterdome"
  | "Collector's Edition Pack"
  | "Mechromancer Pack"
  | "Psycho Pack"
  | "Ultimate Vault Hunter Upgrade Pack"
  | "Ultimate Vault Hunter Upgrade Pack Two: Digistruct Peak Challenge"
  | "T.K. Baha's Bloody Harvest"
  | "The Horrible Hunger of the Ravenous Wattle Gobbler"
  | "How Marcus Saved Mercenary Day"
  | "Mad Moxxi and the Wedding Day Massacre"
  | "Sir Hammerlock vs. the Son of Crawmerax"
  | "Commander Lilith & the Fight for Sanctuary"
  | "Premiere Club";

type WeaponType =
  | "Repeater"
  | "Revolver"
  | "Pistol"
  | "SMG"
  | "Assault Rifle"
  | "Shotgun"
  | "Sniper"
  | "Launcher"
  | "Eridian"
  | "Unknown";

type Manufacturer =
  | "Anshin"
  | "Atlas"
  | "Bandit"
  | "Dahl"
  | "Eridian"
  | "Gearbox"
  | "Hyperion"
  | "Jakobs"
  | "Maliwan"
  | "Pangolin"
  | "S&S Munitions"
  | "Tediore"
  | "Torgue"
  | "Vladof"
  | "Scav";

type Rarity =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Cursed"
  | "Epic"
  | "Gemstone"
  | "E-tech"
  | "Legendary"
  | "Effervescent"
  | "Seraph"
  | "Pearlescent";

type Item = {
  category: "weapons";
  content: Content;
  dlc: boolean;
  image: string;
  resources: {
    lootlemon?: string;
    wiki?: string;
  };
  name: string;
  aliases?: string[];
  slug: string;
  type: WeaponType;
  description: string;
  notes?: string;
  manufacturers: Manufacturer[];
  rarities: Rarity[];
};

type LootlemonItem = {
  content: Content;
  manufacturer: Manufacturer;
  name: string;
  rarity: Rarity;
  type: WeaponType;
  url: string;
};

// Narrative field policy:
// `description`, `special.description`, and long-form `notes` are intentionally placeholders in seed output.
// Final values must be authored by LLM synthesis using BOTH Lootlemon + wiki when both exist (or best available source when one is missing),
// then paraphrased into concise natural English rather than copied text.
// Final narrative text must never mention source names (e.g. "Lootlemon says..." / "wiki says...").

const CONTENT_MAP: Record<string, Content> = {
  "base-game-bl2": "Base Game",
  "big-game-hunt-dlc": "Sir Hammerlock's Big Game Hunt",
  "campaign-of-carnage-dlc": "Mr. Torgue's Campaign of Carnage",
  "digistruct-peak-feature-pack": "Ultimate Vault Hunter Upgrade Pack Two: Digistruct Peak Challenge",
  "dragon-keep-dlc": "Tiny Tina's Assault on Dragon Keep",
  "fight-for-sanctuary-dlc": "Commander Lilith & the Fight for Sanctuary",
  "pirates-booty-dlc": "Captain Scarlett and Her Pirate's Booty",
  "slaughterdome-mini-dlc": "Creature Slaughterdome",
  "ultimate-upgrade-feature-pack": "Ultimate Vault Hunter Upgrade Pack",
};

const TYPE_MAP: Record<string, WeaponType> = {
  "assault-rifle-bl2": "Assault Rifle",
  "launcher-bl2": "Launcher",
  "pistol-bl2": "Pistol",
  "shotgun-bl2": "Shotgun",
  "smg-bl2": "SMG",
  "sniper-bl2": "Sniper",
};

const RARITY_MAP: Record<string, Rarity> = {
  "c-rare": "Rare",
  "d-epic": "Epic",
  "e-tech": "E-tech",
  "f-legendary": "Legendary",
  "g-seraph": "Seraph",
  "h-pearlescent": "Pearlescent",
  "i-effervescent": "Effervescent",
};

const MANUFACTURER_MAP: Record<string, Manufacturer> = {
  bandit: "Bandit",
  dahl: "Dahl",
  hyperion: "Hyperion",
  jakobs: "Jakobs",
  maliwan: "Maliwan",
  tediore: "Tediore",
  torgue: "Torgue",
  vladof: "Vladof",
};

const MANUFACTURER_CATEGORY_MAP: Record<string, Manufacturer> = {
  anshin: "Anshin",
  atlas: "Atlas",
  "bandit (manufacturer)": "Bandit",
  bandit: "Bandit",
  bandits: "Bandit",
  dahl: "Dahl",
  eridian: "Eridian",
  gearbox: "Gearbox",
  hyperion: "Hyperion",
  jakobs: "Jakobs",
  maliwan: "Maliwan",
  pangolin: "Pangolin",
  scav: "Scav",
  "s&s munitions": "S&S Munitions",
  tediore: "Tediore",
  torgue: "Torgue",
  vladof: "Vladof",
};

const RARITY_CATEGORY_TO_VALUE: Array<{ key: string; value: Rarity }> = [
  { key: "cursed", value: "Cursed" },
  { key: "gemstone", value: "Gemstone" },
  { key: "effervescent", value: "Effervescent" },
  { key: "seraph", value: "Seraph" },
  { key: "pearlescent", value: "Pearlescent" },
  { key: "legendary", value: "Legendary" },
  { key: "e-tech", value: "E-tech" },
  { key: "very rare", value: "Epic" },
  { key: "epic", value: "Epic" },
  { key: "rare", value: "Rare" },
  { key: "blue", value: "Rare" },
  { key: "uncommon", value: "Uncommon" },
  { key: "green", value: "Uncommon" },
  { key: "common", value: "Common" },
  { key: "white", value: "Common" },
];

// Rarity curation note:
// Wiki "Rarity: Common" entries in BL2 can still roll higher tiers.
// During manual enrichment, use the downloaded item-card name color as a heuristic cap
// and expand rarities cumulatively up to that tier (Common -> ... -> Epic).
// Legendary+ entries remain fixed.

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

function decodeHtml(text: string): string {
  return text
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
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

function normalizeNameForMatch(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function inferTypeFromWikiTitle(title: string): WeaponType {
  const text = title.toLowerCase();
  if (text.includes("assault rifle") || text.includes("(rifle)")) return "Assault Rifle";
  if (text.includes("shotgun")) return "Shotgun";
  if (text.includes("sniper")) return "Sniper";
  if (text.includes("launcher") || text.includes("bazooka") || text.includes("rpg")) return "Launcher";
  if (text.includes("smg")) return "SMG";
  if (text.includes("revolver")) return "Revolver";
  if (text.includes("repeater")) return "Repeater";
  if (text.includes("pistol") || text.includes("handgun")) return "Pistol";
  return "Unknown";
}

function looksPossiblyNonWeapon(title: string): boolean {
  return /(relic|grenade|shield|amulet|mod|blood of|breath of|bone of|heart of|skin of)/i.test(title);
}

function inferContentFromCategories(categories: string[]): Content {
  const joined = categories.join(" ").toLowerCase();

  if (joined.includes("commander lilith") || joined.includes("fight for sanctuary")) {
    return "Commander Lilith & the Fight for Sanctuary";
  }
  if (joined.includes("captain scarlett") || joined.includes("pirate")) {
    return "Captain Scarlett and Her Pirate's Booty";
  }
  if (joined.includes("campaign of carnage") || joined.includes("torgue's campaign")) {
    return "Mr. Torgue's Campaign of Carnage";
  }
  if (joined.includes("big game hunt") || joined.includes("sir hammerlock")) {
    return "Sir Hammerlock's Big Game Hunt";
  }
  if (joined.includes("assault on dragon keep") || joined.includes("dragon keep")) {
    return "Tiny Tina's Assault on Dragon Keep";
  }
  if (joined.includes("creature slaughterdome")) {
    return "Creature Slaughterdome";
  }
  if (joined.includes("digistruct peak")) {
    return "Ultimate Vault Hunter Upgrade Pack Two: Digistruct Peak Challenge";
  }
  if (joined.includes("ultimate vault hunter upgrade")) {
    return "Ultimate Vault Hunter Upgrade Pack";
  }
  if (joined.includes("bloody harvest")) {
    return "T.K. Baha's Bloody Harvest";
  }
  if (joined.includes("wattle gobbler")) {
    return "The Horrible Hunger of the Ravenous Wattle Gobbler";
  }
  if (joined.includes("mercenary day")) {
    return "How Marcus Saved Mercenary Day";
  }
  if (joined.includes("wedding day massacre")) {
    return "Mad Moxxi and the Wedding Day Massacre";
  }
  if (joined.includes("son of crawmerax")) {
    return "Sir Hammerlock vs. the Son of Crawmerax";
  }

  return "Base Game";
}

function inferManufacturerFromCategories(categories: string[]): Manufacturer {
  for (const category of categories) {
    const key = category.toLowerCase();
    const mapped = MANUFACTURER_CATEGORY_MAP[key];
    if (mapped) return mapped;
  }
  return "Bandit";
}

function inferRarityFromCategories(categories: string[]): Rarity {
  const lowerCategories = categories.map(category => category.toLowerCase());
  // "Unique" is treated as a descriptor on wiki; final rarity should be resolved from infobox color.
  for (const rarity of RARITY_CATEGORY_TO_VALUE) {
    if (lowerCategories.some(category => category.includes(rarity.key))) {
      return rarity.value;
    }
  }
  return "Rare";
}

function wikiUrlFromTitle(title: string): string {
  const path = title.replaceAll(" ", "_");
  return `https://borderlands.fandom.com/wiki/${encodeURIComponent(path).replaceAll("%2F", "/")}`;
}

function uniqueSlug(base: string, usedSlugs: Set<string>): string {
  if (!usedSlugs.has(base)) {
    usedSlugs.add(base);
    return base;
  }

  let index = 2;
  while (usedSlugs.has(`${base}-${index}`)) {
    index += 1;
  }
  const slug = `${base}-${index}`;
  usedSlugs.add(slug);
  return slug;
}

function chunk<T>(values: T[], size: number): T[][] {
  const items: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    items.push(values.slice(i, i + size));
  }
  return items;
}

function isNonWeaponBySignals(title: string, categories: string[]): boolean {
  if (NON_WEAPON_TITLE_PATTERNS.some(pattern => pattern.test(title))) {
    return true;
  }

  return categories.some(category =>
    NON_WEAPON_CATEGORY_PATTERNS.some(pattern => pattern.test(category))
  );
}

function addAlias(item: Item, aliasName: string): void {
  const cleanAlias = aliasName.replace(/\s*\(Borderlands 2\)\s*$/i, "").trim();
  if (!cleanAlias) return;
  if (cleanAlias.localeCompare(item.name, undefined, { sensitivity: "accent" }) === 0) return;
  if (item.aliases?.some(alias => alias.localeCompare(cleanAlias, undefined, { sensitivity: "accent" }) === 0)) {
    return;
  }
  item.aliases = [...(item.aliases ?? []), cleanAlias];
}

function parseLootlemonItemsFromHtml(html: string): LootlemonItem[] {
  const items: LootlemonItem[] = [];
  const chunks = html.split("<div class=\"db_item w-dyn-item\"");
  for (const chunk of chunks.slice(1)) {
    const tagEndIndex = chunk.indexOf(">");
    if (tagEndIndex === -1) continue;

    const attrs = parseAttributes(chunk.slice(0, tagEndIndex));
    const name = attrs["data-name"]?.trim();
    const content = CONTENT_MAP[attrs["data-content"] ?? ""];
    const manufacturer = MANUFACTURER_MAP[attrs["data-manufacturer"] ?? ""];
    const rarity = RARITY_MAP[attrs["data-rarity"] ?? ""];
    const type = TYPE_MAP[attrs["data-type"] ?? ""];
    const hrefMatch = chunk.match(/href="(\/weapon\/[^"]+)"/);

    if (!name || !content || !manufacturer || !rarity || !type || !hrefMatch?.[1]) {
      continue;
    }

    items.push({
      content,
      manufacturer,
      name,
      rarity,
      type,
      url: `${LOOTLEMON_HOST}${hrefMatch[1]}`,
    });
  }
  return items;
}

async function fetchLootlemonWeapons(): Promise<LootlemonItem[]> {
  const pageOne = await fetchText(LOOTLEMON_URL);
  const loadPagesMatch = pageOne.match(/id="item-list"[^>]*data-load-pages="(\d+)"/);
  const extraPages = Number(loadPagesMatch?.[1] ?? "0");

  const pages = [pageOne];
  for (let page = 2; page <= extraPages + 1; page += 1) {
    pages.push(await fetchText(`${LOOTLEMON_URL}?aa6d804c_page=${page}`));
  }

  const all = pages.flatMap(parseLootlemonItemsFromHtml);
  const deduped = new Map<string, LootlemonItem>();
  for (const item of all) {
    deduped.set(item.url, item);
  }
  return [...deduped.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchWikiCategoryTitles(): Promise<string[]> {
  const titles: string[] = [];
  let continueToken: string | undefined;

  do {
    const params = new URLSearchParams({
      action: "query",
      cmlimit: "max",
      cmtitle: "Category:Weapons_in_Borderlands_2",
      format: "json",
      list: "categorymembers",
    });
    if (continueToken) {
      params.set("cmcontinue", continueToken);
    }

    const url = `${WIKI_API_URL}?${params.toString()}`;
    const responseText = await fetchText(url);
    const payload = JSON.parse(responseText) as {
      continue?: { cmcontinue?: string };
      query?: { categorymembers?: Array<{ title?: string }> };
    };

    for (const member of payload.query?.categorymembers ?? []) {
      if (member.title) {
        titles.push(member.title.trim());
      }
    }

    continueToken = payload.continue?.cmcontinue;
  } while (continueToken);

  return [...new Set(titles)].sort((a, b) => a.localeCompare(b));
}

async function fetchWikiCategorySignals(titles: string[]): Promise<Map<string, string[]>> {
  const categoriesByNormalizedTitle = new Map<string, string[]>();

  for (const group of chunk(titles, 30)) {
    const params = new URLSearchParams({
      action: "query",
      cllimit: "max",
      format: "json",
      prop: "categories",
      redirects: "1",
      titles: group.join("|"),
    });

    const url = `${WIKI_API_URL}?${params.toString()}`;
    const responseText = await fetchText(url);
    const payload = JSON.parse(responseText) as {
      query?: {
        pages?: Record<string, {
          categories?: Array<{ title?: string }>;
          title?: string;
        }>;
      };
    };

    for (const page of Object.values(payload.query?.pages ?? {})) {
      const pageTitle = page.title;
      if (!pageTitle) continue;

      const categories = (page.categories ?? [])
        .map(category => category.title?.replace(/^Category:/i, "").trim())
        .filter((value): value is string => Boolean(value));

      categoriesByNormalizedTitle.set(normalizeNameForMatch(pageTitle), categories);
    }
  }

  return categoriesByNormalizedTitle;
}

async function fetchWikiPageUrlForTitle(title: string): Promise<string | undefined> {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    inprop: "url",
    prop: "info",
    redirects: "1",
    titles: title,
  });

  const url = `${WIKI_API_URL}?${params.toString()}`;
  const responseText = await fetchText(url);
  const payload = JSON.parse(responseText) as {
    query?: {
      pages?: Record<string, {
        fullurl?: string;
        missing?: string;
      }>;
    };
  };

  for (const page of Object.values(payload.query?.pages ?? {})) {
    if (!("missing" in page) && page.fullurl) {
      return page.fullurl;
    }
  }

  return undefined;
}

function buildLootlemonSeed(item: LootlemonItem, usedSlugs: Set<string>): Item {
  const canonicalName = CANONICAL_NAME_BY_LOOT_NAME[normalizeNameForMatch(item.name)];
  const pathSlug = item.url.split("/").pop()?.replace(/-bl2$/i, "") ?? item.name;
  const slug = uniqueSlug(
    slugify(canonicalName ?? pathSlug),
    usedSlugs
  );
  const seed: Item = {
    category: "weapons",
    content: item.content,
    dlc: item.content !== "Base Game",
    image: `/img/games/borderlands2/weapons/${slug}.png`,
    resources: {
      lootlemon: item.url,
    },
    name: canonicalName ?? item.name,
    slug,
    type: item.type,
    description: "Initial BL2 weapon seed entry from Lootlemon list data. Detailed description pending full scrape.",
    manufacturers: [item.manufacturer],
    rarities: [item.rarity],
  };

  if (canonicalName) {
    addAlias(seed, item.name);
  }

  return seed;
}

function buildWikiOnlySeed(
  title: string,
  categories: string[],
  usedSlugs: Set<string>
): Item {
  const displayName = title.replace(/\s*\(Borderlands 2\)\s*$/i, "").trim() || title;
  const slug = uniqueSlug(slugify(displayName), usedSlugs);
  const content = inferContentFromCategories(categories);

  return {
    category: "weapons",
    content,
    dlc: content !== "Base Game",
    image: `/img/games/borderlands2/weapons/${slug}.png`,
    resources: {
      wiki: wikiUrlFromTitle(title),
    },
    name: displayName,
    slug,
    type: inferTypeFromWikiTitle(title),
    description: "Initial BL2 weapon seed entry from wiki category listing. Detailed description pending full scrape.",
    manufacturers: [inferManufacturerFromCategories(categories)],
    rarities: [inferRarityFromCategories(categories)],
  };
}

async function clearExistingOutput(dir: string): Promise<void> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".json")) {
        await unlink(join(dir, entry.name));
      }
    }
  } catch {
    // Directory will be created later if it does not exist.
  }
}

async function main(): Promise<void> {
  const lootlemonItems = await fetchLootlemonWeapons();
  const wikiTitles = await fetchWikiCategoryTitles();
  const wikiCategorySignals = await fetchWikiCategorySignals(wikiTitles);

  const usedSlugs = new Set<string>();
  const items: Item[] = [];
  const lootByNormalizedName = new Map<string, Item>();

  for (const loot of lootlemonItems) {
    const seed = buildLootlemonSeed(loot, usedSlugs);
    items.push(seed);
    lootByNormalizedName.set(normalizeNameForMatch(loot.name), seed);
    lootByNormalizedName.set(normalizeNameForMatch(seed.name), seed);
  }

  let wikiLinked = 0;
  let wikiOnly = 0;
  let aliasLinked = 0;
  let wikiSkippedAsNonWeapon = 0;
  for (const title of wikiTitles) {
    const normalized = normalizeNameForMatch(title.replace(/\(Borderlands 2\)/gi, ""));
    const matchingLoot =
      lootByNormalizedName.get(normalized)
      ?? lootByNormalizedName.get(WIKI_TO_LOOT_ALIAS[normalized] ?? "");

    if (matchingLoot) {
      if (!matchingLoot.resources.wiki) {
        matchingLoot.resources.wiki = wikiUrlFromTitle(title);
        wikiLinked += 1;
        if (!lootByNormalizedName.has(normalized)) {
          addAlias(matchingLoot, title);
          aliasLinked += 1;
        }
      }
      continue;
    }

    if (isNonWeaponBySignals(title, wikiCategorySignals.get(normalized) ?? [])) {
      wikiSkippedAsNonWeapon += 1;
      continue;
    }

    items.push(buildWikiOnlySeed(title, wikiCategorySignals.get(normalized) ?? [], usedSlugs));
    wikiOnly += 1;
  }

  let wikiResolvedByDirectTitle = 0;
  for (const item of items) {
    if (!item.resources.lootlemon || item.resources.wiki) continue;

    const wikiUrl = await fetchWikiPageUrlForTitle(item.name);
    if (wikiUrl) {
      item.resources.wiki = wikiUrl;
      wikiResolvedByDirectTitle += 1;
    }
  }

  items.sort((a, b) => a.slug.localeCompare(b.slug));

  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(OUTPUT_IMG_DIR, { recursive: true });
  await mkdir(AGENT_REPORT_DIR, { recursive: true });
  await clearExistingOutput(OUTPUT_DIR);

  for (const item of items) {
    const path = join(OUTPUT_DIR, `${item.slug}.json`);
    await writeFile(path, `${JSON.stringify(item, null, 2)}\n`, "utf-8");
  }

  const report = {
    aliasLinked,
    createdAt: new Date().toISOString(),
    lootlemonItems: lootlemonItems.length,
    totalItemsWritten: items.length,
    wikiResolvedByDirectTitle,
    wikiSkippedAsNonWeapon,
    wikiItems: wikiTitles.length,
    wikiLinkedToLootlemon: wikiLinked,
    wikiOnlyItems: wikiOnly,
  };
  await writeFile(join(AGENT_REPORT_DIR, "seed-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf-8");

  console.log(
    [
      `Lootlemon items: ${report.lootlemonItems}`,
      `Wiki items: ${report.wikiItems}`,
      `Linked wiki URLs: ${report.wikiLinkedToLootlemon}`,
      `Alias-linked wiki URLs: ${report.aliasLinked}`,
      `Wiki URLs resolved by direct title query: ${report.wikiResolvedByDirectTitle}`,
      `Wiki titles skipped as obvious non-weapons: ${report.wikiSkippedAsNonWeapon}`,
      `Wiki-only seeds: ${report.wikiOnlyItems}`,
      `Total files written: ${report.totalItemsWritten}`,
    ].join("\n")
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
