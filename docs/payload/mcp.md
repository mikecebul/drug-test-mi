# Payload MCP access

The official `@payloadcms/plugin-mcp` integration exposes a streamable HTTP MCP server at:

```text
http://127.0.0.1:3000/api/mcp
```

The endpoint is enabled in development and production. Use the deployed application origin in production:

```text
https://<deployment-origin>/api/mcp
```

## Access model

The plugin configuration exposes read-only (`find`) tools for operational collections, selected content
collections, and public site globals. Admin accounts and private media are not exposed. A separate tool
grant allows super admins to send an itemized client payment request.

Every request in every environment requires an MCP API key. Payload applies both the capabilities selected
on that key and the access rules of the admin associated with the key.

## Create a development key

1. Start the development server and sign in at `http://127.0.0.1:3000/admin`.
2. Open **MCP → API Keys** and create a key associated with an admin account.
3. Give it a clear label such as `Codex local development`.
4. Enable MCP traffic and allow `find` only for the collections needed by the current task. For booking
   inspection, enable `bookings`; `clients`, `courts`, and `employers` are usually helpful when tracing
   normalization and referral behavior. Test types are static configuration and are not exposed as an MCP
   collection.
5. Save and copy the generated key. Payload only shows the complete key when it is generated.

## Connect Codex without committing the key

The project `.codex/config.toml` points Codex at the local endpoint and tells it to read the bearer token from
`PAYLOAD_MCP_API_KEY`. Do not put the key in `.codex/config.toml`, `.env`, shell history, or any committed file.

On macOS, store it in the login Keychain. Placing `-w` last makes `security` prompt without echoing the key:

```sh
security add-generic-password -a "$USER" -s "drug-test-mi-payload-mcp" -U -w
```

Before launching Codex, copy the key into the per-user launch environment without printing it:

```sh
launchctl setenv PAYLOAD_MCP_API_KEY "$(security find-generic-password -a "$USER" -s "drug-test-mi-payload-mcp" -w)"
```

Fully quit and reopen Codex after setting the variable or changing `.codex/config.toml`. The Keychain item is
persistent; the `launchctl` environment value may need to be restored after signing out or restarting macOS.

The project also includes a `payload_production` entry for the deployed `/api/mcp` endpoint. Use a separate
production key stored in `PAYLOAD_PRODUCTION_MCP_API_KEY` in the launch environment.

To remove the value from the launch environment:

```sh
launchctl unsetenv PAYLOAD_MCP_API_KEY
```

## Send an itemized client payment request

Grant `previewClientPayment` and `sendClientPayment` to a specific MCP key associated with a Super Admin.
Both grants default to off. Include read access to `clients`, `drug-tests`, and `payments` for record lookup
and payment tracking. Production uses the existing Stripe and Resend credentials and Stripe Checkout
webhook. MongoDB must support transactions. Run the app migrations before making the tools available.

1. Use `findClients` and `findDrugTests` to match the client, test dates, and charge amounts.
2. Call `previewClientPayment` with the client ID and exact test IDs, kinds, and amounts in USD cents.
   `screen` selects an outstanding screen balance. `confirmation` selects a recorded fee on a paid screen.
   `new-confirmation` records a specifically authorized fee when paid, on a test with a paid screen and
   no prior confirmation fee. The preview shows the account email and itemized total.
3. Once the user authorizes sending, call `sendClientPayment` with the same charges, the preview's
   `recipientEmail` as `expectedEmail`, and a UUID as `requestId`. Reuse that UUID if the call times out or
   email acceptance is uncertain. The result includes the payment ID and, in production, the Resend email ID.
4. Use `findPayments` with the payment ID to check its status. A pending request is awaiting Stripe payment.
   Stripe's paid event posts the payment to the selected tests and updates the client's balance. The hourly
   worker also reconciles paid or expired sessions. A payment amount that could not be applied generates an
   admin alert for refund review.
