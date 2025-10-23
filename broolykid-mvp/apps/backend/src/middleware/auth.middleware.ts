import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../utils/jwt.util';

// Middleware d'authentification obligatoire
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const { userId } = verifyToken(token);

    req.userId = userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Middleware d'authentification optionnelle (pour routes publiques)
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    // Si pas de token, continuer sans userId (accès public)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.userId = undefined;
      return next();
    }

    // Si token présent, essayer de le vérifier
    const token = authHeader.substring(7);
    try {
      const { userId } = verifyToken(token);
      req.userId = userId;
    } catch (error) {
      // Token invalide, continuer quand même sans userId
      req.userId = undefined;
    }

    next();
  } catch (error) {
    // En cas d'erreur, continuer sans userId
    req.userId = undefined;
    next();
  }
}
