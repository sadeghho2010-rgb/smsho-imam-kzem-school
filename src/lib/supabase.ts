import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://kozpynpjwqeynmhcbqpx.supabase.co';
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvenB5bnBqd3FleW5taGNicXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2OTU0MDUsImV4cCI6MjEwMjI3MTQwNX0.HqtPfjwQgLmW1lNdBm-8CERmHmx6HW2vtLIyXteHerw';

export const BUCKET_NAME = 'backups';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Maps mentor ID to Supabase Storage folder path
 * - Hosseini -> 'hosseini'
 * - Hayati -> 'hayati'
 * - Soleimani -> 'soleymani'
 * - Shahpoori / Manager -> 'boss'
 */
export function getFolderForMentor(mentorId: string): string {
  switch (mentorId) {
    case 'hosseini':
      return 'hosseini';
    case 'hayati':
      return 'hayati';
    case 'soleimani':
    case 'soleymani':
      return 'soleymani';
    case 'asadi':
      return 'asadi';
    case 'shahpoori':
    case 'boss':
      return 'boss';
    default:
      return 'boss';
  }
}
