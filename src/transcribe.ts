import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const CHUNK_DURATION = 20 * 60; // 20 minutes in seconds
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes

interface AudioFile {
  name: string;
  path: string;
}

async function getFileSizeInMB(filePath: string): Promise<number> {
  const stats = await fs.promises.stat(filePath);
  return stats.size / (1024 * 1024);
}

async function getAudioDuration(filePath: string): Promise<number> {
  const { stdout } = await execAsync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
  );
  return parseFloat(stdout.trim());
}

async function splitAudioFile(filePath: string, outputDir: string): Promise<string[]> {
  await fs.promises.mkdir(outputDir, { recursive: true });
  
  const duration = await getAudioDuration(filePath);
  const chunks: string[] = [];
  
  console.log(`Audio duration: ${Math.floor(duration / 60)} minutes`);
  console.log(`Splitting into ${Math.ceil(duration / CHUNK_DURATION)} chunks...`);
  
  const ext = path.extname(filePath).toLowerCase();
  
  for (let i = 0; i * CHUNK_DURATION < duration; i++) {
    const startTime = i * CHUNK_DURATION;
    const chunkPath = path.join(outputDir, `chunk_${i}${ext}`);
    
    await execAsync(
      `ffmpeg -i "${filePath}" -ss ${startTime} -t ${CHUNK_DURATION} -c copy "${chunkPath}" -y`
    );
    
    chunks.push(chunkPath);
    console.log(`Created chunk ${i + 1}/${Math.ceil(duration / CHUNK_DURATION)}`);
  }
  
  return chunks;
}

async function transcribeChunk(openai: OpenAI, chunkPath: string, language: string = 'ru'): Promise<string> {
  const audioFile = fs.createReadStream(chunkPath);
  
  try {
    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: language,
    });
    
    return response.text;
  } catch (error) {
    console.error(`Error transcribing chunk ${chunkPath}:`, error);
    throw error;
  }
}

async function cleanupChunks(chunkPaths: string[]): Promise<void> {
  for (const chunkPath of chunkPaths) {
    try {
      await fs.promises.unlink(chunkPath);
    } catch (error) {
      console.error(`Error deleting chunk ${chunkPath}:`, error);
    }
  }
}

async function transcribeAudioFile(openai: OpenAI, audioFile: AudioFile, language: string = 'ru'): Promise<void> {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Processing: ${audioFile.name}`);
  
  const fileSize = await getFileSizeInMB(audioFile.path);
  console.log(`File size: ${fileSize.toFixed(2)} MB`);
  
  let transcript = '';
  let chunks: string[] = [];
  
  try {
    if (fileSize > 25) {
      // Split the file into chunks
      const outputDir = path.join(path.dirname(audioFile.path), `${audioFile.name}_chunks`);
      chunks = await splitAudioFile(audioFile.path, outputDir);
      
      // Transcribe each chunk
      const transcripts: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        console.log(`Transcribing chunk ${i + 1}/${chunks.length}...`);
        const startTime = Date.now();
        const chunkTranscript = await transcribeChunk(openai, chunks[i], language);
        const endTime = Date.now();
        console.log(`  Chunk ${i + 1} transcribed in ${((endTime - startTime) / 1000).toFixed(1)}s`);
        transcripts.push(chunkTranscript);
      }
      
      transcript = transcripts.join('\n\n');
      
      // Cleanup chunks
      await cleanupChunks(chunks);
      await fs.promises.rmdir(path.dirname(chunks[0]));
    } else {
      // File is small enough to transcribe directly
      console.log('Sending to Whisper API...');
      transcript = await transcribeChunk(openai, audioFile.path, language);
    }
    
    // Save transcript
    const outputPath = audioFile.path.replace(/\.(mp3|m4a|wav|flac|aac|ogg|wma)$/i, '_transcript.txt');
    await fs.promises.writeFile(outputPath, transcript, 'utf-8');
    console.log(`Transcript saved to: ${outputPath}`);
    console.log(`Preview (first 200 chars):\n${transcript.substring(0, 200)}...`);
    
  } catch (error) {
    console.error(`Failed to transcribe ${audioFile.name}:`, error);
  }
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable not set');
    process.exit(1);
  }
  
  const openai = new OpenAI({ apiKey });
  
  const audioFiles: AudioFile[] = [
    { name: '123.m4a', path: './123.m4a' },
  ];
  
  for (const audioFile of audioFiles) {
    if (!fs.existsSync(audioFile.path)) {
      console.error(`File not found: ${audioFile.path}`);
      continue;
    }
    
    await transcribeAudioFile(openai, audioFile);
  }
}

main().catch(console.error);