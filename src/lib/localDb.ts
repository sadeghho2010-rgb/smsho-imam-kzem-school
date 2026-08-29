/**
 * Local Database Engine (100% Offline & Laptop Storage)
 * Uses IndexedDB with automatic schema migration and fallback.
 * All photos are stored directly in the local database as Base64 data URLs.
 */

export interface BackupMetadata {
  version: string;
  exportDate: string;
  systemName: string;
  totalCollections: number;
  totalRecords: number;
  hasPhotos: boolean;
  exportType: 'full' | 'mentor' | 'single_student';
  mentorId?: string;
  mentorName?: string;
  mentorRole?: string;
  gradeLabel?: string;
  studentId?: string;
  studentName?: string;
}

export interface FullBackupPackage {
  _meta: BackupMetadata;
  students: any[];
  programs: any[];
  enrollments: any[];
  research: any[];
  conversation_archives: any[];
  attendance: any[];
  study_stats: any[];
  study_periods: any[];
  periodic_study_logs: any[];
  todos: any[];
  student_comments: any[];
  oral_exams: any[];
}

export interface MentorBackupPackage {
  _meta: BackupMetadata;
  mentor: {
    id: string;
    name: string;
    role: string;
    gradeLabel: string;
  };
  students: any[];
  programs: any[];
  enrollments: any[];
  research: any[];
  conversation_archives: any[];
  attendance: any[];
  study_stats: any[];
  study_periods: any[];
  periodic_study_logs: any[];
  todos: any[];
  student_comments: any[];
  oral_exams: any[];
}

export interface StudentBackupPackage {
  _meta: BackupMetadata;
  student: any;
  research: any[];
  conversation_archives: any[];
  attendance: any[];
  study_stats: any[];
  periodic_study_logs: any[];
  study_periods: any[];
  student_comments: any[];
  oral_exams: any[];
  enrollments: any[];
  programs: any[];
  todos: any[];
}

const DB_NAME = 'TOLAB_OFFLINE_LOCAL_DB';
const DB_VERSION = 6;

export const COLLECTIONS = [
  'students',
  'programs',
  'enrollments',
  'research',
  'research_records',
  'research_history',
  'research_skills_def',
  'student_research_skills',
  'conversation_archives',
  'attendance',
  'study_stats',
  'study_periods',
  'periodic_study_logs',
  'todos',
  'student_comments',
  'oral_exams',
  'settings',
  'cloud_backups',
  'manager_files',
  'discussion_groups'
] as const;

export type CollectionName = typeof COLLECTIONS[number] | string;

export function normalizeNationalId(id?: any): string {
  if (!id) return '';
  const s = String(id).trim();
  return s
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    .replace(/\s+/g, '')
    .replace(/[-_]/g, '');
}

export interface DuplicateGroup {
  nationalId: string;
  students: any[];
  primaryCandidateId: string;
  totalRelatedRecords: number;
}

export interface MergeResult {
  success: boolean;
  duplicateGroupsCount: number;
  mergedStudentsCount: number;
  updatedRelatedRecordsCount: number;
  message: string;
  details: {
    nationalId: string;
    primaryStudentName: string;
    mergedNames: string[];
    removedCount: number;
  }[];
}

export function isStudentActive(val: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'object') {
    const inner = val.isActive !== undefined ? val.isActive : (val.active !== undefined ? val.active : (val.status !== undefined ? val.status : (val.IsActive !== undefined ? val.IsActive : undefined)));
    if (inner !== undefined && inner !== null) {
      return isStudentActive(inner);
    }
    if (val.status === 'فعال' || val.status === 'active') return true;
    return false;
  }
  if (val === true || val === 1 || val === '1') return true;
  if (typeof val === 'string') {
    const str = val.trim().toLowerCase();
    if (['true', '1', 'فعال', 'active', 'yes', 'بله', 'در حال تحصیل'].includes(str)) return true;
    if (['false', '0', 'غیرفعال', 'غیر فعال', 'inactive', 'no', 'خیر', 'فارغ التحصیل', 'انصرافی'].includes(str)) return false;
  }
  return Boolean(val);
}

