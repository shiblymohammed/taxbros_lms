import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'path';
import { AppLogger } from './common/logging/app-logger.service';
import {
  assertProductionSecrets,
  buildHelmetOptions,
  isSwaggerEnabled,
  parseCorsOrigins,
} from './common/security/security.config';

async function bootstrap() {
  // Fail fast on weak/missing JWT secrets in production (Task 68)
  assertProductionSecrets(process.env);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // Route all framework and application logs through Winston (R39)
  const logger = app.get(AppLogger);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const port = configService.get('PORT') || 4000;
  const apiPrefix = configService.get('API_PREFIX') || 'api';
  const nodeEnv = configService.get<string>('NODE_ENV');
  // Throws in production if CORS_ORIGIN is missing, "*" or not https (Task 70)
  const corsOrigins = parseCorsOrigins(configService.get<string>('CORS_ORIGIN'), nodeEnv);

  // Behind Nginx/a load balancer, trust the proxy so rate limits and logs see
  // the real client IP (e.g. TRUST_PROXY=1). Leave unset when exposed directly.
  const trustProxy = configService.get<string>('TRUST_PROXY');
  if (trustProxy) {
    app.set('trust proxy', /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }

  // Security headers: CSP, HSTS (1 year), nosniff, frame protection, referrer policy (Task 70)
  app.use(helmet(buildHelmetOptions()));
  app.disable('x-powered-by');

  // Serve static files from uploads directory
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Global prefix for all routes
  app.setGlobalPrefix(apiPrefix);

  // Enable cookie parsing middleware
  app.use(cookieParser());

  // Enable CORS with credentials support for cookies
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Retry-After', 'Content-Disposition'],
    maxAge: 600,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // Swagger/OpenAPI documentation (off in production unless SWAGGER_ENABLED=true)
  const swaggerEnabled = isSwaggerEnabled(configService.get<string>('SWAGGER_ENABLED'), nodeEnv);
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('TAXBROS LMS API')
      .setDescription('Learning Management System API for TAXBROS institute')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token',
        },
        'JWT'
      )
      .addCookieAuth('refreshToken', {
        type: 'apiKey',
        in: 'cookie',
        name: 'refreshToken',
        description: 'Refresh token stored in httpOnly cookie',
      })
      .addTag('Authentication', 'User authentication and session management')
      .addTag('Users', 'User account management')
      .addTag('Students', 'Student profile management')
      .addTag('Staff', 'Staff profile management')
      .addTag('Classes', 'Class management and enrollment')
      .addTag('Attendance', 'Student and staff attendance tracking')
      .addTag('Courses', 'Course content management')
      .addTag('Uploads', 'File upload management')
      .addTag('Progress', 'Lesson progress tracking')
      .addTag('Quizzes', 'Quiz creation and assessment')
      .addTag('Labs', 'Government portal simulations')
      .addTag('Reports', 'Attendance and progress reports')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
      customSiteTitle: 'TAXBROS LMS API Documentation',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  await app.listen(port);
  logger.log(`API server running on http://localhost:${port}/${apiPrefix}`, 'Bootstrap');
  if (swaggerEnabled) {
    logger.log(`API documentation at http://localhost:${port}/${apiPrefix}/docs`, 'Bootstrap');
  }
  logger.log(`CORS origins: ${corsOrigins.join(', ')}`, 'Bootstrap');
}

bootstrap();
