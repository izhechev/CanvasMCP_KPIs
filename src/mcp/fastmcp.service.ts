import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { FastMCP } from 'fastmcp';
import { CanvasService } from '../canvas/canvas.service';
import { TokenService } from '../token/token.service';
import { SessionStore } from '../auth/session-store';
import { ToolDeps } from './tool';
import { TOOLS } from './tools';

// FastMcpCanvasServer is the MCP server — it is NOT an HTTP REST controller.
// It runs alongside the HTTP server on a separate port defined by MCP_PORT.
// NestJS manages its lifecycle via OnModuleInit and OnModuleDestroy.
@Injectable()
export class FastMcpCanvasServer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FastMcpCanvasServer.name);

  private readonly server: FastMCP<{ studentId: string }>;

  // Read MCP_PORT from the environment. Defaults to 3001 if not set,
  // but the server only starts if MCP_PORT is explicitly defined.
  private readonly mcpPort = parseInt(process.env.MCP_PORT ?? '3001', 10);

  constructor(
    private readonly canvasApi: CanvasService,
    private readonly tokenService: TokenService,
    private readonly sessionStore: SessionStore,
  ) {
    const isProd = process.env.NODE_ENV === 'production';

    this.server = new FastMCP({
      name: 'canvas-mcp',
      version: '1.0.0',
      // authenticate is only wired in production — in dev mode omitting it prevents
      // FastMCP from returning 401, which would trigger the MCP Inspector's OAuth flow.
      // In dev, CANVAS_TEST_TOKEN is used for all tool calls regardless of studentId.
      ...(isProd && {
        authenticate: (request: {
          headers?: Record<string, string | string[] | undefined>;
        }) => {
          const raw = request?.headers?.['authorization'];
          const header = Array.isArray(raw) ? raw[0] : raw;
          const token = header?.startsWith('Bearer ')
            ? header.slice(7).trim()
            : '';
          return this.sessionStore
            .resolve(token)
            .then((studentId) => ({ studentId: studentId ?? '' }));
        },
      }),
    });
  }

  // onModuleInit() is called by NestJS after all dependencies are injected and ready.
  // Using a lifecycle hook (not the constructor) ensures CanvasService and TokenService
  // are fully initialised before we start accepting MCP connections.
  onModuleInit(): void {
    // Register all 8 tools with the FastMCP server
    this.registerTools();

    // Only start the MCP server if MCP_PORT is set in the environment.
    // This allows the HTTP server to run without MCP enabled (e.g. for the auth-only flow).
    if (process.env.MCP_PORT) {
      this.server
        .start({
          transportType: 'httpStream',
          httpStream: { port: this.mcpPort },
        })
        .then(() =>
          this.logger.log(`MCP server listening on port ${this.mcpPort}`),
        )
        .catch((err: unknown) =>
          this.logger.error('MCP server failed to start', err),
        );
    }
  }

  // onModuleDestroy() is called by NestJS when the application is shutting down.
  // Stopping the server cleanly prevents open HTTP connections from being abandoned.
  async onModuleDestroy(): Promise<void> {
    await this.server.stop();
  }

  // registerTools() wires all 8 tool objects into the FastMCP server.
  // Each tool is a plain const object (not a class) that satisfies the Tool interface.
  // Adding a 9th tool only requires adding a new file and exporting it from tools/index.ts —
  // this method never needs to change (Open/Closed Principle).
  private registerTools(): void {
    // Build the base ToolDeps once — shared across all tool calls.
    // studentId is injected per-call from the MCP session context (see execute below).
    const baseDeps = {
      canvasApi: this.canvasApi,
      tokenService: this.tokenService,
    };

    for (const tool of TOOLS) {
      this.server.addTool({
        name: tool.name,
        description: tool.description,
        // parameters is the Zod schema — fastmcp validates the LLM's arguments against it
        parameters: tool.parameters,
        // execute is called by fastmcp after Zod validation passes.
        // It calls our tool's handle() and JSON.stringifies the result for MCP transport.
        execute: async (args, context) => {
          const studentId = context.session?.studentId ?? '';
          const deps: ToolDeps = { ...baseDeps, studentId };
          return JSON.stringify(await tool.handle(deps, args));
        },
      });
    }
    this.logger.log(`Registered ${TOOLS.length} Canvas MCP tools`);
  }
}
