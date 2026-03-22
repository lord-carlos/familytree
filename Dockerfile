FROM oven/bun:1 AS builder
ARG VITE_PAGE_TITLE=Family Tree
ENV VITE_PAGE_TITLE=$VITE_PAGE_TITLE
WORKDIR /app
COPY package.json bun.lock* ./
COPY client/package.json ./client/
COPY client/bun.lock* ./client/
RUN bun install --frozen-lockfile
RUN cd client && bun install --frozen-lockfile
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
