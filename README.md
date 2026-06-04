# Canvas MCP

NestJS-based MCP server that connects Microsoft Teams to Canvas LMS. Students ask questions in Teams; the bot uses an LLM to call Canvas tools and returns grades, announcements, and assignment feedback as Adaptive Cards.

## Architecture

```
Student → Teams → Bot (NestJS) → LLM (GPT-5) → MCP Server (FastMCP) → Canvas REST API
                                                        ↕
                                                 Token Store (PostgreSQL)
```

## Test Coverage

Measured with `npm run test:cov` (166 tests, 21 suites):

| Area | Statements | Branches | Functions | Lines |
|------|-----------|----------|-----------|-------|
| **All files** | 82% | 76% | 78% | 83% |
| MCP tools | 95% | 78% | 90% | 100% |
| Token | 100% | 88% | 100% | 100% |
| Auth | 100% | 83% | 100% | 100% |
| Common (errors, http, filter) | 100% | 97% | 100% | 100% |

Notable gap: `canvas.service.ts` (11%) is an HTTP wrapper tested in E2E only.

## Prerequisites

- Node.js 24 (see `.nvmrc`)
- npm 10+
- Access to a Canvas LMS instance (Fontys: `https://fhict.instructure.com`)
- OpenAI API key
- PostgreSQL (for production; SQLite acceptable locally)

## Local setup

1. **Clone and install**

   ```bash
   git clone https://github.com/canvas-mcp/canvas-mcp.git
   cd canvas-mcp
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Fill in `.env`:

   | Variable | Where to get it |
   |----------|----------------|
   | `CANVAS_CLIENT_ID` | Canvas Admin → Developer Keys → New Key |
   | `CANVAS_CLIENT_SECRET` | Same page as above |
   | `OPENAI_API_KEY` | platform.openai.com |
   | `TOKEN_ENCRYPTION_KEY` | Run `openssl rand -hex 32` |

   Leave `CANVAS_BASE_URL`, `SESSION_INACTIVITY_DAYS`, `PORT`, and `NODE_ENV` as-is for local development.

3. **Run in development mode**

   ```bash
   npm run start:dev
   ```

   Server starts on `http://localhost:3000`.

4. **Run tests**

   ```bash
   npm test
   ```

5. **Lint**

   ```bash
   npm run lint
   ```

## Testing tools with MCP Inspector

[MCP Inspector](https://github.com/modelcontextprotocol/inspector) is the official tool for exercising MCP servers. Use it to call any Canvas tool with custom arguments and inspect the response.

1. Set `MCP_PORT=3001` in `.env` (or another free port) and start the server with `npm run start:dev`. The Nest log line `MCP server listening on port 3001` confirms the FastMCP HTTP transport is up.
2. In a second terminal:

   ```bash
   npm run inspector
   ```

3. In the Inspector UI, set **Transport** to `Streamable HTTP` and **URL** to `http://localhost:3001/mcp`, then connect.
4. Use the **Tools** tab to invoke `get_grades`, `get_courses`, etc. The `student_id` argument should match a Teams user ID for which a Canvas token has been stored (or, in non-production, set `CANVAS_TEST_TOKEN` in `.env` to bypass token lookup).

### Auth page

The login page requires a `teamsUserId` query parameter (normally injected by the Teams bot). Open it directly in the browser:

```
http://localhost:3000/auth/login?teamsUserId=test-student
```

**Dev shortcut** — skip Fontys OIDC entirely and store the test token in one step (requires `CANVAS_TEST_TOKEN` in `.env`):

```
http://localhost:3000/auth/login?devStudentId=test-student
```

This stores the token immediately and shows the "connected" page without any OAuth redirect. Only works when `NODE_ENV !== 'production'`.

### Full OAuth flow (no returnTo)

If you open the login page without a `returnTo` parameter and complete the Fontys OIDC login, the callback has nowhere to redirect and falls back to a debug page showing a one-time auth code:

```
Your Canvas account has been linked. Exchange this one-time code for a session token:
POST /auth/token  { "code": "1e9acd9d..." }
```

Exchange it for a session token:

```bash
curl -X POST http://localhost:3000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"code": "<code from the page>"}'
```

You get back `{ "token": "<64-char hex>" }`. Use that token as the `Authorization: Bearer <token>` header when connecting MCP Inspector to `http://localhost:3001/mcp` — the MCP server uses it to identify which student is calling the tools.

In real Teams usage the bot always passes a `returnTo` deep link, so the student is silently bounced back into Teams after OAuth and never sees this page.

## Canvas API sandbox setup

To test against Canvas without affecting real student data:

1. Log into your Canvas instance as an admin
2. Go to **Admin → Developer Keys → + Developer Key → API Key**
3. Set redirect URI to `http://localhost:3000/auth/canvas/callback`
4. Note the **Client ID** and **Client Secret** — add them to `.env`
5. Enable the key (toggle to ON)

If you do not have admin access to a Canvas instance, ask the project owner for a shared sandbox credential set.

## Available scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Start with hot reload |
| `npm run build` | Compile TypeScript |
| `npm test` | Run unit tests |
| `npm run test:cov` | Run tests with coverage report |
| `npm run lint` | Lint and auto-fix |
| `npm run inspector` | Launch MCP Inspector |

## Branch and commit conventions

- Feature branches: `feat/<short-description>`
- Commit prefixes: `feat:`, `fix:`, `docs:`, `refactor:`
- PRs target `main`; branch protection requires CI to pass
