const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ||
  (window.location.port === "5173" ? "http://localhost:3000/api" : "/api");

interface ApiErrorResponse {
  error?: { code?: string; message?: string; details?: unknown };
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  const payload = (await response.json().catch(() => ({}))) as
    T | ApiErrorResponse;
  if (!response.ok) {
    const error = (payload as ApiErrorResponse).error;
    throw new ApiRequestError(
      response.status,
      error?.code ?? "REQUEST_FAILED",
      error?.message ?? "The request could not be completed",
      error?.details,
    );
  }
  return payload as T;
}
