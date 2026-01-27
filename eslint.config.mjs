import stylistic from "@stylistic/eslint-plugin";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import perfectionist from "eslint-plugin-perfectionist";
import tsdoc from "eslint-plugin-tsdoc";
import { defineConfig, globalIgnores } from "eslint/config";

/**
 * ESLint configuration for Borderlens.
 */
const eslintConfig = defineConfig([...nextVitals, ...nextTs, {
  plugins: {
    perfectionist,
    tsdoc,
    "@stylistic": stylistic,
  },
  rules: {
    "@stylistic/max-len": ["error", {
      code: 150,
      comments: 120,
      ignorePattern: "(?:(['\"`]).*\\1|^\\s*//.*$)",
    }],
    "@stylistic/indent": ["error", 2, { SwitchCase: 1 }],
    "@stylistic/semi": ["error", "always"],
    "@stylistic/quotes": ["error", "double"],
    "@stylistic/object-curly-spacing": ["error", "always"],
    "@stylistic/comma-spacing": ["error", {
      before: false,
      after: true,
    }],
    "@stylistic/comma-dangle": ["error", {
      arrays: "always-multiline",
      objects: "always-multiline",
      imports: "always-multiline",
      exports: "always-multiline",
      functions: "never",
      enums: "always-multiline",
      tuples: "always-multiline",
    }],
    "tsdoc/syntax": "error",
    "perfectionist/sort-exports": ["error", {
      type: "alphabetical",
      order: "asc",
      newlinesBetween: 1,
      groups: [
        "value-export",
        "type-export",
      ],
    }],
    "perfectionist/sort-imports": ["error", {
      type: "alphabetical",
      order: "asc",
      newlinesBetween: 1,
      groups: [
        "builtin",
        "external",
        "core-group",
        "database-group",
        "components-group",
        ["parent", "sibling", "index"],
        "type",
      ],
      customGroups: [
        {
          groupName: "core-group",
          modifiers: ["value"],
          elementNamePattern: "^#(config)$",
        },
        {
          groupName: "database-group",
          modifiers: ["value"],
          elementNamePattern: "^#(database)$",
        },
        {
          groupName: "components-group",
          modifiers: ["value"],
          elementNamePattern: "^#components(/.*)?$",
        },
      ],
      internalPattern: ["^#"],
    }],
  },
},
globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"])]);

export default eslintConfig;
