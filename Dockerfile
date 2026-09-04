# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
ARG NPM_REGISTRY="https://registry.npmmirror.com"
RUN --mount=type=cache,target=/root/.npm \
  npm config set registry "${NPM_REGISTRY}" \
  && npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm config set fetch-timeout 600000 \
  && npm config set maxsockets 8 \
  && npm ci --prefer-offline --no-audit --no-fund

COPY . .

ARG NEXT_PUBLIC_DOWNLOAD_URL=""
ARG NEXT_PUBLIC_MACOS_DOWNLOAD_URL=""
ARG NEXT_PUBLIC_MOBILE_DOWNLOAD_URL="https://api.unmind.art/v1/mobile/apk"
ARG NEXT_PUBLIC_API_BASE_URL="https://api.unmind.art"
ENV NEXT_PUBLIC_DOWNLOAD_URL=${NEXT_PUBLIC_DOWNLOAD_URL}
ENV NEXT_PUBLIC_MACOS_DOWNLOAD_URL=${NEXT_PUBLIC_MACOS_DOWNLOAD_URL}
ENV NEXT_PUBLIC_MOBILE_DOWNLOAD_URL=${NEXT_PUBLIC_MOBILE_DOWNLOAD_URL}
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

ENV NEXT_TELEMETRY_DISABLED=1
RUN NODE_OPTIONS=--max-old-space-size=1024 npm run build

FROM nginx:1.27-alpine AS runner

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist/client /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
