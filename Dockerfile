FROM node:24-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json yarn.lock* package-lock.json* ./
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; fi

FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY public ./public
RUN if [ -f yarn.lock ]; then yarn build; else npm run build; fi

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY package.json ./package.json

EXPOSE 3000
CMD ["node", "dist/src/index.js"]
