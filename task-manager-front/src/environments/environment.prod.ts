export const environment = {
  production: true,
  apiUrl: "/api/v1",
  sseUrl: "/api/v1/sse",
  clientIdHeader: "X-Client-Id",
  uploadAcceptTypes: "image/*,application/pdf",
  uploadMaxBytes: 5 * 1024 * 1024, // 5 MB
  // Bump on each release to bust /i18n/*.json caches.
  assetsVersion: "2025-09-11-01",
} as const;
