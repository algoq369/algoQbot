import { Router } from 'express';
import { createCourse, enrollInCourse, getCourses } from '../controllers/courses.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

router.get('/', getCourses);
router.post('/', authMiddleware, createCourse);
router.post('/:id/enroll', authMiddleware, enrollInCourse);

export default router;



