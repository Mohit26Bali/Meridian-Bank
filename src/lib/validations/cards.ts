import { z } from "zod";

export const issueCardSchema = z.object({
  accountId: z.string().uuid("Choose an account"),
  type: z.enum(["DEBIT_PHYSICAL", "DEBIT_VIRTUAL"]),
});

export type IssueCardInput = z.infer<typeof issueCardSchema>;

export const cardControlsSchema = z.object({
  cardId: z.string().uuid(),
  dailyLimit: z.coerce.number().min(0).max(50_000, "Daily limit is capped at $50,000"),
  onlinePaymentsEnabled: z.boolean(),
  internationalEnabled: z.boolean(),
});

export type CardControlsInput = z.infer<typeof cardControlsSchema>;

export const changePinSchema = z
  .object({
    cardId: z.string().uuid(),
    pin: z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
    confirmPin: z.string(),
  })
  .refine((data) => data.pin === data.confirmPin, {
    message: "PINs do not match",
    path: ["confirmPin"],
  });

export type ChangePinInput = z.infer<typeof changePinSchema>;
