import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// [NGHIỆP VỤ]: Khởi động API NestJS với CORS, validation và cổng riêng của backend.
// [CHỐNG GIAN LẬN]: ValidationPipe whitelist/forbid trường lạ để payload không thể ghi thuộc tính ngoài DTO.
// [CẨN THẬN KHI SỬA]: Production phải cấu hình CORS_ORIGIN; không bật wildcard khi dùng credentials.
// [ĐIỂM MỞ RỘNG]: Gắn global exception filter, rate limiting và observability tại bootstrap.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configuredOrigins = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV === 'production' && !configuredOrigins?.length) {
    throw new Error('Cần cấu hình CORS_ORIGIN khi chạy production');
  }

  app.enableCors({
    origin: configuredOrigins?.length
      ? configuredOrigins
      : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3001));
}
void bootstrap();
