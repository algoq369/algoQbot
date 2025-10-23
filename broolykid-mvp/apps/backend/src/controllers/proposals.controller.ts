import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

const prisma = new PrismaClient();

export async function getProposals(req: Request, res: Response) {
  try {
    const proposals = await prisma.proposal.findMany({
      include: {
        proposer: {
          select: {
            id: true,
            username: true,
            avatarUrl: true
          }
        },
        _count: {
          select: { votes: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ proposals });
  } catch (error) {
    console.error('Get proposals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function createProposal(req: Request, res: Response) {
  try {
    const { title, description, endsAt } = req.body;

    if (!title || !description || !endsAt) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const proposal = await prisma.proposal.create({
      data: {
        title,
        description,
        proposerId: req.userId!,
        endsAt: new Date(endsAt)
      },
      include: {
        proposer: {
          select: {
            id: true,
            username: true,
            avatarUrl: true
          }
        }
      }
    });

    res.status(201).json({ proposal });
  } catch (error) {
    console.error('Create proposal error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function voteOnProposal(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { voteOption } = req.body;

    if (!voteOption || !['for', 'against'].includes(voteOption)) {
      return res.status(400).json({ error: 'Invalid vote option' });
    }

    // Check if user already voted
    const existingVote = await prisma.vote.findUnique({
      where: {
        proposalId_userId: {
          proposalId: id,
          userId: req.userId!
        }
      }
    });

    if (existingVote) {
      return res.status(400).json({ error: 'Already voted on this proposal' });
    }

    // Create vote
    await prisma.vote.create({
      data: {
        proposalId: id,
        userId: req.userId!,
        voteOption
      }
    });

    // Update proposal vote counts
    const votes = await prisma.vote.findMany({
      where: { proposalId: id }
    });

    const votesFor = votes.filter(v => v.voteOption === 'for').length;
    const votesAgainst = votes.filter(v => v.voteOption === 'against').length;

    const proposal = await prisma.proposal.update({
      where: { id },
      data: {
        votesFor,
        votesAgainst
      }
    });

    res.json({ proposal, vote: { voteOption } });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}



