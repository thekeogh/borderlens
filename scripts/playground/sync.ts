import { mkdir, readdir, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

import ts from "typescript";

type ControlType = "boolean" | "json" | "jsx" | "number" | "select" | "text";
type OptionValue = boolean | number | string;

interface PropMeta {
  control: ControlType;
  defaultValue: unknown;
  name: string;
  optional: boolean;
  options?: OptionValue[];
  typeText: string;
}

interface ComponentMeta {
  exportName: string;
  filePath: string;
  key: string;
  path: string;
  props: PropMeta[];
}

interface ComponentEntry {
  exportName: string;
  filePath: string;
  importPath: string;
  key: string;
  path: string;
  props: PropMeta[];
}

const ROOT_DIR = process.cwd();
const COMPONENTS_DIR = join(ROOT_DIR, "src/components");
const OUTPUT_DIR = join(ROOT_DIR, "src/playground/generated");
const OUTPUT_LOADERS_FILE = join(OUTPUT_DIR, "loaders.ts");
const OUTPUT_METADATA_FILE = join(OUTPUT_DIR, "metadata.ts");
const TS_CONFIG_FILE = join(ROOT_DIR, "tsconfig.json");
const FILE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const EXCLUDED_FILE_SUFFIXES = [".d.ts", ".spec.ts", ".spec.tsx", ".test.ts", ".test.tsx"];

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function hasAnySuffix(value: string, suffixes: string[]): boolean {
  return suffixes.some(suffix => value.endsWith(suffix));
}

function isComponentFile(filePath: string): boolean {
  const extension = extname(filePath);
  if (!FILE_EXTENSIONS.has(extension)) {
    return false;
  }

  return !hasAnySuffix(filePath, EXCLUDED_FILE_SUFFIXES);
}

async function collectFiles(dir: string): Promise<string[]> {
  const dirEntries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of dirEntries) {
    const resolvedPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectFiles(resolvedPath));
      continue;
    }

    if (entry.isFile() && isComponentFile(resolvedPath)) {
      files.push(resolvedPath);
    }
  }

  return files;
}

function toComponentPath(filePath: string): string {
  const relativePath = normalizePath(relative(COMPONENTS_DIR, filePath));
  const withoutExtension = relativePath.replace(/\.[^.]+$/, "");

  if (withoutExtension.endsWith("/index")) {
    return withoutExtension.slice(0, -"/index".length);
  }

  return withoutExtension;
}

function toImportPath(filePath: string): string {
  const relativePath = normalizePath(relative(OUTPUT_DIR, filePath));
  const withoutExtension = relativePath.replace(/\.[^.]+$/, "");

  if (withoutExtension.startsWith(".")) {
    return withoutExtension;
  }

  return `./${withoutExtension}`;
}

function createProgram(): ts.Program {
  const config = ts.readConfigFile(TS_CONFIG_FILE, ts.sys.readFile);
  if (config.error) {
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
  }

  const parsedConfig = ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT_DIR);

  if (parsedConfig.errors.length > 0) {
    const firstError = parsedConfig.errors[0];
    throw new Error(ts.flattenDiagnosticMessageText(firstError.messageText, "\n"));
  }

  return ts.createProgram({
    options: parsedConfig.options,
    rootNames: parsedConfig.fileNames,
  });
}

function getExportSymbol(symbol: ts.Symbol, checker: ts.TypeChecker): ts.Symbol {
  if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) {
    return checker.getAliasedSymbol(symbol);
  }

  return symbol;
}

function getExportType(symbol: ts.Symbol, checker: ts.TypeChecker, sourceFile: ts.SourceFile): ts.Type {
  const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0] ?? sourceFile;
  return checker.getTypeOfSymbolAtLocation(symbol, declaration);
}

function getBooleanLiteral(type: ts.Type): boolean | undefined {
  if ((type.flags & ts.TypeFlags.BooleanLiteral) === 0) {
    return undefined;
  }

  const intrinsicName = (type as { intrinsicName?: string }).intrinsicName;

  if (intrinsicName === "true") {
    return true;
  }

  if (intrinsicName === "false") {
    return false;
  }

  return undefined;
}

function getLiteralValue(type: ts.Type): OptionValue | undefined {
  if (type.isStringLiteral()) {
    return type.value;
  }

  if (type.isNumberLiteral()) {
    return type.value;
  }

  return getBooleanLiteral(type);
}

