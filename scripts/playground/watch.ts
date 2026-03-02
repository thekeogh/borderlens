import { watch } from "node:fs";
import { join } from "node:path";

import { syncPlayground } from "./sync";

const ROOT_DIR = process.cwd();
const COMPONENTS_DIR = join(ROOT_DIR, "src/components");
const WATCHED_EXTENSIONS = new Set([".css", ".js", ".jsx", ".sass", ".scss", ".ts", ".tsx"]);
const IGNORED_SUFFIXES = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx"];
const DEBOUNCE_MS = 150;

let pendingTimer: NodeJS.Timeout | undefined;
let queuedReason: string | undefined;
let syncInProgress = false;

function getExtension(filePath: string): string {
  const lastDotIndex = filePath.lastIndexOf(".");

  if (lastDotIndex === -1) {
    return "";
  }

  return filePath.slice(lastDotIndex);
}

function shouldProcess(filePath: string): boolean {
  const extension = getExtension(filePath);

  if (!WATCHED_EXTENSIONS.has(extension)) {
    return false;
  }

  return !IGNORED_SUFFIXES.some(suffix => filePath.endsWith(suffix));
}

async function runSync(reason: string): Promise<void> {
  if (syncInProgress) {
    queuedReason = reason;
    return;
  }

  syncInProgress = true;

  try {
    await syncPlayground();
    console.log(`[playground:watch] synced (${reason})`);
  } catch (error) {
    console.error(`[playground:watch] ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    syncInProgress = false;

    if (queuedReason) {
      const nextReason = queuedReason;
      queuedReason = undefined;
      scheduleSync(nextReason);
    }
  }
}

function scheduleSync(reason: string): void {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
  }

  pendingTimer = setTimeout(() => {
    pendingTimer = undefined;
    void runSync(reason);
  }, DEBOUNCE_MS);
}

function shutdownWatcher(watcher: ReturnType<typeof watch>): void {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
  }

  watcher.close();
  process.exit(0);
}

async function runWatcher(): Promise<void> {
  await runSync("startup");

  const watcher = watch(COMPONENTS_DIR, { recursive: true }, (_, fileName) => {
    if (!fileName) {
      scheduleSync("components changed");
      return;
    }

    const relativePath = String(fileName);

    if (!shouldProcess(relativePath)) {
      return;
    }

    scheduleSync(relativePath);
  });

  console.log(`[playground:watch] watching ${COMPONENTS_DIR}`);

  process.on("SIGINT", () => shutdownWatcher(watcher));
  process.on("SIGTERM", () => shutdownWatcher(watcher));
}

runWatcher().catch(error => {
  console.error(`[playground:watch] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
