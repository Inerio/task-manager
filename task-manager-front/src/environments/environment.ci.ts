export const environment = {
  production: true,
  // CI: front http://localhost:4200, API http://localhost:8080
  apiUrl: "http://localhost:8080/api/v1",
  clientIdHeader: "X-Client-Id",
  uploadAcceptTypes: "image/*,application/pdf",
  uploadMaxBytes: 5 * 1024 * 1024, // 5 MB
  assetsVersion: "ci",
} as const;
