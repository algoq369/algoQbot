import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

export async function getCourses(req: Request, res: Response) {
  try {
    const courses = await prisma.course.findMany({
      include: {
        _count: {
          select: { enrollments: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ courses });
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createCourse(req: Request, res: Response) {
  try {
    const { title, description, thumbnailUrl, videoUrl, durationMinutes, difficulty } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const course = await prisma.course.create({
      data: {
        title,
        description,
        thumbnailUrl,
        videoUrl,
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
        difficulty
      }
    });

    res.status(201).json({ course });
  } catch (error) {
    console.error('Create course error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function enrollInCourse(req: Request, res: Response) {
  try {
    const { id } = req.params;

    // Check if already enrolled
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: req.userId!,
          courseId: id
        }
      }
    });

    if (existingEnrollment) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        userId: req.userId!,
        courseId: id
      },
      include: {
        course: true
      }
    });

    res.status(201).json({ enrollment });
  } catch (error) {
    console.error('Enroll error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}



