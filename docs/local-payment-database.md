# Local development services

`docker-compose.yml` owns one Docker Desktop group named `drug-test-mi`:

- `mongo`: MongoDB 8.0.10 replica set, host port 28017.
- `mailpit`: SMTP on host port 1026, inbox at http://localhost:8026.
- `worker-redwood`: optional background worker, in the `redwood-worker` profile.

## Before running the app

Open Docker Desktop, then run these commands from this repository:

```sh
docker compose up -d --wait
pnpm db:check
pnpm dev
```

The Compose health check initializes a fresh replica set and waits for a writable
primary. `db:check` verifies the database selected by this repo’s `.env` supports
payments. Starting MongoDB and Mailpit does not post a payment or send email.

For a fresh checkout without the database volume, create it once:

```sh
docker volume create drug-test-mi-payments_payments-mongo-data
```

Existing installations reuse that volume directly. Its historical name is kept
so regrouping containers does not move or replace database data. Never copy data
again as part of normal startup, and never delete the volume to fix a startup error.
The old standalone volume `drug-test-mi_mongo-data` remains separate for rollback.

## Connection settings

Keep the existing project database name when changing hosts or connection options:

```dotenv
DATABASE_URI=mongodb://127.0.0.1:28017/<same-project-database>?replicaSet=drug-test-mi-payments&directConnection=true
DOCKER_DATABASE_URI=mongodb://mongo:27017/<same-project-database>?replicaSet=drug-test-mi-payments&directConnection=true
EMAIL_HOST=localhost
EMAIL_PORT=1026
```

The host app connects through the published ports. The worker connects through
the Compose network to `mongo:27017` and `mailpit:1025`; its SMTP settings are
explicitly overridden in Compose. All services appear under `drug-test-mi`.

## Optional background worker

Start this only when you want clinic jobs and notifications to run:

```sh
docker compose --profile redwood-worker up -d --build --wait
```

After changing connection settings, recreate the worker with `up`; starting an
old stopped container in Docker Desktop does not update its environment. Restart
a running host app after changing `.env`.

## Existing standalone data

Before copying an existing standalone database into a fresh replica-set volume,
back up the database and `.env` privately, stop project writers, and copy only the
intended `drug-test-mi` database. Verify documents, indexes, and transaction
support before switching the app. Preserve the original volume and backups;
neither normal startup nor container regrouping requires another database copy.
