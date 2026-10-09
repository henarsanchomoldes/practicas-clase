import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser", timeout: 30000, workers: 2,
  use: { baseURL: "http://127.0.0.1:4173", headless: true,
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {} },
  webServer: { command: "pnpm dev --port 4173", url: "http://127.0.0.1:4173", reuseExistingServer: !process.env.CI },
  reporter: "list"
});
