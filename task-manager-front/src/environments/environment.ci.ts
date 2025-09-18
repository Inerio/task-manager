export const environment = {
  production: true,
  // In CI we serve the frontend at http://localhost:4200
  // and start the backend in the workflow at http://localhost:8080
  apiUrl: "http://localhost:8080/api/v1",
  clientIdHeader: "X-Client-Id",
  uploadAcceptTypes: "image/*,application/pdf",
  uploadMaxBytes: 5 * 1024 * 1024, // 5 MB
  // Cache-busting tag for i18n/assets in CI if needed
  assetsVersion: "ci",
} as const;
