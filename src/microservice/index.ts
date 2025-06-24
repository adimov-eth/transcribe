import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { QueueService } from './services/queue';
import { StorageService } from './services/storage';
import { TranscriptionWorker } from './workers/transcriber';
import { createTranscribeRouter } from './routes/transcribe';
import { createJobsRouter } from './routes/jobs';
import { logger } from './utils/logger';

// Configuration
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '500') * 1024 * 1024; // MB to bytes

if (!OPENAI_API_KEY) {
  logger.error('OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

// Initialize services
const app = express();
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

const queueService = new QueueService(REDIS_URL);
const storageService = new StorageService(UPLOAD_DIR, MAX_FILE_SIZE);
const worker = new TranscriptionWorker(OPENAI_API_KEY, storageService, io);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
}));
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/transcribe', createTranscribeRouter(queueService, storageService));
app.use('/api/jobs', createJobsRouter(queueService));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction): void => {
  // Handle multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({
      error: `File too large. Maximum size: ${storageService.getMaxFileSizeMB()}MB`,
    });
    return;
  }
  if (err.message && err.message.includes('File type not allowed')) {
    res.status(400).json({ error: err.message });
    return;
  }
  
  // General error handler
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  // Join job-specific rooms
  socket.on('subscribe', (jobId: string) => {
    socket.join(`job:${jobId}`);
    logger.info(`Client ${socket.id} subscribed to job ${jobId}`);
  });

  socket.on('unsubscribe', (jobId: string) => {
    socket.leave(`job:${jobId}`);
    logger.info(`Client ${socket.id} unsubscribed from job ${jobId}`);
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Start worker processing
queueService.getQueue().process(5, async (job) => {
  return await worker.processJob(job);
});

// Cleanup old files periodically
setInterval(() => {
  storageService.cleanupOldFiles(24).catch(err => {
    logger.error('Failed to cleanup old files:', err);
  });
}, 60 * 60 * 1000); // Every hour

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  await queueService.close();
  process.exit(0);
});

// Start server
httpServer.listen(PORT, () => {
  logger.info(`Transcription API server listening on port ${PORT}`);
  logger.info(`WebSocket server ready for real-time updates`);
});