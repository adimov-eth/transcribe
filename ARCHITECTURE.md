# Transcription Service Architecture

## Overview
A modular transcription service that accepts audio/video files from multiple sources, processes them efficiently, and delivers transcriptions while respecting API limits.

## Core Components

### 1. Input Sources
- **File Upload API** - REST endpoint for direct file uploads
- **File System Watcher** - Monitor directories for new files
- **S3/Cloud Storage** - Pull files from cloud storage
- **URL Download** - Fetch files from URLs
- **CLI Input** - Process local files via command line

### 2. Processing Pipeline

```
Input → Validation → Format Conversion → Chunking → Transcription → Assembly → Output
```

#### Pipeline Stages:
1. **Validation**
   - Check file format support
   - Verify file integrity
   - Check file size limits

2. **Format Conversion**
   - Convert video to audio (MKV → MP3)
   - Normalize audio format (WAV, M4A → MP3)
   - Optimize bitrate for transcription

3. **Smart Chunking**
   - By file size (< 25MB for OpenAI)
   - By duration (configurable chunks)
   - By silence detection (natural breaks)

4. **Transcription**
   - Provider abstraction (OpenAI, Google, etc.)
   - Parallel chunk processing
   - Rate limit management
   - Retry logic with backoff

5. **Assembly**
   - Merge chunk transcriptions
   - Handle overlaps
   - Format output (TXT, SRT, JSON)

### 3. Queue Management
- Job queue for processing
- Priority levels
- Status tracking
- Progress reporting

### 4. Storage
- Temporary file storage
- Transcription cache
- Job metadata

## API Design

### REST Endpoints
```
POST   /api/transcribe     - Submit file for transcription
GET    /api/job/{id}       - Check job status
GET    /api/job/{id}/result - Get transcription result
POST   /api/transcribe/url - Submit URL for transcription
GET    /api/health         - Service health check
```

### CLI Commands
```
transcribe file <path>     - Process single file
transcribe watch <dir>     - Watch directory
transcribe status <job-id> - Check job status
transcribe config          - Manage settings
```

## Configuration
```yaml
# config.yaml
service:
  port: 3000
  workers: 4

storage:
  temp_dir: /tmp/transcribe
  output_dir: ./output

providers:
  openai:
    api_key: ${OPENAI_API_KEY}
    model: whisper-1
    chunk_size_mb: 25
    chunk_duration_min: 20

processing:
  formats:
    video: [mkv, mp4, avi]
    audio: [mp3, wav, m4a]
  output_formats: [txt, srt, json]

limits:
  max_file_size_mb: 500
  max_queue_size: 100
  concurrent_jobs: 5
```

## Error Handling
- Validation errors (unsupported format, size)
- Conversion failures
- API errors (rate limits, network)
- Partial failure recovery

## Monitoring
- Job metrics (success/failure rates)
- Processing times
- API usage tracking
- Queue depth

## Deployment Options
1. **Standalone Service** - Docker container
2. **Serverless** - AWS Lambda + SQS
3. **Kubernetes** - Scalable deployment
4. **Local CLI** - Single machine processing