export function normalizeStudent(item: any): any {
  if (!item || typeof item !== 'object') return item;
  const isAct = isStudentActive(item);
  return {
    ...item,
    id: item.id || `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    isActive: isAct,
    grade: item.grade ? String(item.grade).trim() : '',
    name: item.name ? String(item.name).trim() : 'نامشخص',
    createdAt: item.createdAt || new Date().toISOString()
  };
}

export function getMentorKeyForGrade(grade?: string): 'hayati' | 'hosseini' | 'soleimani' | 'asadi' | 'other' {
  if (!grade) return 'other';
  const g = String(grade).trim().toLowerCase();
  if (g.includes('10') || g.includes('۱۰') || g.includes('ده') || g.includes('دهم') || g === '10' || g === '۱۰') return 'asadi';
  if (g.includes('7') || g.includes('۷') || g.includes('هفت') || g === '7' || g === '۷') return 'hayati';
  if (g.includes('8') || g.includes('۸') || g.includes('هشت') || g === '8' || g === '۸') return 'hosseini';
  if (g.includes('9') || g.includes('۹') || g.includes('نه') || g.includes('نهم') || g === '9' || g === '۹') return 'soleimani';
  return 'other';
}

export const MENTOR_META: Record<string, { id: string; name: string; role: string; gradeLabel: string }> = {
  hayati: { id: 'hayati', name: 'استاد حیاتی', role: 'مسئول پایه ۷', gradeLabel: 'پایه ۷' },
  hosseini: { id: 'hosseini', name: 'استاد حسینی', role: 'مسئول پایه ۸', gradeLabel: 'پایه ۸' },
  soleimani: { id: 'soleimani', name: 'استاد سلیمانی', role: 'مسئول پایه ۹', gradeLabel: 'پایه ۹' },
  asadi: { id: 'asadi', name: 'استاد اسدی', role: 'مسئول پایه ۱۰', gradeLabel: 'پایه ۱۰' },
  shahpoori: { id: 'shahpoori', name: 'استاد شاهپوری', role: 'مدیر اصلی', gradeLabel: 'کل پایه‌ها' },
};

class LocalDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.initDb();
  }

  private resolveCollection(name: string): string {
    if (name === 'research_records') return 'research';
    return name;
  }

  private initDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        for (const col of COLLECTIONS) {
          const resolved = this.resolveCollection(col);
          if (!db.objectStoreNames.contains(resolved)) {
            db.createObjectStore(resolved, { keyPath: 'id' });
          }
        }
      };

      request.onsuccess = async (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
        // Check if database is empty, if so populate initial sample seed data
        await this.checkAndSeedDefaultData(db);
        // Auto-migrate and normalize any students with non-boolean isActive
        this.autoMigrateStudents(db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.dbPromise;
  }

  private async getDb(): Promise<IDBDatabase> {
    return this.initDb();
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error('LocalDb listener error:', e);
      }
    });
  }

  // LocalStorage Fallback Helpers for when IndexedDB Store does not exist
  private getLocalStorageDocs<T>(resolvedCol: string): T[] {
    try {
      const raw = localStorage.getItem(`fallback_idb_${resolvedCol}`);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  private setLocalStorageDoc(resolvedCol: string, doc: any) {
    try {
      const docs = this.getLocalStorageDocs(resolvedCol);
      const idx = docs.findIndex((d: any) => d.id === doc.id);
      if (idx >= 0) docs[idx] = doc;
      else docs.push(doc);
      localStorage.setItem(`fallback_idb_${resolvedCol}`, JSON.stringify(docs));
    } catch (e) {
      console.error('LocalStorage fallback write error:', e);
    }
  }

  private deleteLocalStorageDoc(resolvedCol: string, id: string) {
    try {
      const docs = this.getLocalStorageDocs(resolvedCol);
      const filtered = docs.filter((d: any) => d.id !== id);
      localStorage.setItem(`fallback_idb_${resolvedCol}`, JSON.stringify(filtered));
    } catch (e) {
      console.error('LocalStorage fallback delete error:', e);
    }
  }

  // Get all documents from a collection
  async getDocs<T = any>(collectionName: CollectionName): Promise<T[]> {
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();
    if (!db.objectStoreNames.contains(resolvedCol)) {
      return this.getLocalStorageDocs<T>(resolvedCol);
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(resolvedCol, 'readonly');
        const store = transaction.objectStore(resolvedCol);
        const request = store.getAll();

        request.onsuccess = () => {
          const idbResult = (request.result || []) as T[];
          const lsResult = this.getLocalStorageDocs<T>(resolvedCol);
          // Combine IDB result with any LS fallback docs
          const idSet = new Set((idbResult as any[]).map(x => x.id));
          const combined = [...idbResult];
          for (const item of lsResult as any[]) {
            if (!idSet.has(item.id)) {
              combined.push(item);
            }
          }
          resolve(combined as T[]);
        };
        request.onerror = () => {
          reject(request.error);
        };
      } catch (e) {
        console.warn(`Object store ${resolvedCol} error:`, e);
        resolve(this.getLocalStorageDocs<T>(resolvedCol));
      }
    });
  }

  // Get single document by ID
  async getDoc<T = any>(collectionName: CollectionName, id: string): Promise<T | null> {
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();
    if (!db.objectStoreNames.contains(resolvedCol)) {
      const lsDocs = this.getLocalStorageDocs<T>(resolvedCol);
      return (lsDocs as any[]).find(x => x.id === id) || null;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(resolvedCol, 'readonly');
        const store = transaction.objectStore(resolvedCol);
        const request = store.get(id);

        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result as T);
          } else {
            const lsDocs = this.getLocalStorageDocs<T>(resolvedCol);
            resolve((lsDocs as any[]).find(x => x.id === id) || null);
          }
        };
        request.onerror = () => {
          reject(request.error);
        };
      } catch (e) {
        console.warn(`Object store ${resolvedCol} error:`, e);
        const lsDocs = this.getLocalStorageDocs<T>(resolvedCol);
        resolve((lsDocs as any[]).find(x => x.id === id) || null);
      }
    });
  }

  // Add a new document (auto assigns ID if missing)
  async addDoc(collectionName: CollectionName, data: any): Promise<string> {
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();
    let record = { ...data };
    if (resolvedCol === 'students') {
      record = normalizeStudent(record);
    }
    const id = record.id || `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    record.id = id;

    if (!db.objectStoreNames.contains(resolvedCol)) {
      this.setLocalStorageDoc(resolvedCol, record);
      this.notify();
      return id;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(resolvedCol, 'readwrite');
        const store = transaction.objectStore(resolvedCol);
        const request = store.put(record);

        request.onsuccess = () => {
          this.notify();
          resolve(id);
        };
        request.onerror = () => {
          this.setLocalStorageDoc(resolvedCol, record);
          this.notify();
          resolve(id);
        };
      } catch (e) {
        console.warn(`Object store ${resolvedCol} put error:`, e);
        this.setLocalStorageDoc(resolvedCol, record);
        this.notify();
        resolve(id);
      }
    });
  }

  // Update existing document
  async updateDoc(collectionName: CollectionName, id: string, data: any): Promise<void> {
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();
    if (!db.objectStoreNames.contains(resolvedCol)) {
      this.setLocalStorageDoc(resolvedCol, { ...data, id });
      this.notify();
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(resolvedCol, 'readwrite');
        const store = transaction.objectStore(resolvedCol);
        const getReq = store.get(id);

        getReq.onsuccess = () => {
          const existing = getReq.result || { id };
          let updated = { ...existing, ...data, id };
          if (resolvedCol === 'students') {
            updated = normalizeStudent(updated);
          }
          const putReq = store.put(updated);
          putReq.onsuccess = () => {
            this.notify();
            resolve();
          };
          putReq.onerror = () => {
            this.setLocalStorageDoc(resolvedCol, updated);
            this.notify();
            resolve();
          };
        };
        getReq.onerror = () => {
          this.setLocalStorageDoc(resolvedCol, { ...data, id });
          this.notify();
          resolve();
        };
      } catch (e) {
        console.warn(`Object store ${resolvedCol} update error:`, e);
        this.setLocalStorageDoc(resolvedCol, { ...data, id });
        this.notify();
        resolve();
      }
    });
  }

  // Delete a document
  async deleteDoc(collectionName: CollectionName, id: string): Promise<void> {
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();
    this.deleteLocalStorageDoc(resolvedCol, id);

    if (!db.objectStoreNames.contains(resolvedCol)) {
      this.notify();
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(resolvedCol, 'readwrite');
        const store = transaction.objectStore(resolvedCol);
        const request = store.delete(id);

        request.onsuccess = () => {
          this.notify();
          resolve();
        };
        request.onerror = () => {
          this.notify();
          resolve();
        };
      } catch (e) {
        console.warn(`Object store ${resolvedCol} delete error:`, e);
        this.notify();
        resolve();
      }
    });
  }

  // Clear entire collection
  async clearCollection(collectionName: CollectionName): Promise<void> {
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();
    if (!db.objectStoreNames.contains(resolvedCol)) return;

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(resolvedCol, 'readwrite');
        const store = transaction.objectStore(resolvedCol);
        const request = store.clear();

        request.onsuccess = () => {
          this.notify();
          resolve();
        };
        request.onerror = () => {
          reject(request.error);
        };
      } catch (e) {
        console.warn(`Object store ${resolvedCol} clear error:`, e);
        resolve();
      }
    });
  }

  private async autoMigrateStudents(db: IDBDatabase): Promise<void> {
    try {
      if (!db.objectStoreNames.contains('students')) return;
      const transaction = db.transaction('students', 'readwrite');
      const store = transaction.objectStore('students');
      const request = store.getAll();
      request.onsuccess = () => {
        const students = request.result || [];
        let updatedCount = 0;
        for (const s of students) {
          const currentIsActive = s.isActive;
          const normalizedActive = isStudentActive(s);
          if (currentIsActive !== normalizedActive || typeof currentIsActive !== 'boolean') {
            const normalized = normalizeStudent(s);
            store.put(normalized);
            updatedCount++;
          }
        }
        if (updatedCount > 0) {
          this.notify();
        }
      };
    } catch (e) {
      console.warn('autoMigrateStudents non-fatal error:', e);
    }
  }

  // Bulk add or overwrite documents in a collection
  async bulkPut(collectionName: CollectionName, items: any[]): Promise<void> {
    if (!items || items.length === 0) return;
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(resolvedCol, 'readwrite');
      const store = transaction.objectStore(resolvedCol);

      for (const item of items) {
        let record = { ...item };
        if (resolvedCol === 'students') {
          record = normalizeStudent(record);
        } else if (!record.id) {
          record.id = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        }
        store.put(record);
      }

      transaction.oncomplete = () => {
        this.notify();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Clear all data in all collections
  async resetAllDatabase(): Promise<void> {
    for (const col of COLLECTIONS) {
      await this.clearCollection(col);
    }
    this.notify();
  }

  // ==========================================
  // BACKUP & RESTORE FUNCTIONALITY
  // ==========================================

  // Export full database backup (including all Base64 photos)
  async exportFullBackup(): Promise<FullBackupPackage> {
    const [
      students,
      programs,
      enrollments,
      research,
      conversation_archives,
      attendance,
      study_stats,
      study_periods,
      periodic_study_logs,
      todos,
      student_comments,
      oral_exams
    ] = await Promise.all([
      this.getDocs('students'),
      this.getDocs('programs'),
      this.getDocs('enrollments'),
      this.getDocs('research'),
      this.getDocs('conversation_archives'),
      this.getDocs('attendance'),
      this.getDocs('study_stats'),
      this.getDocs('study_periods'),
      this.getDocs('periodic_study_logs'),
      this.getDocs('todos'),
      this.getDocs('student_comments'),
      this.getDocs('oral_exams')
    ]);

    const totalRecords =
      students.length +
      programs.length +
      enrollments.length +
      research.length +
      conversation_archives.length +
      attendance.length +
      study_stats.length +
      study_periods.length +
      periodic_study_logs.length +
      todos.length +
      student_comments.length +
      oral_exams.length;

    const hasPhotos = students.some((s) => !!s.photoUrl);

    const backupPackage: FullBackupPackage = {
      _meta: {
        version: '2.0.0-offline',
        exportDate: new Date().toISOString(),
        systemName: 'سیستم جامع مدیریت طلاب (آفلاین)',
        totalCollections: 12,
        totalRecords,
        hasPhotos,
        exportType: 'full'
      },
      students,
      programs,
      enrollments,
      research,
      conversation_archives,
      attendance,
      study_stats,
      study_periods,
      periodic_study_logs,
      todos,
      student_comments,
      oral_exams
    };

    return backupPackage;
  }

  // Export individual mentor/professor backup (e.g. استاد حسینی، استاد حیاتی، استاد سلیمانی، استاد شاهپوری)
  async exportMentorBackup(mentorId: string): Promise<MentorBackupPackage> {
    const meta = MENTOR_META[mentorId] || {
      id: mentorId,
      name: mentorId === 'shahpoori' ? 'استاد شاهپوری' : `استاد ${mentorId}`,
      role: 'مسئول پایه',
      gradeLabel: 'پایه مربوطه'
    };

    const allStudents = await this.getDocs('students');
    const mentorStudents = allStudents.filter((s) => {
      if (mentorId === 'shahpoori') return true;
      const key = getMentorKeyForGrade(s.grade);
      return key === mentorId;
    });

    const studentIds = new Set(mentorStudents.map((s) => s.id));

    const [
      allResearch,
      allArchives,
      allAttendance,
      allStats,
      allPeriodicLogs,
      allPeriods,
      allComments,
      allExams,
      allEnrollments,
      allPrograms,
      allTodos
    ] = await Promise.all([
      this.getDocs('research'),
      this.getDocs('conversation_archives'),
      this.getDocs('attendance'),
      this.getDocs('study_stats'),
      this.getDocs('periodic_study_logs'),
      this.getDocs('study_periods'),
      this.getDocs('student_comments'),
      this.getDocs('oral_exams'),
      this.getDocs('enrollments'),
      this.getDocs('programs'),
      this.getDocs('todos')
    ]);

    const mentorResearch = allResearch.filter((r) => studentIds.has(r.studentId));
    const mentorArchives = allArchives.filter((a) => studentIds.has(a.studentId));
    const mentorAttendance = allAttendance.filter((a) => studentIds.has(a.studentId));
    const mentorStats = allStats.filter((s) => studentIds.has(s.studentId));
    const mentorPeriodicLogs = allPeriodicLogs.filter((p) => studentIds.has(p.studentId));
    const relevantPeriodIds = new Set(mentorPeriodicLogs.map((p) => p.periodId));
    const mentorPeriods = allPeriods.filter((p) => relevantPeriodIds.has(p.id));
    const mentorComments = allComments.filter((c) => studentIds.has(c.studentId));
    const mentorExams = allExams.filter((e) => studentIds.has(e.studentId));
    const mentorEnrollments = allEnrollments.filter((e) => studentIds.has(e.studentId));
    const relevantProgramIds = new Set(mentorEnrollments.map((e) => e.programId));
    const mentorPrograms = allPrograms.filter((p) => relevantProgramIds.has(p.id));
    const mentorTodos = allTodos.filter((t) => studentIds.has(t.studentId));

    const totalRecords =
      mentorStudents.length +
      mentorResearch.length +
      mentorArchives.length +
      mentorAttendance.length +
      mentorStats.length +
      mentorPeriodicLogs.length +
      mentorPeriods.length +
      mentorComments.length +
      mentorExams.length +
      mentorEnrollments.length +
      mentorPrograms.length +
      mentorTodos.length;

    const hasPhotos = mentorStudents.some((s) => !!s.photoUrl);

    const backupPackage: MentorBackupPackage = {
      _meta: {
        version: '2.0.0-offline',
        exportDate: new Date().toISOString(),
        systemName: 'سیستم جامع مدیریت طلاب (آفلاین)',
        totalCollections: 12,
        totalRecords,
        hasPhotos,
        exportType: 'mentor',
        mentorId: meta.id,
        mentorName: meta.name,
        mentorRole: meta.role,
        gradeLabel: meta.gradeLabel
      },
      mentor: meta,
      students: mentorStudents,
      programs: mentorPrograms,
      enrollments: mentorEnrollments,
      research: mentorResearch,
      conversation_archives: mentorArchives,
      attendance: mentorAttendance,
      study_stats: mentorStats,
      study_periods: mentorPeriods,
      periodic_study_logs: mentorPeriodicLogs,
      todos: mentorTodos,
      student_comments: mentorComments,
      oral_exams: mentorExams
    };

    return backupPackage;
  }

  // Export individual student backup
  async exportStudentBackup(studentId: string): Promise<StudentBackupPackage> {
    const student = await this.getDoc('students', studentId);
    if (!student) {
      throw new Error(`طلبه با شناسه ${studentId} یافت نشد.`);
    }

    const [
      allResearch,
      allArchives,
      allAttendance,
      allStats,
      allPeriodicLogs,
      allPeriods,
      allComments,
      allExams,
      allEnrollments,
      allPrograms,
      allTodos
    ] = await Promise.all([
      this.getDocs('research'),
      this.getDocs('conversation_archives'),
      this.getDocs('attendance'),
      this.getDocs('study_stats'),
      this.getDocs('periodic_study_logs'),
      this.getDocs('study_periods'),
      this.getDocs('student_comments'),
      this.getDocs('oral_exams'),
      this.getDocs('enrollments'),
      this.getDocs('programs'),
      this.getDocs('todos')
    ]);

    const studentResearch = allResearch.filter((r) => r.studentId === studentId);
    const studentArchives = allArchives.filter((a) => a.studentId === studentId);
    const studentAttendance = allAttendance.filter((a) => a.studentId === studentId);
    const studentStats = allStats.filter((s) => s.studentId === studentId);
    const studentPeriodicLogs = allPeriodicLogs.filter((p) => p.studentId === studentId);
    const relevantPeriodIds = new Set(studentPeriodicLogs.map((p) => p.periodId));
    const studentPeriods = allPeriods.filter((p) => relevantPeriodIds.has(p.id));
    const studentComments = allComments.filter((c) => c.studentId === studentId);
    const studentExams = allExams.filter((e) => e.studentId === studentId);
    const studentEnrollments = allEnrollments.filter((e) => e.studentId === studentId);
    const relevantProgramIds = new Set(studentEnrollments.map((e) => e.programId));
    const studentPrograms = allPrograms.filter((p) => relevantProgramIds.has(p.id));
    const studentTodos = allTodos.filter((t) => t.studentId === studentId);

    const totalRecords =
      1 +
      studentResearch.length +
      studentArchives.length +
      studentAttendance.length +
      studentStats.length +
      studentPeriodicLogs.length +
      studentPeriods.length +
      studentComments.length +
      studentExams.length +
      studentEnrollments.length +
      studentPrograms.length +
      studentTodos.length;

    const backupPackage: StudentBackupPackage = {
      _meta: {
        version: '2.0.0-offline',
        exportDate: new Date().toISOString(),
        systemName: 'سیستم جامع مدیریت طلاب (آفلاین)',
        totalCollections: 12,
        totalRecords,
        hasPhotos: !!student.photoUrl,
        exportType: 'single_student',
        studentId: student.id,
        studentName: student.name
      },
      student,
      research: studentResearch,
      conversation_archives: studentArchives,
      attendance: studentAttendance,
      study_stats: studentStats,
      periodic_study_logs: studentPeriodicLogs,
      study_periods: studentPeriods,
      student_comments: studentComments,
      oral_exams: studentExams,
      enrollments: studentEnrollments,
      programs: studentPrograms,
      todos: studentTodos
    };

    return backupPackage;
  }

  // Restore full backup into local database
  async restoreFullBackup(
    backupData: FullBackupPackage,
    mode: 'overwrite' | 'merge' = 'overwrite'
  ): Promise<{ success: boolean; message: string; counts: Record<string, number> }> {
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('فرمت فایل پشتیبان نامعتبر است.');
    }

    if (mode === 'overwrite') {
      await this.resetAllDatabase();
    }

    const counts: Record<string, number> = {};

    const collectionsToRestore: CollectionName[] = [
      'students',
      'programs',
      'enrollments',
      'research',
      'conversation_archives',
      'attendance',
      'study_stats',
      'study_periods',
      'periodic_study_logs',
      'todos',
      'student_comments',
      'oral_exams'
    ];

    for (const col of collectionsToRestore) {
      const items = (backupData as any)[col];
      if (Array.isArray(items) && items.length > 0) {
        await this.bulkPut(col, items);
        counts[col] = items.length;
      } else {
        counts[col] = 0;
      }
    }

    this.notify();
    return {
      success: true,
      message: `بازیابی کامل اطلاعات با موفقیت انجام شد (${mode === 'overwrite' ? 'جایگزینی کل داده‌ها' : 'ادغام با داده‌های موجود'}).`,
      counts
    };
  }

  async importFullBackup(
    backupData: any,
    mode: 'overwrite' | 'merge' = 'merge'
  ): Promise<any> {
    if (backupData?.data && typeof backupData.data === 'object' && !backupData.students) {
      // Legacy format where data is inside backupData.data
      const dataMap = backupData.data;
      for (const [col, items] of Object.entries(dataMap)) {
        if (Array.isArray(items)) {
          await this.bulkPut(col as CollectionName, items);
        }
      }
      this.notify();
      return { success: true, message: 'داده‌ها با موفقیت بازیابی شدند.' };
    }
    return this.restoreFullBackup(backupData, mode);
  }

  // Restore individual mentor/user backup
  async restoreMentorBackup(
    backupData: MentorBackupPackage,
    mode: 'overwrite' | 'merge' = 'merge'
  ): Promise<{ success: boolean; mentorName: string; studentCount: number; message: string; counts: Record<string, number> }> {
    if (!backupData || !backupData.mentor || !Array.isArray(backupData.students)) {
      throw new Error('فایل پشتیبان کاربر/استاد نامعتبر است.');
    }

    const mentorId = backupData.mentor.id;
    const incomingStudentIds = new Set(backupData.students.map((s) => s.id));

    if (mode === 'overwrite') {
      // Find existing students for this mentor's grade and clear their data
      const allStudents = await this.getDocs('students');
      const studentsToRemove = allStudents.filter((s) => {
        if (mentorId === 'shahpoori') return true;
        const key = getMentorKeyForGrade(s.grade);
        return key === mentorId;
      });
      const removeIds = new Set(studentsToRemove.map((s) => s.id));

      const cols: CollectionName[] = [
        'research',
        'conversation_archives',
        'attendance',
        'study_stats',
        'periodic_study_logs',
        'student_comments',
        'oral_exams',
        'enrollments',
        'todos'
      ];

      for (const col of cols) {
        const records = await this.getDocs(col);
        const toDelete = records.filter((r: any) => removeIds.has(r.studentId));
        for (const item of toDelete) {
          await this.deleteDoc(col, item.id);
        }
      }

      for (const s of studentsToRemove) {
        await this.deleteDoc('students', s.id);
      }
    }

    const counts: Record<string, number> = {};

    const collectionsToRestore: (keyof MentorBackupPackage)[] = [
      'students',
      'programs',
      'enrollments',
      'research',
      'conversation_archives',
      'attendance',
      'study_stats',
      'study_periods',
      'periodic_study_logs',
      'todos',
      'student_comments',
      'oral_exams'
    ];

    for (const key of collectionsToRestore) {
      const items = backupData[key] as any[];
      if (Array.isArray(items) && items.length > 0) {
        await this.bulkPut(key as CollectionName, items);
        counts[key] = items.length;
      } else {
        counts[key] = 0;
      }
    }

    this.notify();
    return {
      success: true,
      mentorName: backupData.mentor.name || 'استاد',
      studentCount: backupData.students.length,
      message: `اطلاعات و پرونده‌های ${backupData.mentor.name} (${backupData.mentor.role}) با موفقیت بازیابی شد (${backupData.students.length} طلبه).`,
      counts
    };
  }

  // Universal Restore handler that detects package type
  async restoreAnyBackup(
    backupData: any,
    mode: 'overwrite' | 'merge' = 'merge'
  ): Promise<{ success: boolean; message: string; type: string; details?: any }> {
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('فرمت فایل پشتیبان نامعتبر است.');
    }

    // 1. Check if it's single student backup
    if (backupData._meta?.exportType === 'single_student' || (backupData.student && backupData.student.name)) {
      const res = await this.restoreStudentBackup(backupData, mode);
      return {
        success: true,
        type: 'student',
        message: `پرونده طلبه «${res.studentName}» با موفقیت بازیابی شد.`,
        details: res
      };
    }

    // 2. Check if it's mentor/user backup
    if (backupData._meta?.exportType === 'mentor' || (backupData.mentor && Array.isArray(backupData.students))) {
      const res = await this.restoreMentorBackup(backupData, mode);
      return {
        success: true,
        type: 'mentor',
        message: res.message,
        details: res
      };
    }

    // 3. Fallback to Full Backup
    const res = await this.restoreFullBackup(backupData, mode);
    return {
      success: true,
      type: 'full',
      message: res.message,
      details: res
    };
  }

  // Restore single student backup into local database
  async restoreStudentBackup(
    backupData: StudentBackupPackage,
    mode: 'overwrite' | 'merge' = 'merge'
  ): Promise<{ success: boolean; studentName: string; counts: Record<string, number> }> {
    if (!backupData || !backupData.student || !backupData.student.name) {
      throw new Error('فایل پشتیبان پرونده طلبه نامعتبر است.');
    }

    const student = backupData.student;
    const studentId = student.id;

    if (mode === 'overwrite') {
      // Remove any existing records of this student before importing
      const studentCols: CollectionName[] = [
        'research',
        'conversation_archives',
        'attendance',
        'study_stats',
        'periodic_study_logs',
        'student_comments',
        'oral_exams',
        'enrollments',
        'todos'
      ];

      for (const col of studentCols) {
        const records = await this.getDocs(col);
        const toDelete = records.filter((r: any) => r.studentId === studentId);
        for (const item of toDelete) {
          await this.deleteDoc(col, item.id);
        }
      }
    }

    // Save student
    await this.addDoc('students', student);

    const counts: Record<string, number> = { students: 1 };

    // Restore related arrays
    const subMappings: { key: keyof StudentBackupPackage; col: CollectionName }[] = [
      { key: 'research', col: 'research' },
      { key: 'conversation_archives', col: 'conversation_archives' },
      { key: 'attendance', col: 'attendance' },
      { key: 'study_stats', col: 'study_stats' },
      { key: 'periodic_study_logs', col: 'periodic_study_logs' },
      { key: 'study_periods', col: 'study_periods' },
      { key: 'student_comments', col: 'student_comments' },
      { key: 'oral_exams', col: 'oral_exams' },
      { key: 'enrollments', col: 'enrollments' },
      { key: 'programs', col: 'programs' },
      { key: 'todos', col: 'todos' }
    ];

    for (const mapping of subMappings) {
      const items = backupData[mapping.key] as any[];
      if (Array.isArray(items) && items.length > 0) {
        await this.bulkPut(mapping.col, items);
        counts[mapping.col] = items.length;
      }
    }

    this.notify();
    return {
      success: true,
      studentName: student.name,
      counts
    };
  }

  // Scan database to find duplicate students based on nationalId
  async scanDuplicateStudents(): Promise<DuplicateGroup[]> {
    const allStudents = await this.getDocs<any>('students');
    const [
      enrollments,
      research,
      conversations,
      attendance,
      studyStats,
      studyLogs,
      todos,
      comments,
      oralExams
    ] = await Promise.all([
      this.getDocs('enrollments'),
      this.getDocs('research'),
      this.getDocs('conversation_archives'),
      this.getDocs('attendance'),
      this.getDocs('study_stats'),
      this.getDocs('periodic_study_logs'),
      this.getDocs('todos'),
      this.getDocs('student_comments'),
      this.getDocs('oral_exams')
    ]);

    // Group by normalized nationalId
    const groupsMap = new Map<string, any[]>();
    for (const s of allStudents) {
      const normNId = normalizeNationalId(s.nationalId);
      if (!normNId || normNId.length < 3) continue; // Only consider valid non-empty national IDs
      if (!groupsMap.has(normNId)) {
        groupsMap.set(normNId, []);
      }
      groupsMap.get(normNId)!.push(s);
    }

    const duplicateGroups: DuplicateGroup[] = [];
    for (const [nationalId, list] of groupsMap.entries()) {
      if (list.length > 1) {
        // Score each candidate to pick the best primary record
        const scored = list.map((s) => {
          let score = 0;
          if (s.photoUrl && s.photoUrl.length > 50) score += 50;
          if (s.name && s.name.trim() !== 'نامشخص') score += 10;
          if (s.phoneNumber) score += 5;
          if (s.grade) score += 5;
          if (s.fatherOccupation) score += 2;
          if (s.birthDate) score += 2;
          if (s.classicEducation) score += 2;
          if (s.levelOneSchool) score += 2;
          if (isStudentActive(s)) score += 10;

          const relCount =
            enrollments.filter((e: any) => e.studentId === s.id).length +
            research.filter((r: any) => r.studentId === s.id || (r.teamMemberIds && r.teamMemberIds.includes(s.id))).length +
            conversations.filter((c: any) => c.studentId === s.id).length +
            attendance.filter((a: any) => a.studentId === s.id).length +
            studyStats.filter((st: any) => st.studentId === s.id).length +
            studyLogs.filter((sl: any) => sl.studentId === s.id).length +
            todos.filter((t: any) => t.studentId === s.id).length +
            comments.filter((cm: any) => cm.studentId === s.id).length +
            oralExams.filter((ox: any) => ox.studentId === s.id).length;

          score += relCount * 5;

          return { student: s, score, relCount };
        });

        scored.sort((a, b) => b.score - a.score);
        const primaryCandidateId = scored[0].student.id;
        const totalRelatedRecords = scored.reduce((acc, curr) => acc + curr.relCount, 0);

        duplicateGroups.push({
          nationalId,
          students: list,
          primaryCandidateId,
          totalRelatedRecords
        });
      }
    }

    return duplicateGroups;
  }

  // Merges all duplicate students into a primary record and re-assigns all related data before deleting duplicate records
  async mergeAndDeduplicateStudents(): Promise<MergeResult> {
    const groups = await this.scanDuplicateStudents();
    if (groups.length === 0) {
      return {
        success: true,
        duplicateGroupsCount: 0,
        mergedStudentsCount: 0,
        updatedRelatedRecordsCount: 0,
        message: 'هیچ کاربر تکراری با کد ملی مشابه در سامانه یافت نشد. کلیه پرونده‌ها یکتا هستند.',
        details: []
      };
    }

    const [
      enrollments,
      research,
      conversations,
      attendance,
      studyStats,
      studyLogs,
      todos,
      comments,
      oralExams
    ] = await Promise.all([
      this.getDocs('enrollments'),
      this.getDocs('research'),
      this.getDocs('conversation_archives'),
      this.getDocs('attendance'),
      this.getDocs('study_stats'),
      this.getDocs('periodic_study_logs'),
      this.getDocs('todos'),
      this.getDocs('student_comments'),
      this.getDocs('oral_exams')
    ]);

    let totalMergedCount = 0;
    let totalRelatedUpdated = 0;
    const details: MergeResult['details'] = [];

    for (const grp of groups) {
      const primary = grp.students.find((s) => s.id === grp.primaryCandidateId) || grp.students[0];
      const secondaries = grp.students.filter((s) => s.id !== primary.id);
      const secondaryIds = new Set(secondaries.map((s) => s.id));

      // 1. Merge Profile Data into Primary Record so that NO profile fields are lost
      const mergedStudent: any = { ...primary };

      for (const sec of secondaries) {
        if (!mergedStudent.photoUrl && sec.photoUrl) mergedStudent.photoUrl = sec.photoUrl;
        if ((!mergedStudent.name || mergedStudent.name === 'نامشخص') && sec.name) mergedStudent.name = sec.name;
        else if (sec.name && sec.name.length > (mergedStudent.name?.length || 0)) mergedStudent.name = sec.name;

        if (!mergedStudent.phoneNumber && sec.phoneNumber) mergedStudent.phoneNumber = sec.phoneNumber;
        if (!mergedStudent.grade && sec.grade) mergedStudent.grade = sec.grade;
        if (!mergedStudent.fatherOccupation && sec.fatherOccupation) mergedStudent.fatherOccupation = sec.fatherOccupation;
        if (!mergedStudent.birthPlace && sec.birthPlace) mergedStudent.birthPlace = sec.birthPlace;
        if (!mergedStudent.birthDate && sec.birthDate) mergedStudent.birthDate = sec.birthDate;
        if ((!mergedStudent.maritalStatus || mergedStudent.maritalStatus === 'مجرد') && sec.maritalStatus === 'متاهل') {
          mergedStudent.maritalStatus = 'متاهل';
        }
        if ((sec.childrenCount || 0) > (mergedStudent.childrenCount || 0)) {
          mergedStudent.childrenCount = sec.childrenCount;
        }
        if ((!mergedStudent.livingStatus || mergedStudent.livingStatus === 'پدری') && sec.livingStatus && sec.livingStatus !== 'پدری') {
          mergedStudent.livingStatus = sec.livingStatus;
        }
        if (!mergedStudent.livingStatusOther && sec.livingStatusOther) mergedStudent.livingStatusOther = sec.livingStatusOther;
        if (!mergedStudent.classicEducation && sec.classicEducation) mergedStudent.classicEducation = sec.classicEducation;
        if (!mergedStudent.howzaEntryYear && sec.howzaEntryYear) mergedStudent.howzaEntryYear = sec.howzaEntryYear;
        if (!mergedStudent.levelOneSchool && sec.levelOneSchool) mergedStudent.levelOneSchool = sec.levelOneSchool;
        if ((!mergedStudent.tammomStatus || mergedStudent.tammomStatus === 'غیر معمم') && sec.tammomStatus === 'معمم') {
          mergedStudent.tammomStatus = 'معمم';
        }
        if (isStudentActive(sec) || isStudentActive(mergedStudent)) {
          mergedStudent.isActive = true;
        }
        if (sec.createdAt && mergedStudent.createdAt && new Date(sec.createdAt) < new Date(mergedStudent.createdAt)) {
          mergedStudent.createdAt = sec.createdAt;
        }
      }

      // Save updated merged primary student
      await this.updateDoc('students', primary.id, mergedStudent);

      // 2. Re-assign and merge all related records across every collection in the software

      // A. Enrollments
      const primaryEnrollmentProgramIds = new Set(
        enrollments.filter((e: any) => e.studentId === primary.id).map((e: any) => e.programId)
      );
      for (const e of enrollments) {
        if (secondaryIds.has(e.studentId)) {
          if (primaryEnrollmentProgramIds.has(e.programId)) {
            // Already enrolled, delete duplicate enrollment
            await this.deleteDoc('enrollments', e.id);
          } else {
            await this.updateDoc('enrollments', e.id, { studentId: primary.id });
            primaryEnrollmentProgramIds.add(e.programId);
            totalRelatedUpdated++;
          }
        }
      }

      // B. Research & Research Records
      for (const r of research) {
        let changed = false;
        const updates: any = {};
        if (secondaryIds.has(r.studentId)) {
          updates.studentId = primary.id;
          changed = true;
        }
        if (Array.isArray(r.teamMemberIds)) {
          const newTeamIds = Array.from(new Set(r.teamMemberIds.map((mId: string) => secondaryIds.has(mId) ? primary.id : mId)));
          if (JSON.stringify(newTeamIds) !== JSON.stringify(r.teamMemberIds)) {
            updates.teamMemberIds = newTeamIds;
            changed = true;
          }
        }
        if (changed) {
          await this.updateDoc('research', r.id, updates);
          totalRelatedUpdated++;
        }
      }

      // C. Conversation Archives
      for (const c of conversations) {
        if (secondaryIds.has(c.studentId)) {
          await this.updateDoc('conversation_archives', c.id, { studentId: primary.id });
          totalRelatedUpdated++;
        }
      }

      // D. Attendance
      const primaryAttendanceDates = new Set(
        attendance.filter((a: any) => a.studentId === primary.id).map((a: any) => a.date)
      );
      for (const a of attendance) {
        if (secondaryIds.has(a.studentId)) {
          if (primaryAttendanceDates.has(a.date)) {
            // Duplicate date attendance, remove duplicate
            await this.deleteDoc('attendance', a.id);
          } else {
            await this.updateDoc('attendance', a.id, { studentId: primary.id });
            primaryAttendanceDates.add(a.date);
            totalRelatedUpdated++;
          }
        }
      }

      // E. Study Stats
      const primaryStudyStatDates = new Set(
        studyStats.filter((st: any) => st.studentId === primary.id).map((st: any) => st.date)
      );
      for (const st of studyStats) {
        if (secondaryIds.has(st.studentId)) {
          if (primaryStudyStatDates.has(st.date)) {
            await this.deleteDoc('study_stats', st.id);
          } else {
            await this.updateDoc('study_stats', st.id, { studentId: primary.id });
            primaryStudyStatDates.add(st.date);
            totalRelatedUpdated++;
          }
        }
      }

      // F. Periodic Study Logs
      const primaryPeriodLogs = new Set(
        studyLogs.filter((sl: any) => sl.studentId === primary.id).map((sl: any) => sl.periodId)
      );
      for (const sl of studyLogs) {
        if (secondaryIds.has(sl.studentId)) {
          if (primaryPeriodLogs.has(sl.periodId)) {
            await this.deleteDoc('periodic_study_logs', sl.id);
          } else {
            await this.updateDoc('periodic_study_logs', sl.id, { studentId: primary.id });
            primaryPeriodLogs.add(sl.periodId);
            totalRelatedUpdated++;
          }
        }
      }

      // G. Todos
      for (const t of todos) {
        if (t.studentId && secondaryIds.has(t.studentId)) {
          await this.updateDoc('todos', t.id, { studentId: primary.id });
          totalRelatedUpdated++;
        }
      }

      // H. Student Comments
      for (const cm of comments) {
        if (secondaryIds.has(cm.studentId)) {
          await this.updateDoc('student_comments', cm.id, { studentId: primary.id });
          totalRelatedUpdated++;
        }
      }

      // I. Oral Exams
      for (const ox of oralExams) {
        if (secondaryIds.has(ox.studentId)) {
          await this.updateDoc('oral_exams', ox.id, { studentId: primary.id });
          totalRelatedUpdated++;
        }
      }

      // 3. Delete secondary duplicate students safely after all data has been merged
      for (const sec of secondaries) {
        await this.deleteDoc('students', sec.id);
        totalMergedCount++;
      }

      details.push({
        nationalId: grp.nationalId,
        primaryStudentName: mergedStudent.name,
        mergedNames: grp.students.map((s) => s.name),
        removedCount: secondaries.length
      });
    }

    this.notify();

    return {
      success: true,
      duplicateGroupsCount: groups.length,
      mergedStudentsCount: totalMergedCount,
      updatedRelatedRecordsCount: totalRelatedUpdated,
      message: `فرآیند ادغام با موفقیت انجام شد: تعداد ${totalMergedCount} پرونده تکراری شناسایی و ادغام شد و تمامی سوابق تحصیلی، پژوهشی و نمرات (${totalRelatedUpdated} رکورد) به پرونده اصلی منتقل گردید.`,
      details
    };
  }

  // Get statistics on database size and photos
  async getStorageStats(): Promise<{
    totalStudents: number;
    totalActiveStudents: number;
    totalPhotos: number;
    photosSizeEstimateKB: number;
    collectionCounts: Record<string, number>;
  }> {
    const students = await this.getDocs('students');
    let totalPhotos = 0;
    let photosSizeEstimateBytes = 0;

    for (const s of students) {
      if (s.photoUrl && s.photoUrl.startsWith('data:')) {
        totalPhotos++;
        photosSizeEstimateBytes += s.photoUrl.length;
      }
    }

    const collectionCounts: Record<string, number> = {
      students: students.length
    };

    for (const col of COLLECTIONS) {
      if (col !== 'students') {
        const items = await this.getDocs(col);
        collectionCounts[col] = items.length;
      }
    }

    return {
      totalStudents: students.length,
      totalActiveStudents: students.filter((s) => s.isActive).length,
      totalPhotos,
      photosSizeEstimateKB: Math.round(photosSizeEstimateBytes / 1024),
      collectionCounts
    };
  }

  // Seed default data if database is empty
  private async checkAndSeedDefaultData(db: IDBDatabase) {
    try {
      if (!db.objectStoreNames.contains('students')) return;
      const transaction = db.transaction('students', 'readonly');
      const store = transaction.objectStore('students');
      const countReq = store.count();

      countReq.onsuccess = async () => {
        if (countReq.result === 0) {
          console.log('Local Database is empty. Seeding initial baseline data...');
          const initialStudents = [
          {
            id: 'stu_1',
            name: 'محمد رضایی',
            grade: 'پایه ۷',
            nationalId: '0012345678',
            phoneNumber: '09121111111',
            isActive: true,
            maritalStatus: 'مجرد',
            livingStatus: 'خوابگاه',
            classicEducation: 'دیپلم ریاضی',
            howzaEntryYear: '1400',
            levelOneSchool: 'مدرسه معصومیه',
            tammomStatus: 'غیر معمم',
            createdAt: new Date().toISOString()
          },
          {
            id: 'stu_2',
            name: 'علی حسینی',
            grade: 'پایه ۸',
            nationalId: '0023456789',
            phoneNumber: '09122222222',
            isActive: true,
            maritalStatus: 'متاهل',
            childrenCount: 1,
            livingStatus: 'اجاره ای',
            classicEducation: 'کارشناسی ادبیات',
            howzaEntryYear: '1399',
            levelOneSchool: 'مدرسه حقانی',
            tammomStatus: 'معمم',
            createdAt: new Date().toISOString()
          },
          {
            id: 'stu_3',
            name: 'حسین سلیمانی',
            grade: 'پایه ۹',
            nationalId: '0034567890',
            phoneNumber: '09123333333',
            isActive: true,
            maritalStatus: 'مجرد',
            livingStatus: 'پدری',
            classicEducation: 'دیپلم علوم انسانی',
            howzaEntryYear: '1398',
            levelOneSchool: 'مدرسه شهیدین',
            tammomStatus: 'غیر معمم',
            createdAt: new Date().toISOString()
          }
        ];

        const initialPrograms = [
          {
            id: 'prog_1',
            title: 'درس خارج فقه و اصول',
            type: 'اصلی',
            day: 'شنبه تا چهارشنبه',
            time: '08:00 - 09:30',
            teacher: 'استاد حسینی'
          },
          {
            id: 'prog_2',
            title: 'کارگاه روش تحقیق و مقاله‌نویسی',
            type: 'پژوهش',
            day: 'پنج‌شنبه',
            time: '10:00 - 11:30',
            teacher: 'استاد حیاتی'
          }
        ];

        const initialEnrollments = [
          { id: 'enr_1', studentId: 'stu_1', programId: 'prog_1' },
          { id: 'enr_2', studentId: 'stu_1', programId: 'prog_2' },
          { id: 'enr_3', studentId: 'stu_2', programId: 'prog_1' }
        ];

        const initialStudyPeriods = [
          {
            id: 'period_1',
            title: 'دوره مطالعه آبان و آذر',
            startDate: '1403/08/01',
            endDate: '1403/09/30',
            mandatoryHours: 80,
            createdAt: new Date().toISOString()
          }
        ];

        const initialPeriodicLogs = [
          { id: 'log_1', periodId: 'period_1', studentId: 'stu_1', hours: 75 },
          { id: 'log_2', periodId: 'period_1', studentId: 'stu_2', hours: 88 },
          { id: 'log_3', periodId: 'period_1', studentId: 'stu_3', hours: 62 }
        ];

        const initialComments = [
          {
            id: 'com_1',
            studentId: 'stu_1',
            authorName: 'استاد حیاتی',
            category: 'علمی',
            content: 'پیشرفت بسیار خوبی در مباحث مکاسب داشته است و منظم در کلاس شرکت می‌کند.',
            priority: 'high',
            date: '1403/08/15',
            createdAt: new Date().toISOString()
          }
        ];

        const initialOralExams = [
          {
            id: 'exam_1',
            studentId: 'stu_1',
            title: 'فقه پایه ۷ (مکاسب)',
            subjectType: 'فقه',
            score: 18.5,
            examinerName: 'استاد ممتحن فقه',
            date: '1403/08/10',
            isRetake: false,
            createdAt: new Date().toISOString()
          }
        ];

        const initialTodos = [
          {
            id: 'todo_1',
            studentId: 'stu_1',
            title: 'بررسی پیش‌نویس مقاله پژوهشی طلبه محمد رضایی',
            completed: false,
            dueDate: '1403/09/01',
            createdAt: new Date().toISOString()
          }
        ];

        const initialDiscussionGroups = [
          {
            id: 'group_1',
            title: 'گروه مباحثه مکاسب و اصول',
            subject: 'فقه و اصول',
            grade: 'پایه ۷',
            mentorId: 'hayati',
            memberStudentIds: ['stu_1'],
            externalMembers: ['طلبه کاظمی (سایر - خارج از مدرسه)'],
            description: 'مباحثه روزانه کتاب مکاسب بعد از درس اصلی',
            createdAt: new Date().toISOString()
          },
          {
            id: 'group_2',
            title: 'گروه مباحثه رسائل و حلقه ثالثه',
            subject: 'اصول فقه',
            grade: 'پایه ۸',
            mentorId: 'hosseini',
            memberStudentIds: ['stu_2'],
            externalMembers: ['طلبه حسینی (سایر)'],
            description: 'مباحثه تخصصی مباحث الفاظ و حجج',
            createdAt: new Date().toISOString()
          }
        ];

        await Promise.all([
          this.bulkPut('students', initialStudents),
          this.bulkPut('programs', initialPrograms),
          this.bulkPut('enrollments', initialEnrollments),
          this.bulkPut('study_periods', initialStudyPeriods),
          this.bulkPut('periodic_study_logs', initialPeriodicLogs),
          this.bulkPut('student_comments', initialComments),
          this.bulkPut('oral_exams', initialOralExams),
          this.bulkPut('todos', initialTodos),
          this.bulkPut('discussion_groups', initialDiscussionGroups)
        ]);
      }
    };
    } catch (e) {
      console.warn('Seed data check error:', e);
    }
  }
}

export const localDb = new LocalDatabase();
