/**
 * Frontend environment configuration.
 *
 * Only `NEXT_PUBLIC_*` variables are available in the browser. The API base URL
 * is consumed by the services layer (introduced in a later milestone); no API
 * calls are made in Milestone 0.
 */
export const env = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "",
} as const;
