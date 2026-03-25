import { Fragment, type ReactElement } from "react";

/**
 * Formats text with line breaks and paragraph breaks into React elements.
 *
 * @remarks
 * This function splits the input text by double newlines to create paragraphs, then renders each paragraph with single
 * newlines converted to `<br />` elements. Empty paragraphs are filtered out.
 *
 * @param text - The text to format, with `\n` for line breaks and `\n\n` for paragraph breaks.
 * @returns A React fragment containing formatted paragraphs with line break elements.
 */
export function formatLineBreaks(text: string): ReactElement {
  const paragraphs = text.split("\n\n").filter(Boolean);
  return (
    <Fragment>
      {paragraphs.map((para, i) => (
        <p key={i}>
          {para.split("\n").map((line, j, arr) => (
            <Fragment key={j}>
              {line}
              {j < arr.length - 1 && <br />}
            </Fragment>
          ))}
        </p>
      ))}
    </Fragment>
  );
}

/**
 * Converts a string to snake_case format.
 *
 * @remarks
 * This function transforms strings by converting camelCase to snake_case, replacing spaces, hyphens, and dots with
 * underscores, removing other special characters, and converting to lowercase.
 *
 * @param str - The string to convert.
 * @returns The converted snake_case string.
 */
export function toSnakeCase(str: string): string {
  return str
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s\-\.]+/g, "_")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase();
}

/**
 * Converts a string to title case format.
 *
 * @remarks
 * This function transforms strings by splitting on underscores, hyphens, whitespace, or camelCase boundaries, then
 * capitalises the first letter of each word whilst converting the remainder to lowercase, and joins them with spaces.
 *
 * @param str - The string to convert.
 * @returns The converted title case string.
 */
export function toTitleCase(str: string): string {
  return str
    .split(/[_\-\s]+|(?<=[a-z])(?=[A-Z])/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}