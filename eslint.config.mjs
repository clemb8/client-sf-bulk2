// @ts-check
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/", "docs/", "examples/", "coverage/", "node_modules/"],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    // Test-only relaxations. src/ keeps the recommended type-checked set intact.
    files: ["test/**/*.ts"],
    rules: {
      // vi.fn() members read off a mock object are not real unbound methods.
      "@typescript-eslint/unbound-method": "off",
      // Some tests must produce a non-Error rejection to prove the production
      // code wraps it into one.
      "@typescript-eslint/prefer-promise-reject-errors": "off",
    },
  },
  {
    languageOptions: {
      parserOptions: {
        // Covers src/, test/ and the config files; the build tsconfig stays
        // scoped to src/ so nothing but the library reaches dist/.
        project: ["./tsconfig.eslint.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
