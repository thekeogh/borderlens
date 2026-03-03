"use client";

import { type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiFile,
  FiFolder,
  FiMonitor,
  FiRotateCcw,
  FiSliders,
} from "react-icons/fi";

import styles from "./playground.module.css";

import type { PlaygroundComponentMeta, PlaygroundOptionValue, PlaygroundPropMeta } from "../../playground/types";

interface PlaygroundShellProps {
  components: PlaygroundComponentMeta[];
}

interface ControlState {
  optionalEnabled: Record<string, boolean>;
  values: Record<string, unknown>;
}

interface PlaygroundJsxValue {
  __playgroundType: "jsx";
  value: string;
}

interface PreviewState {
  jsonErrors: Record<string, string>;
  props: Record<string, unknown>;
}

interface TreeFolder {
  components: string[];
  count: number;
  folders: TreeFolder[];
  fullPath: string;
  name: string;
}

interface MutableTreeFolder {
  components: string[];
  folders: Map<string, MutableTreeFolder>;
  fullPath: string;
  name: string;
}

type TypeBadgeKind = "boolean" | "enum" | "json" | "jsx" | "number" | "select" | "string" | "type";

interface TypeBadgeInfo {
  kind: TypeBadgeKind;
  label: string;
}

interface PersistedLayout {
  explorerWidth: number;
  propsWidth: number;
}

interface PersistedPlaygroundState {
  componentStates: Record<string, ControlState>;
  explorerCollapsed: boolean;
  importsInput: string;
  openFolders: Record<string, boolean>;
  propsCollapsed: boolean;
  selectedExportNameInput: string;
  selectedPath: string;
  viewport: ViewportId;
}

const VIEWPORTS = [
  {
    id: "desktop",
    width: null,
  },
  {
    id: "xl",
    width: 1312,
  },
  {
    id: "lg",
    width: 1024,
  },
  {
    id: "md",
    width: 768,
  },
  {
    id: "sm",
    width: 480,
  },
] as const;

type ViewportId = (typeof VIEWPORTS)[number]["id"];
type ResizablePanel = "explorer" | "props";

const COLLAPSED_WIDTH = 42;
const DEFAULT_EXPLORER_WIDTH = 250;
const DEFAULT_PROPS_WIDTH = 340;
const HANDLE_WIDTH = 8;
const MIN_EXPLORER_WIDTH = 180;
const MIN_PREVIEW_WIDTH = 360;
const MIN_PROPS_WIDTH = 250;
const TREE_BASE_INDENT = 12;
const TREE_CHILD_INDENT = 36;
const TREE_DEPTH_STEP = 22;
const LAYOUT_STORAGE_KEY = "borderlens.playground.layout.v1";
const PLAYGROUND_STATE_STORAGE_KEY = "borderlens.playground.state.v1";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatSegmentName(value: string): string {
  return value
    .split(/[-_]/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatViewportWidth(width: number | null): string {
  return width ? `${width}px` : "100%";
}

function asPanelWidth(value: unknown, fallback: number, min: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.round(Math.max(min, value));
}

function loadPersistedLayout(): PersistedLayout {
  if (typeof window === "undefined") {
    return {
      explorerWidth: DEFAULT_EXPLORER_WIDTH,
      propsWidth: DEFAULT_PROPS_WIDTH,
    };
  }

  try {
    const storedRaw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);

    if (!storedRaw) {
      return {
        explorerWidth: DEFAULT_EXPLORER_WIDTH,
        propsWidth: DEFAULT_PROPS_WIDTH,
      };
    }

    const stored = JSON.parse(storedRaw) as { explorerWidth?: unknown; propsWidth?: unknown };

    return {
      explorerWidth: asPanelWidth(stored.explorerWidth, DEFAULT_EXPLORER_WIDTH, MIN_EXPLORER_WIDTH),
      propsWidth: asPanelWidth(stored.propsWidth, DEFAULT_PROPS_WIDTH, MIN_PROPS_WIDTH),
    };
  } catch {
    return {
      explorerWidth: DEFAULT_EXPLORER_WIDTH,
      propsWidth: DEFAULT_PROPS_WIDTH,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asBooleanRecord(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) {
    return {};
  }

  const output: Record<string, boolean> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "boolean") {
      output[key] = entry;
    }
  }

  return output;
}

function asUnknownRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function asControlStateRecord(value: unknown): Record<string, ControlState> {
  if (!isRecord(value)) {
    return {};
  }

  const output: Record<string, ControlState> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (!isRecord(entry)) {
      continue;
    }

    output[key] = {
      optionalEnabled: asBooleanRecord(entry.optionalEnabled),
      values: asUnknownRecord(entry.values),
    };
  }

  return output;
}

