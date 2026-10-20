FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-slim
LABEL org.opencontainers.image.source=https://github.com/Craftyplayz/Arrmy
# The release (1.1.0) or `latest`, so Arrmy can tell Discord which version the server runs.
ARG VERSION=dev
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1 ARRMY_VERSION=$VERSION
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY scripts/init.mjs ./
EXPOSE 3000
CMD ["node", "server.js"]
