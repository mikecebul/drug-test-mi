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
- Provider-issued values such as S3, Stripe, Resend, Redwood, Google Calendar, and Sentry should be recovered from the provider console.

## Sync process

1. Update the value in Dokploy/server first.
2. If the variable is listed in the `Build + runtime` section, mirror the same value into the matching GitHub Actions secret.
3. Run `node scripts/validate-production-env.mjs` before shipping Docker or workflow changes.

## Random-testing runtime values

These are runtime-only Dokploy values and do not belong in GitHub build secrets:

- ToxAccess: `REDWOOD_AUTOMATION_ENABLED`, `REDWOOD_USERNAME`, `REDWOOD_PASSWORD`, `REDWOOD_LOGIN_URL`, `REDWOOD_SCHEDULED_COLLECTIONS_URL`, and `REDWOOD_UPCOMING_COLLECTIONS_URL`
- Cal.com availability and booking: `CAL_API_KEY`, `RANDOM_TESTING_CALCOM_SCHEDULE_ID=840279`, and `RANDOM_TESTING_CALCOM_EVENT_TYPE_ID=3684719`
- Google Calendar: `GOOGLE_CALENDAR_ID`, `GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY`
- Optional booking-organizer fallback: `GOOGLE_CALENDAR_ORGANIZER_EMAIL`
- Optional Google delegation: leave `GOOGLE_CALENDAR_IMPERSONATED_USER` empty when the calendar is shared directly with the service account
- Client instructions: `RANDOM_TESTING_CALL_IN_PHONE` and `RANDOM_TESTING_CHECK_IN_URL`
- Scheduling and kill switch: `RANDOM_TESTING_SCHEDULE_SYNC_ENABLED`, `RANDOM_TESTING_UPCOMING_CRON`, and `RANDOM_TESTING_TODAY_CRON`
- Worker settings: `REDWOOD_WORKER_BATCH_LIMIT` and `REDWOOD_WORKER_POLL_MS`

Keep the Google private key on one line with literal `\n` separators if the Dokploy editor stores dotenv text. Never paste the key into chat, logs, Git, or a client-exposed environment variable.