function isViewportId(value: unknown): value is ViewportId {
  return typeof value === "string" && VIEWPORTS.some(entry => entry.id === value);
}

function loadPersistedPlaygroundState(): PersistedPlaygroundState {
  const defaults: PersistedPlaygroundState = {
    componentStates: {},
    explorerCollapsed: false,
    importsInput: "",
    openFolders: {},
    propsCollapsed: false,
    selectedExportNameInput: "default",
    selectedPath: "",
    viewport: "desktop",
  };

  if (typeof window === "undefined") {
    return defaults;
  }

  try {
    const storedRaw = window.localStorage.getItem(PLAYGROUND_STATE_STORAGE_KEY);

    if (!storedRaw) {
      return defaults;
    }

    const parsed = JSON.parse(storedRaw);

    if (!isRecord(parsed)) {
      return defaults;
    }

    return {
      componentStates: asControlStateRecord(parsed.componentStates),
      explorerCollapsed: typeof parsed.explorerCollapsed === "boolean" ? parsed.explorerCollapsed : defaults.explorerCollapsed,
      importsInput: typeof parsed.importsInput === "string" ? parsed.importsInput : defaults.importsInput,
      openFolders: asBooleanRecord(parsed.openFolders),
      propsCollapsed: typeof parsed.propsCollapsed === "boolean" ? parsed.propsCollapsed : defaults.propsCollapsed,
      selectedExportNameInput: typeof parsed.selectedExportNameInput === "string" && parsed.selectedExportNameInput.length > 0
        ? parsed.selectedExportNameInput
        : defaults.selectedExportNameInput,
      selectedPath: typeof parsed.selectedPath === "string" ? parsed.selectedPath : defaults.selectedPath,
      viewport: isViewportId(parsed.viewport) ? parsed.viewport : defaults.viewport,
    };
  } catch {
    return defaults;
  }
}

function isPrimitiveTypeName(value: string): boolean {
  return value === "boolean" || value === "number" || value === "string";
}

function isTypeIdentifier(value: string): boolean {
  return /^[$A-Z_a-z][0-9A-Z_a-z$]*(?:\\.[$A-Z_a-z][0-9A-Z_a-z$]*)*$/.test(value);
}

function nonNullishUnionParts(typeText: string): string[] {
  return typeText
    .split("|")
    .map(part => part.trim())
    .filter(part => part !== "null" && part !== "undefined");
}

function getTypeBadgeInfo(prop: PlaygroundPropMeta): TypeBadgeInfo {
  const parts = nonNullishUnionParts(prop.typeText);

  if (parts.length === 1) {
    const part = parts[0];

    if (isPrimitiveTypeName(part)) {
      return {
        kind: part === "string" ? "string" : part === "number" ? "number" : "boolean",
        label: part,
      };
    }

    if (isTypeIdentifier(part)) {
      return {
        kind: prop.control === "select" ? "enum" : "type",
        label: part,
      };
    }
  }

  if (prop.control === "select") {
    return {
      kind: "select",
      label: "select",
    };
  }

  if (prop.control === "json") {
    return {
      kind: "json",
      label: "json",
    };
  }

  if (prop.control === "jsx") {
    return {
      kind: "jsx",
      label: "jsx",
    };
  }

  if (prop.control === "number") {
    return {
      kind: "number",
      label: "number",
    };
  }

  if (prop.control === "boolean") {
    return {
      kind: "boolean",
      label: "boolean",
    };
  }

  return {
    kind: "string",
    label: "string",
  };
}

