import { z } from "zod";

const dataUrlSchema = z
  .string()
  .min(1, "Upload a file")
  .regex(/^data:image\/(png|jpe?g|webp);base64,/, "Upload a PNG, JPG, or WEBP image")
  .refine((value) => value.length < 3_500_000, "File is too large (max ~2.5MB)");

export const kycSubmissionSchema = z.object({
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid PAN (e.g. ABCDE1234F)"),
  aadhaar: z
    .string()
    .trim()
    .regex(/^\d{12}$/, "Aadhaar must be exactly 12 digits"),
  panDocument: dataUrlSchema,
  aadhaarDocument: dataUrlSchema,
  selfie: dataUrlSchema,
  addressProof: dataUrlSchema,
});

export type KycSubmissionInput = z.infer<typeof kycSubmissionSchema>;
