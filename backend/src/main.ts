import 'reflect-metadata';

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, type NextFunction, type Request, type Response } from 'express';
import { ApiExceptionFilter } from './common/api-exception.filter.js';
import { AppModule } from './app.module.js';

// Automatically load .env for local development (supports running from backend/ or project root)
if (typeof process.loadEnvFile === 'function') {
  for (const candidate of ['.env', '../.env']) {
    const fullPath = resolve(process.cwd(), candidate);
    if (existsSync(fullPath)) {
      try {
        process.loadEnvFile(fullPath);
        break;
      } catch {
        // Fall back to existing process.env
      }
    }
  }
}

async function bootstrap(): Promise<void> {
  const application = await NestFactory.create(AppModule, { bodyParser: false });

  application.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    );
    next();
  });

  application.use(json({ limit: 1 << 20 }));
  application.use(
    (error: unknown, _request: Request, response: Response, next: NextFunction) => {
      if (error) {
        response.status(400).json({ error: 'request body must contain valid JSON' });
        return;
      }
      next();
    },
  );
  application.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: () => new BadRequestException('request body must contain valid JSON'),
    }),
  );
  application.useGlobalFilters(new ApiExceptionFilter());
  application.enableShutdownHooks();

  const host = process.env.HOST ?? '127.0.0.1';
  const port = process.env.PORT ?? '8080';
  await application.listen(port, host);
  console.log(`NestJS backend listening at http://${host}:${port}`);
}

void bootstrap();
