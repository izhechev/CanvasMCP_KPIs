import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppErrorFilter } from './common/app-error.filter';

// These environment variables must all be set before the server can start.
// The server throws immediately at startup if any are missing — fail fast,
// rather than starting and then crashing on the first request.
const REQUIRED_ENV_VARS = [
  'CANVAS_BASE_URL',
  // Fontys OIDC — used for student authentication until Canvas Developer Key is available
  'FONTYS_ISSUER_URL',
  'FONTYS_CLIENT_ID',
  'FONTYS_CLIENT_SECRET',
  'FONTYS_REDIRECT_URI',
  'TOKEN_ENCRYPTION_KEY',
];

// validateEnv checks that all required variables are present and that
// no development-only settings are active in production.
function validateEnv(): void {
  // Find all variable names from the list that are missing or empty in process.env
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  // CANVAS_TEST_TOKEN bypasses OAuth entirely — it must never be set in production
  // because it would allow any request to use the hardcoded token as if it were authenticated.
  if (process.env.NODE_ENV === 'production' && process.env.CANVAS_TEST_TOKEN) {
    throw new Error(
      'CANVAS_TEST_TOKEN must not be set in production — it bypasses OAuth',
    );
  }
}

// bootstrap is the entry point of the NestJS application.
async function bootstrap() {
  // Validate environment variables before creating the app — no point starting if misconfigured
  validateEnv();

  // NestFactory.create() bootstraps the NestJS application from the root AppModule,
  // which wires together all the modules (canvas, token, auth, mcp).
  const app = await NestFactory.create(AppModule);

  // Register the global exception filter so every thrown AppError is converted
  // to the correct HTTP status code automatically — no try/catch needed in controllers.
  app.useGlobalFilters(new AppErrorFilter());

  // Start the HTTP server on the port from environment or default 3000
  await app.listen(process.env.PORT ?? 3000);
}

// void suppresses the "floating promise" TypeScript warning —
// bootstrap() is intentionally not awaited at the top level.
void bootstrap();
