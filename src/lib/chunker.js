"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioChunker = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const types_1 = require("./types");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class AudioChunker {
    constructor(chunkDuration = 20 * 60) {
        this.chunkDuration = chunkDuration;
        this.defaultChunkDuration = 20 * 60; // 20 minutes in seconds
    }
    async getAudioDuration(filePath) {
        try {
            const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`);
            return parseFloat(stdout.trim());
        }
        catch (error) {
            throw new types_1.TranscriptionError(`Failed to get audio duration: ${error instanceof Error ? error.message : String(error)}`, 'DURATION_ERROR');
        }
    }
    async splitAudioFile(filePath, outputDir) {
        const duration = await this.getAudioDuration(filePath);
        const ext = path_1.default.extname(filePath).toLowerCase();
        const baseName = path_1.default.basename(filePath, ext);
        const finalOutputDir = outputDir || path_1.default.join(path_1.default.dirname(filePath), `${baseName}_chunks`);
        await fs_1.default.promises.mkdir(finalOutputDir, { recursive: true });
        const chunks = [];
        const totalChunks = Math.ceil(duration / this.chunkDuration);
        console.log(`Audio duration: ${Math.floor(duration / 60)} minutes`);
        console.log(`Splitting into ${totalChunks} chunks...`);
        for (let i = 0; i < totalChunks; i++) {
            const startTime = i * this.chunkDuration;
            const chunkPath = path_1.default.join(finalOutputDir, `chunk_${i}${ext}`);
            const actualDuration = Math.min(this.chunkDuration, duration - startTime);
            try {
                await execAsync(`ffmpeg -i "${filePath}" -ss ${startTime} -t ${actualDuration} -c copy "${chunkPath}" -y`);
                chunks.push({
                    path: chunkPath,
                    index: i,
                    startTime,
                    duration: actualDuration,
                });
                console.log(`Created chunk ${i + 1}/${totalChunks}`);
            }
            catch (error) {
                throw new types_1.TranscriptionError(`Failed to create chunk ${i + 1}: ${error instanceof Error ? error.message : String(error)}`, 'CHUNK_ERROR');
            }
        }
        return chunks;
    }
    async cleanupChunks(chunks) {
        for (const chunk of chunks) {
            try {
                await fs_1.default.promises.unlink(chunk.path);
            }
            catch (error) {
                console.error(`Failed to delete chunk ${chunk.path}:`, error);
            }
        }
        if (chunks.length > 0) {
            const chunkDir = path_1.default.dirname(chunks[0].path);
            try {
                await fs_1.default.promises.rmdir(chunkDir);
            }
            catch (error) {
                console.error(`Failed to remove chunk directory:`, error);
            }
        }
    }
    async getFileSizeInMB(filePath) {
        const stats = await fs_1.default.promises.stat(filePath);
        return stats.size / (1024 * 1024);
    }
}
exports.AudioChunker = AudioChunker;
