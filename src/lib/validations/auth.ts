import { z } from "zod";

const COMMON_PASSWORDS = new Set([
  "password123!",
  "letmein123!",
  "qwerty123456",
  "welcome1234!",
  "admin123456!",
  "iloveyou123!",
  "password1234",
  "123456789012",
]);

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters long")
  .max(128, "Password must be at most 128 characters long")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character")
  .refine(
    (value) => !COMMON_PASSWORDS.has(value.toLowerCase()),
    "This password is too common. Please choose a stronger one."
  );

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address")
  .max(254);

// E.164: optional leading +, 1-15 digits, first digit non-zero
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{7,14}$/, "Enter a valid phone number in international format");

export const signupSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required").max(60),
    lastName: z.string().trim().min(1, "Last name is required").max(60),
    email: emailSchema,
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the terms to continue" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const otpSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
