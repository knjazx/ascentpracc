import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MIME_MAP: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { filename: string } }
) {
  const { filename } = params;
  // Prevent directory traversal
  const sanitized = path.basename(filename);
  const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');
  const filePath = path.join(uploadDir, sanitized);

  if (!fs.existsSync(filePath)) {
    return new NextResponse('File not found', {
      status: 404,
      headers: {
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  const ext = path.extname(sanitized).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';
  const fileBuffer = await fs.promises.readFile(filePath);

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
