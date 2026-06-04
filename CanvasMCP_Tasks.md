# Canvas MCP — Task breakdown

> **Legend**
> - `(official #N)` — backed by a GitHub issue, agreed sprint scope
> - `(proposed)` — added from S3 competency plan, pending teacher approval
> - No label — planned work, sprint not yet decided
> - ✓ — completed

---

## Task 1: MCP Server — Iskren

- 1.1 Define CanvasMcpServer interface (abstraction layer) ✓
- 1.2 Implement FastMCP version behind the interface ✓
- 1.3 Implement get_grades — Zod input schema, Canvas /users/self/enrollments ✓ (official #18)
- 1.4 Implement get_courses — Zod input schema, Canvas /courses ✓ (official #19)
- 1.5 Implement get_assignments — Zod input schema, Canvas /courses/:id/assignments ✓ (official #20)
- 1.6 Implement get_announcements — Zod input schema, Canvas /announcements ✓ (proposed)
- 1.7 Implement get_feedback — Zod input schema, Canvas /courses/:id/students/submissions ✓ (proposed)
- 1.8 Implement get_submission_history — cross-course aggregation, all workflow states ✓ (proposed)
- 1.9 Implement get_calendar — date-range params, mixed event types, Canvas /calendar_events ✓ (proposed)
- 1.10 Implement get_inbox — conversation preview only (deliberate privacy boundary), Canvas /conversations ✓ (proposed)
- 1.11 Unit tests for all 8 tools — happy path + error paths (429, 500, missing token, malformed JSON) ✓ (official #24)
- 1.12 Tool descriptions optimised for LLM tool selection ✓
- 1.13 Canvas API response mapping — strip nested JSON to flat structure per tool ✓
- 1.14 Zod response validation on Canvas API responses in canvas.service.ts — not just inputs (proposed)
- 1.15 Write docs/test-strategy.md — unit vs integration scope, coverage threshold, deliberate exclusions (proposed)

## Task 2: OAuth2 — Iskren

- 2.1 Build token service module (separate from MCP server) (official #23)
- 2.2 Token storage — AES-256-GCM encrypted access + refresh tokens keyed by Teams user ID (official #23)
- 2.3 Authorisation code exchange endpoint — verify CSRF state, exchange code, store encrypted record (official #23)
- 2.4 Silent token refresh — call Canvas refresh endpoint when expiry is within 5 minutes, update stored record only
- 2.5 Inactivity check — last_active_at vs SESSION_INACTIVITY_DAYS (30 days)
- 2.6 Token cleanup — TokenService.deleteInactive() removes records older than SESSION_INACTIVITY_DAYS (proposed)
- 2.7 Integration tests for full OAuth flow — mock Canvas token endpoint, assert encrypted record stored, assert refresh updates expiry only

## Task 3: Bot + LLM — Kaan

- 3.1 NestJS bot receiving Teams messages via Bot Framework SDK
- 3.2 Forward question to OpenAI with tool descriptions
- 3.3 Route LLM tool call to MCP server (direct method call, not JSON-RPC)
- 3.4 Format response as Adaptive Card (grades table, announcements list, feedback card)
- 3.5 Handle no-auth state: show OAuth login card
- 3.6 Handle errors: Canvas down, token revoked, rate limit, ambiguous query
- 3.7 LLM validation test: 10 sample questions, check correct tool selected and no hallucinated params
- 3.8 System prompt design: define LLM behaviour for ambiguous queries, multi-course responses, error explanation

## Task 4: Infrastructure — Iskren

- 4.1 Dockerfile for MCP server + bot
- 4.2 GitHub Actions CI — lint, TypeScript compile, jest on push and PR to main (official #25)
- 4.3 AKS deployment config with runtime secrets (client_id, client_secret, OpenAI key)
- 4.4 Latency logging in canvas.service.ts — elapsed ms per Canvas API call, structured format, no student data (proposed)
- 4.5 Git tags v0.1.0 / v0.2.0 at sprint demos with one-paragraph release note in CHANGELOG.md (proposed)
- 4.6 docs/incident-log.md — running log of non-trivial bugs and Canvas API surprises (proposed)

## Task 5: Analysis and evaluation

- 5.1 Compare Canvas API documented behaviour vs actual Fontys instance behaviour (test each endpoint, document discrepancies)
- 5.2 LLM tool selection accuracy analysis: run 20+ queries across all tools, measure correct tool %, correct params %, hallucination rate
- 5.3 Response time breakdown: measure latency per component (bot → LLM → MCP → Canvas → back), identify bottleneck
- 5.4 Rate limit analysis: simulate burst usage (exam period pattern), confirm Canvas quota handles expected load
- 5.5 Compare GPT-5 vs GPT-5.4 mini accuracy on the 20+ query set, decide routing threshold

## Task 6: User-facing deliverables — Kaan

- 6.1 User manual: how students connect Canvas, what they can ask, what to do when something fails
- 6.2 Usability test: 3-5 Fontys students use the bot, observe pain points, document findings
- 6.3 Iterate Adaptive Card design based on usability test feedback
- 6.4 Demo video: end-to-end walkthrough from first OAuth connect to grade retrieval

---

## KPI mapping

### S. Design 3
**Tasks:** 1.1, 1.2, 1.9, 1.10, 1.12, 1.13, 1.14, 1.15, 2.1, 3.8, 4.1, 4.3

**Why:** Abstraction layer (1.1, 1.2) shows adaptable architecture. Calendar and inbox tools (1.9, 1.10) required non-trivial schema decisions and deliberate design boundaries (privacy, payload size). Zod response validation (1.14) is an architectural decision handling unpredictable external data. Test strategy document (1.15) satisfies S3.2. Token service as separate module (2.1) demonstrates modular architecture.

---

### S. Realise 3
**Tasks:** 1.3–1.13, 1.14, 2.2–2.7, 3.1–3.7, 4.2

**Why:** Eight MCP tools with Zod validation, Canvas API integration, and full error-path tests (1.3–1.13) is the core implementation at S3 depth. OAuth2 token lifecycle with encryption, refresh, and cleanup (2.2–2.7) implements advanced security functionality. Bot + LLM integration (3.1–3.7) connects four external systems. CI pipeline (4.2) satisfies S3.2 test automation requirement.

---

### S. Manage 3
**Tasks:** 2.6, 4.2, 4.4, 4.5, 4.6, 7.2, 7.3

**Why:** CI pipeline (4.2) is the automated build/test infrastructure S3.2 requires. Latency logging (4.4) enables operational monitoring. Token cleanup (2.6) manages system state over time with GDPR rationale. Release tags + changelog (4.5) provide the audit trail S3.1 requires. Incident log (4.6) documents managing complex issues.

---

### Personal Leadership 3
**Evidence from:** Competence Document (learning objectives, adapted after coach feedback), weekly software expert meetings, logbook tracking daily progress, scope adjustments based on sprint outcomes.
