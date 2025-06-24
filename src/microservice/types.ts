import { TranscriptionResult } from '../lib/types';

export interface JobData {
  id: string;
  type: 'file' | 'url';
  source: string; // file path or URL
  options: {
    language?: string;
    outputFormat?: 'txt' | 'json' | 'srt' | 'vtt';
  };
  uploadedFile?: string; // for file uploads
}

export interface JobResult {
  jobId: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
  progress?: number;
  result?: TranscriptionResult;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TranscriptionRequest {
  language?: string;
  format?: 'txt' | 'json' | 'srt' | 'vtt';
}

export interface TranscriptionResponse {
  jobId: string;
  status: string;
  message: string;
}

export interface ProgressUpdate {
  jobId: string;
  status: string;
  progress?: number;
  message?: string;
  result?: TranscriptionResult;
  error?: string;
}