import { db } from './firebase';
import { collection, addDoc, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { localDb } from './localDb';
import { supabase, BUCKET_NAME, getFolderForMentor } from './supabase';

export interface CloudBackupRecord {
  id: string;
  mentorId: string;
  mentorName: string;
  mentorRole: string;
  fileName: string;
  folderPath?: string;
  createdAt: string;
  persianDate: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  totalRecords: number;
  studentCount: number;
  backupData: any;
  supabaseUrl?: string;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '۰ کیلوبایت';
  const k = 1024;
  const sizes = ['بایت', 'کیلوبایت', 'مگابایت'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${val.toLocaleString('fa-IR')} ${sizes[i]}`;
}

export function getPersianDateTime(dateInput: Date | string = new Date()): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  try {
    const dStr = date.toLocaleDateString('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const tStr = date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    return `${dStr} - ساعت ${tStr}`;
  } catch (e) {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }
}

export function generateBackupFilename(mentorName: string, dateInput: Date = new Date()): string {
  const cleanName = (mentorName || 'کاربر').replace(/\s+/g, '_');
  let dStr = '';
  try {
    dStr = dateInput.toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-');
  } catch (e) {
    dStr = dateInput.toISOString().slice(0, 10);
  }
  const timeStr = dateInput.toTimeString().slice(0, 5).replace(/:/g, '-');
  return `پشتیبان_${cleanName}_${dStr}_${timeStr}.json`;
}

/**
 * Uploads a backup package to Supabase Storage & Firestore / Local DB
 */
export async function uploadBackupToCloud(
  mentorId: string,
  mentorName: string,
  mentorRole: string,
  backupPackage: any
): Promise<CloudBackupRecord> {
  const now = new Date();
  const jsonStr = JSON.stringify(backupPackage, null, 2);
  const jsonBlob = new Blob([jsonStr], { type: 'application/json' });
  const fileSizeBytes = jsonBlob.size;
  const fileName = generateBackupFilename(mentorName, now);

  const folder = getFolderForMentor(mentorId);
  const filePath = `${folder}/${fileName}`;

  const studentCount = Array.isArray(backupPackage.students) 
    ? backupPackage.students.length 
    : (backupPackage.student ? 1 : 0);

  const totalRecords = backupPackage._meta?.totalRecords || 
    (Array.isArray(backupPackage.students) ? backupPackage.students.length : 1);

  let supabasePublicUrl = '';

  // 1. Upload file directly to Supabase Storage bucket under the user's folder
  try {
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, jsonBlob, {
        contentType: 'application/json',
        upsert: true
      });

    if (uploadError) {
      console.warn('Supabase storage upload notice:', uploadError.message);
    } else {
      const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);
      supabasePublicUrl = urlData?.publicUrl || '';
    }
  } catch (err) {
    console.warn('Supabase storage connection notice:', err);
  }

  const recordId = `backup_${mentorId}_${Date.now()}`;

  const record: CloudBackupRecord = {
    id: recordId,
    mentorId,
    mentorName,
    mentorRole,
    fileName,
    folderPath: filePath,
    createdAt: now.toISOString(),
    persianDate: getPersianDateTime(now),
    fileSizeBytes,
    fileSizeFormatted: formatBytes(fileSizeBytes),
    totalRecords,
    studentCount,
    backupData: backupPackage,
    supabaseUrl: supabasePublicUrl
  };

  // 2. Try saving metadata to Firestore database
  try {
    const docRef = await addDoc(collection(db, 'cloud_backups'), record);
    record.id = docRef.id;
  } catch (e) {
    console.warn('Firestore fallback to local database:', e);
  }

  // 3. Always store in local IndexedDB store
  await localDb.addDoc('cloud_backups', record);

  return record;
}

/**
 * Fetches backups from Database & Supabase Storage
 */
export async function fetchCloudBackups(
  filterMentorId?: string,
  isManager: boolean = false
): Promise<CloudBackupRecord[]> {
  const allRecordsMap = new Map<string, CloudBackupRecord>();

  // 1. Fetch from Firestore
  try {
    const colRef = collection(db, 'cloud_backups');
    const snapshot = await getDocs(colRef);
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as CloudBackupRecord;
      allRecordsMap.set(docSnap.id, { ...data, id: docSnap.id });
    });
  } catch (e) {
    console.warn('Firestore fetch fallback:', e);
  }

  // 2. Fetch from Local IndexedDB store
  try {
    const localRecords = await localDb.getDocs<CloudBackupRecord>('cloud_backups');
    localRecords.forEach(rec => {
      if (!allRecordsMap.has(rec.id)) {
        allRecordsMap.set(rec.id, rec);
      }
    });
  } catch (e) {
    console.error('Error fetching local backups store:', e);
  }

  // 3. Fetch list directly from Supabase Storage folders as fallback / sync
  const foldersToFetch = isManager 
    ? ['hosseini', 'hayati', 'soleymani', 'boss']
    : [getFolderForMentor(filterMentorId || '')];

  for (const f of foldersToFetch) {
    try {
      const { data: storageFiles, error } = await supabase.storage
        .from(BUCKET_NAME)
        .list(f);

      if (!error && storageFiles) {
        storageFiles.forEach(fileObj => {
          if (fileObj.name && fileObj.name !== '.emptyFolderPlaceholder') {
            const path = `${f}/${fileObj.name}`;
            const exists = Array.from(allRecordsMap.values()).some(r => r.fileName === fileObj.name || r.folderPath === path);
            if (!exists) {
              // Convert storage file to record
              let mentorName = 'استاد/کاربر';
              let mentorId = f;
              if (f === 'hosseini') { mentorName = 'استاد حسینی'; mentorId = 'hosseini'; }
              if (f === 'hayati') { mentorName = 'استاد حیاتی'; mentorId = 'hayati'; }
              if (f === 'soleymani') { mentorName = 'استاد سلیمانی'; mentorId = 'soleimani'; }
              if (f === 'boss') { mentorName = 'استاد شاهپوری (مدیر)'; mentorId = 'shahpoori'; }

              const created = fileObj.created_at || new Date().toISOString();
              const rec: CloudBackupRecord = {
                id: `sp_${f}_${fileObj.id || fileObj.name}`,
                mentorId,
                mentorName,
                mentorRole: f === 'boss' ? 'مدیر ارشد' : 'استاد راهنما',
                fileName: fileObj.name,
                folderPath: path,
                createdAt: created,
                persianDate: getPersianDateTime(new Date(created)),
                fileSizeBytes: fileObj.metadata?.size || 0,
                fileSizeFormatted: formatBytes(fileObj.metadata?.size || 0),
                totalRecords: 1,
                studentCount: 1,
                backupData: null,
                supabaseUrl: supabase.storage.from(BUCKET_NAME).getPublicUrl(path).data.publicUrl
              };
              allRecordsMap.set(rec.id, rec);
            }
          }
        });
      }
    } catch (err) {
      console.warn(`Supabase list folder ${f} notice:`, err);
    }
  }

  let list = Array.from(allRecordsMap.values());

  // Sort by created date descending
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Filter logic
  if (isManager && (!filterMentorId || filterMentorId === 'all' || filterMentorId === 'shahpoori')) {
    return list;
  }

  if (filterMentorId && filterMentorId !== 'all') {
    return list.filter(r => r.mentorId === filterMentorId || getFolderForMentor(r.mentorId) === getFolderForMentor(filterMentorId));
  }

  return list;
}

/**
 * Downloads full backup content from Supabase Storage if backupData is missing
 */
export async function downloadBackupPackage(record: CloudBackupRecord): Promise<any> {
  if (record.backupData) {
    return record.backupData;
  }

  if (record.folderPath) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .download(record.folderPath);

      if (!error && data) {
        const text = await data.text();
        return JSON.parse(text);
      }
    } catch (e) {
      console.error('Error downloading from Supabase Storage:', e);
    }
  }

  throw new Error('محتوای فایل پشتیبان یافت نشد.');
}

/**
 * Deletes a backup record from Database & Supabase Storage
 */
export async function deleteCloudBackup(backupRecord: CloudBackupRecord): Promise<void> {
  // Delete from Supabase Storage
  if (backupRecord.folderPath) {
    try {
      await supabase.storage.from(BUCKET_NAME).remove([backupRecord.folderPath]);
    } catch (e) {
      console.warn('Supabase delete error:', e);
    }
  }

  // Delete from Firestore
  try {
    await deleteDoc(doc(db, 'cloud_backups', backupRecord.id));
  } catch (e) {
    console.warn('Cloud backup delete firestore fallback:', e);
  }

  // Delete from Local DB
  await localDb.deleteDoc('cloud_backups', backupRecord.id);
}
