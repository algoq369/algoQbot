import { Router } from 'express';
import { createProposal, getProposals, voteOnProposal } from '../controllers/proposals.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/', getProposals);
router.post('/', authMiddleware, createProposal);
router.post('/:id/vote', authMiddleware, voteOnProposal);

export default router;



