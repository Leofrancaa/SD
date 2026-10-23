import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "test-results/admin.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 60000,
    env: {
      AUTH_SECRET: "e2e-secret-0123456789-0123456789-abc",
      ADMIN_PASSWORD: "admin-e2e",
      GERENCIA_PASSWORD: "gerencia-e2e",
    },
  },
});
