import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/*.test.ts", "tests/*.integration.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/validation.ts",
        "src/lib/cart-storage.ts",
        "src/lib/commerce.ts",
      ],
      reporter: ["text", "html"],
      thresholds: { lines: 70, statements: 70, functions: 70, branches: 70 },
    },
  },
});
