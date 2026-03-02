import fs from "node:fs";
import path from "node:path";

type Weapon = {
  name?: string;
  description?: string;
  notes?: string;
  special?: {
    title?: string;
    description?: string;
  } | null;
  [key: string]: unknown;
};

type RewriteResult = {
  description: string;
  notes: string;
  specialDescription: string;
};

const MODEL = process.env.OPENAI_MODEL || "gpt-5.2";
const API_KEY = process.env.OPENAI_API_KEY;
const WEAPONS_DIR = path.resolve("data/games/borderlands2/weapons");
const MAX_CHARS = 600;
const EXCLUDE = new Set([
  "evil-smasher.json",
  "face-time.json",
  "falcon.json",
  "fibber.json",
  "fighter.json",
]);

if (!API_KEY) {
  console.error("OPENAI_API_KEY is not set.");
  process.exit(1);
}

function asciiClean(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/\u202F/g, " ")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractJsonObject(content: string): RewriteResult {
  const trimmed = content.trim();
  try {
    const parsed = JSON.parse(trimmed) as RewriteResult;
    return parsed;
  } catch {
    // fallback for wrapped output
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Model response did not include a JSON object.");
    }
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as RewriteResult;
    return parsed;
  }
}

async function callOpenAI(messages: Array<{ role: "system" | "user"; content: string }>, attempt = 1): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if ((response.status === 429 || response.status >= 500) && attempt < 5) {
      const delayMs = 1000 * attempt;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return callOpenAI(messages, attempt + 1);
    }
    throw new Error(`OpenAI error (${response.status}): ${body}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty content.");
  }
  return content;
}

async function rewriteNarrative(name: string, input: RewriteResult): Promise<RewriteResult> {
  const system = [
    "You rewrite Borderlands weapon text for a game database.",
    "Use British English.",
    "Rewrite completely in your own words; do not copy source phrasing.",
    "Keep all important gameplay context and remove repetition.",
    "Do not mention sources or websites.",
    "Clean, concise, natural prose only.",
    "ASCII punctuation only.",
    "Paragraph breaks are allowed when helpful, using \\n\\n.",
    `Each non-empty field should be no more than ${MAX_CHARS} characters.`,
    "If a field has no usable input, return an empty string for that field.",
    "Return only JSON with exactly: description, notes, specialDescription.",
  ].join(" ");

  const user = JSON.stringify({
    weapon: name,
    input,
  });

  const raw = await callOpenAI([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);

  const parsed = extractJsonObject(raw);
  const cleaned: RewriteResult = {
    description: asciiClean(parsed.description || ""),
    notes: asciiClean(parsed.notes || ""),
    specialDescription: asciiClean(parsed.specialDescription || ""),
  };

  if (
    cleaned.description.length <= MAX_CHARS &&
    cleaned.notes.length <= MAX_CHARS &&
    cleaned.specialDescription.length <= MAX_CHARS
  ) {
    return cleaned;
  }

  const compactSystem = [
    "You compress rewritten weapon text while preserving important gameplay meaning.",
    "British English, clean prose, no source mentions, no repetition, ASCII punctuation.",
    `Hard limit: each non-empty field must be <= ${MAX_CHARS} characters.`,
    "Paragraph breaks may be used with \\n\\n when clarity improves.",
    "Return only JSON with exactly: description, notes, specialDescription.",
  ].join(" ");

  const compactUser = JSON.stringify({
    weapon: name,
    input: cleaned,
  });

  const compactRaw = await callOpenAI([
    { role: "system", content: compactSystem },
    { role: "user", content: compactUser },
  ]);
  const compactParsed = extractJsonObject(compactRaw);
  return {
    description: asciiClean((compactParsed.description || "").slice(0, MAX_CHARS)),
    notes: asciiClean((compactParsed.notes || "").slice(0, MAX_CHARS)),
    specialDescription: asciiClean((compactParsed.specialDescription || "").slice(0, MAX_CHARS)),
  };
}

function readWeapon(file: string): Weapon {
  return JSON.parse(fs.readFileSync(file, "utf8")) as Weapon;
}

function writeWeapon(file: string, weapon: Weapon): void {
  fs.writeFileSync(file, `${JSON.stringify(weapon, null, 2)}\n`);
}

async function main() {
  const started = Date.now();
  const files = fs
    .readdirSync(WEAPONS_DIR)
    .filter((file) => file.endsWith(".json"))
    .filter((file) => !EXCLUDE.has(file))
    .sort((a, b) => a.localeCompare(b));

  console.log(`Rewriting ${files.length} BL2 weapon files with ${MODEL}...`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fullPath = path.join(WEAPONS_DIR, file);
    try {
      const weapon = readWeapon(fullPath);
      const rewritten = await rewriteNarrative(weapon.name || file.replace(/\.json$/, ""), {
        description: weapon.description || "",
        notes: weapon.notes || "",
        specialDescription: weapon.special?.description || "",
      });

      weapon.description = rewritten.description;
      weapon.notes = rewritten.notes;

      const specialTitle = (weapon.special?.title || "").trim();
      if (rewritten.specialDescription) {
        weapon.special = {
          ...(weapon.special || {}),
          description: rewritten.specialDescription,
        };
      } else if (specialTitle) {
        weapon.special = {
          ...(weapon.special || {}),
          description: "",
        };
      } else {
        delete weapon.special;
      }

      writeWeapon(fullPath, weapon);
      updated++;
      console.log(
        `[${String(i + 1).padStart(3, "0")}/${files.length}] ${file} ok ` +
          `(d:${weapon.description.length} n:${(weapon.notes || "").length} s:${weapon.special?.description?.length || 0})`,
      );
    } catch (error) {
      failed++;
      console.error(`[${String(i + 1).padStart(3, "0")}/${files.length}] ${file} failed:`, error);
    }
  }

  const elapsedMs = Date.now() - started;
  console.log(`Done. Updated=${updated}, Failed=${failed}, Elapsed=${elapsedMs}ms`);
  if (failed > 0) {
    process.exit(2);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