function isNullishType(type: ts.Type): boolean {
  return (type.flags & ts.TypeFlags.Null) !== 0 || (type.flags & ts.TypeFlags.Undefined) !== 0;
}

function isOptionalType(type: ts.Type): boolean {
  return type.isUnion() && type.types.some(unionType => (unionType.flags & ts.TypeFlags.Undefined) !== 0);
}

function toTypeText(type: ts.Type, checker: ts.TypeChecker): string {
  return checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
}

function classifyControl(
  type: ts.Type,
  checker: ts.TypeChecker
): Pick<PropMeta, "control" | "defaultValue" | "options" | "typeText"> {
  const unionTypes = type.isUnion() ? type.types : [type];
  const nonNullUnion = unionTypes.filter(unionType => !isNullishType(unionType));
  const effectiveUnion = nonNullUnion.length > 0 ? nonNullUnion : unionTypes;

  if (effectiveUnion.length > 0) {
    const literalOptions = effectiveUnion
      .map(unionType => getLiteralValue(unionType))
      .filter((value): value is OptionValue => value !== undefined);

    if (literalOptions.length === effectiveUnion.length) {
      const dedupedOptions = [...new Set(literalOptions)];
      const allBooleanOptions = dedupedOptions.every(option => typeof option === "boolean");

      if (allBooleanOptions) {
        return {
          control: "boolean",
          defaultValue: false,
          typeText: toTypeText(type, checker),
        };
      }

      return {
        control: "select",
        defaultValue: dedupedOptions[0],
        options: dedupedOptions,
        typeText: toTypeText(type, checker),
      };
    }
  }

  const baseType = effectiveUnion[0] ?? type;

  if ((baseType.flags & ts.TypeFlags.BooleanLike) !== 0) {
    return {
      control: "boolean",
      defaultValue: false,
      typeText: toTypeText(type, checker),
    };
  }

  if ((baseType.flags & ts.TypeFlags.NumberLike) !== 0) {
    return {
      control: "number",
      defaultValue: 0,
      typeText: toTypeText(type, checker),
    };
  }

  if ((baseType.flags & ts.TypeFlags.StringLike) !== 0) {
    return {
      control: "text",
      defaultValue: "",
      typeText: toTypeText(type, checker),
    };
  }

  if (checker.isArrayType(baseType) || checker.isTupleType(baseType)) {
    return {
      control: "json",
      defaultValue: [],
      typeText: toTypeText(type, checker),
    };
  }

  return {
    control: "json",
    defaultValue: {},
    typeText: toTypeText(type, checker),
  };
}

function getPropsType(componentType: ts.Type, checker: ts.TypeChecker): ts.Type | undefined {
  const callSignatures = componentType.getCallSignatures();

  if (callSignatures.length > 0) {
    const firstSignature = callSignatures[0];
    const firstParameter = firstSignature.getParameters()[0];

    if (firstParameter) {
      const declaration =
        firstParameter.valueDeclaration ??
        firstParameter.declarations?.[0] ??
        firstSignature.getDeclaration();

      return checker.getTypeOfSymbolAtLocation(firstParameter, declaration);
    }
  }

  const propsSymbol = componentType.getProperty("props");

  if (!propsSymbol) {
    return undefined;
  }

  const declaration = propsSymbol.valueDeclaration ?? propsSymbol.declarations?.[0];

  if (!declaration) {
    return undefined;
  }

  return checker.getTypeOfSymbolAtLocation(propsSymbol, declaration);
}

function getPropsMetadata(componentType: ts.Type, checker: ts.TypeChecker): PropMeta[] {
  const propsType = getPropsType(componentType, checker);

  if (!propsType) {
    return [];
  }

  const properties = checker
    .getPropertiesOfType(checker.getApparentType(propsType))
    .sort((propertyA, propertyB) => propertyA.getName().localeCompare(propertyB.getName()));

  return properties.map(property => {
    const declaration = property.valueDeclaration ?? property.declarations?.[0];
    const propertyType = declaration
      ? checker.getTypeOfSymbolAtLocation(property, declaration)
      : checker.getDeclaredTypeOfSymbol(property);
    const control = property.getName() === "children"
      ? {
        control: "jsx" as const,
        defaultValue: "",
        typeText: toTypeText(propertyType, checker),
      }
      : classifyControl(propertyType, checker);

    const optionalBySymbol = (property.flags & ts.SymbolFlags.Optional) !== 0;
    const optional = optionalBySymbol || isOptionalType(propertyType);

    return {
      control: control.control,
      defaultValue: control.defaultValue,
      name: property.getName(),
      optional,
      options: control.options,
      typeText: control.typeText,
    };
  });
}

