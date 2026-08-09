# SPDX-FileCopyrightText: 2026 The HedgeDoc developers (see AUTHORS file)
#
# SPDX-License-Identifier: AGPL-3.0-only
FROM node:24.12.0-alpine AS build
WORKDIR /build
COPY package.json tsconfig.json ./
COPY src ./src
RUN npm install --no-package-lock --no-fund --no-audit fastify@^4.28.1 esbuild@^0.25.12 \
  && npx esbuild src/server.ts --bundle --platform=node --target=node20 --format=cjs --outfile=dist/server.cjs

FROM node:24.12.0-alpine
WORKDIR /app
COPY --from=build /build/dist/server.cjs ./server.cjs
ENV NODE_ENV=production
EXPOSE 8600
USER node
CMD ["node", "server.cjs"]
