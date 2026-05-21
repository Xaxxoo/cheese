// src/common/filters/http-exception.filter.ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'InternalServerError';
    let details: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse() as
        | string
        | {
            message?: string | string[];
            error?: string;
            [key: string]: unknown;
          };
      message =
        typeof exResponse === 'string'
          ? exResponse
          : Array.isArray(exResponse.message)
            ? exResponse.message[0]
            : exResponse.message || exception.message;
      error =
        (typeof exResponse !== 'string' && exResponse.error) || exception.name;
      if (typeof exResponse !== 'string') {
        const { message: _message, error: _error, ...extra } = exResponse;
        details = extra;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unhandled error: ${exception.message}`,
        exception.stack,
      );
    }

    if (response.headersSent) return;

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      error,
      ...details,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
