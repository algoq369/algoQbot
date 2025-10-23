import { Router } from 'express';
import { chatWithBroolyAI } from '../controllers/chat.controller';
import { optionalAuthMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Route pour chat avec BroolyKid AI (auth optionnelle)
router.post('/', optionalAuthMiddleware, chatWithBroolyAI);

export default router;
