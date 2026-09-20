FROM node:22-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
# node:22-alpine already ships a "node" user (uid 1000) — run as that instead of root.
RUN mkdir -p /app/data && chown -R node:node /app
USER node
CMD ["node", "src/index.js"]
