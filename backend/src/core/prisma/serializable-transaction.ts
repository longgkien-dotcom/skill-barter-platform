import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

// [NGHIỆP VỤ]: Chạy thao tác nhiều bước với mức cô lập Serializable và thử lại xung đột ghi có thể phục hồi.
// [CHỐNG GIAN LẬN]: Ngăn hai yêu cầu đồng thời cùng tiêu số dư hoặc cùng xử lý escrow dựa trên số dư cũ.
// [CẨN THẬN KHI SỬA]: Callback có thể chạy lại; không đặt side effect bên ngoài database như gửi email trong callback.
// [ĐIỂM MỞ RỘNG]: Có thể bổ sung jitter/backoff và metric retry khi cần xử lý tải lớn.
export async function withSerializableRetry<T>(
  prisma: PrismaService,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const isRetryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034';
      if (!isRetryable || attempt === maxAttempts) {
        throw error;
      }
    }
  }

  throw new Error('Serializable transaction exhausted without a result');
}
