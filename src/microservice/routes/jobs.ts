import { Router, Request, Response } from 'express';
import { QueueService } from '../services/queue';
import { statusRateLimiter } from '../middleware/rateLimit';
import { logger } from '../utils/logger';

export function createJobsRouter(queue: QueueService): Router {
  const router = Router();

  // Get job status
  router.get('/:id', statusRateLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const jobStatus = await queue.getJobStatus(id);

      if (!jobStatus) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      res.json(jobStatus);
    } catch (error) {
      logger.error('Failed to get job status:', error);
      res.status(500).json({ error: 'Failed to get job status' });
    }
  });

  // Get job result
  router.get('/:id/result', statusRateLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const jobStatus = await queue.getJobStatus(id);

      if (!jobStatus) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      if (jobStatus.status !== 'completed') {
        res.status(400).json({
          error: 'Job not completed',
          status: jobStatus.status,
        });
        return;
      }

      if (!jobStatus.result) {
        res.status(404).json({ error: 'Result not found' });
        return;
      }

      res.json({
        jobId: id,
        result: jobStatus.result,
        completedAt: jobStatus.completedAt,
      });
    } catch (error) {
      logger.error('Failed to get job result:', error);
      res.status(500).json({ error: 'Failed to get job result' });
    }
  });

  // Cancel/Delete job
  router.delete('/:id', statusRateLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const removed = await queue.removeJob(id);

      if (!removed) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      res.json({ message: 'Job cancelled', jobId: id });
    } catch (error) {
      logger.error('Failed to cancel job:', error);
      res.status(500).json({ error: 'Failed to cancel job' });
    }
  });

  // List active jobs (admin endpoint - should be protected in production)
  router.get('/', statusRateLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
      const activeJobs = await queue.getActiveJobs();
      const waitingJobs = await queue.getWaitingJobs();

      res.json({
        active: activeJobs.length,
        waiting: waitingJobs.length,
        jobs: {
          active: activeJobs.map(job => ({
            id: job.id,
            progress: job.progress(),
            timestamp: job.timestamp,
          })),
          waiting: waitingJobs.map(job => ({
            id: job.id,
            timestamp: job.timestamp,
          })),
        },
      });
    } catch (error) {
      logger.error('Failed to list jobs:', error);
      res.status(500).json({ error: 'Failed to list jobs' });
    }
  });

  return router;
}