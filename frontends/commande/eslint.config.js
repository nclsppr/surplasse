import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

// Unused-code detection lives here rather than in tsc (noUnusedLocals):
// ESLint only covers handwritten sources, the generated client is exempt.
export default tseslint.config({ ignores: ["dist"] }, ...tseslint.configs.recommended, {
  files: ["**/*.{ts,tsx}"],
  plugins: { "react-hooks": reactHooks },
  rules: {
    ...reactHooks.configs.recommended.rules,
    "@typescript-eslint/no-unused-vars": "error",
  },
});
