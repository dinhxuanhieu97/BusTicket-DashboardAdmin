import { z } from "zod";

/** Ảnh lệnh chuyển khoản khách gửi từ Mini App (khớp `apps/api/src/bookings/payment-proofs.service.ts`). */
export const PROOF_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const PROOF_MAX_BYTES = 1_572_864;
export const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const paymentProofSchema = z.object({
  id: z.string().regex(UUID),
  mime: z.enum(PROOF_TYPES),
  bytes: z.number().int().positive().max(PROOF_MAX_BYTES),
  createdAt: z.string(),
});
export const bookingPaymentProofsSchema = z.object({
  transferClaimedAt: z.string().nullable(),
  proofs: z.array(paymentProofSchema).max(10),
});
export type PaymentProof = z.infer<typeof paymentProofSchema>;
export type BookingPaymentProofs = z.infer<typeof bookingPaymentProofsSchema>;

/** Đường dẫn ảnh qua BFF cùng origin (không lộ API, kèm phiên đăng nhập). */
export const proofImageUrl = (id: string) =>
  `/api/payment-proofs/${encodeURIComponent(id)}`;
