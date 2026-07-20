import { createTRPCReact } from "@trpc/react-query";
// Type-only import — erased at build time, so no server code ever ships
// to the client. This is what gives us end-to-end type safety for free.
import type { AppRouter } from "@ghpos/backend/src/routers";

export const trpc = createTRPCReact<AppRouter>();

export const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
