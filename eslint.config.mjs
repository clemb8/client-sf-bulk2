// @ts-check
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/", "docs/", "examples/", "coverage/", "node_modules/"],
  },
  ...tseslint.configs.recommendedTypeChecked,
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
