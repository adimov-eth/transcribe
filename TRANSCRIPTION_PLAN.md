# Audio Transcription Tool Architecture Plan

## Current State
- TypeScript-based transcription tool using OpenAI Whisper API
- Handles large files by chunking (>25MB)
- Supports multiple audio formats (mp3, m4a, wav, etc.)
- Uses ffmpeg for audio processing

## Proposed Implementations

### 1. CLI Tool
**Purpose**: Command-line interface for easy transcription of audio files

**Features**:
- Accept file paths as arguments
- Support batch processing
- Configurable options (language, output format, chunk size)
- Progress indicators
- Error handling and retry logic

**Structure**:
```
src/
  cli/
    index.ts         # CLI entry point with commander.js
    commands/
      transcribe.ts  # Transcribe command implementation
    utils/
      config.ts      # Configuration management
      logger.ts      # CLI-specific logging
  core/
    transcriber.ts   # Core transcription logic (refactored from current)
    chunker.ts       # Audio chunking logic
    types.ts         # Shared types
```

**Usage Examples**:
```bash
# Single file
transcribe audio.mp3

# Multiple files
transcribe *.mp3

# With options
transcribe --language en --output-dir ./transcripts audio.m4a

# From config file
transcribe --config transcribe.config.json
```

### 2. Microservice
**Purpose**: RESTful API for transcription as a service

**Features**:
- REST endpoints for transcription
- File upload support
- Job queue for async processing
- Status tracking
- WebSocket for real-time progress
- Rate limiting
- Authentication (optional)

**Tech Stack**:
- Express/Fastify for API
- Bull/BullMQ for job queue
- Redis for job storage
- Socket.io for WebSocket

**Endpoints**:
```
POST   /api/transcribe        # Upload and transcribe
GET    /api/jobs/:id          # Get job status
GET    /api/jobs/:id/result   # Get transcription result
DELETE /api/jobs/:id          # Cancel job
GET    /api/health            # Health check
WS     /ws/jobs/:id           # Real-time progress
```

**Structure**:
```
src/
  microservice/
    index.ts           # Express app entry
    routes/
      transcribe.ts    # Transcription routes
      jobs.ts          # Job management routes
    middleware/
      auth.ts          # Authentication
      upload.ts        # File upload handling
      rateLimit.ts     # Rate limiting
    services/
      queue.ts         # Job queue service
      storage.ts       # File storage service
    workers/
      transcriber.ts   # Background worker
```

### 3. MCP (Model Context Protocol) Server
**Purpose**: Integration with Claude and other AI assistants

**Features**:
- MCP protocol implementation
- Tool definitions for transcription
- Streaming support
- Resource management
- Error handling per MCP spec

**Structure**:
```
mcp-transcription/
  package.json
  src/
    index.ts          # MCP server entry
    tools/
      transcribe.ts   # Transcribe tool
      status.ts       # Status checking tool
    resources/
      jobs.ts         # Job resources
    utils/
      mcp-utils.ts    # MCP helpers
```

**MCP Tools**:
1. `transcribe_audio` - Main transcription tool
2. `get_transcription_status` - Check job status
3. `list_supported_formats` - Get supported formats
4. `configure_transcription` - Set default options

## Shared Components

### Core Library
Extract common functionality:
```
src/
  lib/
    transcriber.ts    # Core transcription engine
    chunker.ts        # Audio chunking
    formats.ts        # Format detection/validation
    storage.ts        # File system operations
    types.ts          # Shared TypeScript types
```

### Configuration
Unified config structure:
```typescript
interface TranscriptionConfig {
  openai: {
    apiKey: string;
    model: 'whisper-1';
  };
  audio: {
    maxFileSize: number;
    chunkDuration: number;
    supportedFormats: string[];
  };
  output: {
    format: 'txt' | 'json' | 'srt' | 'vtt';
    includeTimestamps: boolean;
  };
  language: string;
}
```

## Implementation Order

1. **Refactor Core** (Week 1)
   - Extract transcription logic into reusable library
   - Add comprehensive error handling
   - Improve logging and debugging

2. **CLI Tool** (Week 1-2)
   - Most straightforward implementation
   - Immediate utility value
   - Good testing ground for core library

3. **Microservice** (Week 2-3)
   - More complex but high value
   - Can reuse CLI components
   - Enables web integration

4. **MCP Server** (Week 3-4)
   - Newest technology
   - Enables AI assistant integration
   - Can leverage microservice for backend

## Testing Strategy

- Unit tests for core library
- Integration tests for each implementation
- E2E tests with sample audio files
- Performance benchmarks
- Load testing for microservice

## Deployment Considerations

### CLI
- NPM package
- Homebrew formula (optional)
- Binary releases via GitHub

### Microservice
- Docker container
- Kubernetes deployment
- Cloud functions (AWS Lambda, etc.)

### MCP
- NPM package for MCP servers
- Configuration templates
- Integration guides

## Next Steps

1. Review and refine this plan
2. Set up monorepo structure (optional)
3. Begin core library refactoring
4. Implement CLI as proof of concept