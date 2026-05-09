import { z } from "zod";

export const emailSchema = z.string().trim().email("Adresă de email invalidă");
export const passwordSchema = z
  .string()
  .min(8, "Parola trebuie să aibă cel puțin 8 caractere");

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Parolele nu coincid",
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
