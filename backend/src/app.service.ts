import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  // [NGHIỆP VỤ]: Trả thông điệp mặc định cho endpoint kiểm tra ứng dụng.
  // [CHỐNG GIAN LẬN]: Endpoint này không thay thế health check cơ sở dữ liệu.
  // [CẨN THẬN KHI SỬA]: Không đưa thông tin môi trường hoặc bí mật vào chuỗi trả về.
  // [ĐIỂM MỞ RỘNG]: Thay bằng health indicator có kiểm tra Prisma khi cần.
  getHello(): string {
    return 'Hello World!';
  }
}