function defaultControlValue(prop: PlaygroundPropMeta): unknown {
  if (prop.control === "json") {
    return JSON.stringify(prop.defaultValue, null, 2);
  }

  return prop.defaultValue;
}

function valueFromSelect(rawValue: string, options: PlaygroundOptionValue[] | undefined): PlaygroundOptionValue {
  if (!options || options.length === 0) {
    return rawValue;
  }

  return options.find(option => String(option) === rawValue) ?? options[0];
}

function initControlState(component: PlaygroundComponentMeta | undefined): ControlState {
  if (!component) {
    return {
      optionalEnabled: {},
      values: {},
    };
  }

  const optionalEnabled: Record<string, boolean> = {};
  const values: Record<string, unknown> = {};

  for (const prop of component.props) {
    optionalEnabled[prop.name] = !prop.optional;
    values[prop.name] = defaultControlValue(prop);
  }

  return {
    optionalEnabled,
    values,
  };
}

function buildPreviewState(component: PlaygroundComponentMeta | undefined, controlState: ControlState): PreviewState {
  if (!component) {
    return {
      jsonErrors: {},
      props: {},
    };
  }

  const jsonErrors: Record<string, string> = {};
  const props: Record<string, unknown> = {};

  for (const prop of component.props) {
    const enabled = !prop.optional || controlState.optionalEnabled[prop.name];

    if (!enabled) {
      continue;
    }

    const value = controlState.values[prop.name];

    if (prop.control === "jsx") {
      const rawJsx = String(value ?? "");
      props[prop.name] = {
        __playgroundType: "jsx",
        value: rawJsx,
      } satisfies PlaygroundJsxValue;
      continue;
    }

    if (prop.control === "json") {
      const rawJson = String(value ?? "").trim();

      if (rawJson.length === 0) {
        props[prop.name] = prop.defaultValue;
        continue;
      }

      try {
        props[prop.name] = JSON.parse(rawJson);
      } catch {
        jsonErrors[prop.name] = "Invalid JSON";
      }

      continue;
    }

    props[prop.name] = value;
  }

  return {
    jsonErrors,
    props,
  };
}

function buildTree(componentPaths: string[]): TreeFolder[] {
  const root: MutableTreeFolder = {
    components: [],
    folders: new Map(),
    fullPath: "",
    name: "",
  };

  for (const path of componentPaths) {
    const segments = path.split("/").filter(Boolean);

    if (segments.length === 0) {
      continue;
    }

    if (segments.length === 1) {
      root.components.push(path);
      continue;
    }

    let current = root;

    for (const segment of segments.slice(0, -1)) {
      const nextPath = current.fullPath ? `${current.fullPath}/${segment}` : segment;
      const nextFolder = current.folders.get(segment) ?? {
        components: [],
        folders: new Map(),
        fullPath: nextPath,
        name: segment,
      };

      current.folders.set(segment, nextFolder);
      current = nextFolder;
    }

    current.components.push(path);
  }

  function finalize(folder: MutableTreeFolder): TreeFolder {
    const folders = [...folder.folders.values()]
      .map(entry => finalize(entry))
      .sort((folderA, folderB) => folderA.name.localeCompare(folderB.name));

    const components = [...folder.components].sort((pathA, pathB) => pathA.localeCompare(pathB));
    const descendants = folders.reduce((acc, current) => acc + current.count, 0);

    return {
      components,
      count: components.length + descendants,
      folders,
      fullPath: folder.fullPath,
      name: folder.name,
    };
  }

  return [...root.folders.values()]
    .map(folder => finalize(folder))
    .sort((folderA, folderB) => folderA.name.localeCompare(folderB.name));
}

