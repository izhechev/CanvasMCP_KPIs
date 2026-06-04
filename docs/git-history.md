# Git History — Commits, PRs & Comments

## Contributors

| Login | Email |
|-------|-------|
| izhechev | iskren330@gmail.com |
| danpasecinic | — |

---

## Commits

| Hash | Author | Date | Message |
|------|--------|------|---------|
| `67860e7` | izhechev | 2026-05-12 | swallow 403s per course in get_feedback and get_submission_history |
| `4db15cd` | izhechev | 2026-05-12 | remove student_id param from get_grades tool |
| `62144fc` | izhechev | 2026-05-12 | fix(mcp): remove unused CanvasService import in get-feedback.ts |
| `b6859d5` | izhechev | 2026-05-12 | fix(canvas): add User-Agent and normalize URLs to prevent 401s |
| `3ae44d2` | izhechev | 2026-05-12 | fix(token): add defensive trimming and Bearer stripping to resolveToken |
| `cab39f5` | izhechev | 2026-05-12 | fix(common): export fetchAllPages utility for pagination |
| `0a5fb6f` | izhechev | 2026-05-12 | feat(mcp): diagnostic logging for 401s and refactored token resolution |
| `8438c7e` | izhechev | 2026-05-12 | feat(mcp): resolve tool issues and port functional fixes |
| `da583a7` | izhechev | 2026-05-03 | refactor: rename MCP tools and extracted tool definitions (#28) |
| `d05f168` | izhechev | 2026-05-03 | Merge pull request #27 from canvas-mcp/feat/fastmcp-setup |
| `980f444` | izhechev | 2026-04-23 | fix: address all code review findings from PR #27 |
| `86581b3` | izhechev | 2026-04-23 | feat: introduce typed domain errors (AppError hierarchy) with global exception filter |
| `bc2ce21` | izhechev | 2026-04-23 | refactor: replace per-tool error test copies with describe.each |
| `f7a8d65` | izhechev | 2026-04-23 | feat: add GET /health endpoint, fix e2e test, add e2e and coverage to CI |
| `27e5c16` | izhechev | 2026-04-23 | fix: guard CANVAS_TEST_TOKEN against production use, add CANVAS_REDIRECT_URI to .env.example |
| `c69144f` | izhechev | 2026-04-23 | refactor: map to SubmissionHistoryResult inside inner loop, remove _courseId/_courseName spread |
| `68908ac` | izhechev | 2026-04-23 | refactor: collapse fetchX wrappers into getX, replace 8 addTool blocks with TOOLS array |
| `38ea01b` | izhechev | 2026-04-23 | fix: throw BadRequestException/UnauthorizedException instead of raw Error for correct HTTP status codes |
| `71af62c` | izhechev | 2026-04-23 | feat: add PKCE (S256) to Canvas OAuth flow per OAuth 2.1 |
| `86d5301` | izhechev | 2026-04-22 | fix: add TTL and size cap to pendingStates, note process-local limitation |
| `a30223a` | izhechev | 2026-04-22 | fix: prevent reflected XSS by sending plain-text responses in auth callback |
| `43376db` | izhechev | 2026-04-22 | fix: explicitly import AuthModule, CanvasModule, TokenModule in AppModule |
| `0cd17d1` | izhechev | 2026-04-22 | fix: cast caught error to Error before Promise.reject to satisfy prefer-promise-reject-errors |
| `d9dd59c` | izhechev | 2026-04-22 | fix: resolve CI failures — action versions, lint rules, sync throws in token service |
| `f42670c` | izhechev | 2026-04-22 | refactor: add HttpError class, use fetchJson in canvas.service |
| `f9690bd` | izhechev | 2026-04-22 | refactor: extract fetchJson utility, handle Canvas OAuth error response |
| `c28e5d2` | izhechev | 2026-04-22 | feat: add OAuth callback endpoint and auth module |
| `29acd03` | izhechev | 2026-04-22 | feat: implement token service with AES-256-GCM encryption |
| `5d07f26` | izhechev | 2026-04-22 | test: add failing tests for token service and crypto util |
| `6dfb056` | izhechev | 2026-04-22 | ci: remove non-existent develop branch, pin ubuntu version, add build step |
| `cee0030` | izhechev | 2026-04-22 | ci: add GitHub Actions pipeline (lint, type check, tests) |
| `adef58e` | izhechev | 2026-04-22 | fix: resolve all lint errors, update README node version and project structure |
| `a9aad6c` | izhechev | 2026-04-22 | docs: restore task breakdown |
| `54d70e9` | izhechev | 2026-04-22 | refactor: apply NestJS naming conventions (singular .interface.ts, domain-first service names) |
| `2cd07f4` | izhechev | 2026-04-22 | chore: gitignore .claude and superpowers, remove old context files |
| `571038c` | izhechev | 2026-04-22 | docs: split KPI mapping into official/proposed, remove personal leadership section |
| `598580d` | izhechev | 2026-04-22 | docs: remove task 6, analyse and advise KPI sections |
| `1951c29` | izhechev | 2026-04-22 | docs: mark extra tools as proposed, remove PS3 section |
| `5909e3b` | izhechev | 2026-04-22 | docs: distinguish official vs proposed tasks, add GitHub issue refs |
| `2eee54c` | izhechev | 2026-04-22 | docs: remove sprint sections, mark S3-proposed tasks |
| `0fbcefd` | izhechev | 2026-04-22 | docs: merge S3 plan into task list, delete separate S3 plan |
| `dd149f1` | izhechev | 2026-04-22 | fix: replace feedpulse/portflow (Drieam LTI) with canvas_get_submission_history |
| `c4afaa9` | izhechev | 2026-04-22 | fix: remove canvas_get_portflow — Portflow is a Drieam LTI tool, not Canvas API accessible |
| `141c652` | izhechev | 2026-04-22 | feat: add feedpulse, portflow, calendar and inbox tools with error path tests |
| `4222683` | izhechev | 2026-04-22 | docs: honest S3 gap analysis for Design, Realise, Manage only |
| `5dee59f` | izhechev | 2026-04-22 | docs: restructure S3 plan around formal HBO-i competency requirements |
| `98f0182` | izhechev | 2026-04-22 | docs: replace canvas_get_planner with canvas_get_calendar in S3 plan |
| `c24fc7f` | izhechev | 2026-04-21 | docs: add S3 competency plan for Design, Realise, and Manage |
| `54d64f4` | izhechev | 2026-04-21 | chore: add .nvmrc pinned to Node 24 LTS |
| `5343122` | izhechev | 2026-04-21 | refactor: remove premature module stubs, keep only NestJS renames |
| `592a164` | izhechev | 2026-04-21 | refactor: apply NestJS naming conventions and scaffold all modules |
| `494a729` | izhechev | 2026-04-21 | chore: upgrade all dependencies to latest, including major version bumps |
| `05d747b` | izhechev | 2026-04-20 | docs: update feedpulse and portflow stubs with confirmed Canvas API endpoints |
| `1ddc90d` | izhechev | 2026-04-20 | feat: implement announcements and feedback tools with full test coverage |
| `defd423` | izhechev | 2026-04-14 | feat: implement FastMCP server with tool registration and lifecycle hooks |
| `fe8f683` | izhechev | 2026-04-13 | chore: remove old Next.js/Gemini prototype files |
| `6143ee2` | izhechev | 2026-04-13 | docs: update task ownership, add sprint 3 tasks, add canvas_get_courses and canvas_get_assignments |
| `025077c` | izhechev | 2026-04-13 | docs: rename canvas__ to canvas_ (single underscore) across all context files |
| `4924890` | izhechev | 2026-04-13 | feat: add McpModule with CanvasMcpServer DI binding |
| `e3606ef` | izhechev | 2026-04-13 | feat: add FastMcpCanvasServer stub with not-implemented methods |
| `650e0cf` | izhechev | 2026-04-13 | feat: define CanvasMcpServer abstract class and result types |
| `cd3a353` | izhechev | 2026-04-13 | feat: scaffold NestJS project |
| `1931a13` | izhechev | 2026-04-12 | docs: add task 1.1 implementation plan |
| `2f1cc5c` | izhechev | 2026-04-12 | docs: add task 1.1 CanvasMcpServer interface design spec |
| `c6c7184` | izhechev | 2026-03-03 | fix: Correct Gemini model ID and add detailed error logging |
| `22d49b5` | izhechev | 2026-03-03 | feat: Upgrade Gemini model to 3.1-pro-preview |
| `9c9b83b` | izhechev | 2026-03-03 | feat: Upgrade Gemini to 2.0-flash and improve conversational intelligence |
| `0c39cf4` | izhechev | 2026-03-03 | fix: Resolve Tailwind CSS v4 PostCSS compatibility issue |
| `b4fc071` | izhechev | 2026-03-03 | feat: Initial project setup with Next.js, Gemini integration, and Canvas API service |

---

## Pull Requests

### PR #31 — fix: port tool fixes and resolve persistent 401 issues

- **Author:** izhechev
- **State:** OPEN
- **Created:** 2026-05-11

**Description:**
This PR ports functional fixes for MCP tools and addresses the 401 Unauthorized issues observed during testing.

Summary of changes:
- Token Resolution refactored into TokenService to use ConfigService
- Diagnostic Logging added with masked token and URL logging
- Request Quality improved with User-Agent, Accept headers and URL normalization
- Pagination fix with exported fetchAllPages from http.util
- Tool Improvements ported for grades, inbox and announcements
- Verification confirmed with 121 passing tests

**Comments:** none

**Reviews:** none

---

### PR #30 — fix: port tool fixes to latest main

- **Author:** izhechev
- **State:** CLOSED
- **Created:** 2026-05-11

**Description:**
This PR ports the functional improvements from the previous tools_fix branch to the new modular architecture in main.

Summary of changes:
- Improved data detail for grades (rubrics), inbox (full messages), and calendar.
- Made course_id optional for assignments and announcements.
- Added missing fields (createdAt, attempt, gradedAt) across various tools.
- Unified HTML stripping for content previews.

**Comments:** none

**Reviews:** none

---

### PR #29 — fix: tools

- **Author:** izhechev
- **State:** CLOSED
- **Created:** 2026-05-06

**Description:**
- Replace enrollments endpoint with `getCourses + getSubmissions` so course names/codes are always populated
- Add `include[]=enrollments&include[]=total_scores` to `getCourses` so computed scores appear when Canvas publishes them
- Add per-assignment breakdown (`AssignmentGrade`) to `GradeResult` with score, grade, status, comments and rubric points

**Comments:**

> **danpasecinic** — 2026-05-11
>
> @izhechev, you didn't base your branch off main thus you have plenty of conflicts. Please close PR, reopen it after pulling latest.

**Reviews:** none

---

### PR #28 — refactor: rename MCP tools and extracted tool definitions

- **Author:** izhechev
- **State:** MERGED
- **Created:** 2026-05-03

**Description:**
This PR includes:
- Removal of 'canvas_' prefix from all MCP tools.
- Extraction of tool definitions and handlers from the service into a dedicated 'canvas-mcp.tools.ts' file.
- Integration of a developer dashboard and dev controller for easier tool testing.
- Added 'login' endpoint to AuthController for easier OAuth flow testing.
- Verified all changes with existing unit tests (all 132 tests passed).

**Comments:** none

**Reviews:**

| Reviewer | Date | State | Body |
|----------|------|-------|------|
| danpasecinic | 2026-05-03 | APPROVED | — |

---

### PR #27 — Feat/fastmcp setup

- **Author:** izhechev
- **State:** MERGED
- **Created:** 2026-04-22

**Description:** (none)

**General comments:**

> **danpasecinic** — 2026-04-22
>
> One more thought — errors across the new modules are all `new Error('some string')`, which means downstream code has to `err.message.includes(...)` to branch on them. You've already set a nice precedent with `HttpError` in `http.util.ts`; extending that pattern to a small set of domain errors would pay for itself quickly:
>
> - `OAuthStateError` (invalid/expired state in `auth.service.ts:40`)
> - `TokenExchangeError` (the `catch {}` in `auth.service.ts:65-67` — wrap the original `HttpError` as `cause` so logs still get the upstream status)
> - `CanvasRateLimitError` / `CanvasAuthError` (split the 403 vs 429 case in `canvas.service.ts:118-123`)
> - `MissingAccessTokenError` (`fastmcp service.ts:52`, so MCP tools can surface a "reconnect Canvas" UX instead of a generic 500)
> - `InvalidEncryptionKeyError` (`token.crypto.ts:9-13`)
>
> All extend a tiny `AppError` base; each carries the bits callers actually need (`status`, `cause`, optional `studentId`).

**Reviews:**

| Reviewer | Date | State | Body |
|----------|------|-------|------|
| danpasecinic | 2026-04-22 | COMMENTED | — |
| danpasecinic | 2026-04-22 | COMMENTED | Left you a bunch of comments below. |
| danpasecinic | 2026-04-22 | CHANGES_REQUESTED | — |
| izhechev | 2026-04-22 | COMMENTED | — |
| izhechev | 2026-04-22 | COMMENTED | — |
| izhechev | 2026-04-22 | COMMENTED | — |
| izhechev | 2026-04-22 | COMMENTED | — |
| izhechev | 2026-04-23 | COMMENTED | — |
| izhechev | 2026-04-23 | COMMENTED | — |
| izhechev | 2026-04-23 | COMMENTED | — |
| izhechev | 2026-04-23 | COMMENTED | — |
| izhechev | 2026-04-23 | COMMENTED | — |
| izhechev | 2026-04-23 | COMMENTED | — |
| izhechev | 2026-04-23 | COMMENTED | — |

**Inline review comments:**

#### `.github/workflows/ci.yml` — line 1

> **danpasecinic** — 2026-04-22
>
> Actions are outdated, update all jobs to latest versions, e.g. `actions/checkout@v4` → `actions/checkout@v6`.

> **izhechev** — 2026-04-22
>
> Fixed — both are on @v6 and pushed to the branch.

---

#### `src/app.module.ts` — line 14

> **danpasecinic** — 2026-04-22
>
> `AuthModule` is never imported here, so the OAuth controller isn't mounted. `/auth/canvas/callback` will 404 at runtime. `TokenModule` and `CanvasModule` also only arrive transitively via `McpModule` — worth importing them explicitly.

> **izhechev** — 2026-04-22
>
> AuthModule, CanvasModule, and TokenModule are now explicitly imported in AppModule — the OAuth callback will be mounted correctly at runtime.

---

#### `src/auth/auth.controller.ts`

> **danpasecinic** — 2026-04-22
>
> Reflected XSS. `errorDescription` comes straight off the query string and is interpolated into HTML without escaping. An attacker can craft `/auth/canvas/callback?error=x&error_description=<script>...</script>` and it executes in the browser.
>
> Either HTML-escape before interpolating, or use `@Render()` with a proper template, or just send a plain-text response.

> **izhechev** — 2026-04-22
>
> Switched both responses to text/plain, query string values can no longer be interpreted as HTML by the browser.

---

#### `src/auth/auth.service.ts` — line 29

> **danpasecinic** — 2026-04-22
>
> A few things stacked on this line:
> 1. `pendingStates` has no TTL and no size cap;
> 2. It's process-local, so the moment there's >1 instance, states from instance A won't resolve on instance B;
> 3. The state binds to `teamsUserId` but the callback doesn't verify the caller is the same principal who initiated. State should be bound to a signed session cookie, not just sitting in a map keyed by the state itself.

> **izhechev** — 2026-04-22
>
> - TTL: states expire after 10 minutes; handleCallback rejects expired entries
> - Size cap: generateAuthUrl throws if 500 pending states already exist (prevents memory exhaustion)
> - Eviction: expired entries are swept before each new state is inserted
> - Comment: documents the process-local and signed-cookie limitations with a reference to issue #28 for follow-up

---

#### `src/auth/auth.service.ts` — line 62

> **danpasecinic** — 2026-04-22
>
> No PKCE. Canvas supports it and it's expected for OAuth 2.1. Let's generate a `code_verifier` per request, store alongside `state`, send `code_challenge` + `code_challenge_method=S256` on the auth URL, and include `code_verifier` in the token exchange.

> **izhechev** — 2026-04-23
>
> - code_verifier: 32 random bytes, base64url encoded, stored in PendingState alongside the existing TTL and teamsUserId
> - code_challenge: SHA-256 of code_verifier, base64url encoded, added to the auth URL with code_challenge_method=S256
> - Token exchange: code_verifier included in the POST body so Canvas can verify the challenge
> - 3 new tests: PKCE params present in URL, unique per call, verifier in token exchange body

---

#### `src/auth/auth.service.ts` — line 77

> **danpasecinic** — 2026-04-22
>
> Throwing raw `Error` here (and at `Canvas token exchange failed` below) means the controller surfaces HTTP 500 with a stack for what should be a 400/401. Use Nest's `BadRequestException` / `UnauthorizedException` so callers get a sane status.

> **izhechev** — 2026-04-23
>
> Callers now get 400 for bad/expired state and 401 for Canvas rejecting the code — no stack traces exposed.

---

#### `src/auth/auth.service.ts` (fetchJson type cast)

> **danpasecinic** — 2026-04-22
>
> `fetchJson<CanvasTokenResponse>` is a type cast, not a runtime check. If Canvas returns something malformed (or upstream is compromised), you'll store `undefined` as an encrypted access token and `NaN` as `expiresAt`. Validate with `zod` before passing to `TokenService`.

---

#### `src/token/token.service.ts` — line 19

> **danpasecinic** — 2026-04-22
>
> In-memory `Map` is fine for the spike, but:
> - `.env.example` declares `SESSION_INACTIVITY_DAYS=30` and `lastActiveAt` is stored on the record, but nothing actually evicts inactive sessions.
> - Tokens are lost on restart and don't survive multi-instance.
>
> Before real user tokens land, move to Postgres/Redis and add an inactivity sweeper.

---

#### `src/mcp/canvas-mcp-fastmcp.service.ts` — line 207

> **danpasecinic** — 2026-04-22
>
> `MCP_PORT` is parsed here at class-field init, then read again at line 34 to gate whether the server starts. Pick one. Easiest: drop the field, read env once inside `onModuleInit` (or via `ConfigService`, which is already global).

---

#### `src/mcp/canvas-mcp-fastmcp.service.ts` — line 215

> **danpasecinic** — 2026-04-22
>
> `onModuleInit` is sync and the `server.start(...)` promise is fire-and-forget. If FastMCP fails to bind (port in use, config bad), Nest still reports ready and the failure only shows in logs. Make this `async` and `await` the start.

---

#### `src/canvas/canvas.service.ts` — line 115

> **danpasecinic** — 2026-04-22
>
> Logging the full URL including query string means `student_ids[]`, course IDs, and date ranges end up in whatever log sink Nest points at. Log method + pathname only, or redact known-sensitive params.

---

#### `src/canvas/canvas.service.ts` — line 121

> **danpasecinic** — 2026-04-22
>
> 403 and 429 shouldn't be the same error. 403 on Canvas is almost always "token expired / insufficient scope", not rate limiting — conflating them hides auth failures and prevents the future refresh-token path from triggering when it should. Split into two branches.

---

#### `src/mcp/canvas-mcp-fastmcp.service.ts` (refactor suggestion)

> **danpasecinic** — 2026-04-22
>
> Refactor idea (not blocking): every tool exists three ways — the abstract `getX` contract, a one-line `getX` wrapper, a `fetchX` implementation, and an `addTool` lambda that calls `fetchX` again. The wrappers add no value.
>
> Collapse to: rename `fetchX → getX` (satisfies the abstract), have `registerTools` call `this.getX(...)` directly. Then express the 8 `addTool` blocks as a `TOOLS` array (`[{ name, description, parameters, handler }]`) iterated once — drops ~80 lines and makes adding a ninth tool a one-entry diff.

> **izhechev** — 2026-04-23
>
> - Deleted the 8 one-line getX wrappers that just called fetchX
> - Renamed private async fetchX → async getX — they now directly satisfy the abstract contract
> - Replaced the 8 separate addTool blocks with a module-level TOOLS array + a single for loop in registerTools
> - Adding a 9th tool now = one entry in TOOLS, nothing else

---

#### `src/mcp/canvas-mcp-fastmcp.service.ts` (_courseId/_courseName spread)

> **danpasecinic** — 2026-04-22
>
> The `_courseId` / `_courseName` spread + read-back pattern is a smell for "I wanted a tuple". Map to the final `SubmissionHistoryResult` shape inside the inner loop instead of tagging the raw Canvas submission with underscore fields and re-reading them later — kills the `any` leak and the intermediate type hack.

> **izhechev** — 2026-04-23
>
> The intermediate `{ ...submission, _courseId, _courseName }` object is gone — `c.id` and `c.name` are used directly in the `.map()` where `c` is already in closure scope, and the `submitted_at !== null` filter happens before the map so no `!` assertion is needed on the final shape.

---

#### `.env.example` — line 2

> **danpasecinic** — 2026-04-22
>
> Two things:
> 1. `CANVAS_TEST_TOKEN` is a real OAuth-bypass path. Guard the read site with `NODE_ENV !== 'production'` and assert in `main.ts` — otherwise a misconfigured prod env could silently use it.
> 2. `CANVAS_REDIRECT_URI` is missing from this file even though `auth.service.ts` reads it. Following the example as-is produces a service that sends empty `redirect_uri`.

> **izhechev** — 2026-04-23
>
> - .env.example — added CANVAS_REDIRECT_URI so following the template produces a working OAuth flow
> - main.ts — fails fast at startup if CANVAS_TEST_TOKEN is present in production
> - getAccessToken() — only reads CANVAS_TEST_TOKEN when NODE_ENV !== 'production', so even if the startup check is somehow skipped, the token is never used in prod

---

#### `test/app.e2e-spec.ts`

> **danpasecinic** — 2026-04-22
>
> This expects `GET /` → `'Hello World!'` but there's no `AppController` in `app.module.ts`. `npm run test:e2e` fails immediately — only green because CI doesn't run it. Either delete this placeholder or wire a real `/health` endpoint, and while you're there add `test:e2e` + `--coverage` to the CI workflow.

> **izhechev** — 2026-04-23
>
> - src/health/health.controller.ts — new GET /health → { status: 'ok' }
> - AppModule — registers HealthController
> - test/app.e2e-spec.ts — replaced broken GET / test with GET /health; added jest.mock('fastmcp') so the full AppModule can load without ESM parse errors
> - ci.yml — npm test -- --coverage and npm run test:e2e now both run in CI

---

#### `src/mcp/canvas-mcp-fastmcp.service.spec.ts` — line 1

> **danpasecinic** — 2026-04-22
>
> Each tool block ends with four near-identical error cases (no token / rate limit / API error / malformed). `describe.each([['getGrades', s => s.getGrades('u')], ['getAnnouncements', ...], ...])('error propagation', ...)` at the bottom + deleting the per-tool copies takes this from 835 lines to ~500 without losing any coverage.

> **izhechev** — 2026-04-23
>
> 261 lines, +4 coverage. The TOOL_CASES array drives a single describe.each block that generates "no token / rate limit / API error / malformed" for all 8 tools. The per-tool copies are gone. Adding a 9th tool = one entry in TOOL_CASES.
