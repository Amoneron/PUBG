FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx tsc --noEmit

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app .
CMD ["npx", "tsx", "src/headless.ts", "60"]
