import {
  Controller,
  Get,
  Post,
  Body,
  Logger,
  NotFoundException,
  Query,
  Res,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { TokenService } from '../token/token.service';
import { SessionStore } from './session-store';

// @Controller('auth') sets the route prefix for all endpoints in this class.
// All routes here are accessible under /auth/...
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly sessionStore: SessionStore,
  ) {}

  // GET /auth/login?teamsUserId=<id>&returnTo=<url>
  // Student-facing entry point: renders a minimal HTML login page prompting them to connect Canvas.
  // In dev mode with CANVAS_TEST_TOKEN set, optionally bypasses OAuth and stores the test token directly.
  @Get('login')
  async loginPage(
    @Query('teamsUserId') teamsUserId: string,
    @Query('returnTo') returnTo: string,
    @Query('devStudentId') devStudentId: string,
    @Res() res: Response,
  ): Promise<void> {
    this.logger.log(
      `GET /auth/login teamsUserId=${teamsUserId} hasReturnTo=${!!returnTo}`,
    );

    // Dev-only demo path. NODE_ENV gate is load-bearing security.
    if (
      process.env.NODE_ENV !== 'production' &&
      devStudentId &&
      devStudentId.trim() !== '' &&
      process.env.CANVAS_TEST_TOKEN &&
      process.env.CANVAS_TEST_TOKEN.trim() !== ''
    ) {
      this.logger.log(
        `Dev demo path: storing test token for student ${devStudentId}`,
      );
      await this.tokenService.storeToken(devStudentId, {
        canvasUserId: 0,
        accessToken: process.env.CANVAS_TEST_TOKEN.trim(),
        refreshToken: '',
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      const devToken = await this.sessionStore.create(devStudentId);

      if (returnTo) {
        // TODO: confirm deep link format with Teams bot layer (Kaan)
        const deepLink = `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(returnTo)}&token=${encodeURIComponent(devToken)}`;
        res.redirect(302, deepLink);
        return;
      }

      res.type('text/html').send(connectedHtml(devToken));
      return;
    }

    // Build the Canvas authorize URL, only including params that are present.
    // escapeAttr ensures & and " in the query string can't break the HTML attribute context.
    const qs = new URLSearchParams();
    if (teamsUserId) qs.set('teamsUserId', teamsUserId);
    if (returnTo) qs.set('returnTo', returnTo);
    const qsStr = qs.toString();
    const canvasHref = escapeAttr('/auth/canvas' + (qsStr ? '?' + qsStr : ''));

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Connect Canvas to Teams</title>
  <style>
    body { font-family: sans-serif; max-width: 480px; margin: 80px auto; padding: 0 16px; color: #333; }
    h1 { font-size: 1.4rem; margin-bottom: 12px; }
    p { margin-bottom: 24px; line-height: 1.5; }
    a.btn {
      display: inline-block;
      padding: 10px 20px;
      background: #E66000;
      color: #fff;
      text-decoration: none;
      border-radius: 4px;
      font-size: 1rem;
    }
    a.btn:hover { background: #c55500; }
  </style>
</head>
<body>
  <h1>Connect Canvas to Teams</h1>
  <p>Click the button below to log in with your Fontys Canvas account.</p>
  <a class="btn" href="${canvasHref}">Log in with Canvas</a>
</body>
</html>`;

    res.type('text/html').send(html);
  }

  // GET /auth/canvas?teamsUserId=<id>&returnTo=<url>
  // Development-only endpoint: generates a Canvas OAuth login URL for a given Teams user.
  // In production this throws 404 — the real login flow is triggered by the Teams bot, not HTTP.
  @Get('canvas')
  async login(
    @Query('teamsUserId') teamsUserId: string,
    @Query('returnTo') returnTo: string,
    @Res() res: Response,
  ): Promise<void> {
    // Block this endpoint in production — it is only for development testing
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }
    // Validate that the required query parameter was provided
    if (!teamsUserId) {
      throw new BadRequestException('Missing teamsUserId parameter');
    }
    // Generate the Canvas OAuth URL with PKCE state and redirect the student there
    const authUrl = await this.authService.generateAuthUrl(
      teamsUserId,
      returnTo || undefined,
    );
    res.redirect(authUrl);
  }

  // GET /auth/canvas/callback?code=...&state=...
  // This is the OAuth redirect URI — Canvas redirects here after the student logs in.
  // Canvas may also redirect here with ?error=... if the student denied access.
  @Get('canvas/callback')
  async callback(
    // code is the authorization code Canvas issued — we exchange this for a real token
    @Query('code') code: string,
    // state is the CSRF protection value we generated — we verify it matches what we stored
    @Query('state') state: string,
    // error is set by Canvas if the student denied access (e.g. ?error=access_denied)
    @Query('error') error: string,
    @Query('error_description') errorDescription: string,
    @Res() res: Response,
  ): Promise<void> {
    // If Canvas sent an error, the student denied access or something went wrong on Canvas's side.
    // Return a plain-text error message — the student sees this in their browser.
    if (error) {
      res
        .status(400)
        .type('text/plain')
        .send(`Canvas authorisation denied: ${errorDescription ?? error}`);
      return;
    }

    // Both code and state must be present — if either is missing the callback is malformed
    if (!code || !state) {
      throw new BadRequestException('Missing code or state parameter');
    }

    // Delegate to AuthService: verify state, exchange Fontys code for tokens, save Canvas token.
    // Returns a short-lived one-time authCode — NOT the session token.
    const { returnTo, authCode } = await this.authService.handleCallback(
      code,
      state,
    );

    if (returnTo) {
      this.logger.log(
        `Callback: redirecting with auth code to returnTo=${returnTo}`,
      );
      // The auth code (not the session token) is safe to put in a URL — it is short-lived,
      // one-time use, and worthless without the server-to-server POST /auth/token exchange.
      // TODO: confirm deep link format with Teams bot layer (Kaan)
      try {
        const callbackUrl = new URL(returnTo);
        callbackUrl.searchParams.set('code', authCode);
        res.redirect(302, callbackUrl.toString());
      } catch {
        const deepLink = `https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(returnTo)}&code=${encodeURIComponent(authCode)}`;
        res.redirect(302, deepLink);
      }
      return;
    }

    this.logger.log('Callback: no returnTo, showing fallback page');
    res.type('text/html').send(connectedHtml(authCode));
  }

  // POST /auth/token
  // The Teams bot calls this server-to-server after receiving the auth code from the redirect URL.
  // Returns the session token in the response body — never in a URL.
  @Post('token')
  async exchangeToken(@Body('code') code: string): Promise<{ token: string }> {
    if (!code) throw new BadRequestException('Missing code');
    try {
      const token = await this.authService.exchangeAuthCode(code);
      this.logger.log('Session token issued via POST /auth/token');
      return { token };
    } catch {
      throw new UnauthorizedException('Invalid or expired auth code');
    }
  }
}

// escapeAttr makes a string safe for use inside an HTML attribute value.
// URLSearchParams already percent-encodes " in values, but & between params
// must become &amp; to keep the HTML well-formed and prevent any attribute injection.
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

// connectedHtml returns the fallback page shown when there is no returnTo URL.
// It displays the session token so developers can copy it for MCP configuration.
function connectedHtml(authCode?: string): string {
  const safeCode = escapeAttr(authCode ?? '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Canvas Connected</title>
  <style>
    body { font-family: sans-serif; max-width: 480px; margin: 80px auto; padding: 0 16px; color: #333; text-align: center; }
    h1 { font-size: 1.4rem; margin-bottom: 12px; }
    p { line-height: 1.5; }
    code { display: block; margin: 16px auto; padding: 12px; background: #f5f5f5; border-radius: 4px; word-break: break-all; font-size: 0.85rem; text-align: left; }
    small { color: #888; }
  </style>
</head>
<body>
  <h1>You're connected!</h1>
  <p>Your Canvas account has been linked. Exchange this one-time code for a session token:</p>
  <code>POST /auth/token<br>{ "code": "${safeCode}" }</code>
  <small>This code expires in 5 minutes and can only be used once.</small>
</body>
</html>`;
}
