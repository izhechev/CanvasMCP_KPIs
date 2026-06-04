# PUML Diagram Analysis — CanvasMCP

---

## 01-common.puml — Common: Errors, HTTP Utilities & Helpers

### What It Does

#### High-Level
The diagram documents the **shared foundation** used across the entire system:
- A unified error hierarchy where every domain failure has a named type and an HTTP status code baked in
- A global NestJS exception filter that converts those errors into proper HTTP responses automatically
- Two reusable utility modules: one for making Canvas HTTP calls (with automatic pagination) and one for sanitizing HTML strings

#### Low-Level (Keypoints)
- `AppError` extends `Error` and carries `status: number` — every thrown error in the system inherits from it
- Seven concrete subclasses each stereotyped with their HTTP code: `OAuthStateError (400)`, `TokenExchangeError (401)`, `CanvasAuthError (403)`, `CanvasRateLimitError (429)`, `MissingAccessTokenError (401)`, `InvalidEncryptionKeyError (500)`, `HttpError`
- `AppErrorFilter` is decorated `@Catch(AppError)` and registered globally in `main.ts`; reads `AppError.status` and sets the HTTP response code — no manual status mapping anywhere else
- `HttpUtil.fetchJson<T>()` adds `Authorization: Bearer` and `User-Agent` headers, parses JSON, throws `HttpError` on non-2xx
- `HttpUtil.fetchAllPages<T>()` follows Canvas's `Link: <url>; rel="next"` pagination header — collects 100 items/page until no `next` rel exists
- `StripHtml.stripHtml()` strips HTML tags and collapses whitespace — used exclusively by `getInboxTool` to clean Canvas conversation message bodies
- Neither `HttpUtil` nor `StripHtml` are classes — they are standalone exported functions despite the UML class notation

### Where in Code

#### High-Level Location
The `src/common/` folder — the cross-cutting concerns layer of the NestJS application.

#### Low-Level Location

| Element | File |
|---|---|
| `AppError` + all 7 subclasses | `src/common/errors.ts` |
| `AppErrorFilter` | `src/common/app-error.filter.ts` |
| `fetchJson`, `fetchAllPages`, `parseNextLink` | `src/common/http.util.ts` |
| `stripHtml` | `src/common/strip-html.ts` |
| Global filter registration | `src/main.ts` |
| Tests | `src/common/errors.spec.ts`, `src/common/http.util.spec.ts` |

- `errors.ts`: pure TypeScript class hierarchy, no external dependencies; each subclass calls `super(message, status)`
- `app-error.filter.ts`: single `catch()` method reads `error.status` and calls `response.status(error.status).json({ message: error.message })`
- `http.util.ts`: `parseNextLink()` is a private helper using a regex on the `Link` header string to extract the `next` URL

### Competency Level

#### Realisation

| Level | Explanation |
|---|---|
| **Realisation S2.1** — Build a system of multiple subsystems using existing components | `HttpUtil` wraps native `fetch` and integrates with Canvas's pagination protocol — existing API conventions absorbed into reusable utilities shared across subsystems |
| **Realisation S2.2** — Integrate software components with integrity and security monitoring | `AppErrorFilter` ensures all `AppError`s produce correct HTTP status responses — prevents internal error details from leaking to HTTP clients |
| **Realisation S3.2** — Apply test automation when executing tests | CI/CD pipeline runs `errors.spec.ts` and `http.util.spec.ts` automatically on every push |

#### Management & Control

Not applicable — this diagram covers shared runtime code, not development process or pipeline infrastructure.

### Why I Made These Decisions — Design Level 3

**Typed error hierarchy instead of generic `Error` throwing**

I could have thrown `new Error('Canvas returned 403')` anywhere in the codebase and let callers figure out the status code. I chose a typed hierarchy rooted in `AppError` instead. The reason is the global `AppErrorFilter`: it reads `error.status` and sets the HTTP response code. If a generic `Error` reaches the filter, there is no status to read — it would silently become a 500. With typed errors, the correct HTTP status is decided at the point where the error is defined, not at the point where it is caught. This removes an entire class of bug where a caller forgets to re-map an error to the right code.

The separation between `CanvasAuthError (403)` and `MissingAccessTokenError (401)` is also deliberate. Both mean "no valid token" but for different reasons — one means Canvas rejected the token, the other means we never had a token for this user. Conflating them would make it impossible to give the student a useful error message.

**Standalone functions instead of injectable classes for HttpUtil and StripHtml**

NestJS is a Node.js framework built on top of Express that structures the application into modules, controllers, and providers using TypeScript decorators. It was required by the stakeholder (Stakeholder Clarification Notes). NestJS uses Dependency Injection (DI) — a pattern where objects declare their dependencies and the framework constructs and provides them automatically, rather than the object constructing its own dependencies. This makes components replaceable and testable.

Both `HttpUtil` and `StripHtml` are stateless — they take inputs and return outputs with no internal state. Making them NestJS `@Injectable()` classes would force DI setup everywhere they are used, including in tests. As standalone exported functions, they can be imported directly and mocked at the module level in test files without any NestJS scaffolding. This was a testability decision embedded in the design.

