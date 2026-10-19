import { ZodError } from "zod";

import messages from "../../messages/mn.json";
import { logger } from "./logger";

// Error codes from docs/backend_schema.md §5. User-facing text lives in
// messages/mn.json under "errors".
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_FAILED",
  "MESSAGE_BLOCKED",
  "IN_PROGRESS",
  "TURN_LIMIT_REACHED",
  "DAILY_LIMIT_REACHED",
  "SESSION_NOT_ACTIVE",
  "FEEDBACK_NOT_ELIGIBLE",
  "FEEDBACK_ATTEMPTS_EXHAUSTED",
  "AI_UNAVAILABLE",
  "TOO_MANY_REQUESTS",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ErrorBody = {
  error: { code: ErrorCode; message_mn: string; retryable: boolean };
};

export function defaultMessageMn(code: ErrorCode): string {
  return messages.errors[code];
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly messageMn: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(code: ErrorCode, messageMn: string, status: number, retryable = false) {
    super(code);
    this.name = "AppError";
    this.code = code;
    this.messageMn = messageMn;
    this.status = status;
    this.retryable = retryable;
  }
}

function errorResponse(
  code: ErrorCode,
  messageMn: string,
  status: number,
  retryable: boolean,
): Response {
  const body: ErrorBody = { error: { code, message_mn: messageMn, retryable } };
  return Response.json(body, { status });
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return errorResponse(error.code, error.messageMn, error.status, error.retryable);
  }
  if (error instanceof ZodError) {
    return errorResponse("VALIDATION_FAILED", defaultMessageMn("VALIDATION_FAILED"), 400, false);
  }
  // Unknown errors: log for operators, return a generic message so stack
  // traces and provider details never reach the client.
  logger.error("unhandled_error", {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : undefined,
  });
  return errorResponse("INTERNAL", defaultMessageMn("INTERNAL"), 500, false);
}

export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
