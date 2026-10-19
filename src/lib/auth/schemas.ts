import { z } from "zod";

export const OTP_LENGTH = 6;

const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254));

export const otpRequestSchema = z.object({
  email: emailSchema,
});

export const otpVerifySchema = z.object({
  email: emailSchema,
  // Spaces are tolerated (codes are often pasted as "123 456").
  code: z
    .string()
    .transform((value) => value.replace(/\s+/g, ""))
    .pipe(z.string().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`))),
  next: z.string().max(512).optional(),
});

export const ageConfirmationSchema = z.object({
  confirmed: z.literal(true),
});

export type OtpRequest = z.infer<typeof otpRequestSchema>;
export type OtpVerify = z.infer<typeof otpVerifySchema>;
