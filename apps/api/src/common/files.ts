import { fileTypeFromBuffer } from 'file-type';
import { AppError } from './problem.js';

/**
 * Real type from magic bytes, never the extension or the client's Content-Type (docs/features.md → ไฟล์อัปโหลด)
 * Plain text has no magic bytes → accepted only when allowed and valid UTF-8.
 */
export async function sniffFile(file: Express.Multer.File | undefined, allowed: string[], maxBytes: number) {
  if (!file?.buffer?.length) throw new AppError('VALIDATION_FAILED', 'No file uploaded', { errors: [{ field: 'file', message: 'Required' }] });
  if (file.size > maxBytes) throw new AppError('FILE_TOO_LARGE', `Max ${Math.round(maxBytes / 1048576)} MB`);
  const type = await fileTypeFromBuffer(file.buffer);
  if (type && allowed.includes(type.mime)) return { mime: type.mime, ext: type.ext };
  // glTF binary files start with "glTF"
  if (!type && allowed.includes('model/gltf-binary') && file.buffer.subarray(0, 4).toString('latin1') === 'glTF') return { mime: 'model/gltf-binary', ext: 'glb' };
  if (!type && (allowed.includes('text/plain') || allowed.includes('text/markdown')) && isUtf8Text(file.buffer)) {
    return file.originalname.toLowerCase().endsWith('.md') ? { mime: 'text/markdown', ext: 'md' } : { mime: 'text/plain', ext: 'txt' };
  }
  throw new AppError('UNSUPPORTED_FILE', `Allowed: ${allowed.join(', ')}`);
}

function isUtf8Text(buf: Buffer) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buf.subarray(0, 64 * 1024));
    return !text.includes('\u0000');
  } catch {
    return false;
  }
}