function isLikelyComponent(exportName: string, exportType: ts.Type): boolean {
  if (exportName !== "default" && !/^[A-Z]/.test(exportName)) {
    return false;
  }

  if (exportType.getCallSignatures().length > 0) {
    return true;
  }

  return exportType.getConstructSignatures().length > 0;
}

function getComponentEntries(componentFiles: string[], program: ts.Program): ComponentEntry[] {
  const checker = program.getTypeChecker();
  const entries: ComponentEntry[] = [];

  for (const filePath of componentFiles) {
    const sourceFile = program.getSourceFile(filePath);

    if (!sourceFile) {
      continue;
    }

    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);

    if (!moduleSymbol) {
      continue;
    }

    const componentPath = toComponentPath(filePath);
    const importPath = toImportPath(filePath);
    const moduleExports = checker.getExportsOfModule(moduleSymbol);

    for (const moduleExport of moduleExports) {
      const resolvedExport = getExportSymbol(moduleExport, checker);

      if ((resolvedExport.flags & ts.SymbolFlags.Value) === 0) {
        continue;
      }

      const exportName = moduleExport.getName();
      const exportType = getExportType(resolvedExport, checker, sourceFile);

      if (!isLikelyComponent(exportName, exportType)) {
        continue;
      }

      entries.push({
        exportName,
        filePath: normalizePath(relative(ROOT_DIR, filePath)),
        importPath,
        key: `${componentPath}#${exportName}`,
        path: componentPath,
        props: getPropsMetadata(exportType, checker),
      });
    }
  }

  return entries.sort((entryA, entryB) => {
    if (entryA.path !== entryB.path) {
      return entryA.path.localeCompare(entryB.path);
    }

    if (entryA.exportName === "default" && entryB.exportName !== "default") {
      return -1;
    }

    if (entryA.exportName !== "default" && entryB.exportName === "default") {
      return 1;
    }

    return entryA.exportName.localeCompare(entryB.exportName);
  });
}

function buildMetadata(entries: ComponentEntry[]): ComponentMeta[] {
  return entries.map(entry => ({
    exportName: entry.exportName,
    filePath: entry.filePath,
    key: entry.key,
    path: entry.path,
    props: entry.props,
  }));
}

function createMetadataFileContent(metadata: ComponentMeta[]): string {
  return [
    "/* eslint-disable */",
    "",
    "import type { PlaygroundComponentMeta } from \"../types\";",
    "",
    "// Auto-generated by scripts/playground/sync.ts",
    `export const playgroundComponents: PlaygroundComponentMeta[] = ${JSON.stringify(metadata, null, 2)};`,
    "",
  ].join("\n");
}

function createLoadersFileContent(entries: ComponentEntry[]): string {
  const lines = [
    "import type { PlaygroundLoaderMap } from \"../types\";",
    "",
    "// Auto-generated by scripts/playground/sync.ts",
    "export const playgroundLoaders: PlaygroundLoaderMap = {",
  ];

  for (const entry of entries) {
    if (entry.exportName === "default") {
      lines.push(`  \"${entry.key}\": async () => (await import(\"${entry.importPath}\")).default,`);
      continue;
    }

    lines.push(`  \"${entry.key}\": async () => (await import(\"${entry.importPath}\")).${entry.exportName},`);
  }

  lines.push("};", "");

  return lines.join("\n");
}

export async function syncPlayground(): Promise<void> {
  const componentFiles = await collectFiles(COMPONENTS_DIR);
  const program = createProgram();
  const componentEntries = getComponentEntries(componentFiles, program);
  const metadata = buildMetadata(componentEntries);

  await mkdir(OUTPUT_DIR, { recursive: true });

  await writeFile(OUTPUT_METADATA_FILE, createMetadataFileContent(metadata), "utf8");
  await writeFile(OUTPUT_LOADERS_FILE, createLoadersFileContent(componentEntries), "utf8");

  const uniquePaths = new Set(componentEntries.map(entry => entry.path));
  console.log(`Synced playground registry: ${componentEntries.length} exports across ${uniquePaths.size} components`);
}

const invokedPath = process.argv[1] ? normalizePath(process.argv[1]) : "";
const isDirectRun = invokedPath.endsWith("scripts/playground/sync.ts");

if (isDirectRun) {
  syncPlayground().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
