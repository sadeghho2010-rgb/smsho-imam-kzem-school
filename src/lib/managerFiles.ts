import { db } from './firebase';
import { collection, addDoc, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { localDb } from './localDb';
import { formatBytes, getPersianDateTime } from './cloudBackups';

export interface ManagerFileItem {
  id: string;
  title: string;
  description?: string;
  category: 'study_discussion' | 'attendance' | 'other';
  categoryLabel: string;
  targetType: 'all' | 'specific';
  targetMentorId: string; // 'all' | 'hayati' | 'hosseini' | 'soleimani'
  targetMentorName: string; // 'همه کاربران' | 'استاد حیاتی' | 'استاد حسینی' | 'استاد سلیمانی'
  fileDataUrl: string;
  fileName: string;
  fileSizeBytes: number;
  fileSizeFormatted: string;
  createdAt: string;
  persianDate: string;
  senderName: string;
}

/**
 * Uploads a file sent by Manager to Database
 */
export async function uploadManagerFile(
  fileInput: {
    title: string;
    description?: string;
    category: 'study_discussion' | 'attendance' | 'other';
    categoryLabel: string;
    targetType: 'all' | 'specific';
    targetMentorId: string;
    targetMentorName: string;
    fileDataUrl: string;
    fileName: string;
    fileSizeBytes: number;
    senderName?: string;
  }
): Promise<ManagerFileItem> {
  const now = new Date();
  const recordId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const record: ManagerFileItem = {
    id: recordId,
    title: fileInput.title.trim(),
    description: fileInput.description?.trim() || '',
    category: fileInput.category,
    categoryLabel: fileInput.categoryLabel,
    targetType: fileInput.targetType,
    targetMentorId: fileInput.targetMentorId,
    targetMentorName: fileInput.targetMentorName,
    fileDataUrl: fileInput.fileDataUrl,
    fileName: fileInput.fileName,
    fileSizeBytes: fileInput.fileSizeBytes,
    fileSizeFormatted: formatBytes(fileInput.fileSizeBytes),
    createdAt: now.toISOString(),
    persianDate: getPersianDateTime(now),
    senderName: fileInput.senderName || 'استاد شاهپوری (مدیر)'
  };

  // 1. Try saving to Firestore
  try {
    const docRef = await addDoc(collection(db, 'manager_files'), record);
    record.id = docRef.id;
  } catch (e) {
    console.warn('Firestore manager_files fallback to IndexedDB:', e);
  }

  // 2. Always store in local IndexedDB store
  await localDb.addDoc('manager_files', record);

  return record;
}

/**
 * Fetches files sent by Manager from Database
 */
export async function fetchManagerFiles(
  userMentorId?: string,
  isManager: boolean = false
): Promise<ManagerFileItem[]> {
  const allRecordsMap = new Map<string, ManagerFileItem>();

  // 1. Fetch from Firestore if online
  try {
    const colRef = collection(db, 'manager_files');
    const snapshot = await getDocs(colRef);
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as ManagerFileItem;
      allRecordsMap.set(docSnap.id, { ...data, id: docSnap.id });
    });
  } catch (e) {
    console.warn('Firestore fetch manager_files fallback to IndexedDB:', e);
  }

  // 2. Fetch from Local IndexedDB store
  try {
    const localRecords = await localDb.getDocs<ManagerFileItem>('manager_files');
    localRecords.forEach(rec => {
      if (!allRecordsMap.has(rec.id)) {
        allRecordsMap.set(rec.id, rec);
      }
    });
  } catch (e) {
    console.error('Error fetching local manager_files store:', e);
  }

  let list = Array.from(allRecordsMap.values());

  // Sort by created date descending (newest first)
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // If user is Manager (Shahpoori), return ALL sent files
  if (isManager) {
    return list;
  }

  // If user is a specific mentor (Hayati, Hosseini, Soleimani):
  // Show files sent to 'all' OR targeted specifically to this mentorId
  return list.filter(r => r.targetType === 'all' || r.targetMentorId === 'all' || r.targetMentorId === userMentorId);
}

/**
 * Deletes a manager file record
 */
export async function deleteManagerFile(fileId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'manager_files', fileId));
  } catch (e) {
    console.warn('Manager file delete firestore fallback:', e);
  }
  await localDb.deleteDoc('manager_files', fileId);
}
