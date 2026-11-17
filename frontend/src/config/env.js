const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

export const API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api/v1",
);
export const SOCKET_URL = trimTrailingSlash(
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000",
);
export const DEFAULT_BOARD_ID =
  Number(import.meta.env.VITE_DEFAULT_BOARD_ID) || 1;