**`fetchAllPages` following Link headers instead of assuming one page is enough**

The simple approach would be `per_page=100` and hope the student has fewer than 100 items. I chose to follow the `Link: <url>; rel="next"` header instead. Canvas's pagination is a contract — the presence of a `next` link is the authoritative signal that more data exists. Ignoring it means silently returning incomplete results. A student with many courses, assignments, or conversations would get truncated data with no indication anything was missing.

**Design S3.1 connection:** The common module serves four other modules (canvas, auth, token, mcp) without any of them importing from each other — it is the shared boundary that prevents coupling. Designing it as stateless utilities and a typed error contract was a deliberate architectural decision to keep the dependency graph acyclic.

### Why Not Level 3 Yet — How to Reach It

**Realisation S3.1** — The common module is included in the deployable artifact, but the system has not been containerized or deployed. The definition explicitly requires "build **and** deploy." The module code is complete; what is missing is the Dockerfile (task 4.1) and the AKS deployment configuration (task 4.3). Once the full system deploys, this module is part of that evidence.

**Realisation S3.2** — CI/CD pipeline is in place and runs `errors.spec.ts` and `http.util.spec.ts` automatically on every push. This criterion is now met.

**Management & Control** — Remains not applicable. The common module is shared runtime code; it contributes no direct evidence for pipeline setup, release management, or configuration management.

---

## 02-token.puml — Token: Storage, Encryption & Resolution

### What It Does

#### High-Level
The diagram documents **how Canvas OAuth tokens are stored, encrypted, and retrieved**:
- Tokens are never stored as plaintext — AES-256-GCM encryption is applied before any write to any store
- An abstract `TokenStore` defines the storage contract, with `InMemoryTokenStore` as the current implementation — designed to be swapped for a PostgreSQL backend in production
- `TokenService` is the public facade: resolves a bearer token for a given user ID, stores new tokens received from OAuth, and flags tokens expiring soon

#### Low-Level (Keypoints)
- `TokenCrypto` uses AES-256-GCM; key is `TOKEN_ENCRYPTION_KEY` (64-char hex = 32 bytes); a new random IV is generated on every `encrypt()` call; output format is `IV:AuthTag:CiphertextHex`
- `InvalidEncryptionKeyError` is thrown if the key is absent or malformed — validated at parse time, not silently ignored
- `TokenStore` declares four abstract methods: `save`, `find`, `delete`, `deleteOlderThan` — the last one enables manual TTL cleanup
- `InMemoryTokenStore` holds `Map<string, EncryptedTokenRecord>` — records are always stored already-encrypted, even in memory
- `TokenService.resolveToken()` priority chain: (1) `CANVAS_TEST_TOKEN` env var if `NODE_ENV !== production`, (2) find encrypted record → decrypt → return bearer, (3) throw `MissingAccessTokenError`
- `isExpiringSoon()` flags tokens within 5 minutes of expiry — the caller must trigger a new OAuth flow; no automatic refresh is performed
- `refreshToken` is persisted in the encrypted record but intentionally unused — refresh flow is out of scope and documented as such

### Where in Code

#### High-Level Location
The `src/token/` NestJS module — the complete token lifecycle layer.

#### Low-Level Location

| Element | File |
|---|---|
| `TokenCrypto` (encrypt / decrypt / parseKey) | `src/token/token.crypto.ts` |
| `TokenStore` (abstract) + `InMemoryTokenStore` | `src/token/token-store.ts` |
| `TokenService` | `src/token/token.service.ts` |
| `StoreTokenInput`, `TokenRecord`, `EncryptedTokenRecord` | `src/token/interfaces/token.interface.ts` |
| Module wiring | `src/token/token.module.ts` |
| Tests | `src/token/token.crypto.spec.ts`, `src/token/token-store.spec.ts`, `src/token/token.service.spec.ts` |

- `token.crypto.ts`: `encrypt()` calls `crypto.randomBytes(12)` for the IV, uses Node's built-in `crypto.createCipheriv('aes-256-gcm', key, iv)`, encodes IV, auth tag, and ciphertext as hex strings joined by `:`
- `token-store.ts`: `InMemoryTokenStore.save()` does `this.records.set(record.teamsUserId, record)` — key is the Microsoft Teams user ID string
- `token.service.ts`: `resolveToken()` starts with `if (process.env.NODE_ENV !== 'production' && process.env.CANVAS_TEST_TOKEN)` — explicit development shortcut, blocked in production

### Competency Level

#### Realisation

| Level | Explanation |
|---|---|
| **Realisation S2.2** — Integrate software components with integrity, security, and system performance | AES-GCM auth tag is verified on every decrypt — detects any tampering of stored ciphertext; `deleteOlderThan` cleans up stale records; test token shortcut is locked behind a `NODE_ENV` guard |
| **Realisation S3.2** — Apply test automation when executing tests | CI/CD pipeline runs `token.crypto.spec.ts`, `token-store.spec.ts`, and `token.service.spec.ts` automatically on every push |

#### Management & Control

Not applicable — this diagram covers token runtime logic, not development process or pipeline infrastructure.

### Why I Made These Decisions — Design Level 3

**Abstract `TokenStore` instead of a concrete `Map` field**

