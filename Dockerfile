FROM node:20-bookworm-slim AS base

# Shared OS dependencies for build/runtime:
# - jq is used later in the Dockerfile to read package.json
# - Playwright install-deps ensures Chromium runtime libraries are present
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  jq \
  && rm -rf /var/lib/apt/lists/*
RUN npx -y playwright@1.51.1 install-deps chromium

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Update and enable Corepack
RUN npm install -g corepack@latest

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# install require in the middle package
RUN pnpm add require-in-the-middle@"$(jq -r '.dependencies["require-in-the-middle"]' < package.json)"

# Install Playwright Chromium during image build
RUN pnpm exec playwright install chromium


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT=standalone

# Update and enable Corepack
RUN npm install -g corepack@latest

RUN --mount=type=secret,id=DATABASE_URI,env=DATABASE_URI \
  --mount=type=secret,id=NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,env=NEXT_PUBLIC_GOOGLE_MAPS_API_KEY \
  --mount=type=secret,id=NEXT_PUBLIC_IS_LIVE,env=NEXT_PUBLIC_IS_LIVE \
  --mount=type=secret,id=NEXT_PUBLIC_S3_HOSTNAME,env=NEXT_PUBLIC_S3_HOSTNAME \
  --mount=type=secret,id=NEXT_PUBLIC_SENTRY_DSN,env=NEXT_PUBLIC_SENTRY_DSN \
  --mount=type=secret,id=NEXT_PUBLIC_SERVER_URL,env=NEXT_PUBLIC_SERVER_URL \
  --mount=type=secret,id=NEXT_PUBLIC_UPLOAD_PREFIX,env=NEXT_PUBLIC_UPLOAD_PREFIX \
  --mount=type=secret,id=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY,env=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY \
  --mount=type=secret,id=PAYLOAD_SECRET,env=PAYLOAD_SECRET \
  --mount=type=secret,id=PREVIEW_SECRET,env=PREVIEW_SECRET \
  --mount=type=secret,id=REDWOOD_PASSWORD,env=REDWOOD_PASSWORD \
  --mount=type=secret,id=REDWOOD_USERNAME,env=REDWOOD_USERNAME \
  --mount=type=secret,id=RESEND_API_KEY,env=RESEND_API_KEY \
  --mount=type=secret,id=S3_ACCESS_KEY_ID,env=S3_ACCESS_KEY_ID \
  --mount=type=secret,id=S3_BUCKET,env=S3_BUCKET \
  --mount=type=secret,id=S3_ENDPOINT,env=S3_ENDPOINT \
  --mount=type=secret,id=S3_REGION,env=S3_REGION \
  --mount=type=secret,id=S3_SECRET_ACCESS_KEY,env=S3_SECRET_ACCESS_KEY \
  --mount=type=secret,id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN \
  --mount=type=secret,id=UNSPLASH_ACCESS_KEY,env=UNSPLASH_ACCESS_KEY \
  --mount=type=secret,id=UNSPLASH_URL,env=UNSPLASH_URL \
  if [ -f pnpm-lock.yaml ]; then \
  corepack enable pnpm && \
  pnpm run build; \
  else \
  echo "Lockfile not found." && exit 1; \
  fi

# Worker image for Payload jobs (runs from source with installed deps)
FROM deps AS worker
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY . .
CMD ["pnpm", "worker:redwood"]

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=deps /ms-playwright /ms-playwright

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
