import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = this.getErrorMessage(exception);

    response.status(statusCode).json({ error: message });
  }

  private getErrorMessage(exception: unknown): string {
    if (!(exception instanceof HttpException)) {
      return 'internal server error';
    }

    const exceptionResponse = exception.getResponse();
    if (typeof exceptionResponse === 'string') {
      return exceptionResponse;
    }

    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      const responseMessage = exceptionResponse.message;
      if (typeof responseMessage === 'string') {
        return responseMessage;
      }
      if (Array.isArray(responseMessage) && typeof responseMessage[0] === 'string') {
        return responseMessage[0];
      }
    }

    return exception.message;
  }
}