AKS (Azure Kubernetes Service) is Microsoft's managed Kubernetes platform — the target production environment for this system. Kubernetes runs applications as pods, where multiple pod replicas of the same container can run simultaneously for availability and load balancing. A TTL (Time to Live) is the maximum age an entry is allowed to exist before it is considered expired and eligible for deletion.

I could have put `private records = new Map<string, EncryptedTokenRecord>()` directly inside `TokenService`. I chose an abstract class instead. The reason is that the system will run in two distinct environments: local development (single process, in-memory is fine) and production on AKS (multiple pod replicas, where in-memory storage means each pod has a different view of who is authenticated). The abstract store makes this a one-line change in the NestJS module — swap `InMemoryTokenStore` for a `PostgresTokenStore` — without touching `TokenService` or any test. The upgrade path is designed in, not retrofitted.

**AES-256-GCM specifically, not just "some encryption"**

**What it is.** AES (Advanced Encryption Standard) is a symmetric block cipher standardised by NIST (National Institute of Standards and Technology — the US federal agency responsible for cryptography and security standards) in 2001. It encrypts data in fixed 128-bit blocks using the same key for encryption and decryption. The *256* is the key length in bits — 32 bytes, the strongest of the three AES key sizes (128, 192, 256). A 256-bit key has 2²⁵⁶ possible values, which is computationally infeasible to brute-force; even Grover's quantum algorithm, which halves the effective key length, reduces this to the equivalent of a 128-bit classical search — still beyond any foreseeable attack.

GCM stands for Galois/Counter Mode. It works in two layers simultaneously. The Counter (CTR) layer turns the block cipher into a stream cipher: it encrypts a counter value, XORs the result with the plaintext, then increments the counter for the next block — no block boundary padding needed. The Galois layer runs a GHASH polynomial multiplication over the ciphertext and additional authenticated data (AAD) in GF(2¹²⁸) to produce a 128-bit authentication tag. Both layers share the same key and IV (Initialization Vector — a random value generated fresh for every encryption call; its only job is to ensure that encrypting the same plaintext twice with the same key produces a completely different ciphertext, so stored records cannot be correlated by pattern-matching). In GCM the IV is also called a nonce (number used once) — using the same IV twice with the same key breaks GCM's security guarantees, which is why `crypto.randomBytes(12)` generates a new one on every call. Encryption and authentication happen in a single pass over the data.

**Why this choice over simpler alternatives.** The alternatives were AES-128-GCM (shorter key) and AES-256-CBC (same key length, different mode).

AES-128-GCM was rejected purely on key length. AES-128 is considered cryptographically secure today with no known practical attacks. However, OAuth tokens that grant access to student Canvas accounts are PII (Personally Identifiable Information) — data that can identify an individual, protected under GDPR (General Data Protection Regulation), the EU regulation that governs how personal data must be stored and handled. Tokens carry a long effective lifetime (refresh tokens are valid until revoked). Using 256-bit keys provides a larger security margin at negligible performance cost — Node's native `crypto` module calls OpenSSL (the industry-standard open-source cryptography library) which uses hardware AES-NI instructions (AES-NI — a set of CPU instructions built into modern Intel and AMD processors that accelerate AES operations in hardware, making AES encryption/decryption effectively free in terms of CPU time), making the key-length difference immeasurable in benchmarks.

AES-256-CBC was rejected because CBC only encrypts — it does not authenticate. A tampered ciphertext decrypts to garbage silently; CBC has no mechanism to detect modification. GCM's authentication tag changes if even one bit of the stored record is altered, and the Node runtime throws before returning any plaintext. For stored secrets, silent corruption is a worse outcome than a loud failure.

The random IV generated fresh on every `encrypt()` call (via `crypto.randomBytes(12)`) means two encryptions of the same token produce completely different ciphertexts — an attacker who can read the database cannot detect that the same token was stored twice or correlate records across users.

**Design S3.1 connection:** Security and scalability were explicit quality requirements for this module — student OAuth tokens are PII and the system must survive production deployment on multiple replicas. Both decisions were made at design time by reasoning about those quality characteristics, not added later as patches.

### Why Not Level 3 Yet — How to Reach It

**Realisation S3.1** — Four gaps, all traceable to the design document.

First, deployment: the system is not containerized or running on AKS (tasks 4.1, 4.3).

Second, the design document (Section 2.3.5) explicitly specifies that token storage must use **a database** — "the specific database provider is not yet decided." `InMemoryTokenStore` is a development placeholder that directly contradicts the designed architecture. A database-backed `TokenStore` subclass (PostgreSQL or equivalent) must be implemented to align with the design. This also unblocks the MCP Server's stateless horizontal scaling requirement (Section 2.3.3).

Third, token auto-refresh is specified in the design (Section 5.4) but not implemented. The design requires the MCP Server to check token expiration before every Canvas API call and call Canvas's refresh endpoint when expiry is within 5 minutes. The current `isExpiringSoon()` only flags — it does not call Canvas. Task 2.4 closes this.

