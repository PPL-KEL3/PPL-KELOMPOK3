import type { NextFunction, Request, RequestHandler, Response } from 'express'

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

export function asyncHandler(handler: AsyncRouteHandler): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next)
  }
}

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({
    success: true,
    data,
  })
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>
): void {
  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(fields ? { fields } : {}),
    },
  })
}
