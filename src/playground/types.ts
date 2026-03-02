import type { ReactNode } from "react";

/**
 * Represents a value type accepted by playground options.
 *
 * @remarks
 * This type allows playground options to be specified as a boolean, number, or string value.
 */
export type PlaygroundOptionValue = boolean | number | string;

/**
 * Defines the available control types for playground properties.
 *
 * @remarks
 * This type restricts the set of permitted control representations used for component props in the playground
 * environment.
 */
export type PlaygroundControlType = "boolean" | "json" | "jsx" | "number" | "select" | "text";

/**
 * Represents metadata for a component property within the playground.
 *
 * @remarks
 * This interface defines the structure required to describe component props in the playground environment, including
 * control type, default value, optional status, valid options, and type description.
 */
export interface PlaygroundPropMeta {
  control: PlaygroundControlType;
  defaultValue: unknown;
  name: string;
  optional: boolean;
  options?: PlaygroundOptionValue[];
  typeText: string;
}

/**
 * Describes metadata for a component used within the playground.
 *
 * @remarks
 * This interface defines the structure for organising component metadata in the playground environment, including
 * export identity, file location, unique keys, and property specifications.
 */
export interface PlaygroundComponentMeta {
  exportName: string;
  filePath: string;
  key: string;
  path: string;
  props: PlaygroundPropMeta[];
}

/**
 * Defines the type for components rendered within the playground environment.
 *
 * @param props - A record of property names to values passed to the component.
 * @returns A React node to be rendered.
 */
export type PlaygroundComponentType = (props: Record<string, unknown>) => ReactNode;

/**
 * Specifies the type for asynchronous functions that load playground-related resources.
 *
 * @returns A promise resolving to the loaded resource.
 */
export type PlaygroundLoader = () => Promise<unknown>;

/**
 * Represents a mapping from string keys to playground loader functions.
 *
 * @remarks
 * This type is typically used to organise and access asynchronous loaders for playground resources, indexed by unique
 * keys.
 */
export type PlaygroundLoaderMap = Record<string, PlaygroundLoader>;
