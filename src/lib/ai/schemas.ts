import { z } from "zod";

// Every AI output is validated before it is stored or shown (docs/trd.md §3).
export const replySchema = z.object({ text: z.string().trim().min(1).max(600) });

export type Reply = z.infer<typeof replySchema>;

// Post-conversation feedback (docs/trd.md §3.2). Used by the provider eval
// until the feedback pipeline lands in M7.
export const errorCategorySchema = z.enum([
  "grammar",
  "tense",
  "article",
  "preposition",
  "word_order",
  "vocabulary",
  "other",
]);

export const feedbackSchema = z.object({
  strengths_mn: z.array(z.string().min(1).max(300)).min(2).max(3),
  corrections: z
    .array(
      z.object({
        message_index: z.number().int().nonnegative(),
        original: z.string().min(1),
        corrected: z.string().min(1),
        explanation_mn: z.string().min(1),
        kind: z.enum(["error", "style"]),
        category: errorCategorySchema,
      }),
    )
    .max(5),
  error_tally: z.array(
    z.object({ category: errorCategorySchema, count: z.number().int().positive() }),
  ),
  missions: z.array(
    z.object({
      key: z.number().int().min(1).max(3),
      used: z.boolean(),
      used_correctly: z.boolean(),
    }),
  ),
});

export type ErrorCategory = z.infer<typeof errorCategorySchema>;
export type Feedback = z.infer<typeof feedbackSchema>;
