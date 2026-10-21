import { z } from "zod";

// Every AI output is validated before it is stored or shown (docs/trd.md §3).
export const replySchema = z.object({ text: z.string().trim().min(1).max(600) });

export type Reply = z.infer<typeof replySchema>;
