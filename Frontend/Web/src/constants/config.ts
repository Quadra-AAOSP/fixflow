/** Empty means same-origin /api; Vite proxies it to the configured backend in development. */
export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
