FROM node:20-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

# Install deps
COPY package.json ./
COPY pnpm-lock.yaml ./

RUN pnpm install

# Copy rest
COPY . .

RUN pnpm run build

FROM node:20-alpine AS release

RUN npm install -g pnpm

WORKDIR /app

# Copy only the necessary files from the builder
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/pnpm-lock.yaml /app/pnpm-lock.yaml

# Install only production dependencies
RUN pnpm install --prod

ENTRYPOINT ["sh", "-c", "if [ -z \"$UPSTASH_EMAIL\" ] || [ -z \"$UPSTASH_API_KEY\" ]; then echo 'Error: Missing required environment variables UPSTASH_EMAIL and UPSTASH_API_KEY'; exit 1; fi; exec node dist/index.js run \"$UPSTASH_EMAIL\" \"$UPSTASH_API_KEY\""]

