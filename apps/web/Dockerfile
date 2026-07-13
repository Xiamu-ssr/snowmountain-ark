FROM node:24-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile && pnpm --filter @snowmountain/web build

FROM nginx:1.27-alpine
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
