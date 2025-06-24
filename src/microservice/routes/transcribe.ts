import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { QueueService } from '../services/queue';
import { StorageService } from '../services/storage';
import { createUploadMiddleware } from '../middleware/upload';
import { transcriptionRateLimiter } from '../middleware/rateLimit';
import { JobData, TranscriptionRequest } from '../types';
import { logger } from '../utils/logger';

export function createTranscribeRouter(queue: QueueService, storage: StorageService): Router {
  const router = Router();
  const uploadMiddleware = createUploadMiddleware(storage);

  // Transcribe uploaded file
  router.post(
    '/file',
    transcriptionRateLimiter,
    uploadMiddleware.single,
    async (req: Request, res: Response): Promise<void> => {
      try {
        if (!req.file) {
          res.status(400).json({ error: 'No file uploaded' });
          return;
        }

        const { language, format } = req.body as TranscriptionRequest;
        const jobId = uuidv4();

        const jobData: JobData = {
          id: jobId,
          type: 'file',
          source: req.file.path,
          options: {
            language,
            outputFormat: format,
          },
          uploadedFile: req.file.path,
        };

        await queue.addJob(jobData);

        res.status(202).json({
          jobId,
          status: 'pending',
          message: 'Transcription job created',
        });
      } catch (error) {
        logger.error('Failed to create file transcription job:', error);
        res.status(500).json({ error: 'Failed to create transcription job' });
      }
    }
  );

  // Transcribe from URL
  router.post('/url', transcriptionRateLimiter, async (req: Request, res: Response): Promise<void> => {
    try {
      const { url, language, format } = req.body;

      if (!url) {
        res.status(400).json({ error: 'URL is required' });
        return;
      }

      // Basic URL validation
      try {
        new URL(url);
      } catch {
        res.status(400).json({ error: 'Invalid URL' });
        return;
      }

      const jobId = uuidv4();

      const jobData: JobData = {
        id: jobId,
        type: 'url',
        source: url,
        options: {
          language,
          outputFormat: format,
        },
      };

      await queue.addJob(jobData);

      res.status(202).json({
        jobId,
        status: 'pending',
        message: 'Transcription job created',
      });
    } catch (error) {
      logger.error('Failed to create URL transcription job:', error);
      res.status(500).json({ error: 'Failed to create transcription job' });
    }
  });

  return router;
}