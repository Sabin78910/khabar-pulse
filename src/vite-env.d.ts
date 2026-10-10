/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** Cloudflare Worker base URL, e.g. https://khabar-pulse-api.example.workers.dev (optional). */
  readonly VITE_API_URL?: string;
}
