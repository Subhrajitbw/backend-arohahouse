FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=9000
ENV HOST=0.0.0.0

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./

RUN yarn install --immutable

COPY . .

RUN yarn build

EXPOSE 9000

CMD ["yarn", "start"]
