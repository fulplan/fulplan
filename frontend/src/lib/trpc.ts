import { createTRPCReact } from "@trpc/react-query";
// Type-only import — erased at build time, so no server code ever ships
// to the client. This is what gives us end-to-end type safety for free.
import type { AppRouter } from "@uptilll/backend/src/routers";

export const trpc = createTRPCReact<AppRouter>();

// In production the frontend is served from the same origin as the API,
// so we use a relative URL. VITE_API_URL overrides for local dev.
export const apiUrl = import.meta.env.VITE_API_URL ?? "";
