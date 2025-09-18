export const environment = {
  production: true,
  // In CI we serve the frontend on 127.0.0.1:4200 and backend on 127.0.0.1:8080
  apiUrl: "http://127.0.0.1:8080/api/v1",
  clientIdHeader: "X-Client-Id",
  uploadAcceptTypes: "image/*,application/pdf",
  uploadMaxBytes: 5 * 1024 * 1024, // 5 MB
  assetsVersion: "ci",
} as const;
