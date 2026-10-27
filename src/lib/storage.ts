import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface StorageProvider {
  uploadFile(buffer: Buffer, originalFilename: string, mimeType: string): Promise<string>;
  deleteFile(fileUrl: string): Promise<void>;
}

export class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(buffer: Buffer, originalFilename: string, _mimeType: string): Promise<string> {
    const ext = path.extname(originalFilename).toLowerCase() || '.png';
    const hash = crypto.randomBytes(16).toString('hex');
    const filename = `${Date.now()}-${hash}${ext}`;
    const filePath = path.join(this.uploadDir, filename);

    await fs.promises.writeFile(filePath, buffer);
    return `/api/uploads/${filename}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const filename = path.basename(fileUrl);
      const filePath = path.join(this.uploadDir, filename);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err) {
      console.warn('[Storage] Failed to delete file:', fileUrl, err);
    }
  }
}

// Singleton storage provider (can be swapped for S3StorageProvider when S3 envs configured)
export const storage: StorageProvider = new LocalStorageProvider();
