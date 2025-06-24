import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { logger } from '../utils/logger';

const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);

export class StorageService {
  private uploadDir: string;
  private maxFileSize: number;

  constructor(uploadDir: string = './uploads', maxFileSize: number = 500 * 1024 * 1024) { // 500MB default
    this.uploadDir = path.resolve(uploadDir);
    this.maxFileSize = maxFileSize;
    this.ensureUploadDir();
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await stat(this.uploadDir);
    } catch (error) {
      await mkdir(this.uploadDir, { recursive: true });
      logger.info(`Created upload directory: ${this.uploadDir}`);
    }
  }

  getUploadPath(filename: string): string {
    return path.join(this.uploadDir, filename);
  }

  async deleteFile(filepath: string): Promise<void> {
    try {
      await unlink(filepath);
      logger.info(`Deleted file: ${filepath}`);
    } catch (error) {
      logger.error(`Failed to delete file ${filepath}:`, error);
    }
  }

  async cleanupOldFiles(maxAgeHours: number = 24): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.uploadDir);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;

      for (const file of files) {
        const filepath = path.join(this.uploadDir, file);
        const stats = await stat(filepath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await this.deleteFile(filepath);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old files:', error);
    }
  }

  validateFileSize(size: number): boolean {
    return size <= this.maxFileSize;
  }

  getMaxFileSizeMB(): number {
    return this.maxFileSize / (1024 * 1024);
  }
}