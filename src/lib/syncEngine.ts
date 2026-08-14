import { supabase, uploadBase64ToSupabase } from './supabase';
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';
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
 * Dual fetch helper: First returns local backup instantly, then queries Supabase & Firestore
 * Supabase works directly in Iran without VPN!
 */
export async function fetchDataDual(collectionName: string): Promise<any[]> {
  const localBackup = getLocalLaptopBackup(collectionName);
  
  if (!navigator.onLine) {
    return localBackup;
  }

  try {
    // 1. Query Supabase (REST API works in Iran without VPN!)
    const { data: sbData, error: sbErr } = await supabase.from(collectionName).select('*');
    if (!sbErr && sbData && sbData.length > 0) {
      // Merge with local backup so offline items aren't lost
      const sbMap = new Map(sbData.map((item: any) => [item.id, item]));
      for (const item of localBackup) {
        if (!sbMap.has(item.id)) {
          sbData.push(item);
        }
      }
      saveLocalLaptopBackup(collectionName, sbData);
      return sbData;
    }

    // 2. Fallback to Firestore with timeout
    const snap = await Promise.race([
      getDocs(collection(db, collectionName)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 1200))
    ]);
    const fsItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (fsItems && fsItems.length > 0) {
      saveLocalLaptopBackup(collectionName, fsItems);
      return fsItems;
    }
  } catch (err) {
    console.warn(`Dual fetch fallback to local storage for ${collectionName}:`, err);
  }

  return localBackup;
}

/**
 * Dual save helper: Saves to local laptop storage immediately, then pushes to Supabase & Firestore
 */
export async function saveDataDual(collectionName: string, item: any): Promise<void> {
  // 1. Save to LocalStorage immediately
  const localItems = getLocalLaptopBackup(collectionName);
  const idx = localItems.findIndex((x: any) => x.id === item.id);
  if (idx >= 0) {
    localItems[idx] = { ...localItems[idx], ...item };
  } else {
    localItems.push(item);
  }
  saveLocalLaptopBackup(collectionName, localItems);

  // 2. Push to Supabase if online (Works in Iran without VPN!)
  if (navigator.onLine) {
    try {
      await supabase.from(collectionName).upsert(item);
    } catch (e) {
      console.warn("Supabase upsert notice:", e);
    }

    // 3. Push to Firestore in background
    try {
      await Promise.race([
        setDoc(doc(db, collectionName, item.id), item, { merge: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 1000))
      ]);
    } catch (e) {
      console.warn("Firestore setDoc notice:", e);
    }
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
    for (const [localId, itemToSync] of localMap.entries()) {
      let localItem = { ...itemToSync };

      // If student has an offline Base64 photo, upload it to Supabase Storage when online
      if (collectionName === 'students' && localItem.photoUrl && localItem.photoUrl.startsWith('data:image/')) {
        try {
          const publicUrl = await uploadBase64ToSupabase(localItem.photoUrl, localItem.id);
          if (publicUrl) {
            localItem.photoUrl = publicUrl;
            // Update Firestore with new public URL
            try {
              await setDoc(doc(db, 'students', localId), { photoUrl: publicUrl }, { merge: true });
            } catch (e) {
              console.warn("Firestore update photoUrl error:", e);
            }
          }
        } catch (e) {
          console.warn("Error uploading offline student photo during sync:", e);
        }
      }

      if (!sbMap.has(localId) || localItem.photoUrl !== sbMap.get(localId)?.photoUrl) {
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
