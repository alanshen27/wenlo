import axios, { isAxiosError, type AxiosRequestConfig } from "axios";

/** Thrown when an API route returns a non-2xx status. */
export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;
  /** True when the request was aborted rather than failing on the server. */
  readonly canceled: boolean;

  constructor(message: string, status: number, data?: unknown, canceled = false) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
    this.canceled = canceled;
  }
}

function messageFromResponseBody(data: unknown): string | undefined {
  if (data && typeof data === "object" && "error" in data) {
    const error = (data as { error: unknown }).error;
    if (typeof error === "string" && error.trim()) return error;
  }
}

export function getApiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Status used for transport-level failures with no HTTP response. */
export const NETWORK_ERROR_STATUS = 0;

/** True when a request was aborted (e.g. component unmount / cancel token). */
export function isCanceledError(error: unknown): boolean {
  return error instanceof ApiError && error.canceled;
}

/**
 * True for "the resource is gone or you can't see it" responses (404/403).
 * Views use this to redirect home instead of showing a retryable error.
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 403);
}

export const apiClient = axios.create({
  withCredentials: true,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (isAxiosError(error)) {
      if (error.response) {
        const { status, data } = error.response;
        const message =
          messageFromResponseBody(data) ?? error.message ?? `Request failed (${status})`;
        throw new ApiError(message, status, data);
      }
      // Request was made but no response arrived: cancellation, timeout, or a
      // transport failure (offline, DNS, CORS). Normalize all of these so
      // callers only ever have to handle ApiError.
      if (error.code === "ERR_CANCELED") {
        throw new ApiError("Request was canceled", NETWORK_ERROR_STATUS, undefined, true);
      }
      const message =
        error.code === "ECONNABORTED"
          ? "The request timed out. Check your connection and try again."
          : "Network error. Check your connection and try again.";
      throw new ApiError(message, NETWORK_ERROR_STATUS, undefined);
    }
    // Non-axios error (programming error, etc.) — surface as-is.
    throw error;
  }
);

export async function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await apiClient.get<T>(url, config);
  return data;
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const { data } = await apiClient.post<T>(url, body, config);
  return data;
}

export async function apiPatch<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const { data } = await apiClient.patch<T>(url, body, config);
  return data;
}

export async function apiDelete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await apiClient.delete<T>(url, config);
  return data;
}

/** Multipart upload — do not set Content-Type; axios adds the boundary. */
export async function apiUpload<T>(url: string, form: FormData): Promise<T> {
  const { data } = await apiClient.post<T>(url, form);
  return data;
}

/** Fire-and-forget POST; logs failures without throwing to callers. */
export async function apiPostSilent(url: string, body?: unknown): Promise<void> {
  try {
    await apiClient.post(url, body);
  } catch (error) {
    console.error("[api]", url, error);
  }
}
