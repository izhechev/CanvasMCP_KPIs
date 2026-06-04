# Design Spec: Test Report + Coverage Document

**Date:** 2026-06-04  
**Project:** CanvasMCP (NestJS Canvas–Teams MCP bridge)  
**Audience:** Fontys assessors / school portfolio  
**Format:** Single Markdown file at `docs/test-report.md`

---

## Purpose

Produce a structured quality document that an assessor can read to understand:
1. How many tests were written and whether they pass
2. What percentage of the codebase is exercised by those tests
3. Why specific tests are currently failing and how they would be fixed
4. Which coverage gaps are intentional (external deps, bootstrap code) vs. addressable

---

## Document Structure

### 1. Executive Summary
- Project name, report date, test runner version
- Single-sentence verdict: pass rate, overall coverage
- Numbers: total suites, total tests, passing/failing

### 2. Test Suite Results Table
Grouped by module (auth, common, health, mcp/tools, mcp, token, canvas).  
Columns: Suite file | Tests | Passed | Failed | Status

### 3. Coverage by Module
Full Jest coverage table reproduced from `npm run test:cov`.  
Columns: File | % Stmts | % Branch | % Funcs | % Lines | Uncovered lines  
Short annotation per module explaining any low-coverage areas.

### 4. Failure Analysis
One sub-section per failing suite (2 suites, 4 tests):

**4a. `mcp/fastmcp.service.spec.ts` (3 failures)**
- *`starts HTTP transport when MCP_PORT is set`*: spec asserts `httpStream: { port: 3001 }` but the service now passes `{ host: '0.0.0.0', port: 3001 }`. Root cause: spec was written before the `host` field was added. Fix: update assertion to include `host`.
- *`resolves Bearer token to studentId`* and *`returns empty studentId when no Authorization header`*: `authenticate` is not exported/accessible from the service as a standalone function. Root cause: implementation refactor changed how auth callback is exposed. Fix: extract or spy on the authenticate callback in the test setup.

**4b. `mcp/mcp.module.spec.ts` (1 failure)**
- *`provides FastMcpCanvasServer`*: TypeORM's `DataSource` is not available in the test module — `TokenRecordEntityRepository` cannot be instantiated. Root cause: the test imports the real `McpModule` which transitively needs a DB connection. Fix: mock the TypeORM repository or use `TypeOrmModule.forRoot` with an in-memory SQLite DB.

### 5. Coverage Gap Analysis
Table of uncovered areas with rationale:

| File/Group | Coverage | Reason | Addressable? |
|---|---|---|---|
| `main.ts`, `app.module.ts` | 0% | Bootstrap / wiring code, not unit-testable | No (needs e2e) |
| `canvas.service.ts` | ~11% | Wraps external Canvas REST API; every method needs a live Canvas token | Via integration tests |
| Postgres stores (`postgres-*.ts`) | ~45% | Require live PostgreSQL connection | Via integration tests with test DB |
| `fastmcp.service.ts` lines 44–51 | ~85% | Stale tests — covered once failures are fixed | Yes (fix tests) |

---

## Out of Scope
- Fixing the failing tests (document only — analysis and recommendation)
- Writing new tests
- Changing source code

---

## File Output
`docs/test-report.md` — committed to the `main` branch alongside the codebase.
