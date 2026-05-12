import { ConvexReactClient } from "convex/react";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string | undefined;

export const isConvexEnabled = !!CONVEX_URL;

export const convex = CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : null;

