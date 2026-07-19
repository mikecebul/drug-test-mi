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
collections, and public site globals. It does not expose create, update, or delete tools. Admin accounts and
private media are not exposed.

Every request in every environment requires an MCP API key. Payload applies both the capabilities selected
on that key and the access rules of the admin associated with the key.

## Create a development key

1. Start the development server and sign in at `http://127.0.0.1:3000/admin`.
2. Open **MCP → API Keys** and create a key associated with an admin account.
3. Give it a clear label such as `Codex local development`.
4. Enable MCP traffic and allow `find` only for the collections needed by the current task. For booking
   inspection, enable `bookings`; `clients`, `test-types`, `courts`, and `employers` are usually helpful when
   tracing normalization and referral behavior.
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

The committed project configuration targets the local development server. To connect Codex to production,
create a separate production API key in the production Payload admin and add a user-level MCP server entry in
`~/.codex/config.toml` that points at the deployed `/api/mcp` URL. Reference a separate environment variable,
such as `PAYLOAD_PRODUCTION_MCP_API_KEY`, rather than placing the production key in the config file.

To remove the value from the launch environment:

```sh
launchctl unsetenv PAYLOAD_MCP_API_KEY
```
