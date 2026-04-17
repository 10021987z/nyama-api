import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join, resolve } from 'path';
import { promises as fs } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.enableCors({ origin: true, credentials: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Sert les fichiers statiques (avatars) :
  //   uploads/avatars/<file> → /api/v1/uploads/avatars/<file>
  const uploadsRoot = process.env.AVATAR_STORAGE_PATH
    ? resolve(process.env.AVATAR_STORAGE_PATH, '..')
    : resolve(process.cwd(), 'uploads');
  await fs
    .mkdir(join(uploadsRoot, 'avatars'), { recursive: true })
    .catch(() => undefined);
  app.useStaticAssets(uploadsRoot, {
    prefix: '/api/v1/uploads/',
    maxAge: '1h',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`NYAMA API running on port ${port}`);
  console.log(`Avatar storage: ${uploadsRoot}`);
}
bootstrap();
