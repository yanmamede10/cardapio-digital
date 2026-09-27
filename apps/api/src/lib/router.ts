import { Router, type NextFunction, type Request, type Response } from "express";

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;
const METHODS = ["get", "post", "put", "patch", "delete"] as const;

/** A Router whose async handlers hand their errors to Express. Express 4 doesn't: a rejected handler (a failed query, a
 *  malformed body Prisma refuses) became an unhandled rejection that killed the whole API. Now it's a 500 for that request. */
export function asyncRouter() {
  const router = Router();
  for (const m of METHODS) {
    const register = router[m].bind(router) as (path: string, ...handlers: Handler[]) => unknown;
    (router as unknown as Record<string, unknown>)[m] = (path: string, ...handlers: Handler[]) =>
      register(path, ...handlers.map((h): Handler => (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)));
  }
  return router;
}
