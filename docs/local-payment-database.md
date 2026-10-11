# Local payments database

Cash posting and account credit update multiple records atomically. The standalone
development MongoDB supports pending charges and unpaid collection, but not posting
money. Admins and super-admins use the same transaction safeguards.

`docker-compose.payments.yml` defines a separate development replica set for this
project. It uses MongoDB 8.0.10, matching the inspected local server, its own Docker
project and data volume, and port 28017 bound to localhost. It does not convert or
restart the existing MongoDB server on port 27017.

## Before running the app

Open Docker Desktop, then run these commands from this repository:

```sh
docker compose -f docker-compose.payments.yml up -d --wait
pnpm db:check
pnpm dev
```

The Compose health check initializes the replica set on its first start and waits
for a writable primary. `db:check` checks the database selected by this repo’s
`.env`, so a healthy container with an incorrect app connection does not pass.
Neither command posts a payment or sends email. The named volume preserves data
between restarts; do not use `down -v` unless you intend to delete that volume.

The existing standalone service on port 27017 is not the payment database. Only
copy existing data during the initial setup below, never on each startup.

Before changing the running app's connection:

1. Back up this project's existing database and `.env` privately.
2. Start the separate service with
   `docker compose -f docker-compose.payments.yml up -d --wait`.
3. Copy only the current `drug-test-mi` project database into the initially empty
   replica set, preserving its database name. Check collection counts and critical
   client, booking, test, and payment records before switching.
4. Update only this project's `DATABASE_URI` to
   `mongodb://127.0.0.1:28017/<same-project-database>?replicaSet=drug-test-mi-payments&directConnection=true`.
5. Restart this project's development app. Verify a transaction can begin, roll
   back a disposable probe, and then let the operator retry the payment.

Do not run collection, SMTP, Stripe, or clinic jobs while verifying the copied
database. Keep the original database and backup intact for rollback. No real
payment is submitted by database setup.

The existing worker Compose configuration uses a different network. Before
starting or recreating the optional worker, set `DOCKER_DATABASE_URI` to the same
project database through Docker Desktop’s host gateway:

```dotenv
DOCKER_DATABASE_URI=mongodb://host.docker.internal:28017/<same-project-database>?replicaSet=drug-test-mi-payments&directConnection=true
```

Do not leave a worker processing the old standalone database while the app uses
the copied replica-set database. Database setup does not start worker jobs.
