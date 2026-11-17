import { z } from "zod";

export const depositSchema = z.object({
  accountId: z.string().uuid("Choose an account"),
  amount: z.coerce
    .number()
    .positive("Enter an amount greater than zero")
    .max(50_000, "Mock deposits are capped at $50,000")
    .refine((value) => Math.round(value * 100) === value * 100, {
      message: "Amounts can have at most 2 decimal places",
    }),
  description: z.string().trim().max(140).optional(),
});

export type DepositInput = z.infer<typeof depositSchema>;

const amountSchema = z.coerce
  .number()
  .positive("Enter an amount greater than zero")
  .refine((value) => Math.round(value * 100) === value * 100, {
    message: "Amounts can have at most 2 decimal places",
  });

export const beneficiarySchema = z.object({
  nickname: z.string().trim().min(1, "Give this payee a nickname").max(40),
  bankName: z.string().trim().min(1, "Bank name is required").max(80),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{9,18}$/, "Account number must be 9-18 digits"),
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC code (e.g. ABCD0123456)"),
});

export type BeneficiaryInput = z.infer<typeof beneficiarySchema>;

export const internalTransferSchema = z
  .object({
    fromAccountId: z.string().uuid("Choose a source account"),
    toAccountId: z.string().uuid("Choose a destination account"),
    amount: amountSchema,
    description: z.string().trim().max(140).optional(),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: "Choose two different accounts",
    path: ["toAccountId"],
  });

export type InternalTransferInput = z.infer<typeof internalTransferSchema>;

export const beneficiaryTransferSchema = z.object({
  fromAccountId: z.string().uuid("Choose a source account"),
  beneficiaryId: z.string().uuid("Choose a payee"),
  amount: amountSchema,
  description: z.string().trim().max(140).optional(),
});

export type BeneficiaryTransferInput = z.infer<typeof beneficiaryTransferSchema>;
