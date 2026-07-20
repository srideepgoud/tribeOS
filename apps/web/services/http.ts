import { env } from "@/lib/env";

export interface ApiErrorDetail {
  field: string;
  message: string;
}

/** Error thrown for any non-successful API response (envelope from api_contract.md). */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: ApiErrorDetail[];

  constructor(message: string, code: string, status: number, details?: ApiErrorDetail[]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: unknown;
}

interface ErrorEnvelope {
  success: false;
  error: { code: string; message: string; details?: ApiErrorDetail[] };
}

export interface ApiResult<T> {
  data: T;
  meta?: unknown;
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const response = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return { data: undefined as T };
  }

  const body = (await response.json().catch(() => null)) as
    | SuccessEnvelope<T>
    | ErrorEnvelope
    | null;

  if (!response.ok || !body || body.success === false) {
    const error = body && body.success === false ? body.error : undefined;
    throw new ApiError(
      error?.message ?? "The request could not be completed.",
      error?.code ?? "ERROR",
      response.status,
      error?.details,
    );
  }

  return { data: body.data, meta: body.meta };
}

/** Extract a user-safe message from an unknown error, with a fallback. */
export function apiErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  return error instanceof ApiError ? error.message : fallback;
}

/** Thin typed HTTP client. Components never call fetch() directly (see AI_CONTEXT.md). */
export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, payload: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(payload) }),
  put: <T>(path: string, payload: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(payload) }),
  patch: <T>(path: string, payload: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(payload) }),
  delete: (path: string) => request<void>(path, { method: "DELETE" }),
};
