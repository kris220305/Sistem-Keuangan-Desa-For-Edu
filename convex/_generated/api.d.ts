/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _shared_adminAuth from "../_shared/adminAuth.js";
import type * as _shared_audit from "../_shared/audit.js";
import type * as _shared_crypto from "../_shared/crypto.js";
import type * as admin from "../admin.js";
import type * as crons from "../crons.js";
import type * as groupLimits from "../groupLimits.js";
import type * as groupStates from "../groupStates.js";
import type * as groups from "../groups.js";
import type * as impersonation from "../impersonation.js";
import type * as reportSubmissions from "../reportSubmissions.js";
import type * as screenshots from "../screenshots.js";
import type * as sessions from "../sessions.js";
import type * as siteSettings from "../siteSettings.js";
import type * as validators_AnggaranSchema from "../validators/AnggaranSchema.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "_shared/adminAuth": typeof _shared_adminAuth;
  "_shared/audit": typeof _shared_audit;
  "_shared/crypto": typeof _shared_crypto;
  admin: typeof admin;
  crons: typeof crons;
  groupLimits: typeof groupLimits;
  groupStates: typeof groupStates;
  groups: typeof groups;
  impersonation: typeof impersonation;
  reportSubmissions: typeof reportSubmissions;
  screenshots: typeof screenshots;
  sessions: typeof sessions;
  siteSettings: typeof siteSettings;
  "validators/AnggaranSchema": typeof validators_AnggaranSchema;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
