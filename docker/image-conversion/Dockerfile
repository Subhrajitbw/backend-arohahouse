FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache vips

COPY scripts/image-conversions/convert-r2-images.mjs .

RUN npm install sharp @aws-sdk/client-s3

CMD ["node","convert-r2-images.mjs"]