FROM node:20-bookworm-slim

# Set up user for Hugging Face Spaces (UID 1000)
RUN useradd -m -u 1000 user

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7860
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

RUN chown -R user:user /app

USER user

EXPOSE 7860

CMD ["yarn", "start"]

