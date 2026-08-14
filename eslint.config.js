import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import vitest from "@vitest/eslint-plugin";
import playwright from "eslint-plugin-playwright";
import prettier from "eslint-config-prettier";

/**
 * One flat config for web, server and e2e. Type-aware rules reach both workspace tsconfigs plus
 * the root one covering e2e through typescript-eslint's projectService.
 *
 * The workspaces compile with TypeScript 7, whose native build no longer exposes the JS compiler
 * API that type-aware linting is built on. Root devDependency `typescript` is pinned to 5.9 purely
 * as ESLint's analysis engine; `tsc --noEmit` in each workspace still runs 7.
 */
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "e2e/.tmp/**",
      "test-results/**",
      "playwright-report/**",
      "data/**",
    ],
  },

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  sonarjs.configs.recommended,

  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // `onChange={(e) => setName(e.target.value)}` is the React idiom and reads better than the
      // braced form the rule would otherwise demand at ~190 call sites. The rule still catches the
      // case worth catching: `return someVoidCall()` from a normal function.
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],

      // A number in a template literal is unambiguous. What this rule is worth keeping for is
      // `string | undefined`, which silently prints "undefined", and that stays an error.
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true },
      ],

      // These are what enforce "short functions, short modules" from STANDARDS.md.
      complexity: ["error", 15],
      "max-depth": ["error", 4],
      "max-lines": [
        "error",
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "error",
        { max: 80, skipBlankLines: true, skipComments: true },
      ],
      "max-params": ["error", 5],
    },
  },

  // Config files and plain scripts sit outside any tsconfig, so type-aware rules cannot run.
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },

  {
    files: ["web/src/**/*.{ts,tsx}"],
    extends: [
      reactHooks.configs.flat["recommended-latest"],
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: { globals: globals.browser },
  },

  {
    files: ["web/src/**/*.tsx"],
    extends: [reactRefresh.configs.vite],
  },

  {
    files: [
      "server/**/*.ts",
      "e2e/**/*.ts",
      "playwright.config.ts",
      "scripts/**",
    ],
    languageOptions: { globals: globals.node },
  },

  {
    files: ["e2e/**/*.ts"],
    extends: [playwright.configs["flat/recommended"]],
  },

  {
    files: ["server/test/**/*.ts", "web/src/**/*.test.{ts,tsx}"],
    extends: [vitest.configs.recommended],
    rules: {
      // A test body is one long arrow function by nature; splitting it hides the arrangement.
      "max-lines-per-function": "off",
      "max-lines": "off",
    },
  },

  // `no-non-null-assertion` and `non-nullable-type-assertion-style` pull against each other: one
  // forbids `x!`, the other asks for it in preference to `x as T`. Split them by where the mistake
  // lands. In a test a wrong assumption fails loudly and at once, which is what an assertion is
  // for; in src it can ship a crash, so the rule stays on there.
  {
    files: ["server/test/**/*.ts", "web/src/**/*.test.{ts,tsx}", "e2e/**/*.ts"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },

  prettier,
);
