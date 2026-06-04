import { z } from 'zod';
import { CanvasService } from '../canvas/canvas.service';
import { TokenService } from '../token/token.service';

// ToolDeps is a plain object that carries the two services every tool needs.
// Passing deps as a plain object (not via NestJS DI) means:
//   - Tool files have zero NestJS imports — they are plain TypeScript
//   - Tests can mock both services inline without a NestJS module setup
//   - FastMcpCanvasServer creates ToolDeps once and passes it to all 8 tools
export interface ToolDeps {
  canvasApi: CanvasService;
  tokenService: TokenService;
  studentId: string;
}

// Tool is the interface every MCP tool must satisfy.
// The generic S allows TypeScript to infer the exact Zod schema type so that
// handle() receives strongly-typed arguments (not just 'object').
export interface Tool<
  S extends z.ZodObject<z.ZodRawShape> = z.ZodObject<z.ZodRawShape>,
> {
  // name is the snake_case identifier the LLM uses to call this tool (e.g. "get_courses")
  readonly name: string;
  // description is prose the LLM reads to decide whether to call this tool.
  // A good description is the most important part of an MCP tool — bad descriptions
  // cause the LLM to call the wrong tool or miss the right one.
  readonly description: string;
  // parameters is a Zod schema that fastmcp validates against the LLM's arguments
  // before handle() is called. Invalid arguments are rejected before any Canvas call is made.
  readonly parameters: S;
  // handle is the actual implementation — receives validated deps and typed args,
  // returns data that fastmcp JSON-stringifies for MCP transport
  handle(deps: ToolDeps, args: z.infer<S>): Promise<unknown>;
}
