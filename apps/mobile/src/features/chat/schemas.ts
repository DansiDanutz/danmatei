import { z } from "zod";

// Same limits as the server (api/_lib/mobile-api.ts): trimmed, 1 to 4000 characters.
export const messageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Scrie un mesaj")
    .max(4000, "Mesajul poate avea cel mult 4000 de caractere"),
});

export type MessageInput = z.infer<typeof messageSchema>;
