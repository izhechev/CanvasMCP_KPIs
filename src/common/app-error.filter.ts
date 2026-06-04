import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { AppError } from './errors';

// @Catch(AppError) tells NestJS: intercept any thrown AppError (and its subclasses)
// before it reaches the default error handler.
// This filter is registered globally in main.ts, so it runs for every request.
@Catch(AppError)
export class AppErrorFilter implements ExceptionFilter {
  catch(error: AppError, host: ArgumentsHost): void {
    // ArgumentsHost gives access to the underlying HTTP context (request + response).
    // switchToHttp() switches from the generic host to the HTTP-specific adapter.
    const response = host.switchToHttp().getResponse<Response>();

    // Read the status code from the error (set in AppError constructor)
    // and send a JSON body with the error details.
    // This means every thrown AppError automatically becomes the correct HTTP response —
    // no manual try/catch needed in controllers.
    response.status(error.status).json({
      statusCode: error.status,
      message: error.message,
      error: error.name,
    });
  }
}
