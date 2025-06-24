import Bull from 'bull';
import { JobData, JobResult } from '../types';
import { logger } from '../utils/logger';

export class QueueService {
  private transcriptionQueue: Bull.Queue<JobData>;
  private redisUrl: string;

  constructor(redisUrl: string = process.env.REDIS_URL || 'redis://localhost:6379') {
    this.redisUrl = redisUrl;
    this.transcriptionQueue = new Bull('transcription', this.redisUrl, {
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50,      // Keep last 50 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.transcriptionQueue.on('error', (error) => {
      logger.error('Queue error:', error);
    });

    this.transcriptionQueue.on('stalled', (job) => {
      logger.warn(`Job ${job.id} stalled`);
    });
  }

  async addJob(jobData: JobData): Promise<Bull.Job<JobData>> {
    const job = await this.transcriptionQueue.add(jobData, {
      jobId: jobData.id,
    });
    logger.info(`Job ${job.id} added to queue`);
    return job;
  }

  async getJob(jobId: string): Promise<Bull.Job<JobData> | null> {
    return await this.transcriptionQueue.getJob(jobId);
  }

  async getJobStatus(jobId: string): Promise<JobResult | null> {
    const job = await this.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    const progress = job.progress();

    const result: JobResult = {
      jobId: job.id as string,
      status: state as JobResult['status'],
      progress: typeof progress === 'number' ? progress : undefined,
      createdAt: new Date(job.timestamp),
    };

    if (job.processedOn) {
      result.startedAt = new Date(job.processedOn);
    }

    if (job.finishedOn) {
      result.completedAt = new Date(job.finishedOn);
    }

    if (state === 'completed' && job.returnvalue) {
      result.result = job.returnvalue;
    }

    if (state === 'failed' && job.failedReason) {
      result.error = job.failedReason;
    }

    return result;
  }

  async removeJob(jobId: string): Promise<boolean> {
    const job = await this.getJob(jobId);
    if (!job) return false;

    await job.remove();
    logger.info(`Job ${jobId} removed`);
    return true;
  }

  async getActiveJobs(): Promise<Bull.Job<JobData>[]> {
    return await this.transcriptionQueue.getActive();
  }

  async getWaitingJobs(): Promise<Bull.Job<JobData>[]> {
    return await this.transcriptionQueue.getWaiting();
  }

  async clean(grace: number = 0): Promise<Bull.Job<JobData>[]> {
    return await this.transcriptionQueue.clean(grace);
  }

  getQueue(): Bull.Queue<JobData> {
    return this.transcriptionQueue;
  }

  async close(): Promise<void> {
    await this.transcriptionQueue.close();
  }
}