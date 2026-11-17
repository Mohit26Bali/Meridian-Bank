import { z } from "zod";

export const createInvestmentSchema = z.object({
  accountId: z.string().uuid("Choose a funding account"),
  type: z.enum(["MUTUAL_FUND", "FIXED_DEPOSIT", "RECURRING_DEPOSIT", "STOCK"]),
  principal: z.coerce
    .number()
    .positive("Enter an amount greater than zero")
    .max(1_000_000, "Amount is too large for this demo"),
});

export type CreateInvestmentInput = z.infer<typeof createInvestmentSchema>;

export const withdrawInvestmentSchema = z.object({
  investmentId: z.string().uuid(),
  accountId: z.string().uuid("Choose a payout account"),
});

export type WithdrawInvestmentInput = z.infer<typeof withdrawInvestmentSchema>;
