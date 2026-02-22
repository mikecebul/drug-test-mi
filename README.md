# MI Drug Test

## Table of Contents

- [What This System Does](#what-this-system-does)
- [Architecture Overview](#architecture-overview)
- [App Surfaces](#app-surfaces)
- [Core Domain Model (Collections + Relationships)](#core-domain-model-collections--relationships)
- [Drug Test Workflow Engine (Admin Wizard)](#drug-test-workflow-engine-admin-wizard)
- [Registration Flows (Frontend + Admin parity)](#registration-flows-frontend--admin-parity)
- [Email Automation and Recipient Resolution](#email-automation-and-recipient-resolution)
- [Integrations](#integrations)
- [Local Development Setup](#local-development-setup)
- [Testing](#testing)
- [Deployment (Dokploy)](#deployment-dokploy)
- [Environment Variables Reference (grouped)](#environment-variables-reference-grouped)
- [License](#license)

## What This System Does

MI Drug Test is a PayloadCMS + Next.js App Router application for running drug-testing operations end-to-end: public client intake/registration, internal technician/admin workflows, client self-service dashboard access, and automated email notifications tied to test lifecycle events.

## Architecture Overview

This repository combines a Next.js app and a Payload CMS backend in one codebase.

- Next.js App Router powers the public site, auth flows, client dashboard, and custom UI inside the Payload admin.
- Payload CMS manages operational data (clients, drug tests, referrals, bookings, etc.), CMS content, and admin access.
- MongoDB is the primary database (via `@payloadcms/db-mongodb`).
- Media/private documents use S3-compatible storage (Cloudflare R2-compatible setup via Payload S3 plugin).
- Email uses Resend in production and Nodemailer (local SMTP) in development.

## App Surfaces

### Frontend (`src/app/(frontend)/`)

Public marketing pages, auth flows, and the client-facing multi-step registration flow.

Key areas include:
- public pages rendered from Payload page blocks
- auth routes (`sign-in`, `register`, password reset, verify email)
- client registration wizard (`src/app/(frontend)/register/`)

### Client Dashboard (`src/app/dashboard/`)

Protected client portal for viewing results and managing profile-related data.

Key capabilities include:
- results access
- medication history updates
- profile management
- scheduling / Cal.com integration entry points

### Payload Admin (`src/app/(payload)/admin/`)

Payload admin UI plus custom operational views used by internal staff.

Custom admin views are registered in `src/payload.config.ts`, including:
- `DrugTestWizard` (`/admin/drug-test-upload`)
- `DrugTestTracker`
- analytics/dashboard helpers

## Core Domain Model (Collections + Relationships)

Collections live in `src/collections/`, and the active registered collection set is defined in `src/payload.config.ts`.

### Operations

- `Clients`: client identity, profile, medications, referral settings, recipient preferences
- `DrugTests`: test records, lifecycle state, attached/private documents, notification behavior
- `Technicians`: staff records and scheduling-related metadata
- `Admins`: Payload admin users for internal operations

### Referral Network

- `Courts`
- `Employers`

These provide referral presets (including contacts/recipient emails) that are reused by registration and drug-test notifications.

### Scheduling / Testing Metadata

- `Bookings`: booking records (including Cal.com webhook-created bookings)
- `TestTypes`: test metadata used by operational flows and scheduling labels

### CMS / Forms / Content

- `Pages`
- `Forms`
- `FormSubmissions`
- `Resources` (repo collection; check `src/payload.config.ts` for whether it is currently registered)

### Storage / Ops Support

- `Media`
- `PrivateMedia`
- `AdminAlerts`

### Recipient Resolution (important)

Drug test notification recipients are derived from client and referral data together:
- referral preset contacts from selected court/employer profiles
- client-specific additional recipients (`referralAdditionalRecipients`)
- deduped recipient resolution before sending stage emails

## Drug Test Workflow Engine (Admin Wizard)

The admin wizard (`src/views/DrugTestWizard/`) drives internal multi-step operational workflows for staff.

Supported workflows include:
- Register clients
- Create drug test records (instant test flow)
- Collect lab samples
- Enter lab screen results
- Enter lab confirmation results

Common workflow patterns:
- TanStack Form state with step-based navigation
- step-scoped validation before advancing
- PDF upload/extraction steps in instant/lab flows
- review/confirmation steps before record writes and email notifications

## Registration Flows (Frontend + Admin parity)

The public registration flow and admin register-client workflow intentionally mirror each other for step order, validation behavior, and data normalization.

Shared patterns include:
- multi-step TanStack Form flows
- shared/parallel form options and validation logic
- recipient selection for self, employer, and court referral scenarios
- optional medications step
- email verification flow after registration

Recent recipient flow behavior (important for maintenance):
- employer/court preset recipients can be selected from referral profiles
- users/staff can add client-specific additional recipients
- “new employer/court” flows can capture extra referral recipients that are saved to the new referral profile

## Email Automation and Recipient Resolution

Email sending is part of the operational workflow, not a standalone subsystem.

### Registration emails

Registration flows trigger automated emails such as:
- client verification email
- internal/admin notifications for new registrations

### Drug test lifecycle emails

Drug test workflows send stage-based notifications (for example, collection/screening/confirmation updates) and may include attachments depending on the workflow stage.

### Recipient composition

Notification recipient lists are composed from:
- referral preset recipients (court/employer contacts)
- client-level additional recipients (`referralAdditionalRecipients`)
- legacy/self-referral paths where applicable

The system deduplicates recipients so the same email is not sent multiple times.

### Migration note

A Payload migration (`src/migrations/20260222_042245_migration.ts`) backfills legacy self-referral recipient rows into the unified `referralAdditionalRecipients` field.

### Email test mode

`EMAIL_TEST_MODE=true` can be used to redirect operational notifications to a safe test recipient flow (see `.env.example`). This is useful during local/dev testing to avoid accidental sends.

## Integrations

### Cal.com

Used for appointment scheduling and booking workflows, including webhook ingestion for booking records.

### Resend

Production email delivery provider (Payload Resend adapter).

### Local SMTP / Mailpit (dev + e2e)

Development email uses Payload's Nodemailer adapter with local SMTP defaults (`localhost:1025`). Mailpit is a good fit for local inbox inspection and Playwright email assertions.

### S3 / R2-compatible object storage

Payload S3 storage plugin is used for media and private media storage (including signed downloads for private media).

### Stripe

Payload Stripe plugin is enabled for payment-related form flows/webhooks.

### Sentry / Glitchtip

Sentry plugin is configured in Payload and can be enabled/configured via environment variables as needed.

## Local Development Setup

### Prerequisites

- Node.js and pnpm versions compatible with `package.json` engines:
  - Node: `^20.19.0 || ^22.13.0 || >=24.0.0`
  - pnpm: `^9 || ^10`
- Docker + Docker Compose (recommended for local MongoDB)
- Optional: Mailpit (for local email inbox inspection and e2e email assertions)

### Environment setup

1. Copy the example env file:

```bash
cp .env.example .env
```

2. Fill in the values you need for your local use case.

Minimum local development usually requires:
- `PAYLOAD_SECRET`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- `NEXT_PUBLIC_SERVER_URL` (use a full URL like `http://localhost:3000`)
- `DATABASE_URI`

Notes:
- In development, Payload uses the Nodemailer adapter by default (`NODE_ENV !== 'production'`).
- If `EMAIL_HOST` / `EMAIL_PORT` are not set, the app defaults to `localhost:1025` (works well with Mailpit).
- `.env.example` includes many production/integration variables; not all are required for basic local startup.

### Local services

#### Start MongoDB (recommended via Docker Compose)

This repo includes a `docker-compose.yml` with `mongo` and a production-style `payload` service.

For normal local development, start only MongoDB and run the app with `pnpm dev`:

```bash
docker compose up -d mongo
```

Notes:
- The compose file also defines a `payload` container intended for containerized/prod-like runs.
- Most local development is simpler with a local Node process (`pnpm dev`) plus the compose MongoDB container.

#### Optional: Run Mailpit for local email inspection

Example Docker command:

```bash
docker run --rm -p 1025:1025 -p 8025:8025 axllent/mailpit
```

Mailpit URLs commonly used in this repo's e2e helpers:
- Web UI: `http://127.0.0.1:8025`
- API: `http://127.0.0.1:8025/api/v1`

### Install and start the app

```bash
pnpm install
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Migrations / build behavior

- `pnpm build` runs `payload migrate` before the Next.js build.
- Local build/dev tasks require MongoDB to be reachable.
- If you are testing email flows (especially e2e Mailpit assertions), local SMTP/Mailpit should also be running.

## Testing

### Unit / integration tests (Vitest)

```bash
pnpm test
```

UI mode:

```bash
pnpm test:ui
```

### End-to-end tests (Playwright)

Available scripts (from `package.json`):

```bash
pnpm test:e2e
pnpm test:e2e:wizard
pnpm test:e2e:registration
pnpm test:e2e:all
pnpm test:e2e:headed
pnpm test:e2e:ui
```

Playwright setup notes:
- Config file: `playwright.config.ts`
- Test suite location: `tests/e2e/`
- By default, Playwright starts the app automatically via `pnpm dev` unless `PLAYWRIGHT_BASE_URL` is set.
- Workers default to `1` for stability; override with `PLAYWRIGHT_WORKERS` if needed.

### E2E prerequisites and useful env vars

#### Admin autologin (in `.env.example`)

These support stable Payload admin login flows in e2e runs:
- `PAYLOAD_ADMIN_AUTOLOGIN_ENABLED`
- `PAYLOAD_ADMIN_AUTOLOGIN_EMAIL`
- `PAYLOAD_ADMIN_AUTOLOGIN_PASSWORD`

#### Playwright runner overrides (in `.env.example` / optional)

- `PLAYWRIGHT_BASE_URL`
- `PLAYWRIGHT_WORKERS`

#### Optional e2e helper envs (used by `tests/e2e/helpers/*`)

Some e2e helpers support additional env vars that may not be listed in `.env.example`:
- PDF fixture overrides: `E2E_PDF_INSTANT_PATH`, `E2E_PDF_LAB_SCREEN_PATH`, `E2E_PDF_LAB_CONFIRM_PATH`
- Mailpit config/assertions: `E2E_MAILPIT_API_BASE`, `E2E_SMTP_WEB_BASE`, `E2E_ENABLE_MAILPIT_ASSERTIONS`, `E2E_REQUIRE_EMAIL_TEST_MODE_FALSE`

E2E helpers also seed/cleanup data using Payload local API utilities under `tests/e2e/helpers/`.

## Deployment (Dokploy)

This project is self-hosted with Docker/Dokploy. MongoDB is also self-hosted alongside the app on the same VPS.

Important notes:
- `pnpm build` runs `payload migrate` before `next build`
- all required services (especially MongoDB) must be reachable during build/runtime
- keep production env vars consistent across deploys/instances

### Stable Next.js Server Action IDs

Set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` at build/runtime and reuse the same value across deployments/instances.

Generate once:

```bash
openssl rand -base64 32
```

## Environment Variables Reference (grouped)

Use `.env.example` as the canonical key list. The categories below are for orientation and maintenance.

### Core app / Payload

Examples:
- `PAYLOAD_SECRET`
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
- `PREVIEW_SECRET`
- `NEXT_PUBLIC_SERVER_URL`
- `NEXT_PUBLIC_IS_LIVE`

### Database

Examples:
- `DATABASE_URI` (MongoDB primary runtime DB)
- `LOCAL_DATABASE_URL` / `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` (repo includes additional DB-related vars for other flows/tools)

### Email (Resend / SMTP / safety)

Examples:
- `RESEND_DEFAULT_EMAIL`
- `RESEND_API_KEY`
- `EMAIL_TEST_MODE`
- local SMTP vars used by Payload dev adapter defaults/overrides: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`

### Playwright / E2E

Examples from `.env.example`:
- `PAYLOAD_ADMIN_AUTOLOGIN_ENABLED`
- `PAYLOAD_ADMIN_AUTOLOGIN_EMAIL`
- `PAYLOAD_ADMIN_AUTOLOGIN_PASSWORD`
- `PLAYWRIGHT_WORKERS`
- optional `PLAYWRIGHT_BASE_URL`

Additional optional helper envs are used by `tests/e2e/helpers/env.ts` (PDF fixture paths and Mailpit settings).

### Storage (S3 / R2-compatible)

Examples:
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_REGION`
- `S3_ENDPOINT`
- `S3_BUCKET`
- `NEXT_PUBLIC_S3_HOSTNAME`

### Third-party integrations

Examples:
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOKS_ENDPOINT_SECRET`
- Cal.com: `CALCOM_WEBHOOK_SECRET`
- Google Maps: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- Sentry/Glitchtip: `SENTRY_AUTH_TOKEN`

### Seed / import helpers

Examples:
- `SOURCE_API_URL`
- `SOURCE_API_KEY`

## License

MIT. See `LICENSE` for details.
