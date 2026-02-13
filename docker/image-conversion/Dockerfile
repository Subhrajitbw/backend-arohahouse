FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Preinstall conversion dependencies so the action job is fast.
RUN npm install --no-save sharp @aws-sdk/client-s3

COPY scripts/image-conversions/convert-r2-images.mjs /app/convert-r2-images.mjs

CMD ["node", "/app/convert-r2-images.mjs"]
