import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('WorkerIngest');
  const app = await NestFactory.createApplicationContext(AppModule);

  logger.log('Ingest worker started');

  const shutdown = async () => {
    logger.log('Shutting down ingest worker...');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap();
