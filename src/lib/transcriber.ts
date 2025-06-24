import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { AudioChunker } from './chunker';
import {
  TranscriptionConfig,
  AudioFile,
  TranscriptionResult,
  TranscriptionError,
  ChunkInfo,
} from './types';

export class Transcriber {
  private openai: OpenAI;
  private chunker: AudioChunker;
  private config: Required<TranscriptionConfig>;

  private static readonly DEFAULT_CONFIG: Required<TranscriptionConfig> = {
    openai: {
      apiKey: '',
      model: 'whisper-1',
    },
    audio: {
      maxFileSize: 25 * 1024 * 1024, // 25MB
      chunkDuration: 20 * 60, // 20 minutes
      supportedFormats: ['.mp3', '.m4a', '.wav', '.flac', '.aac', '.ogg', '.wma'],
    },
    output: {
      format: 'txt',
      includeTimestamps: false,
    },
    language: 'en',
  };

  constructor(config: TranscriptionConfig) {
    this.config = this.mergeConfig(config);
    this.validateConfig();
    
    this.openai = new OpenAI({ apiKey: this.config.openai.apiKey });
    this.chunker = new AudioChunker(this.config.audio.chunkDuration);
  }

  private mergeConfig(config: TranscriptionConfig): Required<TranscriptionConfig> {
    return {
      openai: {
        ...Transcriber.DEFAULT_CONFIG.openai,
        ...config.openai,
      },
      audio: {
        ...Transcriber.DEFAULT_CONFIG.audio,
        ...config.audio,
      },
      output: {
        ...Transcriber.DEFAULT_CONFIG.output,
        ...config.output,
      },
      language: config.language || Transcriber.DEFAULT_CONFIG.language,
    };
  }

  private validateConfig(): void {
    if (!this.config.openai.apiKey) {
      throw new TranscriptionError('OpenAI API key is required', 'CONFIG_ERROR');
    }
  }

  async transcribe(audioFile: AudioFile): Promise<TranscriptionResult> {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Processing: ${audioFile.name}`);

    // Validate file format
    const ext = path.extname(audioFile.path).toLowerCase();
    if (!this.config.audio.supportedFormats!.includes(ext)) {
      throw new TranscriptionError(
        `Unsupported format: ${ext}. Supported formats: ${this.config.audio.supportedFormats!.join(', ')}`,
        'FORMAT_ERROR'
      );
    }

    // Check file existence
    if (!fs.existsSync(audioFile.path)) {
      throw new TranscriptionError(`File not found: ${audioFile.path}`, 'FILE_ERROR');
    }

    const fileSize = await this.chunker.getFileSizeInMB(audioFile.path);
    console.log(`File size: ${fileSize.toFixed(2)} MB`);
    const fileSizeBytes = fileSize * 1024 * 1024;

    let transcript = '';
    let chunks: ChunkInfo[] = [];

    try {
      if (fileSizeBytes > this.config.audio.maxFileSize!) {
        // Large file - need to chunk
        chunks = await this.chunker.splitAudioFile(audioFile.path);
        const transcripts: string[] = [];

        for (let i = 0; i < chunks.length; i++) {
          console.log(`Transcribing chunk ${i + 1}/${chunks.length}...`);
          const startTime = Date.now();
          
          const chunkTranscript = await this.transcribeChunk(chunks[i].path);
          
          const endTime = Date.now();
          console.log(`  Chunk ${i + 1} transcribed in ${((endTime - startTime) / 1000).toFixed(1)}s`);
          
          transcripts.push(chunkTranscript);
        }

        transcript = transcripts.join('\n\n');
      } else {
        // Small file - transcribe directly
        console.log('Sending to Whisper API...');
        transcript = await this.transcribeChunk(audioFile.path);
      }

      const result: TranscriptionResult = {
        text: transcript,
        metadata: {
          duration: await this.chunker.getAudioDuration(audioFile.path),
          language: this.config.language,
          model: this.config.openai.model || 'whisper-1',
        },
      };

      return result;
    } finally {
      // Cleanup chunks if any
      if (chunks.length > 0) {
        await this.chunker.cleanupChunks(chunks);
      }
    }
  }

  private async transcribeChunk(chunkPath: string): Promise<string> {
    const audioStream = fs.createReadStream(chunkPath);

    try {
      const response = await this.openai.audio.transcriptions.create({
        file: audioStream,
        model: this.config.openai.model!,
        language: this.config.language,
      });

      return response.text;
    } catch (error: any) {
      if (error.response?.status === 413) {
        throw new TranscriptionError(
          'File too large for OpenAI API. Consider reducing chunk size.',
          'FILE_TOO_LARGE'
        );
      }
      throw new TranscriptionError(
        `Transcription failed: ${error.message || String(error)}`,
        'API_ERROR'
      );
    }
  }

  async transcribeToFile(
    audioFile: AudioFile,
    outputPath?: string
  ): Promise<string> {
    const result = await this.transcribe(audioFile);
    
    const finalOutputPath = outputPath || 
      audioFile.path.replace(/\.(mp3|m4a|wav|flac|aac|ogg|wma)$/i, '_transcript.txt');

    await fs.promises.writeFile(finalOutputPath, result.text, 'utf-8');
    
    console.log(`Transcript saved to: ${finalOutputPath}`);
    console.log(`Preview (first 200 chars):\n${result.text.substring(0, 200)}...`);
    
    return finalOutputPath;
  }

  updateConfig(partialConfig: Partial<TranscriptionConfig>): void {
    this.config = this.mergeConfig({ ...this.config, ...partialConfig });
    this.validateConfig();
    
    // Recreate OpenAI client if API key changed
    if (partialConfig.openai?.apiKey) {
      this.openai = new OpenAI({ apiKey: this.config.openai.apiKey });
    }
    
    // Recreate chunker if chunk duration changed
    if (partialConfig.audio?.chunkDuration) {
      this.chunker = new AudioChunker(this.config.audio.chunkDuration);
    }
  }
}