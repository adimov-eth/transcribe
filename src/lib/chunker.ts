import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ChunkInfo, TranscriptionError } from './types';

const execAsync = promisify(exec);

export class AudioChunker {
  private readonly defaultChunkDuration = 20 * 60; // 20 minutes in seconds

  constructor(private chunkDuration: number = 20 * 60) {}

  async getAudioDuration(filePath: string): Promise<number> {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
      );
      return parseFloat(stdout.trim());
    } catch (error) {
      throw new TranscriptionError(
        `Failed to get audio duration: ${error instanceof Error ? error.message : String(error)}`,
        'DURATION_ERROR'
      );
    }
  }

  async splitAudioFile(
    filePath: string,
    outputDir?: string
  ): Promise<ChunkInfo[]> {
    const duration = await this.getAudioDuration(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const baseName = path.basename(filePath, ext);
    const finalOutputDir = outputDir || path.join(path.dirname(filePath), `${baseName}_chunks`);

    await fs.promises.mkdir(finalOutputDir, { recursive: true });

    const chunks: ChunkInfo[] = [];
    const totalChunks = Math.ceil(duration / this.chunkDuration);

    console.log(`Audio duration: ${Math.floor(duration / 60)} minutes`);
    console.log(`Splitting into ${totalChunks} chunks...`);

    for (let i = 0; i < totalChunks; i++) {
      const startTime = i * this.chunkDuration;
      const chunkPath = path.join(finalOutputDir, `chunk_${i}${ext}`);
      const actualDuration = Math.min(this.chunkDuration, duration - startTime);

      try {
        await execAsync(
          `ffmpeg -i "${filePath}" -ss ${startTime} -t ${actualDuration} -c copy "${chunkPath}" -y`
        );

        chunks.push({
          path: chunkPath,
          index: i,
          startTime,
          duration: actualDuration,
        });

        console.log(`Created chunk ${i + 1}/${totalChunks}`);
      } catch (error) {
        throw new TranscriptionError(
          `Failed to create chunk ${i + 1}: ${error instanceof Error ? error.message : String(error)}`,
          'CHUNK_ERROR'
        );
      }
    }

    return chunks;
  }

  async cleanupChunks(chunks: ChunkInfo[]): Promise<void> {
    for (const chunk of chunks) {
      try {
        await fs.promises.unlink(chunk.path);
      } catch (error) {
        console.error(`Failed to delete chunk ${chunk.path}:`, error);
      }
    }

    if (chunks.length > 0) {
      const chunkDir = path.dirname(chunks[0].path);
      try {
        await fs.promises.rmdir(chunkDir);
      } catch (error) {
        console.error(`Failed to remove chunk directory:`, error);
      }
    }
  }

  async getFileSizeInMB(filePath: string): Promise<number> {
    const stats = await fs.promises.stat(filePath);
    return stats.size / (1024 * 1024);
  }
}