function collectFolderPaths(folders: TreeFolder[]): string[] {
  const values: string[] = [];

  function walk(entries: TreeFolder[]): void {
    for (const entry of entries) {
      values.push(entry.fullPath);
      walk(entry.folders);
    }
  }

  walk(folders);
  return values;
}

export function PlaygroundShell({ components }: PlaygroundShellProps) {
  const shellRef = useRef<HTMLElement | null>(null);

  const componentsByPath = useMemo(() => {
    const map = new Map<string, PlaygroundComponentMeta[]>();

    for (const component of components) {
      const entries = map.get(component.path) ?? [];
      entries.push(component);

      entries.sort((entryA, entryB) => {
        if (entryA.exportName === "default" && entryB.exportName !== "default") {
          return -1;
        }

        if (entryA.exportName !== "default" && entryB.exportName === "default") {
          return 1;
        }

        return entryA.exportName.localeCompare(entryB.exportName);
      });

      map.set(component.path, entries);
    }

    return map;
  }, [components]);

  const componentPaths = useMemo(
    () => [...componentsByPath.keys()].sort((pathA, pathB) => pathA.localeCompare(pathB)),
    [componentsByPath]
  );

  const treeFolders = useMemo(() => buildTree(componentPaths), [componentPaths]);
  const initialFolderOpenState = useMemo(
    () => Object.fromEntries(collectFolderPaths(treeFolders).map(path => [path, true])),
    [treeFolders]
  );

  const [persistedLayout] = useState<PersistedLayout>(() => loadPersistedLayout());
  const [persistedPlaygroundState] = useState<PersistedPlaygroundState>(() => loadPersistedPlaygroundState());
  const [explorerCollapsed, setExplorerCollapsed] = useState(persistedPlaygroundState.explorerCollapsed);
  const [explorerWidth, setExplorerWidth] = useState(persistedLayout.explorerWidth);
  const [importsInput, setImportsInput] = useState(persistedPlaygroundState.importsInput);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>(
    () => ({
      ...initialFolderOpenState,
      ...persistedPlaygroundState.openFolders,
    })
  );
  const [propsCollapsed, setPropsCollapsed] = useState(persistedPlaygroundState.propsCollapsed);
  const [propsWidth, setPropsWidth] = useState(persistedLayout.propsWidth);
  const [selectedExportNameInput, setSelectedExportNameInput] = useState<string>(persistedPlaygroundState.selectedExportNameInput);
  const [selectedPath, setSelectedPath] = useState<string>(() => {
    const persistedPath = persistedPlaygroundState.selectedPath;

    if (persistedPath.length > 0 && componentsByPath.has(persistedPath)) {
      return persistedPath;
    }

    return componentPaths[0] ?? "";
  });
  const [componentStates, setComponentStates] = useState<Record<string, ControlState>>(persistedPlaygroundState.componentStates);
  const [viewport, setViewport] = useState<ViewportId>(persistedPlaygroundState.viewport);

  const availableExports = useMemo(
    () => (selectedPath ? (componentsByPath.get(selectedPath) ?? []) : []),
    [componentsByPath, selectedPath]
  );

  const selectedExportName = useMemo(() => {
    if (availableExports.some(entry => entry.exportName === selectedExportNameInput)) {
      return selectedExportNameInput;
    }

    const defaultExport = availableExports.find(entry => entry.exportName === "default");
    return defaultExport?.exportName ?? availableExports[0]?.exportName ?? "";
  }, [availableExports, selectedExportNameInput]);

  const selectedComponent = useMemo(
    () => availableExports.find(entry => entry.exportName === selectedExportName),
    [availableExports, selectedExportName]
  );

  const selectedComponentKey = selectedComponent?.key ?? "";

  const controlState = useMemo(
    () => componentStates[selectedComponentKey] ?? initControlState(selectedComponent),
    [componentStates, selectedComponent, selectedComponentKey]
  );

  const previewState = useMemo(
    () => buildPreviewState(selectedComponent, controlState),
    [controlState, selectedComponent]
  );

  const previewSrc = useMemo(() => {
    const searchParams = new URLSearchParams();

    if (selectedComponent) {
      searchParams.set("key", selectedComponent.key);
      searchParams.set("props", JSON.stringify(previewState.props));
    }

    if (importsInput.trim().length > 0) {
      searchParams.set("imports", importsInput);
    }

    return `/.playground/preview?${searchParams.toString()}`;
  }, [importsInput, previewState.props, selectedComponent]);

  const viewportConfig = useMemo(
    () => VIEWPORTS.find(entry => entry.id === viewport) ?? VIEWPORTS[0],
    [viewport]
  );

  const previewFrameStyle = useMemo(
    () => ({
      width: viewportConfig.width ? `${viewportConfig.width}px` : "calc(100% - 2rem)",
    }),
    [viewportConfig.width]
  );

  const shellStyle = useMemo(
    () => ({
      "--explorer-width": `${explorerCollapsed ? COLLAPSED_WIDTH : explorerWidth}px`,
      "--props-width": `${propsCollapsed ? COLLAPSED_WIDTH : propsWidth}px`,
    }) as React.CSSProperties,
    [explorerCollapsed, explorerWidth, propsCollapsed, propsWidth]
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        LAYOUT_STORAGE_KEY,
        JSON.stringify({
          explorerWidth,
          propsWidth,
        })
      );
    } catch {
      // Ignore storage write failures (e.g. private mode restrictions).
    }
  }, [explorerWidth, propsWidth]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PLAYGROUND_STATE_STORAGE_KEY,
        JSON.stringify({
          componentStates,
          explorerCollapsed,
          importsInput,
          openFolders,
          propsCollapsed,
          selectedExportNameInput,
          selectedPath,
          viewport,
        } satisfies PersistedPlaygroundState)
      );
    } catch {
      // Ignore storage write failures (e.g. private mode restrictions).
    }
  }, [componentStates, explorerCollapsed, importsInput, openFolders, propsCollapsed, selectedExportNameInput, selectedPath, viewport]);

  function applyPath(path: string): void {
    if (!componentsByPath.has(path)) {
      return;
    }

    setSelectedPath(path);
    setSelectedExportNameInput("default");
  }

  function startResize(panel: ResizablePanel, event: ReactMouseEvent<HTMLDivElement>): void {
    if ((panel === "explorer" && explorerCollapsed) || (panel === "props" && propsCollapsed)) {
      return;
    }

    event.preventDefault();

    const startX = event.clientX;
    const initialWidth = panel === "explorer" ? explorerWidth : propsWidth;

    function onMouseMove(moveEvent: MouseEvent): void {
      const shellWidth = shellRef.current?.getBoundingClientRect().width ?? window.innerWidth;
      const delta = moveEvent.clientX - startX;
      const otherWidth = panel === "explorer"
        ? (propsCollapsed ? COLLAPSED_WIDTH : propsWidth)
        : (explorerCollapsed ? COLLAPSED_WIDTH : explorerWidth);
      const minWidth = panel === "explorer" ? MIN_EXPLORER_WIDTH : MIN_PROPS_WIDTH;
      const maxWidth = Math.max(minWidth, shellWidth - otherWidth - MIN_PREVIEW_WIDTH - (HANDLE_WIDTH * 2));
      const nextWidth = Math.round(clamp(initialWidth + delta, minWidth, maxWidth));

      if (panel === "explorer") {
        setExplorerWidth(nextWidth);
      } else {
        setPropsWidth(nextWidth);
      }
    }

    function onMouseUp(): void {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function updateControlState(update: (state: ControlState) => ControlState): void {
    if (!selectedComponent) {
      return;
    }

    setComponentStates(previousState => {
      const currentState = previousState[selectedComponentKey] ?? initControlState(selectedComponent);

      return {
        ...previousState,
        [selectedComponentKey]: update(currentState),
      };
    });
  }

  function updatePropValue(propName: string, value: unknown): void {
    updateControlState(state => ({
      ...state,
      values: {
        ...state.values,
        [propName]: value,
      },
    }));
  }

  function updateOptionalEnabled(propName: string, enabled: boolean): void {
    updateControlState(state => ({
      ...state,
      optionalEnabled: {
        ...state.optionalEnabled,
        [propName]: enabled,
      },
    }));
  }

  function toggleFolder(path: string): void {
    setOpenFolders(previousState => ({
      ...previousState,
      [path]: !previousState[path],
    }));
  }

  function resetSavedLayout(): void {
    try {
      window.localStorage.removeItem(LAYOUT_STORAGE_KEY);
    } catch {
      // Ignore storage deletion failures and continue with reload.
    }

    window.location.reload();
  }

  function resetSavedState(): void {
    try {
      window.localStorage.removeItem(PLAYGROUND_STATE_STORAGE_KEY);
    } catch {
      // Ignore storage deletion failures and continue with reload.
    }

    window.location.reload();
  }

  function renderFolder(folder: TreeFolder, depth = 0): ReactNode {
    const isOpen = openFolders[folder.fullPath] ?? true;

    return (
      <div className={styles.treeFolder} key={folder.fullPath}>
        <button
          className={styles.treeFolderButton}
          onClick={() => toggleFolder(folder.fullPath)}
          style={{ paddingLeft: `${TREE_BASE_INDENT + (depth * TREE_DEPTH_STEP)}px` }}
          type="button"
        >
          <span className={styles.folderChevron}>{isOpen ? <FiChevronDown /> : <FiChevronRight />}</span>
          <FiFolder className={styles.folderIcon} />
          <span className={styles.folderName}>{formatSegmentName(folder.name)}</span>
          <span className={styles.folderCount}>{folder.count}</span>
        </button>

        {isOpen && (
          <div className={styles.treeChildren}>
            {folder.folders.map(entry => renderFolder(entry, depth + 1))}

            {folder.components.map(componentPath => {
              const name = componentPath.split("/").pop() ?? componentPath;
              const isActive = componentPath === selectedPath;

              return (
                <button
                  className={isActive ? styles.treeComponentActive : styles.treeComponent}
                  key={componentPath}
                  onClick={() => applyPath(componentPath)}
                  style={{ paddingLeft: `${TREE_BASE_INDENT + TREE_CHILD_INDENT + (depth * TREE_DEPTH_STEP)}px` }}
                  type="button"
                >
                  <FiFile className={styles.componentIcon} />
                  <span>{formatSegmentName(name)}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell} ref={shellRef} style={shellStyle}>
        <aside className={`${styles.explorerPanel} ${explorerCollapsed ? styles.panelCollapsed : ""}`}>
          <header className={styles.panelHeader}>
            {!explorerCollapsed && (
              <>
                <span className={styles.panelTitleWithIcon}>
                  <FiFolder />
                  Explorer
                </span>
                <span className={styles.panelCount}>{componentPaths.length}</span>
              </>
            )}

            <button
              className={styles.panelCollapseButton}
              onClick={() => setExplorerCollapsed(previousState => !previousState)}
              title={explorerCollapsed ? "Expand explorer" : "Collapse explorer"}
              type="button"
            >
              {explorerCollapsed ? <FiChevronRight /> : <FiChevronLeft />}
            </button>
          </header>

          {!explorerCollapsed && (
            <div className={styles.explorerContent}>
              {treeFolders.map(folder => renderFolder(folder))}

              {componentPaths
                .filter(path => !path.includes("/"))
                .map(componentPath => {
                  const isActive = componentPath === selectedPath;

                  return (
                    <button
                      className={isActive ? styles.treeComponentActive : styles.treeComponent}
                      key={componentPath}
                      onClick={() => applyPath(componentPath)}
                      style={{ paddingLeft: `${TREE_BASE_INDENT}px` }}
                      type="button"
                    >
                      <FiFile className={styles.componentIcon} />
                      <span>{formatSegmentName(componentPath)}</span>
                    </button>
                  );
                })}
            </div>
          )}
        </aside>

        <div
          className={styles.resizeHandle}
          onMouseDown={event => startResize("explorer", event)}
          role="separator"
        />

        <aside className={`${styles.propsPanel} ${propsCollapsed ? styles.panelCollapsed : ""}`}>
          <header className={styles.panelHeader}>
            {!propsCollapsed && (
              <>
                <span className={styles.panelTitleWithIcon}>
                  <FiSliders />
                  Props
                </span>
                <span className={styles.currentComponentLabel}>{formatSegmentName(selectedPath.split("/").pop() ?? "") || "None"}</span>
              </>
            )}

            <div className={styles.panelHeaderActions}>
              {!propsCollapsed && (
                <button
                  className={styles.panelCollapseButton}
                  onClick={resetSavedState}
                  title="Reset saved playground state"
                  type="button"
                >
                  <FiRotateCcw />
                </button>
              )}

              <button
                className={styles.panelCollapseButton}
                onClick={() => setPropsCollapsed(previousState => !previousState)}
                title={propsCollapsed ? "Expand props" : "Collapse props"}
                type="button"
              >
                {propsCollapsed ? <FiChevronRight /> : <FiChevronLeft />}
              </button>
            </div>
          </header>

          {!propsCollapsed && (
            <div className={styles.propsContent}>
              {selectedComponent ? (
                <>
                  <div className={styles.exportRow}>
                    <label className={styles.exportLabel} htmlFor="component-export">
                      Export
                    </label>

                    <select
                      className={styles.compactSelect}
                      id="component-export"
                      onChange={event => setSelectedExportNameInput(event.target.value)}
                      value={selectedExportName}
                    >
                      {availableExports.map(entry => (
                        <option key={entry.key} value={entry.exportName}>
                          {entry.exportName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedComponent.props.map(prop => {
                    const typeBadge = getTypeBadgeInfo(prop);
                    const propValue = controlState.values[prop.name];
                    const optionalIsEnabled = controlState.optionalEnabled[prop.name] ?? false;
                    const controlDisabled = prop.optional && !optionalIsEnabled;

                    const optionalStateClass = prop.optional
                      ? (optionalIsEnabled ? styles.propBlockEnabled : styles.propBlockDisabled)
                      : "";

                    return (
                      <section className={`${styles.propBlock} ${optionalStateClass}`} key={prop.name}>
                        <div className={styles.propMetaRow}>
                          <span className={styles.propName}>{prop.name}</span>
                          <span className={`${styles.typeBadge} ${styles[`typeBadge${typeBadge.kind.charAt(0).toUpperCase()}${typeBadge.kind.slice(1)}`]}`}>
                            {typeBadge.label}
                          </span>
                        </div>

                        {prop.control === "select" && (
                          <select
                            className={styles.compactSelect}
                            disabled={controlDisabled}
                            onChange={event => updatePropValue(prop.name, valueFromSelect(event.target.value, prop.options))}
                            value={String(propValue ?? prop.options?.[0] ?? "")}
                          >
                            {(prop.options ?? []).map(option => (
                              <option key={String(option)} value={String(option)}>
                                {String(option)}
                              </option>
                            ))}
                          </select>
                        )}

                        {prop.control === "text" && (
                          <input
                            className={styles.compactInput}
                            disabled={controlDisabled}
                            onChange={event => updatePropValue(prop.name, event.target.value)}
                            type="text"
                            value={String(propValue ?? "")}
                          />
                        )}

                        {prop.control === "number" && (
                          <input
                            className={styles.compactInput}
                            disabled={controlDisabled}
                            onChange={event => {
                              const nextValue = Number(event.target.value);
                              updatePropValue(prop.name, Number.isFinite(nextValue) ? nextValue : 0);
                            }}
                            step="any"
                            type="number"
                            value={typeof propValue === "number" ? propValue : 0}
                          />
                        )}

                        {prop.control === "json" && (
                          <textarea
                            className={styles.compactTextarea}
                            disabled={controlDisabled}
                            onChange={event => updatePropValue(prop.name, event.target.value)}
                            rows={3}
                            value={String(propValue ?? "")}
                          />
                        )}

                        {prop.control === "jsx" && (
                          <textarea
                            className={styles.compactTextarea}
                            disabled={controlDisabled}
                            onChange={event => updatePropValue(prop.name, event.target.value)}
                            placeholder="<span>Hello</span>"
                            rows={4}
                            value={String(propValue ?? "")}
                          />
                        )}

                        {prop.control === "boolean" && (
                          <label className={styles.switch}>
                            <input
                              checked={Boolean(propValue)}
                              disabled={controlDisabled}
                              onChange={event => updatePropValue(prop.name, event.target.checked)}
                              type="checkbox"
                            />
                            <span className={styles.switchTrack} />
                          </label>
                        )}

                        {prop.optional && (
                          <label className={styles.optionalRow}>
                            <input
                              className={styles.optionalCheckbox}
                              checked={optionalIsEnabled}
                              onChange={event => updateOptionalEnabled(prop.name, event.target.checked)}
                              type="checkbox"
                            />
                            <span>include</span>
                          </label>
                        )}

                        {previewState.jsonErrors[prop.name] && (
                          <p className={styles.propError}>{previewState.jsonErrors[prop.name]}</p>
                        )}
                      </section>
                    );
                  })}

                  <details className={styles.importsDetails}>
                    <summary className={styles.importsSummary}>JSX Imports (Advanced)</summary>
                    <p className={styles.importsHint}>
                      {"One ESM import per line. Example: import { FaArrowCircleRight } from \"react-icons/fa\";"}
                    </p>
                    <textarea
                      className={styles.importsTextarea}
                      onChange={event => setImportsInput(event.target.value)}
                      placeholder={"import { FaArrowCircleRight } from \"react-icons/fa\";"}
                      rows={4}
                      value={importsInput}
                    />
                  </details>
                </>
              ) : (
                <p className={styles.panelMuted}>Select a component in the explorer.</p>
              )}
            </div>
          )}
        </aside>

        <div
          className={styles.resizeHandle}
          onMouseDown={event => startResize("props", event)}
          role="separator"
        />

        <section className={styles.previewPanel}>
          <header className={styles.previewToolbar}>
            <div className={styles.viewportButtons}>
              {VIEWPORTS.map(entry => {
                const label = formatViewportWidth(entry.width);

                return (
                  <button
                    aria-label={label}
                    className={entry.id === viewport ? styles.viewportButtonActive : styles.viewportButton}
                    key={entry.id}
                    onClick={() => setViewport(entry.id)}
                    type="button"
                  >
                    <FiMonitor className={styles.viewportIcon} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            <div className={styles.previewMeta}>
              <span className={styles.viewportReadout}>{formatViewportWidth(viewportConfig.width)}</span>
              <button
                className={styles.layoutResetButton}
                onClick={resetSavedLayout}
                title="Reset saved panel layout"
                type="button"
              >
                <FiRotateCcw />
              </button>
            </div>
          </header>

          <div className={styles.previewCanvas}>
            <div className={styles.deviceWindow} style={previewFrameStyle}>
              <div className={styles.deviceChrome}>
                <div className={styles.windowDots}>
                  <span />
                  <span />
                  <span />
                </div>
                <span className={styles.windowLabel}>
                  {formatViewportWidth(viewportConfig.width)}
                </span>
              </div>

              <iframe className={styles.previewFrame} src={previewSrc} title="Component preview" />
            </div>
          </div>

          <footer className={styles.previewFooter}>
            <span className={styles.footerPrimary}>{formatSegmentName(selectedPath.split("/").pop() ?? "Component")}</span>
            <span className={styles.footerDivider}>·</span>
            <span>{formatViewportWidth(viewportConfig.width)}</span>
          </footer>
        </section>
      </section>
    </main>
  );
}
