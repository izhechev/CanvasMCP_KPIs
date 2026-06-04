# Canvas MCP

NestJS-based MCP server that connects Microsoft Teams to Canvas LMS. Students ask questions in Teams; the bot uses an LLM to call Canvas tools and returns grades, announcements, and assignment feedback as Adaptive Cards.

## Architecture

```
Student → Teams → Bot (NestJS) → LLM (GPT-5) → MCP Server (FastMCP) → Canvas REST API
                                                        ↕
                                                 Token Store (PostgreSQL)
```

## Non-functional requirements

Load measurements taken with **autocannon v8.0.0** against the compiled production build (`npm run build` → `node dist/main.js`).  
Test conditions: 10 concurrent connections, 30 s duration per endpoint, PostgreSQL 16 running in Docker on localhost, Windows 11 laptop (no network hop).

| Endpoint | Req/s (avg) | Req/s (p50) | p50 lat | p95 lat | p99 lat | Errors |
|----------|-------------|-------------|---------|---------|---------|--------|
| `GET /health` | 10,670 | 10,815 | < 1 ms | 1 ms | 1 ms | 0 / 320,093 |
| `GET /auth/login` | 6,627 | 6,671 | 1 ms | 1 ms | 1 ms | 0 / 198,797 |
| `POST /mcp` (initialize) | 2,274 | 2,307 | 4 ms | 9 ms | 10 ms | 0 / 68,220 |

**Observations**

- `/health` is pure in-process (no I/O) — ~10 k req/s is consistent with a typical NestJS/Express baseline on a dev laptop.
- `/auth/login` renders ~700-byte HTML per request (URLSearchParams + template interpolation) and saturates at ~6.6 k req/s; it does not touch the database.
- The MCP `initialize` call establishes an SSE session (FastMCP httpStream transport) and does more per-request work: JSON-RPC parsing, capability negotiation, and streaming response. At ~2.3 k req/s / 4 ms p50 it is well within acceptable range. Real `tools/call` requests will additionally incur Canvas REST API latency (typically 100–400 ms network round-trip), so throughput for those is bounded by Canvas, not by this server.
- Error rate is **0% across all endpoints** at 10 concurrent connections.

**Reproducing the measurements**

```bash
# Prerequisites: app running on :3000 / :3001 (see Local setup below)
npm install -g autocannon

autocannon -c 10 -d 30 http://localhost:3000/health
autocannon -c 10 -d 30 "http://localhost:3000/auth/login?teamsUserId=test123"
autocannon -c 10 -d 30 -m POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -b '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"bench","version":"1.0"}}}' \
  http://localhost:3001/mcp
```

## Data minimisation (GDPR)

Canvas REST API responses contain many fields the LLM never needs: institution admin IDs, LTI/SCORM governance flags, anonymous grading settings, internal UUIDs. Each tool maps Canvas objects to a minimal shape before the data reaches the LLM context window. The table below was measured against real Canvas API responses from the Fontys production instance (one object per endpoint, July 2025).

| Tool | Raw fields | Mapped fields | Raw bytes | Mapped bytes | Reduction |
|---|---:|---:|---:|---:|---:|
| `get_courses` | 32 | 7 | 1,111 | 170 | 85% |
| `get_assignments` | 68 | 8 | 15,040 | 489 | 97% |
| `get_grades` | 33 | 9 | 8,324 | 220 | 97% |
| `get_announcements` | 53 | 6 | 6,422 | 2,665 | 59% |
| `get_feedback` | 33 | 6 | 8,324 | 138 | 98% |
| `get_calendar` | 19 | 8 | 21,912 | 1,315 | 94% |
| `get_inbox` | 19 | 7 | 828 | 298 | 64% |
| `get_submission_history` | 33 | 10 | 8,324 | 249 | 97% |
| **All 8 tools combined** | | | **70,285** | **5,544** | **92%** |

**92% of what Canvas returns never reaches the LLM.** Across a single user session that calls all 8 tools, 64,741 bytes of student and institutional data are discarded server-side before being forwarded.

Fields stripped include:
- **Institution admin data** (`account_id`, `root_account_id`, `enrollment_term_id`, `uuid`) — internal Canvas identifiers students and LLMs do not need
- **Technical/security fields** (`secure_params`, `lti_context_id`, `annotatable_attachment_id`) — LTI integration tokens and attachment IDs
- **Governance flags** (`moderated_grading`, `peer_reviews`, `post_to_sis`, `grade_passback_setting`, `anonymous_grading`) — 20+ assignment configuration fields
- **Redundant PII** (`grader_id`, `author_id`, `user_id` in submissions) — numeric IDs that duplicate the session identity already resolved server-side

The `get_announcements` reduction is lower (59%) because announcement bodies are large HTML documents and we preserve the full text after stripping HTML tags. The `get_calendar` raw size (21,912 bytes) is high because Canvas embeds the entire assignment object (68 fields) inside each calendar entry — the map throws away 60 of those fields.

**Design implication:** This 92% reduction is not incidental — it is the primary purpose of the tool layer. Without it, calling eight Canvas endpoints would forward ~70 KB of mixed student, institutional, and governance data to the LLM per request. With the mapping layer it is ~5.5 KB, all of it directly relevant to answering the student's question.

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
