import { Router } from 'express';
import { getUserById, getUsers, updateUser } from '../controllers/users.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/', getUsers);
router.get('/:id', getUserById);
router.put('/:id', authMiddleware, updateUser);

export default router;



