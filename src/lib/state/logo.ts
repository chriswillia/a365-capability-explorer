import { z } from 'zod';

export const LOGO_INPUT_BYTES = 2 * 1024 * 1024;
export const LOGO_STORED_BYTES = 512 * 1024;
export const LOGO_MAX_SIDE = 512;
export const LOGO_INPUT_SIDE = 4096;
const prefix = 'data:image/png;base64,';
const signature = [137, 80, 78, 71, 13, 10, 26, 10];

function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (
    bytes.length < 33 ||
    signature.some((value, index) => bytes[index] !== value) ||
    String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR'
  )
    return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function validPng(data: string, width: number, height: number): boolean {
  if (!data.startsWith(prefix)) return false;
  const encoded = data.slice(prefix.length);
  if (encoded.length > Math.ceil(LOGO_STORED_BYTES / 3) * 4) return false;
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return false;
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  const dimensions = pngDimensions(bytes);
  if (!dimensions || dimensions.width !== width || dimensions.height !== height) return false;
  const view = new DataView(bytes.buffer);
  let offset = 8;
  let hasData = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    const end = offset + length + 12;
    if (end > bytes.length) return false;
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    let crc = 0xffffffff;
    for (let i = offset + 4; i < end - 4; i++) {
      crc ^= bytes[i]!;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    if ((crc ^ 0xffffffff) >>> 0 !== view.getUint32(end - 4)) return false;
    if (type === 'IHDR') {
      if (
        offset !== 8 ||
        length !== 13 ||
        bytes[24] !== 8 ||
        ![2, 6].includes(bytes[25]!) ||
        bytes[26] !== 0 ||
        bytes[27] !== 0 ||
        bytes[28] !== 0
      )
        return false;
    } else if (type === 'IDAT') {
      hasData = true;
    } else if (type === 'IEND') {
      return hasData && length === 0 && end === bytes.length;
    } else if (!['sRGB', 'gAMA', 'cHRM', 'pHYs', 'iCCP'].includes(type)) {
      return false;
    }
    offset = end;
  }
  return false;
}

export const LogoSchema = z
  .strictObject({
    data: z.string().max(prefix.length + Math.ceil(LOGO_STORED_BYTES / 3) * 4),
    width: z.number().int().min(1).max(LOGO_MAX_SIDE),
    height: z.number().int().min(1).max(LOGO_MAX_SIDE),
    alt: z.string().trim().min(1).max(120),
  })
  .refine((logo) => validPng(logo.data, logo.width, logo.height), 'invalid normalized PNG logo');

export type Logo = z.infer<typeof LogoSchema>;
export class LogoError extends Error {
  readonly reason: 'size' | 'format' | 'dimensions' | 'read';
  constructor(reason: LogoError['reason']) {
    super(`Logo could not be loaded: ${reason}`);
    this.name = 'LogoError';
    this.reason = reason;
  }
}

function rasterDimensions(bytes: Uint8Array, type: string) {
  if (type === 'image/png') return pngDimensions(bytes);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    const length = view.getUint16(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) return null;
    if (marker === 0xc0 || marker === 0xc2) {
      if (length < 8) return null;
      return { width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
    }
    offset += length + 2;
  }
  return null;
}

export async function normalizeLogo(file: File, alt: string): Promise<Logo> {
  if (file.size > LOGO_INPUT_BYTES) throw new LogoError('size');
  if (!['image/png', 'image/jpeg'].includes(file.type)) throw new LogoError('format');
  if (!alt.trim() || alt.trim().length > 120) throw new LogoError('format');
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (error) {
    if (!(error instanceof DOMException || error instanceof TypeError)) throw error;
    throw new LogoError('read');
  }
  const dimensions = rasterDimensions(new Uint8Array(buffer), file.type);
  if (!dimensions) throw new LogoError('format');
  if (
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    dimensions.width > LOGO_INPUT_SIDE ||
    dimensions.height > LOGO_INPUT_SIDE
  )
    throw new LogoError('dimensions');
  let image: ImageBitmap;
  if (typeof createImageBitmap !== 'function') throw new LogoError('read');
  try {
    image = await createImageBitmap(file);
  } catch (error) {
    if (!(error instanceof DOMException || error instanceof TypeError)) throw error;
    throw new LogoError('read');
  }
  try {
    const ratio = Math.min(1, LOGO_MAX_SIDE / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * ratio));
    canvas.height = Math.max(1, Math.round(image.height * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new LogoError('read');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const parsed = LogoSchema.safeParse({
      data: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
      alt,
    });
    if (!parsed.success) throw new LogoError('format');
    return parsed.data;
  } finally {
    image.close();
  }
}
