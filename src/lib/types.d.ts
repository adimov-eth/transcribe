export interface TranscriptionConfig {
    openai: {
        apiKey: string;
        model?: 'whisper-1';
    };
    audio: {
        maxFileSize?: number;
        chunkDuration?: number;
        supportedFormats?: string[];
    };
    output: {
        format?: 'txt' | 'json' | 'srt' | 'vtt';
        includeTimestamps?: boolean;
    };
    language?: string;
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
export declare class TranscriptionError extends Error {
    code?: string | undefined;
    constructor(message: string, code?: string | undefined);
}
//# sourceMappingURL=types.d.ts.map