import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: [
        "src/app/page.tsx",
        "src/app/login/{page,login-form}.tsx",
        "src/app/actions/*.ts",
        "src/app/auth/callback/route.ts",
        "src/app/onboarding/organization-form.tsx",
        "src/app/dashboard/**/*-form.tsx",
        "src/domain/**/*.ts",
        "src/lib/env.ts",
        "src/lib/auth/redirect.ts",
        "src/lib/dogs/**/*.ts",
        "src/lib/billing/**/*.ts",
        "src/lib/api/**/*.ts",
        "src/lib/server/**/*.ts",
        "src/lib/supabase/{client,server,proxy,admin}.ts",
        "src/app/api/{health,ready}/route.ts",
        "src/app/api/v1/**/*.ts",
      ],
      exclude: ["**/*.test.{ts,tsx}", "src/test/**"],
      thresholds: {
        perFile: true,
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
});
