import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getUploadsDir } from '@/lib/db';
import { isSupabaseConfigured, uploadImageToSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded or invalid file' }, { status: 400 });
    }

    const blob = file as Blob;

    if (!ALLOWED_MIME_TYPES.has(blob.type)) {
      return NextResponse.json(
        { error: `Unsupported file type (${blob.type}). Supported types: JPEG, PNG, GIF, WebP, SVG` },
        { status: 400 }
      );
    }

    if (blob.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds maximum limit of 10MB' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await blob.arrayBuffer());

    // Generate safe unique filename
    const ext = blob.type === 'image/png'
      ? '.png'
      : blob.type === 'image/webp'
      ? '.webp'
      : blob.type === 'image/gif'
      ? '.gif'
      : blob.type === 'image/svg+xml'
      ? '.svg'
      : '.jpg';

    const filename = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;

    let finalUrl = `/api/images/${filename}`;

    // 1. If Supabase is configured, upload to Supabase Storage bucket
    if (isSupabaseConfigured()) {
      const publicUrl = await uploadImageToSupabase(buffer, filename, blob.type);
      if (publicUrl) {
        finalUrl = publicUrl;
      }
    }

    // 2. Fallback to local filesystem storage if not on cloud storage
    if (!finalUrl.startsWith('http')) {
      const uploadsDir = getUploadsDir();
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, buffer);
    }

    return NextResponse.json({
      success: true,
      url: finalUrl,
      filename,
      size: blob.size,
      mimeType: blob.type,
    });
  } catch (error: any) {
    console.error('[Upload API] Error processing upload:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to upload file' },
      { status: 500 }
    );
  }
}
