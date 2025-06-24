import fs from 'fs';
import path from 'path';
import axios from 'axios';
import tmp from 'tmp';
import { logger } from './logger';
import { Transcriber, TranscriptionConfig, AudioFile, TranscriptionResult } from '../../src/lib/index';

// Configure tmp to cleanup files
tmp.setGracefulCleanup();

interface TranscriptionOptions {
  language?: string;
  outputFormat?: 'txt' | 'srt' | 'json';
}

interface MCPTranscriptionResult {
  transcription: string;
  duration?: number;
  chunks?: number;
  outputFormat: string;
  tempFile?: string;
}

// Format transcription result based on requested format
function formatTranscription(result: TranscriptionResult, format: string): string {
  switch (format) {
    case 'json':
      return JSON.stringify({
        text: result.text,
        metadata: result.metadata,
        segments: result.segments || []
      }, null, 2);
    
    case 'srt':
      // Basic SRT format (would need segments with timestamps for proper SRT)
      if (result.segments && result.segments.length > 0) {
        return result.segments.map((seg, i) => {
          const startTime = formatSRTTime(seg.start);
          const endTime = formatSRTTime(seg.end);
          return `${i + 1}\n${startTime} --> ${endTime}\n${seg.text}\n`;
        }).join('\n');
      }
      // Fallback if no segments
      return `1\n00:00:00,000 --> ${formatSRTTime(result.metadata?.duration || 0)}\n${result.text}`;
    
    case 'txt':
    default:
      return result.text;
  }
}

function formatSRTTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

// Get OpenAI API key from environment
function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  return apiKey;
}

export async function transcribeFile(
  filePath: string,
  options: TranscriptionOptions = {}
): Promise<MCPTranscriptionResult> {
  try {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const apiKey = getApiKey();
    
    // Create transcriber with configuration
    const config: TranscriptionConfig = {
      openai: { apiKey },
      language: options.language === 'auto' ? undefined : options.language,
      audio: {}, // Use defaults
      output: {
        format: options.outputFormat || 'txt',
        includeTimestamps: options.outputFormat === 'srt'
      }
    };

    const transcriber = new Transcriber(config);
    
    // Create audio file object
    const audioFile: AudioFile = {
      name: path.basename(filePath),
      path: filePath
    };

    // Transcribe the file
    logger.info(`Starting transcription for: ${audioFile.name}`);
    const result = await transcriber.transcribe(audioFile);
    
    // Format the output
    const formattedTranscription = formatTranscription(result, options.outputFormat || 'txt');
    
    return {
      transcription: formattedTranscription,
      duration: result.metadata?.duration,
      chunks: undefined, // We could calculate this from the transcriber
      outputFormat: options.outputFormat || 'txt'
    };
  } catch (error) {
    logger.error(`Transcription failed: ${error}`);
    throw error;
  }
}

export async function transcribeUrl(
  url: string,
  options: TranscriptionOptions = {}
): Promise<MCPTranscriptionResult> {
  let tempFile: tmp.FileResult | null = null;
  
  try {
    logger.info(`Downloading file from URL: ${url}`);
    
    // Create temporary file
    tempFile = tmp.fileSync({ 
      postfix: path.extname(new URL(url).pathname) || '.tmp',
      keep: false 
    });
    
    // Download the file
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'MCP-Transcription/1.0'
      }
    });

    // Write to temporary file
    const writer = fs.createWriteStream(tempFile.name);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    logger.info(`Downloaded file to: ${tempFile.name}`);
    
    // Transcribe the downloaded file
    const result = await transcribeFile(tempFile.name, options);
    
    return {
      ...result,
      tempFile: tempFile.name
    };
  } catch (error) {
    // Clean up temp file on error
    if (tempFile) {
      try {
        tempFile.removeCallback();
      } catch (cleanupError) {
        logger.error(`Failed to cleanup temp file: ${cleanupError}`);
      }
    }
    
    logger.error(`URL transcription failed: ${error}`);
    throw error;
  }
}