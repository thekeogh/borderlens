import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

type Item = {
  description?: string;
  notes?: string;
  special?: {
    description?: string;
    title?: string;
  };
};

type Change = {
  file: string;
  from: string;
  to: string;
  field: 'description' | 'notes' | 'special.description';
};

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'data/games');
const REPORT_PATH = join(ROOT, '.agent/reports/british-english-pass-report.json');

const REPLACEMENTS: Array<[string, string]> = [
  ['armor', 'armour'],
  ['armored', 'armoured'],
  ['armoring', 'armouring'],
  ['behavior', 'behaviour'],
  ['behaviors', 'behaviours'],
  ['behavioral', 'behavioural'],
  ['color', 'colour'],
  ['colors', 'colours'],
  ['colored', 'coloured'],
  ['coloring', 'colouring'],
  ['flavor', 'flavour'],
  ['flavors', 'flavours'],
  ['flavored', 'flavoured'],
  ['favor', 'favour'],
  ['favors', 'favours'],
  ['favored', 'favoured'],
  ['favoring', 'favouring'],
  ['favorite', 'favourite'],
  ['favorites', 'favourites'],
  ['center', 'centre'],
  ['centered', 'centred'],
  ['centering', 'centring'],
  ['defense', 'defence'],
  ['offense', 'offence'],
  ['offensive', 'offensive'],
  ['analyze', 'analyse'],
  ['analyzing', 'analysing'],
  ['analyzed', 'analysed'],
  ['organize', 'organise'],
  ['organized', 'organised'],
  ['organizing', 'organising'],
  ['organization', 'organisation'],
  ['organizations', 'organisations'],
  ['optimize', 'optimise'],
  ['optimized', 'optimised'],
  ['optimizing', 'optimising'],
  ['optimization', 'optimisation'],
  ['maximize', 'maximise'],
  ['maximized', 'maximised'],
  ['maximizing', 'maximising'],
  ['utilize', 'utilise'],
  ['utilized', 'utilised'],
  ['utilizing', 'utilising'],
  ['customization', 'customisation'],
  ['customizations', 'customisations'],
  ['stabilize', 'stabilise'],
  ['stabilized', 'stabilised'],
  ['stabilizing', 'stabilising'],
  ['traveling', 'travelling'],
  ['traveled', 'travelled'],
  ['traveler', 'traveller'],
  ['leveling', 'levelling'],
  ['modeled', 'modelled'],
  ['modeling', 'modelling'],
  ['canceling', 'cancelling'],
  ['canceled', 'cancelled'],
  ['meter', 'metre'],
  ['meters', 'metres'],
  ['gray', 'grey'],
  ['artifact', 'artefact'],
  ['artifacts', 'artefacts'],
];

function preserveCase(input: string, replacement: string): string {
  if (input.toUpperCase() === input) {
    return replacement.toUpperCase();
  }

  if (input[0]?.toUpperCase() === input[0] && input.slice(1).toLowerCase() === input.slice(1)) {
    return `${replacement[0].toUpperCase()}${replacement.slice(1)}`;
  }

  return replacement;
}

function normaliseBritishEnglish(text: string): { changed: boolean; value: string } {
  let value = text;

  for (const [american, british] of REPLACEMENTS) {
    const regex = new RegExp(`\\b${american}\\b`, 'gi');
    value = value.replace(regex, match => preserveCase(match, british));
  }

  return {
    changed: value !== text,
    value,
  };
}

async function walkJsonFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkJsonFiles(path)));
      continue;
    }
    if (entry.isFile() && path.endsWith('.json')) {
      out.push(path);
    }
  }

  return out;
}

async function main(): Promise<void> {
  const files = (await walkJsonFiles(DATA_DIR)).sort((a, b) => a.localeCompare(b));

  let fileChanges = 0;
  const changes: Change[] = [];
  let processed = 0;

  for (const file of files) {
    const item = JSON.parse(await readFile(file, 'utf8')) as Item;
    processed += 1;
    let touched = false;

    const applyField = (
      field: 'description' | 'notes' | 'special.description',
      current: string | undefined,
      assign: (next: string) => void
    ): void => {
      if (!current) return;
      const normalised = normaliseBritishEnglish(current);
      if (!normalised.changed) return;
      touched = true;
      assign(normalised.value);
      if (changes.length < 3000) {
        changes.push({
          field,
          file: file.replace(`${ROOT}/`, ''),
          from: current,
          to: normalised.value,
        });
      }
    };

    applyField('description', item.description, next => {
      item.description = next;
    });

    applyField('notes', item.notes, next => {
      item.notes = next;
    });

    applyField('special.description', item.special?.description, next => {
      if (!item.special) item.special = { description: next };
      else item.special.description = next;
    });

    if (touched) {
      fileChanges += 1;
      await writeFile(file, `${JSON.stringify(item, null, 2)}\n`, 'utf8');
    }
  }

  await mkdir(join(ROOT, '.agent/reports'), { recursive: true });
  await writeFile(
    REPORT_PATH,
    `${JSON.stringify(
      {
        changedFiles: fileChanges,
        completedAt: new Date().toISOString(),
        processedFiles: processed,
        replacementsTracked: changes.length,
        replacementsMapSize: REPLACEMENTS.length,
        sampleChanges: changes.slice(0, 200),
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  console.log(
    [
      `Processed: ${processed}`,
      `Files changed: ${fileChanges}`,
      `Tracked replacements: ${changes.length}`,
      `Report: ${REPORT_PATH}`,
    ].join('\n')
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