Fourth, the 30-day inactivity expiry policy is specified in the design (Section 5.6): every successful Canvas API call must update `last_active_at`, and the inactivity check runs at token retrieval before the refresh check. If the threshold is exceeded, the token record is deleted. Tasks 2.5 (inactivity check) and 2.6 (`deleteInactive()`) are not done.

Additionally, token revocation (Section 5.5) is not handled: when a student revokes access through Canvas settings, the refresh token becomes invalid. The design specifies the server detects this on the next refresh attempt and prompts re-authorisation. This behaviour is not implemented.

**Realisation S3.2** — CI/CD pipeline runs `token.crypto.spec.ts`, `token-store.spec.ts`, and `token.service.spec.ts` automatically. This criterion is now met.

**Management & Control** — Remains not applicable. Token runtime logic contributes no direct evidence for pipeline, release management, or configuration management.

---

## 03-canvas.puml — Canvas: API Client & Response Types

### What It Does

#### High-Level
The diagram documents the **HTTP client layer for the Canvas LMS REST API**:
- `CanvasService` is the single entry point for all Canvas API calls — every other part of the system talks to Canvas through this service
- Each method maps exactly to one Canvas endpoint and returns a typed response
- All response shapes are defined as TypeScript interfaces, giving the rest of the system a stable typed contract that is independent of Canvas's raw JSON format

#### Low-Level (Keypoints)
- `CanvasService` holds `baseUrl` (defaults to `fhict.instructure.com`) injected from `ConfigService`
- Private `get<T>(url, token)` delegates to `HttpUtil.fetchJson()` with `Authorization: Bearer {token}` and `User-Agent` headers added on every call
- `getConversations()` is the only method that calls `fetchAllPages()` directly — inbox conversations always paginate; other endpoints return bounded sets
- `getAnnouncements(token, courses, count?)` fans out one API call per course in the courses array, then merges `course_name` into each `CanvasAnnouncement` result
- HTTP 403 from Canvas is caught and re-thrown as `CanvasAuthError`; HTTP 429 as `CanvasRateLimitError` — both from the common error hierarchy
- Nine interfaces model only the Canvas API fields actually consumed by the MCP tools (not full Canvas API objects)
- `CanvasSubmission.workflow_state` is one of four string values: `"submitted" | "graded" | "pending_review" | "unsubmitted"`
- `CanvasSubmission.rubric_assessment` is `Record<criterionId, { points, description? }>` — keyed by rubric criterion ID from `CanvasRubricCriterion`

### Where in Code

#### High-Level Location
The `src/canvas/` NestJS module — the external API integration layer.

#### Low-Level Location

| Element | File |
|---|---|
| `CanvasService` | `src/canvas/canvas.service.ts` |
| All 9 Canvas interfaces | `src/canvas/interfaces/canvas-api.interface.ts` |
| Module wiring | `src/canvas/canvas.module.ts` |

- `canvas.service.ts`: each public method is `async`, takes `token: string` as first argument; private `get<T>()` builds the full URL as `this.baseUrl + path`; error mapping uses a `switch` on `HttpError.status`
- `canvas-api.interface.ts`: TypeScript interfaces only — no runtime classes or validation; all optional fields are typed with `?`; `CanvasAssignment.rubric` is `CanvasRubricCriterion[] | undefined`
- The 403/429 conversion happens when `HttpUtil.fetchJson()` throws `HttpError(403, ...)` and `CanvasService.get<T>()` catches it to produce a domain-specific error

### Competency Level

#### Realisation

| Level | Explanation |
|---|---|
| **Realisation S2.2** — Integrate software components with integrity, security, and performance | 403/429 mapped to typed domain errors; `User-Agent` header prevents Canvas rejecting anonymous-looking requests; `fetchAllPages()` prevents memory overflow on large course lists |

#### Management & Control

Not applicable — this diagram covers API client runtime code, not development process or pipeline infrastructure.

### Why I Made These Decisions — Design Level 3

**`CanvasService` as the single anti-corruption layer**

The anti-corruption layer is a Domain-Driven Design pattern that places a translation layer at the boundary between your system and an external system. Its job is to absorb the external system's quirks, naming conventions, and error formats so that none of them leak into your own domain model. Without it, your internal code becomes coupled to the exact shape and behaviour of the external API.

A `Bearer` token is a type of access token used in HTTP `Authorization` headers in the format `Authorization: Bearer <token>`. "Bearer" means that whoever holds (bears) the token is granted access — the server does not verify the identity of the caller, only that they possess a valid token. The `User-Agent` header identifies the client application making the HTTP request (browser, app, or in this case our server). Canvas uses it to distinguish legitimate API clients from automated scrapers.

I could have let each MCP tool call Canvas directly — each tool already receives a token and knows what URL it needs. I chose to route everything through `CanvasService` instead. The reason is that the Fontys Canvas instance has quirks that differ from the Canvas API documentation: the `User-Agent` header is required or Canvas returns 401; the `Link: rel="next"` pagination format is non-standard; some endpoints return 403 where the docs say 401. If these quirks were handled per-tool, fixing a single Canvas behaviour change would require touching 8 files. With `CanvasService` as the single boundary, it is one fix in one place. The tools never need to know about authorization headers, pagination, or error code mapping.

**Nine scoped interfaces instead of reflecting the full Canvas response**

