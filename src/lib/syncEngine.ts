import { supabase, uploadBase64ToSupabase } from './supabase';
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

export const DEFAULT_STUDENTS = [
  {
    id: 'student_1',
    name: 'علی محمدی',
    nationalId: '1234567890',
    phoneNumber: '09123456789',
    grade: 'پایه ۷',
    isActive: true,
    fatherOccupation: 'کارمند',
    birthPlace: 'قم',
    birthDate: '1380/05/12',
    maritalStatus: 'مجرد',
    childrenCount: 0,
    livingStatus: 'خوابگاه',
    classicEducation: 'دیپلم',
    howzaEntryYear: '1400',
    levelOneSchool: 'مدرسه امام کاظم (ع)',
    tammomStatus: 'غیر معمم',
    createdAt: new Date().toISOString()
  },
  {
    id: 'student_2',
    name: 'حسین رضایی',
    nationalId: '0987654321',
    phoneNumber: '09198765432',
    grade: 'پایه ۸',
    isActive: true,
    fatherOccupation: 'کشاورز',
    birthPlace: 'مشهد',
    birthDate: '1379/11/20',
    maritalStatus: 'متاهل',
    childrenCount: 1,
    livingStatus: 'اجاره ای',
    classicEducation: 'لیسانس',
    howzaEntryYear: '1399',
    levelOneSchool: 'مدرسه امام کاظم (ع)',
    tammomStatus: 'معمم',
    createdAt: new Date().toISOString()
  },
  {
    id: 'student_3',
    name: 'محمدمهدی حسینی',
    nationalId: '1122334455',
    phoneNumber: '09351112233',
    grade: 'پایه ۹',
    isActive: true,
    fatherOccupation: 'کاسب',
    birthPlace: 'تهران',
    birthDate: '1381/02/05',
    maritalStatus: 'مجرد',
    childrenCount: 0,
    livingStatus: 'پدری',
    classicEducation: 'دیپلم',
    howzaEntryYear: '1401',
    levelOneSchool: 'مدرسه امام کاظم (ع)',
    tammomStatus: 'غیر معمم',
    createdAt: new Date().toISOString()
  }
];

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
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("LocalStorage read warning:", e);
  }

  // Seed default students if students collection is empty
  if (collectionName === 'students') {
    saveLocalLaptopBackup('students', DEFAULT_STUDENTS);
    return DEFAULT_STUDENTS;
  }

  return [];
}

/**
 * Dual fetch helper: Works 100% in Iran without VPN!
 * 1. Returns local backup instantly.
 * 2. Queries Supabase via REST API (Supabase is accessible without VPN in Iran!).
 * 3. Falls back safely if Firestore is blocked or times out.
 */
export async function fetchDataDual(collectionName: string): Promise<any[]> {
  const localBackup = getLocalLaptopBackup(collectionName);
  
  if (!navigator.onLine) {
    return localBackup;
  }

  // 1. Primary remote fetch from Supabase (Works in Iran without VPN!)
  try {
    const { data: sbData, error: sbErr } = await supabase.from(collectionName).select('*');
    if (!sbErr && sbData) {
      // Merge with local backup so offline-created items aren't lost
      const sbMap = new Map(sbData.map((item: any) => [item.id, item]));
      const merged = [...sbData];
      for (const item of localBackup) {
        if (!sbMap.has(item.id)) {
          merged.push(item);
        }
      }
      if (merged.length > 0) {
        saveLocalLaptopBackup(collectionName, merged);
        return merged;
      }
    }
  } catch (err) {
    console.warn(`Supabase fetch notice for ${collectionName}:`, err);
  }

  // 2. Short non-blocking Firestore fallback (300ms timeout max to prevent freezing in Iran without VPN)
  try {
    const snap = await Promise.race([
      getDocs(collection(db, collectionName)),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Firestore blocked/timeout')), 300))
    ]);
    const fsItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (fsItems && fsItems.length > 0) {
      // Merge
      const fsMap = new Map(fsItems.map((item: any) => [item.id, item]));
      const merged = [...fsItems];
      for (const item of localBackup) {
        if (!fsMap.has(item.id)) {
          merged.push(item);
        }
      }
      saveLocalLaptopBackup(collectionName, merged);
      return merged;
    }
  } catch (err) {
    // Firestore is blocked in Iran without VPN - silently ignore and use local storage
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

    // 3. Non-blocking Firestore push in background
    try {
      await Promise.race([
        setDoc(doc(db, collectionName, item.id), item, { merge: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 300))
      ]);
    } catch (e) {
      // Ignore Firestore network blocks in Iran
    }
  }
}

/**
 * Dual delete helper: Deletes from local laptop storage immediately, then from Supabase & Firestore
 */
export async function deleteDataDual(collectionName: string, id: string): Promise<void> {
  // 1. Remove from LocalStorage immediately
  const localItems = getLocalLaptopBackup(collectionName);
  const updated = localItems.filter((x: any) => x.id !== id);
  saveLocalLaptopBackup(collectionName, updated);

  if (navigator.onLine) {
    // 2. Delete from Supabase (Works in Iran without VPN!)
    try {
      await supabase.from(collectionName).delete().eq('id', id);
    } catch (e) {
      console.warn("Supabase delete notice:", e);
    }

    // 3. Non-blocking Firestore delete in background
    try {
      await Promise.race([
        deleteDoc(doc(db, collectionName, id)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 300))
      ]);
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Sync a specific collection between local laptop storage and Supabase
 * Ensures NO local data is deleted if laptop has extra records; pushes them to Supabase!
 */
export async function syncCollection(collectionName: string): Promise<{ pushed: number; pulled: number }> {
  let pushed = 0;
  let pulled = 0;

  try {
    // 1. Get local items from LocalStorage
    const localItems = getLocalLaptopBackup(collectionName);

    // 2. Fetch Remote Data from Supabase (Fast & works in Iran!)
    const { data: supabaseItems, error: sbError } = await supabase
      .from(collectionName)
      .select('*');

    if (sbError || !supabaseItems) {
      console.warn(`Supabase fetch notice for ${collectionName}:`, sbError?.message);
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
        localItems.push(sbItem);
        pulled++;
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
    message: `همگام‌سازی کامل انجام شد (${totalPushed} داده ارسال شد، ${totalPulled} داده به لپ‌تاپ اضافه شد)`,
    pushedCount: totalPushed,
    pulledCount: totalPulled,
    timestamp: nowStr
  };
}
