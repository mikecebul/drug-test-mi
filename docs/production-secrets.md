# Production Secrets

Dokploy is the source of truth for production values. Store the full production `.env` in Dokploy/server, and mirror only the build-time subset into GitHub Actions secrets for Docker image builds.

GitHub secret values cannot be exported back out after they are saved. If a value is missing, recover it from Dokploy or the upstream provider, then re-save it in GitHub if the Docker build needs it.

Use `env/production.env.example` as the maintained inventory of:

- every production variable
- whether it is needed at build time or only at runtime
- which values should never be part of the app runtime env

## Recovery and generation

- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`: `openssl rand -base64 32`
- `PAYLOAD_SECRET`: `openssl rand -hex 32`
- `PREVIEW_SECRET`: `openssl rand -hex 32`
- `SOURCE_API_KEY`: `openssl rand -hex 32`
- `CALCOM_WEBHOOK_SECRET`: `openssl rand -hex 32`
- Provider-issued values such as S3, Stripe, Resend, Redwood, and Sentry should be recovered from the provider console.

## Sync process

1. Update the value in Dokploy/server first.
2. If the variable is listed in the `Build + runtime` section, mirror the same value into the matching GitHub Actions secret.
3. Run `node scripts/validate-production-env.mjs` before shipping Docker or workflow changes.
