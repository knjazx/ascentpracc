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

function generateFallbackSvg(filename: string): string {
  const clean = filename.replace(/\.[^/.]+$/, '').toUpperCase();
  const tag = clean.slice(0, 4) || 'CS2';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1c1c22" />
      <stop offset="50%" stop-color="#121216" />
      <stop offset="100%" stop-color="#09090b" />
    </linearGradient>
    <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3" />
      <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0.08" />
    </linearGradient>
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#93c5fd" />
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.4" />
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="40%" r="50%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#3b82f6" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="256" height="256" rx="44" fill="url(#bg)" />
  <rect width="254" height="254" x="1" y="1" rx="43" fill="none" stroke="#2a2a32" stroke-width="2" />
  <circle cx="128" cy="118" r="85" fill="url(#glow)" />
  <path d="M128 34 L200 66 L200 152 C200 192 128 226 128 226 C128 226 56 192 56 152 L56 66 Z" fill="url(#shieldGrad)" stroke="url(#borderGrad)" stroke-width="4.5" stroke-linejoin="round" />
  <path d="M128 46 L188 74 L188 148 C188 180 128 210 128 210 C128 210 68 180 68 148 L68 74 Z" fill="#0d0d10" opacity="0.88" />
  <text x="128" y="152" font-family="'Montserrat', 'Arial Black', sans-serif" font-weight="900" font-size="38" fill="#ffffff" text-anchor="middle" letter-spacing="1.5">
    ${tag}
  </text>
  <text x="128" y="178" font-family="monospace" font-weight="800" font-size="11" fill="#93c5fd" text-anchor="middle" letter-spacing="2.5" opacity="0.9">
    CS2 PRACC
  </text>
</svg>`;
}

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
    // Dynamic fallback so missing upload images never return 404 or break UI
    const fallbackSvg = generateFallbackSvg(sanitized);
    return new NextResponse(fallbackSvg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }

  const ext = path.extname(sanitized).toLowerCase();
  const fileBuffer = await fs.promises.readFile(filePath);
  const isSvg = fileBuffer.slice(0, 100).toString('utf8').includes('<svg');
  const contentType = isSvg ? 'image/svg+xml' : (MIME_MAP[ext] || 'application/octet-stream');

  return new NextResponse(fileBuffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
