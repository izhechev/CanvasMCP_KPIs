# Canvas OAuth Authentication Flow

This document describes the Canvas OAuth login flow implemented in Issue #32. The flow allows Fontys students to authenticate with Canvas through their Teams bot integration.

## Flow Overview

The authentication process follows these steps:

1. Teams bot initiates login by directing student to `GET /auth/login`
2. Server renders a minimal HTML login page prompting the student to connect Canvas
3. Student clicks "Log in with Canvas" → `GET /auth/canvas`
4. Server generates a Canvas OAuth URL (with PKCE state) and redirects the student there
5. Student logs in to Canvas and grants permission
6. Canvas redirects to `GET /auth/canvas/callback` with authorization code and state
7. Server exchanges the code for access and refresh tokens
8. Server encrypts and stores the tokens keyed to the student's Teams user ID
9. Server redirects to Teams deep link using `returnTo` parameter to resume the chat

In summary: Teams bot → student browser → `/auth/login` → `/auth/canvas` → Canvas OAuth → `/auth/canvas/callback` → Teams deep link

## Required Environment Variables

All of the following must be set before the server starts. The server validates them at startup and throws immediately if any are missing or invalid.

- **`CANVAS_BASE_URL`** — The Canvas instance URL (e.g., `https://fhict.instructure.com`). Includes the protocol but no trailing slash.

- **`CANVAS_CLIENT_ID`** — The client ID from the Canvas Developer Key created for this application. Currently a placeholder until Fontys approves the key.

- **`CANVAS_CLIENT_SECRET`** — The client secret from the Canvas Developer Key. Currently a placeholder until Fontys approves the key.

- **`CANVAS_REDIRECT_URI`** — The OAuth redirect URI that Canvas will use to return the student to this service. Must exactly match the URI registered on the Canvas Developer Key (e.g., `http://localhost:3000/auth/canvas/callback` for local development, or `https://your-domain.com/auth/canvas/callback` in production).

- **`TOKEN_ENCRYPTION_KEY`** — A 32-byte encryption key (base64-encoded) used to encrypt tokens at rest. Generated during initial setup.

## Development Testing Without Canvas Credentials

To test the authentication flow locally without real Canvas credentials, use the development demo path:

```bash
export NODE_ENV=development
export CANVAS_TEST_TOKEN=your_test_canvas_token
export CANVAS_BASE_URL=https://fhict.instructure.com
export CANVAS_CLIENT_ID=placeholder
export CANVAS_CLIENT_SECRET=placeholder
export CANVAS_REDIRECT_URI=http://localhost:3000/auth/canvas/callback
export TOKEN_ENCRYPTION_KEY=<your-32-byte-base64-key>
npm run start
```

Then visit:

```
http://localhost:3000/auth/login?devStudentId=student123&returnTo=me@fontys.nl
```

The server will store the test token directly without contacting Canvas. If `returnTo` is provided, you'll be redirected to the Teams deep link. If not, you'll see a "You're connected!" page.

### Security Notes on Development Path

The development demo path is **structurally blocked** in production by two independent barriers:

1. **Controller-level gate** (`src/auth/auth.controller.ts`): The dev demo path only runs if `NODE_ENV !== 'production'`. Attempting to use `devStudentId` in production will be ignored.

2. **Startup-level gate** (`src/main.ts`): If `NODE_ENV === 'production'` and `CANVAS_TEST_TOKEN` is set, the server refuses to start with the error: `"CANVAS_TEST_TOKEN must not be set in production — it bypasses OAuth"`.

These two independent checks ensure that test tokens cannot accidentally be used in production.

## Production Deployment: When Real Fontys Credentials Arrive

Once Fontys has approved the Canvas Developer Key and provided the production credentials, follow this checklist:

1. **Set environment variables in production secrets** (never in git or source code):
   - `CANVAS_CLIENT_ID` → Production client ID from Canvas
   - `CANVAS_CLIENT_SECRET` → Production client secret from Canvas
   - `CANVAS_REDIRECT_URI` → Production redirect URI registered on the Canvas key (e.g., `https://your-domain.com/auth/canvas/callback`)
   - Ensure `NODE_ENV=production`
   - Ensure `CANVAS_TEST_TOKEN` is **not** set (server startup will reject it)

2. **Verify the redirect URI** exactly matches what was registered on the Canvas Developer Key.

3. **Smoke test the flow end-to-end**:
   - Navigate to the Teams bot's login flow
   - Authenticate with a test Fontys Canvas account
   - Verify the token is stored and the student is redirected back to Teams

4. **No code changes required** — the OAuth flow is fully implemented. Only environment variables need to be updated.

## Teams Deep Link Format

After successful authentication, the server redirects the student back to Teams using a deep link. The `returnTo` parameter (provided in the initial `/auth/login` request) is treated as opaque by this service and passed directly to the deep link:

```
https://teams.microsoft.com/l/chat/0/0?users=<returnTo>
```

The format and behavior of the deep link is currently subject to confirmation with the Teams bot layer (Kaan). See the TODO comment in `src/auth/auth.controller.ts` (lines 58 and 169).

## Token Storage and Expiry

- Tokens are encrypted at rest using the `TOKEN_ENCRYPTION_KEY` and stored keyed to the student's Teams user ID.
- Access tokens include an expiry time from Canvas (`expires_in`).
- Refresh tokens are stored for future renewal (not yet implemented).

## PKCE (Proof Key for Code Exchange)

The OAuth flow uses PKCE to prevent authorization code interception:

1. When generating the auth URL, a random `code_verifier` is created and hashed (SHA-256) to produce a `code_challenge`.
2. The challenge is sent to Canvas during the initial redirect.
3. During token exchange, the original verifier is sent to Canvas so it can verify that the same client started and completed the flow.

This prevents an attacker from intercepting the authorization code and using it on a different client.

## Error Handling

- If Canvas denies access (e.g., student clicks "Cancel"), Canvas redirects to the callback with `?error=access_denied`. The server returns a 400 response with the error message.
- If the state parameter doesn't match (CSRF attack or expired session), the server throws an `OAuthStateError` (401).
- If the token exchange fails (Canvas returns an error), the server throws a `TokenExchangeError` (401).

All error responses are converted to HTTP status codes by the global exception filter in `src/common/app-error.filter.ts`.
