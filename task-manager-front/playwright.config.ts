import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["BASE_URL"] || "http://localhost:4200";
const apiBase = process.env["API_BASE_URL"] || "http://localhost:8080/api/v1";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],
  use: {
    baseURL,
    video: process.env["CI"] ? "retain-on-failure" : "on",
    trace: process.env["CI"] ? "retain-on-failure" : "off",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Expose API base URL to tests (we also pass the UID inside the spec).
  metadata: { apiBase },
});
