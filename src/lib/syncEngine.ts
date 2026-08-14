import { supabase } from './supabase';
import { collection, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface SyncResult {
  success: boolean;
  message: string;
  pushedCount: number;
  pulledCount: number;
  timestamp: string;
}

// Local Storage keys for offline backup on laptop
const OFFLINE_KEY_PREFIX = 'imam_school_laptop_data_';

export function saveLocalLaptopBackup(collectionName: string, data: any[]) {
  try {
    localStorage.setItem(`${OFFLINE_KEY_PREFIX}${collectionName}`, JSON.stringify(data));
  } catch (e) {
    console.warn("LocalStorage save warning:", e);
  }
}

export function getLocalLaptopBackup(collectionName: string): any[] {
  try {
    const raw = localStorage.getItem(`${OFFLINE_KEY_PREFIX}${collectionName}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Sync a specific collection between local laptop storage (Firestore/LocalStorage) and Supabase
 * Ensures NO local data is deleted if laptop has extra records; pushes them to Supabase!
 */
export async function syncCollection(collectionName: string): Promise<{ pushed: number; pulled: number }> {
  let pushed = 0;
  let pulled = 0;

  try {
    // 1. Fetch Local Data (from Firestore & LocalStorage backup)
    let localItems: any[] = [];
    try {
      const snap = await getDocs(collection(db, collectionName));
      localItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn(`Firestore read failed for ${collectionName}, falling back to laptop localStorage:`, err);
      localItems = getLocalLaptopBackup(collectionName);
    }

    if (localItems.length > 0) {
      saveLocalLaptopBackup(collectionName, localItems);
    }

    // 2. Fetch Remote Data from Supabase
    const { data: supabaseItems, error: sbError } = await supabase
      .from(collectionName)
      .select('*');

    if (sbError) {
      console.warn(`Supabase fetch notice for ${collectionName}:`, sbError.message);
      // If table doesn't exist yet in Supabase or permission issue, push local items to Supabase
      if (localItems.length > 0) {
        for (const item of localItems) {
          const { error: insertErr } = await supabase.from(collectionName).upsert(item);
          if (!insertErr) pushed++;
        }
      }
      return { pushed, pulled };
    }

    const sbMap = new Map((supabaseItems || []).map((item: any) => [item.id, item]));
    const localMap = new Map(localItems.map(item => [item.id, item]));

    // 3. Pull from Supabase -> Laptop (if Supabase has items missing locally)
    for (const [sbId, sbItem] of sbMap.entries()) {
      if (!localMap.has(sbId)) {
        try {
          await setDoc(doc(db, collectionName, sbId), sbItem, { merge: true });
          localItems.push(sbItem);
          pulled++;
        } catch (e) {
          console.error(`Error saving pulled Supabase item to local Firestore:`, e);
        }
      }
    }

    // 4. Push from Laptop -> Supabase (if Laptop has items missing in Supabase, DO NOT DELETE LAPTOP DATA!)
    for (const [localId, localItem] of localMap.entries()) {
      if (!sbMap.has(localId)) {
        try {
          const { error: upsertErr } = await supabase
            .from(collectionName)
            .upsert(localItem);
          
          if (!upsertErr) {
            pushed++;
          } else {
            console.warn(`Could not push item ${localId} to Supabase ${collectionName}:`, upsertErr);
          }
        } catch (e) {
          console.error(`Error pushing local item to Supabase:`, e);
        }
      }
    }

    // Update local backup
    saveLocalLaptopBackup(collectionName, localItems);

  } catch (error) {
    console.error(`Sync error on ${collectionName}:`, error);
  }

  return { pushed, pulled };
}

/**
 * Perform full bidirectional synchronization across all app data models
 */
export async function performFullSync(): Promise<SyncResult> {
  const collections = [
    'students',
    'programs',
    'enrollments',
    'study_periods',
    'periodic_study_logs',
    'todos',
    'comments',
    'research_records'
  ];

  let totalPushed = 0;
  let totalPulled = 0;

  for (const col of collections) {
    const { pushed, pulled } = await syncCollection(col);
    totalPushed += pushed;
    totalPulled += pulled;
  }

  const nowStr = new Date().toLocaleTimeString('fa-IR');

  return {
    success: true,
    message: `همگام‌سازی کامل با دیتابیس Supabase انجام شد (${totalPushed} داده به Supabase ارسال شد، ${totalPulled} داده به لپ‌تاپ اضافه شد)`,
    pushedCount: totalPushed,
    pulledCount: totalPulled,
    timestamp: nowStr
  };
}
