# Audio Transcribe Suite

A comprehensive audio transcription toolkit with three deployment options:
- **CLI Tool** - Command-line interface for local transcription
- **Microservice** - REST API with job queue and real-time updates
- **MCP Server** - Integration with AI assistants like Claude

All implementations use OpenAI's Whisper API and support large file handling through automatic chunking.

## Features

- 🎯 Simple CLI interface for transcribing audio files
- 📦 Reusable TypeScript/JavaScript library
- 🔄 Automatic chunking for large files (>25MB)
- 🌍 Multi-language support
- 📁 Batch processing with configuration files
- 🎵 Supports multiple audio formats (mp3, m4a, wav, flac, aac, ogg, wma)
- ⚡ Progress indicators and error handling

## Installation

```bash
npm install -g audio-transcribe
```

Or use locally:
```bash
npm install
npm run build
```

## Quick Start

### CLI Usage

#### Basic transcription
```bash
# Single file
transcribe audio.mp3

# Multiple files
transcribe *.mp3

# With options
transcribe --language ru --output-dir ./transcripts audio.m4a
```

#### Environment Setup
Set your OpenAI API key:
```bash
export OPENAI_API_KEY=your-api-key-here
```

Or pass it directly:
```bash
transcribe --api-key your-api-key audio.mp3
```

#### Advanced Options
```bash
transcribe --help

Options:
  -l, --language <lang>       Language code (e.g., en, ru, es) (default: "en")
  -o, --output-dir <dir>      Output directory for transcripts
  -k, --api-key <key>         OpenAI API key (or use OPENAI_API_KEY env var)
  -c, --config <file>         Configuration file path
  --chunk-duration <minutes>  Chunk duration in minutes (default: "20")
  --format <format>           Output format (txt, json, srt, vtt) (default: "txt")
```

#### Batch Processing
Create a batch configuration file `batch.json`:
```json
{
  "apiKey": "your-api-key-here",
  "transcriptionConfig": {
    "language": "en",
    "audio": {
      "chunkDuration": 1200
    }
  },
  "files": [
    {
      "path": "./audio1.mp3",
      "output": "./transcripts/audio1.txt"
    },
    {
      "path": "./audio2.m4a",
      "output": "./transcripts/audio2.txt"
    }
  ]
}
```

Run batch transcription:
```bash
transcribe batch --config batch.json
```

### Library Usage

```typescript
import { Transcriber } from 'audio-transcribe';

const transcriber = new Transcriber({
  openai: {
    apiKey: 'your-api-key-here'
  },
  language: 'en'
});

// Transcribe a file
const result = await transcriber.transcribe({
  name: 'audio.mp3',
  path: './audio.mp3'
});

console.log(result.text);

// Save to file
await transcriber.transcribeToFile({
  name: 'audio.mp3',
  path: './audio.mp3'
}, './output.txt');
```

## Configuration

### Full Configuration Options
```typescript
interface TranscriptionConfig {
  openai: {
    apiKey: string;
    model?: 'whisper-1';
  };
  audio: {
    maxFileSize?: number;      // in bytes, default 25MB
    chunkDuration?: number;    // in seconds, default 20 minutes
    supportedFormats?: string[];
  };
  output: {
    format?: 'txt' | 'json' | 'srt' | 'vtt';
    includeTimestamps?: boolean;
  };
  language?: string;           // ISO 639-1 code, default 'en'
}
```

## Requirements

- Node.js 16+
- ffmpeg (for audio processing)
- OpenAI API key

## Microservice Usage

### Quick Start

1. Start Redis:
```bash
docker run -d -p 6379:6379 redis:alpine
```

2. Start the microservice:
```bash
export OPENAI_API_KEY=your-api-key-here
npm run dev:api
```

### Docker Deployment

```bash
# Using Docker Compose (includes Redis)
docker-compose up -d

# View logs
docker-compose logs -f transcription-api

# Stop services
docker-compose down
```

### API Endpoints

- `POST /api/transcribe/file` - Upload and transcribe a file
- `POST /api/transcribe/url` - Transcribe from URL
- `GET /api/jobs/{id}` - Check job status
- `GET /api/jobs/{id}/result` - Get transcription result
- `DELETE /api/jobs/{id}` - Cancel job
- `GET /api/health` - Health check

See [API.md](./API.md) for full documentation.

### WebSocket Support

Connect to the WebSocket server for real-time progress:
```javascript
const socket = io('http://localhost:3000');
socket.emit('subscribe', jobId);
socket.on('progress', (update) => console.log(update));
```

## MCP Server Usage

The MCP server enables AI assistants to transcribe audio files. See [mcp-transcription/README.md](./mcp-transcription/README.md) for setup instructions.

### Available Tools

- `transcribe_file` - Transcribe local files
- `transcribe_url` - Transcribe from URLs

## Project Structure

```
medach/
├── src/
│   ├── lib/          # Core transcription library
│   ├── cli/          # CLI implementation
│   └── microservice/ # REST API implementation
├── mcp-transcription/ # MCP server
├── API.md            # API documentation
├── docker-compose.yml # Docker configuration
└── README.md         # This file
```

## License

MIT