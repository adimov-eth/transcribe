import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { StorageService } from '../services/storage';

const ALLOWED_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.flac', '.aac', '.ogg', '.wma', '.mp4', '.mkv', '.avi', '.mov'];

export function createUploadMiddleware(storage: StorageService) {
  const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, './uploads');
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `upload_${uuidv4()}${ext}`;
      cb(null, filename);
    },
  });

  const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error(`File type not allowed. Supported formats: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
    cb(null, true);
  };

  const upload = multer({
    storage: multerStorage,
    fileFilter: fileFilter,
    limits: {
      fileSize: storage.getMaxFileSizeMB() * 1024 * 1024,
    },
  });

  return {
    single: upload.single('audio'),
    
    handleError: (err: any, req: Request, res: Response, next: NextFunction) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: `File too large. Maximum size: ${storage.getMaxFileSizeMB()}MB`,
          });
        }
        return res.status(400).json({ error: err.message });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    },
  };
}