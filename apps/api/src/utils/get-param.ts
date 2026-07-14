import type { Request } from "express";

/**
 * Safely read a single route param as a string.
 *
 * Express 5's `ParamsDictionary` types values as `string | string[]`, and this
 * repo enables `noUncheckedIndexedAccess`, so `req.params.x` is
 * `string | string[] | undefined`. For a `/:id`-style route the value is always
 * a single string at runtime — this narrows the type and guards the impossible
 * cases explicitly.
 */
export function getParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw new Error(`Missing or invalid route param: ${name}`);
  }
  return value;
}
