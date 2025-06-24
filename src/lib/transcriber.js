"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transcriber = void 0;
const openai_1 = __importDefault(require("openai"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const chunker_1 = require("./chunker");
const types_1 = require("./types");
class Transcriber {
    constructor(config) {
        this.config = this.mergeConfig(config);
        this.validateConfig();
        this.openai = new openai_1.default({ apiKey: this.config.openai.apiKey });
        this.chunker = new chunker_1.AudioChunker(this.config.audio.chunkDuration);
    }
    mergeConfig(config) {
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
    validateConfig() {
        if (!this.config.openai.apiKey) {
            throw new types_1.TranscriptionError('OpenAI API key is required', 'CONFIG_ERROR');
        }
    }
    async transcribe(audioFile) {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`Processing: ${audioFile.name}`);
        // Validate file format
        const ext = path_1.default.extname(audioFile.path).toLowerCase();
        if (!this.config.audio.supportedFormats.includes(ext)) {
            throw new types_1.TranscriptionError(`Unsupported format: ${ext}. Supported formats: ${this.config.audio.supportedFormats.join(', ')}`, 'FORMAT_ERROR');
        }
        // Check file existence
        if (!fs_1.default.existsSync(audioFile.path)) {
            throw new types_1.TranscriptionError(`File not found: ${audioFile.path}`, 'FILE_ERROR');
        }
        const fileSize = await this.chunker.getFileSizeInMB(audioFile.path);
        console.log(`File size: ${fileSize.toFixed(2)} MB`);
        const fileSizeBytes = fileSize * 1024 * 1024;
        let transcript = '';
        let chunks = [];
        try {
            if (fileSizeBytes > this.config.audio.maxFileSize) {
                // Large file - need to chunk
                chunks = await this.chunker.splitAudioFile(audioFile.path);
                const transcripts = [];
                for (let i = 0; i < chunks.length; i++) {
                    console.log(`Transcribing chunk ${i + 1}/${chunks.length}...`);
                    const startTime = Date.now();
                    const chunkTranscript = await this.transcribeChunk(chunks[i].path);
                    const endTime = Date.now();
                    console.log(`  Chunk ${i + 1} transcribed in ${((endTime - startTime) / 1000).toFixed(1)}s`);
                    transcripts.push(chunkTranscript);
                }
                transcript = transcripts.join('\n\n');
            }
            else {
                // Small file - transcribe directly
                console.log('Sending to Whisper API...');
                transcript = await this.transcribeChunk(audioFile.path);
            }
            const result = {
                text: transcript,
                metadata: {
                    duration: await this.chunker.getAudioDuration(audioFile.path),
                    language: this.config.language,
                    model: this.config.openai.model || 'whisper-1',
                },
            };
            return result;
        }
        finally {
            // Cleanup chunks if any
            if (chunks.length > 0) {
                await this.chunker.cleanupChunks(chunks);
            }
        }
    }
    async transcribeChunk(chunkPath) {
        const audioStream = fs_1.default.createReadStream(chunkPath);
        try {
            const response = await this.openai.audio.transcriptions.create({
                file: audioStream,
                model: this.config.openai.model,
                language: this.config.language,
            });
            return response.text;
        }
        catch (error) {
            if (error.response?.status === 413) {
                throw new types_1.TranscriptionError('File too large for OpenAI API. Consider reducing chunk size.', 'FILE_TOO_LARGE');
            }
            throw new types_1.TranscriptionError(`Transcription failed: ${error.message || String(error)}`, 'API_ERROR');
        }
    }
    async transcribeToFile(audioFile, outputPath) {
        const result = await this.transcribe(audioFile);
        const finalOutputPath = outputPath ||
            audioFile.path.replace(/\.(mp3|m4a|wav|flac|aac|ogg|wma)$/i, '_transcript.txt');
        await fs_1.default.promises.writeFile(finalOutputPath, result.text, 'utf-8');
        console.log(`Transcript saved to: ${finalOutputPath}`);
        console.log(`Preview (first 200 chars):\n${result.text.substring(0, 200)}...`);
        return finalOutputPath;
    }
    updateConfig(partialConfig) {
        this.config = this.mergeConfig({ ...this.config, ...partialConfig });
        this.validateConfig();
        // Recreate OpenAI client if API key changed
        if (partialConfig.openai?.apiKey) {
            this.openai = new openai_1.default({ apiKey: this.config.openai.apiKey });
        }
        // Recreate chunker if chunk duration changed
        if (partialConfig.audio?.chunkDuration) {
            this.chunker = new chunker_1.AudioChunker(this.config.audio.chunkDuration);
        }
    }
}
exports.Transcriber = Transcriber;
Transcriber.DEFAULT_CONFIG = {
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
