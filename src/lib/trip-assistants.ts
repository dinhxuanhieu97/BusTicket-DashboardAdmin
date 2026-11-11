import { z } from "zod";

/** Hợp đồng API phân công phụ xe (khớp `apps/api/src/trips/trip-assistants.service.ts`). */
export const MAX_ASSISTANTS_PER_TRIP = 5;

export const assistantRefSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  phone: z.string(),
});
export const tripAssistantSchema = assistantRefSchema.extend({
  active: z.boolean(),
  assignedAt: z.string(),
});
export const tripAssistantsSchema = z.object({
  assistants: z.array(tripAssistantSchema),
});
export const assistantCandidatesSchema = z.object({
  assistants: z.array(assistantRefSchema),
});
export const assignAssistantsInput = z
  .object({
    userIds: z.array(z.uuid()).max(MAX_ASSISTANTS_PER_TRIP),
  })
  .strict()
  .refine((v) => new Set(v.userIds).size === v.userIds.length);

const tripRef = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  departAt: z.string(),
  contactPhone: z.string().nullable(),
  route: z.object({
    code: z.string(),
    origin: z.string(),
    destination: z.string(),
  }),
  vehicle: z.object({
    code: z.string(),
    name: z.string(),
    plateNumber: z.string().nullable(),
  }),
});
export const assignedTripSchema = tripRef.extend({
  bookingCount: z.number().int(),
  seatCount: z.number().int(),
});
export const assignedTripsSchema = z.object({
  trips: z.array(assignedTripSchema),
});
export const passengerBookingSchema = z.object({
  code: z.string(),
  status: z.string(),
  contactName: z.string(),
  contactPhone: z.string(),
  note: z.string().nullable(),
  totalAmount: z.number().int(),
  paidAmount: z.number().int(),
  dueAmount: z.number().int(),
  paymentStatus: z.string(),
  seats: z.array(
    z.object({
      code: z.string(),
      floor: z.string(),
      occupancy: z.number().int(),
      infantCount: z.number().int(),
    }),
  ),
});
export const tripPassengersSchema = z.object({
  trip: tripRef,
  bookings: z.array(passengerBookingSchema),
  summary: z.object({
    bookings: z.number().int(),
    seats: z.number().int(),
    people: z.number().int(),
    infants: z.number().int(),
    dueAmount: z.number().int(),
  }),
  fetchedAt: z.string(),
});
export type TripAssistant = z.infer<typeof tripAssistantSchema>;
export type AssistantRef = z.infer<typeof assistantRefSchema>;
export type AssignedTrip = z.infer<typeof assignedTripSchema>;
export type TripPassengers = z.infer<typeof tripPassengersSchema>;

export const paymentStatusLabels: Record<string, string> = {
  UNPAID: "Chưa thanh toán",
  PARTIAL: "Trả một phần",
  DEPOSIT_PAID: "Đã cọc",
  PAID: "Đã thanh toán",
};

/** Phụ xe: có quyền xem chuyến được giao nhưng không có quyền xem toàn bộ chuyến. */
export function isAssistantOnly(permissions: readonly string[] | undefined) {
  return (
    !!permissions?.includes("trip.assigned.read") &&
    !permissions.includes("trip.read")
  );
}
