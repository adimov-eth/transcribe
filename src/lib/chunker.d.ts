import { ChunkInfo } from './types';
export declare class AudioChunker {
    private chunkDuration;
    private readonly defaultChunkDuration;
    constructor(chunkDuration?: number);
    getAudioDuration(filePath: string): Promise<number>;
    splitAudioFile(filePath: string, outputDir?: string): Promise<ChunkInfo[]>;
    cleanupChunks(chunks: ChunkInfo[]): Promise<void>;
    getFileSizeInMB(filePath: string): Promise<number>;
}
//# sourceMappingURL=chunker.d.ts.map