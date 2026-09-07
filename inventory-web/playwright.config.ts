import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  outputDir: "output/playwright/results",
  use: { baseURL: "http://localhost:3105", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "phone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: "node tests/mock-supabase.mjs",
      url: "http://127.0.0.1:55440",
      reuseExistingServer: false,
    },
    {
      command: "node node_modules/next/dist/bin/next dev --port 3105",
      url: "http://localhost:3105/login",
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55440",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key-only",
        SUPABASE_SERVICE_ROLE_KEY: "test-service-key-only",
        CRON_SECRET: "test-cron-secret-only",
      },
    },
  ],
});
