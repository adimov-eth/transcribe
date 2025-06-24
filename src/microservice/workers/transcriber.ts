import Bull from 'bull';
import { Server as SocketServer } from 'socket.io';
import { JobData, ProgressUpdate } from '../types';
import { Transcriber, TranscriptionConfig, AudioFile } from '../../lib';
import { logger } from '../utils/logger';
import { StorageService } from '../services/storage';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class TranscriptionWorker {
  private transcriber: Transcriber;
  private storage: StorageService;
  private io?: SocketServer;

  constructor(apiKey: string, storage: StorageService, io?: SocketServer) {
    const config: TranscriptionConfig = {
      openai: { apiKey },
      audio: {},
      output: {},
    };
    
    this.transcriber = new Transcriber(config);
    this.storage = storage;
    this.io = io;
  }

  private emitProgress(jobId: string, update: Partial<ProgressUpdate>): void {
    if (this.io) {
      this.io.to(`job:${jobId}`).emit('progress', {
        jobId,
        ...update,
      });
    }
  }

  async processJob(job: Bull.Job<JobData>): Promise<any> {
    const { id, type, source, options } = job.data;
    logger.info(`Processing job ${id}, type: ${type}`);

    try {
      // Update job progress
      await job.progress(10);
      this.emitProgress(id, {
        status: 'active',
        progress: 10,
        message: 'Starting transcription...',
      });

      let audioFile: AudioFile;
      let tempFile: string | undefined;

      if (type === 'url') {
        // Download file from URL
        await job.progress(20);
        this.emitProgress(id, {
          status: 'active',
          progress: 20,
          message: 'Downloading file...',
        });

        tempFile = await this.downloadFile(source);
        audioFile = {
          name: path.basename(tempFile),
          path: tempFile,
        };
      } else {
        // Use uploaded file
        audioFile = {
          name: path.basename(source),
          path: source,
        };
      }

      // Configure transcriber
      if (options.language) {
        this.transcriber.updateConfig({ language: options.language });
      }

      // Start transcription
      await job.progress(30);
      this.emitProgress(id, {
        status: 'active',
        progress: 30,
        message: 'Transcribing audio...',
      });

      // Monitor progress (simplified - in real implementation would hook into chunking progress)
      const progressInterval = setInterval(async () => {
        const currentProgress = job.progress() as number;
        if (currentProgress < 90) {
          const newProgress = Math.min(currentProgress + 10, 90);
          await job.progress(newProgress);
          this.emitProgress(id, {
            status: 'active',
            progress: newProgress,
            message: 'Processing...',
          });
        }
      }, 5000);

      // Perform transcription
      const result = await this.transcriber.transcribe(audioFile);
      clearInterval(progressInterval);

      // Format result based on requested format
      const formattedResult = this.formatResult(result, options.outputFormat || 'txt');

      // Cleanup temporary files
      if (tempFile) {
        await this.storage.deleteFile(tempFile);
      }
      if (type === 'file' && job.data.uploadedFile) {
        await this.storage.deleteFile(job.data.uploadedFile);
      }

      // Complete job
      await job.progress(100);
      this.emitProgress(id, {
        status: 'completed',
        progress: 100,
        message: 'Transcription completed',
        result: formattedResult,
      });

      logger.info(`Job ${id} completed successfully`);
      return formattedResult;

    } catch (error) {
      logger.error(`Job ${id} failed:`, error);
      
      this.emitProgress(id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Transcription failed',
      });

      // Cleanup on error
      if (job.data.uploadedFile) {
        await this.storage.deleteFile(job.data.uploadedFile);
      }

      throw error;
    }
  }

  private async downloadFile(url: string): Promise<string> {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 30000,
      maxContentLength: this.storage.getMaxFileSizeMB() * 1024 * 1024,
    });

    const ext = path.extname(new URL(url).pathname) || '.tmp';
    const filename = `download_${uuidv4()}${ext}`;
    const filepath = this.storage.getUploadPath(filename);

    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(filepath));
      writer.on('error', reject);
    });
  }

  private formatResult(result: any, format: string): any {
    // The actual formatting would be done by the core library
    // This is just a pass-through for now
    return result;
  }
}