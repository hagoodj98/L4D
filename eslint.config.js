import js from "@eslint/js";
import globals from "globals";

export default [
  {
    //skips linting generated/vendor folders and node_modules
    ignores: ["node_modules/**", "public/**"],
  },
  //enables common bug-catching rules.
  js.configs.recommended,
  {
    // tells ESLint to lint .js files as modern ESM.
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
];
