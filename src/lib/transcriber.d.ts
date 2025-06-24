import { TranscriptionConfig, AudioFile, TranscriptionResult } from './types';
export declare class Transcriber {
    private openai;
    private chunker;
    private config;
    private static readonly DEFAULT_CONFIG;
    constructor(config: TranscriptionConfig);
    private mergeConfig;
    private validateConfig;
    transcribe(audioFile: AudioFile): Promise<TranscriptionResult>;
    private transcribeChunk;
    transcribeToFile(audioFile: AudioFile, outputPath?: string): Promise<string>;
    updateConfig(partialConfig: Partial<TranscriptionConfig>): void;
}
//# sourceMappingURL=transcriber.d.ts.map