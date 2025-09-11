export const environment = {
  production: false,
  apiUrl: "/api/v1",
  clientIdHeader: "X-Client-Id",
  uploadAcceptTypes: "image/*,application/pdf",
  uploadMaxBytes: 5 * 1024 * 1024, // 5 MB
  // Dev: keep static; caching is fine to bypass here.
  assetsVersion: "dev",
} as const;
