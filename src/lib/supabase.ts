import { createClient } from '@supabase/supabase-js';
import imageCompression from 'browser-image-compression';

const meta = import.meta as any;
const SUPABASE_URL = meta.env?.VITE_SUPABASE_URL || 'https://kozpynpjwqeynmhcbqpx.supabase.co';
const SUPABASE_ANON_KEY = meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvenB5bnBqd3FleW5taGNicXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2OTU0MDUsImV4cCI6MjEwMjI3MTQwNX0.HqtPfjwQgLmW1lNdBm-8CERmHmx6HW2vtLIyXteHerw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const BUCKET_NAME = 'picture';

/**
 * Compress an image file to ultra-small size before uploading/saving
 */
export async function compressImage(file: File): Promise<File> {
  const options = {
    maxSizeMB: 0.15, // Max 150KB
    maxWidthOrHeight: 400, // Reasonable max dimension for avatar
    useWebWorker: true,
    fileType: 'image/jpeg'
  };

  try {
    const compressedFile = await imageCompression(file, options);
    console.log(`Original image size: ${(file.size / 1024).toFixed(1)} KB`);
    console.log(`Compressed image size: ${(compressedFile.size / 1024).toFixed(1)} KB`);
    return compressedFile;
  } catch (error) {
    console.warn("Browser image compression failed, falling back to original file:", error);
    return file;
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
 * Upload compressed image to Supabase Storage 'picture' bucket
 * Returns public URL or null on failure
 */
export async function uploadImageToSupabase(file: File, studentId?: string): Promise<{ publicUrl: string | null; localDataUrl: string }> {
  // First compress the image
  const compressed = await compressImage(file);
  const localDataUrl = await fileToBase64(compressed);

  try {
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `student_${studentId || Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, compressed, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error("Error uploading to Supabase Storage:", error);
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
    console.error("Supabase storage exception:", err);
    return { publicUrl: null, localDataUrl };
  }
}
