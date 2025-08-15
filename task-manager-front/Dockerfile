# ---------- Build Angular app ----------
FROM node:22-alpine AS build
WORKDIR /app

# Permet d'overrider le type de build (production par défaut)
ARG BUILD_CONFIG=production

COPY package*.json ./
RUN npm ci

COPY . .
# build prod par défaut, ou dev si BUILD_CONFIG=development
RUN npm run build -- --configuration ${BUILD_CONFIG}

# ---------- Nginx to serve SPA ----------
FROM nginx:1.27-alpine

# utilitaire léger pour le healthcheck
RUN apk add --no-cache curl

# Nginx conf (SPA + proxy /api + /health)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Angular 16+/20 -> dist/<app>/browser
COPY --from=build /app/dist/task-manager-front/browser /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl -fsS http://localhost/health || exit 1
