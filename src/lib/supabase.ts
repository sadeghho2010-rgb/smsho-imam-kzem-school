import { createClient } from '@supabase/supabase-js';
import imageCompression from 'browser-image-compression';

const meta = import.meta as any;
const SUPABASE_URL = meta.env?.VITE_SUPABASE_URL || 'https://kozpynpjwqeynmhcbqpx.supabase.co';
const SUPABASE_ANON_KEY = meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvenB5bnBqd3FleW5taGNicXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2OTU0MDUsImV4cCI6MjEwMjI3MTQwNX0.HqtPfjwQgLmW1lNdBm-8CERmHmx6HW2vtLIyXteHerw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const BUCKET_NAME = 'picture';

/**
 * High performance HTML5 Canvas image compressor (100% offline compatible)
 */
export function compressImageCanvas(file: File, maxWidth = 400, maxHeight = 400, quality = 0.75): Promise<Blob> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              resolve(blob || file);
            },
            'image/jpeg',
            quality
          );
        } else {
          resolve(file);
        }
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

/**
 * Compress an image file to ultra-small size before uploading/saving
 */
export async function compressImage(file: File): Promise<Blob> {
  try {
    const canvasBlob = await compressImageCanvas(file, 400, 400, 0.75);
    return canvasBlob;
  } catch (err) {
    try {
      const options = {
        maxSizeMB: 0.15,
        maxWidthOrHeight: 400,
        useWebWorker: false,
        fileType: 'image/jpeg'
      };
      const compressedFile = await imageCompression(file, options);
      return compressedFile;
    } catch (error) {
      console.warn("Image compression fallback to original file:", error);
      return file;
    }
  }
}

/**
 * Convert a File or Blob to Base64 string for offline/laptop storage
 */
export function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Convert Base64 string to Blob
 */
export function base64ToBlob(base64Data: string): Blob {
  const arr = base64Data.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Upload compressed image to Supabase Storage 'picture' bucket
 * Guaranteed to return local Base64 data URL when offline!
 */
export async function uploadImageToSupabase(file: File, studentId?: string): Promise<{ publicUrl: string | null; localDataUrl: string }> {
  // Compress image
  const compressed = await compressImage(file);
  const localDataUrl = await fileToBase64(compressed);

  // If app is offline, return local Base64 data URL immediately for offline laptop storage
  if (!navigator.onLine) {
    console.log("App is offline: storing compressed Base64 photo on laptop.");
    return { publicUrl: null, localDataUrl };
  }

  try {
    const fileName = `student_${studentId || Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const filePath = `avatars/${fileName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, compressed, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.warn("Supabase Storage upload notice (will use compressed local photo):", error.message);
      return { publicUrl: null, localDataUrl };
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return {
      publicUrl: publicUrlData?.publicUrl || null,
      localDataUrl
    };
  } catch (err) {
    console.warn("Supabase storage network exception (will use compressed local photo):", err);
    return { publicUrl: null, localDataUrl };
  }
}

/**
 * Upload an offline Base64 image to Supabase Storage when online during sync
 */
export async function uploadBase64ToSupabase(base64Str: string, studentId?: string): Promise<string | null> {
  if (!base64Str || !base64Str.startsWith('data:image/')) return null;
  if (!navigator.onLine) return null;

  try {
    const blob = base64ToBlob(base64Str);
    const fileName = `student_${studentId || Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const filePath = `avatars/${fileName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.warn("Base64 upload to Supabase notice:", error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return publicUrlData?.publicUrl || null;
  } catch (err) {
    console.warn("Exception uploading Base64 photo to Supabase:", err);
    return null;
  }
}

