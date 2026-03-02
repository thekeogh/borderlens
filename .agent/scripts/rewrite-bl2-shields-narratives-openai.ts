import fs from "node:fs";
import path from "node:path";

type Shield = {
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
const SHIELDS_DIR = path.resolve("data/games/borderlands2/shields");
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
    "You rewrite Borderlands shield text for a game database.",
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

  const user = JSON.stringify({ shield: name, input });
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
    "You compress rewritten shield text while preserving important gameplay meaning.",
    "British English, clean prose, no source mentions, no repetition, ASCII punctuation.",
    `Hard limit: each non-empty field must be <= ${MAX_CHARS} characters.`,
    "Paragraph breaks may be used with \\n\\n when clarity improves.",
    "Return only JSON with exactly: description, notes, specialDescription.",
  ].join(" ");

  const compactRaw = await callOpenAI([
    { role: "system", content: compactSystem },
    { role: "user", content: JSON.stringify({ shield: name, input: cleaned }) },
  ]);

  const compact = extractJsonObject(compactRaw);
  return {
    description: asciiClean((compact.description || "").slice(0, MAX_CHARS)),
    notes: asciiClean((compact.notes || "").slice(0, MAX_CHARS)),
    specialDescription: asciiClean((compact.specialDescription || "").slice(0, MAX_CHARS)),
  };
}

function readShield(file: string): Shield {
  return JSON.parse(fs.readFileSync(file, "utf8")) as Shield;
}

function writeShield(file: string, shield: Shield): void {
  fs.writeFileSync(file, `${JSON.stringify(shield, null, 2)}\n`);
}

async function main() {
  const files = fs
    .readdirSync(SHIELDS_DIR)
    .filter(file => file.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  console.log(`Rewriting ${files.length} BL2 shield files with ${MODEL}...`);

  let updated = 0;
  let failed = 0;
  const started = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fullPath = path.join(SHIELDS_DIR, file);
    try {
      const shield = readShield(fullPath);
      const rewritten = await rewriteNarrative(shield.name || file.replace(/\.json$/, ""), {
        description: shield.description || "",
        notes: shield.notes || "",
        specialDescription: shield.special?.description || "",
      });

      shield.description = rewritten.description;
      shield.notes = rewritten.notes;

      const specialTitle = (shield.special?.title || "").trim();
      if (rewritten.specialDescription) {
        shield.special = {
          ...(shield.special || {}),
          description: rewritten.specialDescription,
        };
      } else if (specialTitle) {
        shield.special = {
          ...(shield.special || {}),
          description: "",
        };
      } else {
        delete shield.special;
      }

      writeShield(fullPath, shield);
      updated++;
      console.log(
        `[${String(i + 1).padStart(3, "0")}/${files.length}] ${file} ok ` +
          `(d:${shield.description.length} n:${(shield.notes || "").length} s:${shield.special?.description?.length || 0})`,
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
