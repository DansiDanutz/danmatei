// Re-export shared cookie/session constants for the browser bundle.
// Kept as a shim so feature code can `import { COOKIE_NAME } from "@/const"`
// without reaching into `@shared/*` directly.
export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
