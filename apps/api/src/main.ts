import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('API');
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`API server running on port ${port}`);
}

bootstrap();