Canvas API responses are large objects — `CanvasCourse` alone has over 40 fields. I defined TypeScript interfaces that contain only the fields the MCP tools actually consume. This was not laziness — it was a deliberate decision with two consequences. First, it documents exactly what the system depends on from Canvas. If Canvas removes or renames a field in a future API version, the interface shows immediately whether that field was relied on. Second, the MCP tools cannot accidentally expose Canvas fields that were not reviewed for privacy — only the declared fields are accessible at the type level.

**Design S3.1 connection:** `CanvasService` is the integration point between a new system (CanvasMCP) and an existing external system (Canvas LMS at Fontys). The anti-corruption layer pattern ensures that Canvas's unpredictable real-world behaviour does not leak into the domain logic. The scoped interfaces are the boundary contract — explicit about what is used and why.

### Why Not Level 3 Yet — How to Reach It

**Realisation S3.1** — Deployment is missing (tasks 4.1 and 4.3). Additionally, `CanvasService` is the most critical module for integration quality but has no `canvas.service.spec.ts` in the codebase — the integration behaviour (403 → `CanvasAuthError`, 429 → `CanvasRateLimitError`, pagination, `User-Agent` header) is tested only manually or through the tool-level specs. Without its own tests, a regression in `CanvasService` may not be caught before it reaches the tools.

**Realisation S3.2** — CI/CD is in place but there are no automated tests for `CanvasService` itself. To close this gap: write `canvas.service.spec.ts` mocking `fetchJson` and `fetchAllPages`, covering at minimum: 403 throws `CanvasAuthError`, 429 throws `CanvasRateLimitError`, pagination is followed for `getConversations`, and `User-Agent` header is present on every call. CI then runs these automatically on every push.

**Management & Control** — Remains not applicable. The Canvas client layer contributes no direct evidence for pipeline, release management, or configuration management.

---

## 04-auth.puml — Auth: OAuth2 + PKCE Flow

### What It Does

#### High-Level
The diagram documents the **complete OAuth2 Authorization Code + PKCE authentication flow**:
- `AuthService` generates a Canvas login URL with a cryptographic PKCE challenge and a random one-time state parameter
- The state is stored in `InMemoryOAuthStateStore` and consumed exactly once on callback — preventing CSRF replay attacks
- On callback, the authorization code is exchanged for real tokens via a direct POST to Canvas; tokens are handed off to `TokenService` for encrypted storage

#### Low-Level (Keypoints)
- PKCE: `code_verifier` is random bytes; `code_challenge = Base64url(SHA-256(code_verifier))` (S256 method) — Canvas verifies this on the token exchange POST, preventing authorization code interception attacks
- `OAuthStatePayload` carries both `teamsUserId` (to know whose token to save after OAuth) and `codeVerifier` (needed to complete PKCE on the token exchange)
- `InMemoryOAuthStateStore`: TTL 10 minutes, hard max 500 entries; `evictExpired()` runs on every `put()` and `consume()` call
- `consume(state)` deletes the entry on read — one-time use; calling `consume()` twice with the same state returns `null` on the second call
- At 500 entries, `put()` throws `AppError(503)` — intentional capacity cap to prevent memory exhaustion via unauthenticated requests
- `handleCallback()` calls `HttpUtil.fetchJson()` directly (not via `CanvasService`) for the token exchange POST — avoids a circular dependency between the auth and canvas modules
- `AuthController` exposes `GET /auth/canvas` (redirects to Canvas login) and `GET /auth/canvas/callback` (handles the return redirect)
- `HealthController` exposes `GET /health → { status: 'ok' }` — a liveness probe (a periodic HTTP check Kubernetes makes to decide if a pod is healthy; if the probe fails, Kubernetes restarts the pod) with no authentication requirement

### Where in Code

#### High-Level Location
The `src/auth/` NestJS module — the authentication and authorization layer.

#### Low-Level Location

| Element | File |
|---|---|
| `AuthService` | `src/auth/auth.service.ts` |
| `AuthController` | `src/auth/auth.controller.ts` |
| `HealthController` | `src/health/health.controller.ts` |
| `OAuthStateStore` (abstract) + `InMemoryOAuthStateStore` | `src/auth/oauth-state-store.ts` |
| Module wiring | `src/auth/auth.module.ts` |
| Tests | `src/auth/auth.service.spec.ts`, `src/auth/oauth-state-store.spec.ts` |

- `auth.service.ts`: `generateAuthUrl()` — `crypto.randomBytes(32)` for verifier, `crypto.createHash('sha256').update(verifier).digest()` then base64url encoding for challenge; `new URL('/login/oauth2/auth', baseUrl)` with search params appended
- `oauth-state-store.ts`: `entries` is `Map<string, InMemoryEntry>`; `InMemoryEntry.expiresAt = Date.now() + this.ttlMs`; `evictExpired()` iterates and calls `this.entries.delete(key)` for expired entries on every operation
- `auth.controller.ts`: callback handler checks for `?error=` query param first (Canvas can reject with `?error=access_denied`), then delegates to `authService.handleCallback(code, state)`

### Competency Level

#### Realisation

