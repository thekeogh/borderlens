import fs from "node:fs";
import path from "node:path";

type GrenadeMod = {
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
const GRENADE_MODS_DIR = path.resolve("data/games/borderlands2/grenade-mods");
const MAX_CHARS = 600;

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
    return JSON.parse(trimmed) as RewriteResult;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Model response did not include JSON object.");
    }
    return JSON.parse(trimmed.slice(start, end + 1)) as RewriteResult;
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
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
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
    "You rewrite Borderlands grenade mod text for a game database.",
    "Use British English.",
    "Rewrite completely in your own words; do not copy source phrasing.",
    "Keep important gameplay context and remove repetition.",
    "Do not mention sources or websites.",
    "Clean, concise, natural prose only.",
    "ASCII punctuation only.",
    "Paragraph breaks are allowed when helpful, using \\n\\n.",
    `Each non-empty field should be no more than ${MAX_CHARS} characters.`,
    "If a field has no usable input, return an empty string for that field.",
    "Return only JSON with exactly: description, notes, specialDescription.",
  ].join(" ");

  const user = JSON.stringify({ grenadeMod: name, input });
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
    "You compress rewritten grenade mod text while preserving important gameplay meaning.",
    "British English, clean prose, no source mentions, no repetition, ASCII punctuation.",
    `Hard limit: each non-empty field must be <= ${MAX_CHARS} characters.`,
    "Paragraph breaks may be used with \\n\\n when clarity improves.",
    "Return only JSON with exactly: description, notes, specialDescription.",
  ].join(" ");

  const compactRaw = await callOpenAI([
    { role: "system", content: compactSystem },
    { role: "user", content: JSON.stringify({ grenadeMod: name, input: cleaned }) },
  ]);

  const compact = extractJsonObject(compactRaw);
  return {
    description: asciiClean((compact.description || "").slice(0, MAX_CHARS)),
    notes: asciiClean((compact.notes || "").slice(0, MAX_CHARS)),
    specialDescription: asciiClean((compact.specialDescription || "").slice(0, MAX_CHARS)),
  };
}

function readGrenadeMod(file: string): GrenadeMod {
  return JSON.parse(fs.readFileSync(file, "utf8")) as GrenadeMod;
}

function writeGrenadeMod(file: string, grenadeMod: GrenadeMod): void {
  fs.writeFileSync(file, `${JSON.stringify(grenadeMod, null, 2)}\n`);
}

async function main() {
  const { files: requestedFiles, limit } = parseArgs();

  let files = fs
    .readdirSync(GRENADE_MODS_DIR)
    .filter(file => file.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  if (requestedFiles.length > 0) {
    const wanted = new Set(
      requestedFiles.map(file => (file.endsWith(".json") ? file : `${file}.json`)),
    );
    files = files.filter(file => wanted.has(file));
  }

  if (typeof limit === "number") {
    files = files.slice(0, limit);
  }

  console.log(`Rewriting ${files.length} BL2 grenade mod files with ${MODEL}...`);

  let updated = 0;
  let failed = 0;
  const started = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fullPath = path.join(GRENADE_MODS_DIR, file);
    try {
      const grenadeMod = readGrenadeMod(fullPath);
      const rewritten = await rewriteNarrative(grenadeMod.name || file.replace(/\.json$/, ""), {
        description: grenadeMod.description || "",
        notes: grenadeMod.notes || "",
        specialDescription: grenadeMod.special?.description || "",
      });

      grenadeMod.description = rewritten.description;
      grenadeMod.notes = rewritten.notes;

      const specialTitle = (grenadeMod.special?.title || "").trim();
      if (rewritten.specialDescription) {
        grenadeMod.special = {
          ...(grenadeMod.special || {}),
          description: rewritten.specialDescription,
        };
      } else if (specialTitle) {
        grenadeMod.special = {
          ...(grenadeMod.special || {}),
          description: "",
        };
      } else {
        delete grenadeMod.special;
      }

      writeGrenadeMod(fullPath, grenadeMod);
      updated++;
      console.log(
        `[${String(i + 1).padStart(3, "0")}/${files.length}] ${file} ok ` +
          `(d:${grenadeMod.description.length} n:${(grenadeMod.notes || "").length} s:${grenadeMod.special?.description?.length || 0})`,
      );
    } catch (error) {
      failed++;
      console.error(`[${String(i + 1).padStart(3, "0")}/${files.length}] ${file} failed:`, error);
    }
  }

  console.log(`Done. Updated=${updated}, Failed=${failed}, Elapsed=${Date.now() - started}ms`);
  if (failed > 0) {
    process.exit(2);
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
function parseArgs(): { files: string[]; limit?: number } {
  const files: string[] = [];
  const args = process.argv.slice(2);
  let limit: number | undefined;
  for (const arg of args) {
    if (arg.startsWith("--limit=")) {
      const parsed = Number(arg.split("=")[1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = Math.floor(parsed);
      }
    }
    if (arg.startsWith("--files=")) {
      const raw = arg.split("=")[1] || "";
      for (const piece of raw.split(",")) {
        const trimmed = piece.trim();
        if (trimmed) {
          files.push(trimmed);
        }
      }
    }
  }
  return { files, limit };
}
