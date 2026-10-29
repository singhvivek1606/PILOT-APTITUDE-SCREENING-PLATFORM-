import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", "dist/"] },
  js.configs.recommended,
  {
    // Renderer: classic browser scripts sharing window.AV* globals.
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser },
    },
  },
  {
    // Electron main process (CommonJS).
    files: ["electron/**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
  },
  {
    files: ["tests/**/*.mjs", "scripts/**/*.mjs", "*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
  },
];
