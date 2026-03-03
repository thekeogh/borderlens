import { notFound } from "next/navigation";
import * as React from "react";

import { playgroundLoaders } from "../../../playground/generated/loaders";
import styles from "./preview.module.css";

export const dynamic = "force-dynamic";

interface PlaygroundPreviewPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

interface PlaygroundJsxValue {
  __playgroundType: "jsx";
  value: string;
}

interface ParsedImportLine {
  defaultImport?: string;
  modulePath: string;
  namedImports: Array<{ imported: string; local: string }>;
  namespaceImport?: string;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function isRenderableComponent(value: unknown): boolean {
  if (typeof value === "function" || typeof value === "string") {
    return true;
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  return "$$typeof" in value;
}

function isIdentifier(value: string): boolean {
  return /^[$A-Z_][0-9A-Z_$]*$/i.test(value);
}

function parseNamedImports(value: string): Array<{ imported: string; local: string }> {
  const trimmed = value.trim();

  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return [];
  }

  const body = trimmed.slice(1, -1).trim();

  if (body.length === 0) {
    return [];
  }

  return body.split(",")
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const aliasSplit = part.split(/\s+as\s+/i).map(token => token.trim());
      const imported = aliasSplit[0];
      const local = aliasSplit[1] ?? imported;

      if (!isIdentifier(imported) || !isIdentifier(local)) {
        throw new Error(`Invalid import binding: ${part}`);
      }

      return { imported, local };
    });
}

function parseImportLine(line: string): ParsedImportLine {
  const importMatch = line.match(/^import\s+(.+?)\s+from\s+["']([^"']+)["'];?$/);

  if (!importMatch) {
    throw new Error(`Invalid import syntax: ${line}`);
  }

  const clause = importMatch[1].trim();
  const modulePath = importMatch[2].trim();

  const parsed: ParsedImportLine = {
    modulePath,
    namedImports: [],
  };

  if (clause.startsWith("{")) {
    parsed.namedImports = parseNamedImports(clause);
    return parsed;
  }

  if (clause.startsWith("* as ")) {
    const namespace = clause.replace(/^\*\s+as\s+/, "").trim();

    if (!isIdentifier(namespace)) {
      throw new Error(`Invalid namespace import: ${namespace}`);
    }

    parsed.namespaceImport = namespace;
    return parsed;
  }

  const commaIndex = clause.indexOf(",");

  if (commaIndex === -1) {
    if (!isIdentifier(clause)) {
      throw new Error(`Invalid default import: ${clause}`);
    }

    parsed.defaultImport = clause;
    return parsed;
  }

  const firstPart = clause.slice(0, commaIndex).trim();
  const secondPart = clause.slice(commaIndex + 1).trim();

  if (!isIdentifier(firstPart)) {
    throw new Error(`Invalid default import: ${firstPart}`);
  }

  parsed.defaultImport = firstPart;

  if (secondPart.startsWith("{")) {
    parsed.namedImports = parseNamedImports(secondPart);
    return parsed;
  }

  if (secondPart.startsWith("* as ")) {
    const namespace = secondPart.replace(/^\*\s+as\s+/, "").trim();

    if (!isIdentifier(namespace)) {
      throw new Error(`Invalid namespace import: ${namespace}`);
    }

    parsed.namespaceImport = namespace;
    return parsed;
  }

  throw new Error(`Invalid import clause: ${line}`);
}

async function resolveImportBindings(rawImports: string | undefined): Promise<Record<string, unknown>> {
  if (!rawImports || rawImports.trim().length === 0) {
    return {};
  }

  const importLines = rawImports
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);
  const bindings: Record<string, unknown> = {};

  for (const line of importLines) {
    const parsedImport = parseImportLine(line);
    const moduleExports = await import(parsedImport.modulePath);

    if (parsedImport.defaultImport) {
      if (!("default" in moduleExports)) {
        throw new Error(`No default export in module: ${parsedImport.modulePath}`);
      }

      bindings[parsedImport.defaultImport] = moduleExports.default;
    }

    if (parsedImport.namespaceImport) {
      bindings[parsedImport.namespaceImport] = moduleExports;
    }

    for (const namedImport of parsedImport.namedImports) {
      if (!(namedImport.imported in moduleExports)) {
        throw new Error(`Missing export \"${namedImport.imported}\" from module: ${parsedImport.modulePath}`);
      }

      bindings[namedImport.local] = moduleExports[namedImport.imported as keyof typeof moduleExports];
    }
  }

  return bindings;
}

function isPlaygroundJsxValue(value: unknown): value is PlaygroundJsxValue {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return "__playgroundType" in value && "value" in value && value.__playgroundType === "jsx" && typeof value.value === "string";
}

async function parseJsxValue(value: string, bindings: Record<string, unknown>): Promise<React.ReactNode> {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return "";
  }

  if (!/[<>{}]/.test(trimmed)) {
    return value;
  }

  const ts = await import("typescript");
  const source = `const __node = (${trimmed});\nreturn __node;`;

  let transpiled: string;
  try {
    transpiled = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        module: ts.ModuleKind.None,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSX: ${message}`);
  }

  try {
    const bindingNames = Object.keys(bindings);
    const bindingValues = bindingNames.map(name => bindings[name]);
    const evaluator = new Function("React", ...bindingNames, transpiled) as (...values: unknown[]) => React.ReactNode;

    return evaluator(React, ...bindingValues);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSX: ${message}`);
  }
}

async function revivePlaygroundValue(value: unknown, bindings: Record<string, unknown>): Promise<unknown> {
  if (isPlaygroundJsxValue(value)) {
    return parseJsxValue(value.value, bindings);
  }

  if (Array.isArray(value)) {
    return Promise.all(value.map(entry => revivePlaygroundValue(entry, bindings)));
  }

  if (typeof value === "object" && value !== null) {
    const entries = await Promise.all(
      Object.entries(value).map(async ([key, entryValue]) => [key, await revivePlaygroundValue(entryValue, bindings)] as const)
    );

    return Object.fromEntries(entries);
  }

  return value;
}

async function parseProps(rawProps: string | undefined, bindings: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!rawProps) {
    return {};
  }

  const parsed = JSON.parse(rawProps) as unknown;

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Props payload must be an object.");
  }

  return revivePlaygroundValue(parsed, bindings) as Promise<Record<string, unknown>>;
}

export default async function PlaygroundPreviewPage({ searchParams }: PlaygroundPreviewPageProps) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const componentKey = firstValue(resolvedSearchParams.key);

  if (!componentKey) {
    return (
      <main className={styles.page}>
        <p className={styles.muted}>Select a component to begin previewing.</p>
      </main>
    );
  }

  const loader = playgroundLoaders[componentKey];

  if (!loader) {
    return (
      <main className={styles.page}>
        <p className={styles.error}>Unknown component key: {componentKey}</p>
      </main>
    );
  }

  const rawProps = firstValue(resolvedSearchParams.props);
  const rawImports = firstValue(resolvedSearchParams.imports);

  try {
    const component = await loader();
    const importBindings = await resolveImportBindings(rawImports);
    const props = await parseProps(rawProps, importBindings);

    if (!isRenderableComponent(component)) {
      throw new Error("Selected export is not a React component.");
    }

    return (
      <main className={styles.page}>
        <section className={styles.canvas}>{React.createElement(component as never, props)}</section>
      </main>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return (
      <main className={styles.page}>
        <p className={styles.error}>{message}</p>
      </main>
    );
  }
}
