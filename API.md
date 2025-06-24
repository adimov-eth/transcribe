# Transcription Microservice API

RESTful API for audio/video transcription with job queue and real-time progress updates.

## Base URL

```
http://localhost:3000/api
```

## Authentication

Currently, the API does not require authentication. In production, you should implement API key or JWT authentication.

## Rate Limiting

- Transcription endpoints: 10 requests per 15 minutes per IP
- Status endpoints: 60 requests per minute per IP

## Endpoints

### 1. Transcribe File Upload

Upload and transcribe an audio/video file.

```http
POST /api/transcribe/file
Content-Type: multipart/form-data
```

**Form Data:**
- `audio` (file, required): Audio/video file to transcribe
- `language` (string, optional): Language code (e.g., 'en', 'ru', 'es')
- `format` (string, optional): Output format ('txt', 'json', 'srt', 'vtt')

**Response (202 Accepted):**
```json
{
  "jobId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "pending",
  "message": "Transcription job created"
}
```

**Supported formats:** mp3, m4a, wav, flac, aac, ogg, wma, mp4, mkv, avi, mov

**Max file size:** 500MB (configurable)

### 2. Transcribe from URL

Transcribe an audio/video file from a URL.

```http
POST /api/transcribe/url
Content-Type: application/json
```

**Request Body:**
```json
{
  "url": "https://example.com/audio.mp3",
  "language": "en",
  "format": "txt"
}
```

**Response (202 Accepted):**
```json
{
  "jobId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "pending",
  "message": "Transcription job created"
}
```

### 3. Get Job Status

Check the status of a transcription job.

```http
GET /api/jobs/{jobId}
```

**Response (200 OK):**
```json
{
  "jobId": "123e4567-e89b-12d3-a456-426614174000",
  "status": "completed",
  "progress": 100,
  "createdAt": "2024-01-01T12:00:00Z",
  "startedAt": "2024-01-01T12:00:05Z",
  "completedAt": "2024-01-01T12:05:00Z"
}
```

**Status values:**
- `pending`: Job is queued
- `active`: Job is being processed
- `completed`: Job finished successfully
- `failed`: Job failed

### 4. Get Job Result

Retrieve the transcription result for a completed job.

```http
GET /api/jobs/{jobId}/result
```

**Response (200 OK):**
```json
{
  "jobId": "123e4567-e89b-12d3-a456-426614174000",
  "result": {
    "text": "Transcribed text content...",
    "metadata": {
      "duration": 300.5,
      "language": "en",
      "model": "whisper-1"
    }
  },
  "completedAt": "2024-01-01T12:05:00Z"
}
```

### 5. Cancel Job

Cancel a pending or active job.

```http
DELETE /api/jobs/{jobId}
```

**Response (200 OK):**
```json
{
  "message": "Job cancelled",
  "jobId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### 6. List Jobs (Admin)

List all active and waiting jobs.

```http
GET /api/jobs
```

**Response (200 OK):**
```json
{
  "active": 2,
  "waiting": 5,
  "jobs": {
    "active": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "progress": 45,
        "timestamp": 1704110400000
      }
    ],
    "waiting": [
      {
        "id": "223e4567-e89b-12d3-a456-426614174001",
        "timestamp": 1704110500000
      }
    ]
  }
}
```

### 7. Health Check

Check if the service is healthy.

```http
GET /api/health
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z",
  "uptime": 3600.5
}
```

## WebSocket Events

Connect to the WebSocket server for real-time progress updates.

```javascript
const socket = io('http://localhost:3000');

// Subscribe to job updates
socket.emit('subscribe', jobId);

// Listen for progress updates
socket.on('progress', (update) => {
  console.log(update);
  // {
  //   jobId: '123e4567-e89b-12d3-a456-426614174000',
  //   status: 'active',
  //   progress: 75,
  //   message: 'Processing...'
  // }
});

// Unsubscribe when done
socket.emit('unsubscribe', jobId);
```

## Error Responses

All endpoints may return error responses:

**400 Bad Request:**
```json
{
  "error": "Invalid request",
  "message": "Detailed error message"
}
```

**404 Not Found:**
```json
{
  "error": "Job not found"
}
```

**429 Too Many Requests:**
```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": "2024-01-01T12:15:00Z"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error"
}
```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `REDIS_URL`: Redis connection URL
- `OPENAI_API_KEY`: OpenAI API key (required)
- `UPLOAD_DIR`: Upload directory path
- `MAX_FILE_SIZE`: Max file size in MB (default: 500)
- `CORS_ORIGIN`: CORS allowed origins
- `NODE_ENV`: Environment (development/production)
- `LOG_LEVEL`: Logging level (error/warn/info/debug)

## Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f transcription-api

# Stop services
docker-compose down
```

## Example Client

```javascript
// Upload file
const formData = new FormData();
formData.append('audio', fileInput.files[0]);
formData.append('language', 'en');

const response = await fetch('http://localhost:3000/api/transcribe/file', {
  method: 'POST',
  body: formData
});

const { jobId } = await response.json();

// Poll for status
const checkStatus = async () => {
  const res = await fetch(`http://localhost:3000/api/jobs/${jobId}`);
  const status = await res.json();
  
  if (status.status === 'completed') {
    const resultRes = await fetch(`http://localhost:3000/api/jobs/${jobId}/result`);
    const result = await resultRes.json();
    console.log(result.result.text);
  } else if (status.status === 'failed') {
    console.error('Transcription failed:', status.error);
  } else {
    setTimeout(checkStatus, 2000);
  }
};

checkStatus();
```