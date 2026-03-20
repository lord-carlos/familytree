FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock* ./
COPY client/package.json ./client/
RUN bun install --frozen-lockfile
COPY client ./client
RUN cd client && bun run build

FROM oven/bun:1-slim
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production
COPY server.ts ./
COPY --from=builder /app/client/dist ./client/dist
EXPOSE 3000
CMD ["bun", "run", "server.ts"]
