FROM node:24-alpine AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build

COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/
RUN npm run build

FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
RUN mkdir -p /app/data && chown -R node:node /app/data

EXPOSE 8080
USER node

CMD ["node", "dist/main.js"]
