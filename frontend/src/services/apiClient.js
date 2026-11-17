import { API_BASE_URL } from "@/config/env";
import { humanizeStatusText } from "@/utils/formatters";

const DEFAULT_MESSAGES = {
  0: "Unable to reach the server. Check that the API is running and try again.",
  400: "The request is invalid. Please review the submitted data.",
  403: "You do not have permission to perform this action.",
  404: "The requested resource was not found.",
  422: "The operation violates a business rule.",
  500: "An unexpected server error occurred. Please try again later.",
};

export class ApiError extends Error {
  constructor({ status, message, error, details, body }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.error = error;
    this.details = details;
    this.body = body;
  }

  get isNetworkError() {
    return this.status === 0;
  }
  get isBadRequest() {
    return this.status === 400;
  }
  get isForbidden() {
    return this.status === 403;
  }
  get isNotFound() {
    return this.status === 404;
  }
  get isBusinessRule() {
    return this.status === 422;
  }
  get isServerError() {
    return this.status >= 500;
  }
}

const defaultMessageFor = (status) =>
  DEFAULT_MESSAGES[status] ||
  (status >= 500
    ? DEFAULT_MESSAGES[500]
    : `Request failed with status ${status}.`);

function buildUrl(path, params) {
  const url = new URL(
    `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`,
  );
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "")
        url.searchParams.set(key, value);
    });
  }
  return url.toString();
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export async function request(
  path,
  { method = "GET", body, params, signal } = {},
) {
  let response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    if (cause?.name === "AbortError") throw cause;
    throw new ApiError({
      status: 0,
      message: defaultMessageFor(0),
      error: "Network Error",
    });
  }

  const payload = await parseBody(response);

  if (!response.ok || payload?.success === false) {
    const status = response.ok ? 500 : response.status;
    throw new ApiError({
      status,
      message: payload?.message || defaultMessageFor(status),
      error: payload?.error || response.statusText,
      details: payload?.details,
      body: payload,
    });
  }

  return payload;
}

export const apiClient = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) =>
    request(path, { ...options, method: "POST", body }),
  patch: (path, body, options) =>
    request(path, { ...options, method: "PATCH", body }),
};

/** Human readable message for any thrown value (raw status codes replaced by friendly labels). */
export function getErrorMessage(error, fallback = DEFAULT_MESSAGES[500]) {
  const message =
    error instanceof ApiError || error?.message ? error.message : fallback;
  return humanizeStatusText(message || fallback);
}
