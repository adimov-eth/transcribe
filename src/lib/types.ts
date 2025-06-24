export interface TranscriptionConfig {
  openai: {
    apiKey: string;
    model?: 'whisper-1';
  };
  audio: {
    maxFileSize?: number; // in bytes, default 25MB
    chunkDuration?: number; // in seconds, default 20 minutes
    supportedFormats?: string[];
  };
  output: {
    format?: 'txt' | 'json' | 'srt' | 'vtt';
    includeTimestamps?: boolean;
  };
  language?: string; // ISO 639-1 code, default 'en'
}

export interface AudioFile {
  name: string;
  path: string;
  size?: number;
  duration?: number;
}

export interface TranscriptionResult {
  text: string;
  segments?: TranscriptionSegment[];
  metadata?: {
    duration: number;
    language: string;
    model: string;
  };
}

export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: TranscriptionResult;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ChunkInfo {
  path: string;
  index: number;
  startTime: number;
  duration: number;
}

export class TranscriptionError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'TranscriptionError';
  }
}