import { z } from "zod";

export const loanApplicationSchema = z.object({
  accountId: z.string().uuid("Choose a disbursement account"),
  type: z.enum(["PERSONAL", "HOME", "AUTO", "EDUCATION", "BUSINESS"]),
  principal: z.coerce.number().positive("Enter a loan amount"),
  termMonths: z.coerce.number().int().positive("Enter a term in months"),
});

export type LoanApplicationInput = z.infer<typeof loanApplicationSchema>;

export const payEmiSchema = z.object({
  loanId: z.string().uuid(),
});

export type PayEmiInput = z.infer<typeof payEmiSchema>;