| Level | Explanation |
|---|---|
| **Realisation S2.2** — Integrate software components with integrity, security, and system performance | PKCE code verifier round-trip enforced end-to-end; state consumed on read prevents replay; 503 at capacity protects memory; encrypted token storage follows immediately on success |
| **Realisation S3.2** — Apply test automation when executing tests | CI/CD pipeline runs `auth.service.spec.ts` and `oauth-state-store.spec.ts` automatically on every push |

#### Management & Control

Not applicable — this diagram covers authentication runtime logic, not development process or pipeline infrastructure.

### Why I Made These Decisions — Design Level 3

**OAuth2 + PKCE instead of plain OAuth2**

OAuth2 (Open Authorization 2.0) is an industry-standard protocol that allows a user to grant a third-party application limited access to their account on another service — without sharing their password. The user authenticates directly with the service (Canvas), which issues a short-lived authorization code to the third-party app. The app exchanges this code for an access token. The access token is what the app uses for subsequent API calls. This keeps Canvas credentials out of the CanvasMCP application entirely.

PKCE stands for Proof Key for Code Exchange (RFC 7636 — RFC stands for Request for Comments, the document format used by the IETF to publish internet standards). It is an extension to the OAuth2 Authorization Code flow designed to prevent authorization code interception attacks. Canvas supports Authorization Code flow without PKCE. I implemented PKCE on top of it.

In the standard Authorization Code flow, Canvas redirects back with a `?code=` in the URL. An attacker who intercepts that redirect — via a malicious browser extension, a logging proxy, or a misconfigured redirect URI — gets the code and can exchange it for a real token. PKCE closes this: before starting the flow I generate a random `code_verifier`, compute its SHA-256 hash (SHA-256 is a cryptographic hash function from the SHA-2 family that produces a fixed 256-bit digest; it is collision-resistant and cannot feasibly be reversed), then base64url-encode the result as the `code_challenge`. Base64url is a variant of base64 encoding that replaces `+` with `-` and `/` with `_` and omits padding `=` — making it safe to include directly in URLs without percent-encoding. The S256 method name used in the OAuth2 request simply identifies this specific derivation (SHA-256 + base64url), as opposed to the deprecated plain method. Canvas verifies the challenge on token exchange. When I exchange the code for a token I must provide the original verifier. An attacker who captured only the code cannot complete the exchange without the verifier, which never left my server.

**One-time-use state with TTL and a hard capacity cap**

CSRF (Cross-Site Request Forgery) is an attack where a malicious site tricks a user's browser into making an authenticated request to another site on the user's behalf. In the OAuth2 context, it could mean an attacker crafting a callback URL that causes the server to associate a Canvas code — obtained by the attacker — with the victim's account. The `state` parameter prevents this: the server generates a unique random value, stores it, sends it to Canvas in the redirect, and then verifies it matches on the callback. A CSRF attack cannot forge the state because the attacker does not know what value the server stored.

I use `consume()` to delete the state on first read. A second callback with the same state returns `null` and is rejected. The TTL (Time to Live, 10 minutes) and hard cap (500 entries) were not arbitrary: the `/auth/canvas` endpoint is publicly reachable without authentication, so an attacker could flood it with login requests to grow the state store unboundedly. At 500 entries, `put()` throws 503 — the store's memory is bounded regardless of request volume.

