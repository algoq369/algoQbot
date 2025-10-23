import { NextFunction, Request, Response } from 'express';

export function errorMiddleware(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error:', error);

  res.status(500).json({
    error: process.env.NODE_ENV === 'development'
      ? error.message
      : 'Internal server error'
  });
}



