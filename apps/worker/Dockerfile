FROM docker:27-cli AS docker-cli

FROM node:24-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker
RUN pnpm install --frozen-lockfile && pnpm --filter @snowmountain/worker build

FROM node:24-alpine
WORKDIR /app
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
ENV WORKER_HOST=0.0.0.0 WORKER_PORT=4312 WORKER_DATA_DIR=/data SANDBOX_IMAGE=alpine:3.20
EXPOSE 4312
CMD ["node", "apps/worker/dist/server.cjs"]
