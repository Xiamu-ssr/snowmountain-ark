FROM node:24-alpine
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api
COPY spec ./spec
RUN pnpm install --frozen-lockfile && pnpm --filter @snowmountain/api build
ENV HOST=0.0.0.0 PORT=4310 DATA_DIR=/app/data SANDBOX_DRIVER=local
EXPOSE 4310
CMD ["node", "apps/api/dist/server.js"]
