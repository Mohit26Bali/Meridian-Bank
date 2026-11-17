import { z } from "zod";

export const totpTokenSchema = z.object({
  token: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your app"),
});

export type TotpTokenInput = z.infer<typeof totpTokenSchema>;