**Design S3.1 connection:** The authentication boundary is the only part of the system reachable by unauthenticated external parties. Every decision here — PKCE, one-time state, TTL, capacity cap — was made by reasoning through the threat model of a publicly exposed OAuth endpoint, which is a multi-stakeholder security requirement (students' tokens must not be obtainable by third parties, the server must not be DoS-able (DoS — Denial of Service: an attack that exhausts server resources to make it unavailable to legitimate users) through the auth flow).

### Why Not Level 3 Yet — How to Reach It

**Realisation S3.1** — Deployment is missing (tasks 4.1 and 4.3). Additionally, the design document (Section 5.5) specifies token revocation handling as part of the auth flow: when a student revokes Canvas access through Canvas settings, the refresh token becomes invalid. On the next refresh attempt the server must detect this, delete the stored token record, and show a re-authorisation prompt that is distinct from the first-time connect message. This is not implemented — the current code does not detect a revoked refresh token and has no explicit revocation endpoint. This gap means a student who disconnects their Canvas account in Canvas settings will get an opaque error rather than a clear reconnect prompt.

**Realisation S3.2** — CI/CD runs `auth.service.spec.ts` and `oauth-state-store.spec.ts` automatically. This criterion is now met for the service and store layers. Full coverage would require adding `auth.controller.spec.ts` to cover the callback endpoint error handling path.

**Management & Control** — Remains not applicable. Authentication runtime logic contributes no direct evidence for pipeline, release management, or configuration management.

---

## 05-mcp.puml — MCP: Tool Server & Tool Handlers

### What It Does

#### High-Level
The diagram documents the **MCP (Model Context Protocol) server** — the AI integration layer that exposes Canvas data as callable tools for LLMs like Claude:
- `FastMcpCanvasServer` wraps the external `fastmcp` library and registers 8 tools on NestJS module startup
- Each tool follows an identical three-step pattern: resolve the student's token → call Canvas → map to an LLM-friendly format → return
- The MCP server is a NestJS service, not an HTTP REST controller — it runs as a parallel MCP transport alongside the HTTP server on a separate port

#### Low-Level (Keypoints)
- `FastMcpCanvasServer` implements `OnModuleInit` and `OnModuleDestroy` — NestJS lifecycle hooks are interfaces with methods that NestJS calls automatically at fixed points in a module's life: `onModuleInit()` is called once after all dependencies are injected and ready, `onModuleDestroy()` is called when the application is shutting down. Using lifecycle hooks instead of a constructor means the MCP server starts only after `TokenService` and `CanvasService` are fully initialised, and shuts down cleanly without leaving open HTTP connections
- `onModuleInit()` only starts the MCP server if the `MCP_PORT` env var is set — the HTTP server can run without MCP enabled
- `registerTools()` iterates an imported `tools` array and calls `server.addTool(definition)` for each
- `Tool` interface: `name` (snake_case), `description` (for LLM context), `parameters` (Zod schema — validated before `handle()` is called by fastmcp), `handle(deps, args)` returns a value JSON-stringified for MCP transport
- `ToolDeps` is a plain object containing `canvasApi` and `tokenService` — decouples individual tool files from the NestJS DI container
- All 8 tools accept `student_id` as a required Zod string parameter; `get_grades` is the exception (student_id removed)
- Standard tool pattern: (1) `tokenService.resolveToken(student_id)`, (2) `canvasApi.<method>(token, ...)`, (3) map `CanvasXxx` → `XxxResult` (rename/filter fields for LLM readability), (4) return
- `getInboxTool` additionally calls `StripHtml.stripHtml()` on each conversation message body before returning
- `getFeedbackTool` and `getSubmissionHistoryTool` wrap per-course Canvas calls in try/catch and skip courses that throw `CanvasAuthError` (403) — resilient to partial course access
- Each tool is a `const` object literal, not a class instance — exported from individual files and barrel-imported via `src/mcp/tools/index.ts` (a barrel is an `index.ts` that re-exports everything from a folder so callers import from one path instead of separate file paths)

### Where in Code

#### High-Level Location
The `src/mcp/` NestJS module — the AI/LLM integration layer, sitting above the Canvas and Token modules.

#### Low-Level Location

| Element | File |
|---|---|
| `FastMcpCanvasServer` | `src/mcp/fastmcp.service.ts` |
| `Tool` interface, `ToolDeps` interface | `src/mcp/tool.ts` |
| `getCoursesTool` | `src/mcp/tools/get-courses.ts` |
| `getGradesTool` | `src/mcp/tools/get-grades.ts` |
| `getAssignmentsTool` | `src/mcp/tools/get-assignments.ts` |
| `getAnnouncementsTool` | `src/mcp/tools/get-announcements.ts` |
| `getFeedbackTool` | `src/mcp/tools/get-feedback.ts` |
| `getSubmissionHistoryTool` | `src/mcp/tools/get-submission-history.ts` |
| `getCalendarTool` | `src/mcp/tools/get-calendar.ts` |
| `getInboxTool` | `src/mcp/tools/get-inbox.ts` |
| Tool barrel export | `src/mcp/tools/index.ts` |
| Module wiring | `src/mcp/mcp.module.ts` |
| Tests | `src/mcp/fastmcp.service.spec.ts`, `src/mcp/tools/*.spec.ts` |

- `fastmcp.service.ts`: `server = new FastMCP({ name: 'CanvasMCP', version: '1.0.0' })`; `registerTools()` iterates the imported `tools` array; `server.start({ transportType: 'httpStream', port: this.mcpPort })` in `onModuleInit()`
- `tool.ts`: `Tool` is a plain TypeScript interface (not abstract class); `ToolDeps` is a plain object type — no framework coupling in individual tool files
- Each tool file: exports a `const` satisfying `Tool`; Zod schema declared inline `z.object({ student_id: z.string().describe('...'), ... })`; `handle()` is an `async` function
- `get-feedback.ts`: `try { const submissions = await canvasApi.getSubmissions(token, courseId) } catch (e) { if (e instanceof CanvasAuthError) continue; throw e; }` — per-course 403 swallowed, other errors propagate

### Competency Level

#### Realisation

| Level | Explanation |
|---|---|
| **Realisation S2.1** — Build a system of multiple subsystems using existing components | 8 tools each compose `TokenService` + `CanvasService` + `fastmcp` — a multi-subsystem build where all three are existing components wired together |
| **Realisation S3.1** — Scalable system connecting to existing systems using existing frameworks | NestJS + fastmcp as frameworks; conditional MCP activation via `MCP_PORT`; new tools added as standalone files without modifying `FastMcpCanvasServer` |
| **Realisation S3.2** — Apply test automation when executing tests | Each of the 8 tools has its own `.spec.ts`; `fastmcp.service.spec.ts` tests server lifecycle; specs mock `ToolDeps` directly without a running NestJS app |

#### Management & Control

| Level | Explanation |
|---|---|
| **Management & Control S2.2** — Apply methods and techniques to manage software development process and ensure quality | The `Tool` interface + `ToolDeps` pattern enforces a uniform structure across all 8 tools — a process-level quality gate that prevents divergence as the tool count grows |
| **Management & Control S3.2** — Development pipeline with automated build and test infrastructure | CI/CD pipeline runs automated lint, TypeScript compile, and Jest on every push — all 8 tool specs and the server lifecycle spec are included |

### Why I Made These Decisions — Design Level 3

**MCP over REST for AI integration**

MCP (Model Context Protocol) is an open protocol published by Anthropic in 2024 that defines a standard way for AI models to discover and call external tools. An MCP server declares a set of named tools; each tool has a description (prose the model reads to decide which tool to invoke), a validated parameter schema, and a return value. The model never constructs a URL or manages an HTTP session — it sends a JSON tool-call message with arguments, and the MCP transport layer handles the rest. The protocol is designed around how language models actually reason: natural language descriptions and structured parameters, not URL paths and query strings.

fastmcp is the Node.js npm library used here to implement the MCP server side. It handles the JSON transport layer (receiving tool-call messages over HTTP streaming), invokes the Zod schema against the incoming arguments, rejects invalid calls before they reach application code, and dispatches valid calls to the `handle()` function. It is the MCP equivalent of Express for REST — the transport plumbing, not the business logic.

Zod is a TypeScript-first schema declaration and validation library. You describe the expected shape of data as a `z.object({ field: z.string(), ... })` and Zod both infers the TypeScript type and enforces it at runtime. fastmcp runs the Zod schema against the LLM's arguments before `handle()` is ever called.

I could have built a REST API and told the LLM to call it. REST would require the LLM to construct URLs, manage query parameters, and interpret raw HTTP responses — tasks no LLM is reliably good at. MCP shifts the interface to what LLMs are reliable at: reading a tool description and filling in a structured schema. If the LLM hallucinates a parameter name or gets the type wrong, Zod rejects the call before any Canvas API request is made. At the start of the project there were 3 planned tools — the architecture grew to 8 without any structural change to `FastMcpCanvasServer` because new tools only require a new file and a barrel-export line.

**`Tool` interface + `ToolDeps` instead of direct NestJS injection**

Each tool is a plain `const` object. It receives a `ToolDeps` object (`{ canvasApi, tokenService }`) at call time — no NestJS decorators, no DI imports. If tools used `@Inject()` directly, testing one tool would require bootstrapping a full NestJS application module. With `ToolDeps` as a plain object, a test mocks it inline and calls `handle(mockDeps, args)` directly. This is why it was practical to write full unit tests for all 8 tools covering happy path and all error paths (429, 500, missing token, 403). The secondary benefit follows the Open/Closed Principle — one of the five SOLID software design principles (SOLID: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion). It states that a module should be open for extension (new behaviour can be added) but closed for modification (existing code does not need to change to accommodate it). `registerTools()` iterates the imported tools array — adding a 9th tool requires zero changes to `FastMcpCanvasServer`. The server is extended without being modified.

**Deliberate privacy boundary in `get_inbox`**

The tool returns conversation subject, last message preview, and participant names — not the full message thread. Student inbox messages may contain sensitive personal content. The LLM does not need the full history to answer "do I have unread messages from my teacher?" Returning only the preview satisfies the use case while minimising the amount of student PII processed by an external AI service. This was a conscious design decision, not a technical limitation. It reflects three stakeholders simultaneously: students want useful answers, Fontys wants data minimisation, and the institution is subject to GDPR.

**Design S3.1 connection:** The MCP server architecture connects three existing systems — Canvas LMS, fastmcp, and NestJS — without coupling them to each other. The `Tool`/`ToolDeps` pattern was designed to absorb unpredictable growth in tool count. The privacy boundary in `get_inbox` came from identifying and reconciling multiple stakeholder constraints at design time rather than retrofitting them later.

### Why Not Level 3 Yet — How to Reach It

**Realisation S3.1** — The build is complete. The "deploy" half is missing: no Dockerfile (task 4.1) and no AKS deployment configuration (task 4.3) exist yet. The S3.1 claim in the competency table above is therefore partial — the scalable architecture is proven by the code, but "building and deploying" requires a running environment. Completing 4.1 and 4.3 closes this. Note also that the design document (Section 2.3.3) specifies the MCP Server must be **stateless** to allow horizontal scaling. Statelessness depends on the token store being a database (not in-memory) — a pod restart or a second replica currently loses all tokens. The database `TokenStore` implementation in the token module is therefore a prerequisite for the MCP Server's full S3.1 claim.

**Realisation S3.2** — CI/CD pipeline runs all 8 tool specs and `fastmcp.service.spec.ts` automatically on every push. This criterion is fully met.

**Management & Control S3.2** — CI/CD pipeline with automated lint, TypeScript compile, and Jest is in place (task 4.2). This criterion is fully met.

**Management & Control S3.1** — Configuration, change, and release management requires a traceable audit trail of releases. Git tags (`v0.1.0`, `v0.2.0`) at sprint demos with one-paragraph release notes in `CHANGELOG.md` (task 4.5) is the concrete action that closes this. This is low effort — the releases have already happened, they only need to be tagged and documented retroactively.
