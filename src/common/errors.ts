// Base class for every error in this application.
// Extends the built-in Error so it can be thrown normally,
// but adds a 'status' field that carries the HTTP response code.
// The global AppErrorFilter reads this status and sends the right HTTP response.
export class AppError extends Error {
  constructor(
    message: string,
    // status is the HTTP code that will be sent to the client (e.g. 400, 401, 403, 500)
    public readonly status: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    // Set the error name to the class name so logs show e.g. "CanvasAuthError" not "Error"
    this.name = this.constructor.name;
  }
}

// Thrown when the OAuth state parameter in the callback is unknown or expired.
// status 400 = Bad Request — the client sent an invalid state value.
export class OAuthStateError extends AppError {
  constructor() {
    super('Invalid or expired OAuth state', 400);
  }
}

// Thrown when Canvas rejects the authorization code during the token exchange POST.
// status 401 = Unauthorized — we could not get a real token from Canvas.
export class TokenExchangeError extends AppError {
  constructor(cause: unknown) {
    super('Canvas token exchange failed', 401, { cause });
  }
}

// Thrown when Canvas returns HTTP 429 (Too Many Requests — rate limit hit).
// status 429 is forwarded as-is so the client knows to retry later.
export class CanvasRateLimitError extends AppError {
  constructor(cause?: unknown) {
    super('Canvas rate limit (HTTP 429)', 429, { cause });
  }
}

// Thrown when Canvas returns HTTP 403 (Forbidden — token is invalid or revoked).
// status 403 = Forbidden — the student's token no longer grants access.
export class CanvasAuthError extends AppError {
  constructor(cause?: unknown) {
    super('Canvas auth error (HTTP 403)', 403, { cause });
  }
}

// Thrown when there is no stored Canvas token for a given student.
// Distinct from CanvasAuthError: here we never had a token, not that the token was rejected.
// status 401 — the student must go through the OAuth flow first.
export class MissingAccessTokenError extends AppError {
  constructor(public readonly studentId: string) {
    super(`No Canvas access token available for student ${studentId}`, 401);
  }
}

// Thrown if the TOKEN_ENCRYPTION_KEY environment variable is missing or the wrong length.
// The key must be 64 hex characters (= 32 bytes) for AES-256.
// status 500 — this is a server misconfiguration, not a client mistake.
export class InvalidEncryptionKeyError extends AppError {
  constructor(length: number) {
    super(
      `TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Got length ${length}.`,
      500,
    );
  }
}
