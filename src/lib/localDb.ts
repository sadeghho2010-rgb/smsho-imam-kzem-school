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
  exportType: 'full' | 'single_student';
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
const DB_VERSION = 1;

export const COLLECTIONS = [
  'students',
  'programs',
  'enrollments',
  'research',
  'research_records',
  'conversation_archives',
  'attendance',
  'study_stats',
  'study_periods',
  'periodic_study_logs',
  'todos',
  'student_comments',
  'oral_exams',
  'settings'
] as const;

export type CollectionName = typeof COLLECTIONS[number] | string;

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

  // Get all documents from a collection
  async getDocs<T = any>(collectionName: CollectionName): Promise<T[]> {
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(resolvedCol, 'readonly');
      const store = transaction.objectStore(resolvedCol);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve((request.result || []) as T[]);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Get single document by ID
  async getDoc<T = any>(collectionName: CollectionName, id: string): Promise<T | null> {
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(resolvedCol, 'readonly');
      const store = transaction.objectStore(resolvedCol);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve((request.result as T) || null);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Add a new document (auto assigns ID if missing)
  async addDoc(collectionName: CollectionName, data: any): Promise<string> {
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();
    const id = data?.id || `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const record = { ...data, id };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(resolvedCol, 'readwrite');
      const store = transaction.objectStore(resolvedCol);
      const request = store.put(record);

      request.onsuccess = () => {
        this.notify();
        resolve(id);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Update existing document
  async updateDoc(collectionName: CollectionName, id: string, data: any): Promise<void> {
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(resolvedCol, 'readwrite');
      const store = transaction.objectStore(resolvedCol);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const existing = getReq.result || { id };
        const updated = { ...existing, ...data, id };
        const putReq = store.put(updated);
        putReq.onsuccess = () => {
          this.notify();
          resolve();
        };
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  // Delete a document
  async deleteDoc(collectionName: CollectionName, id: string): Promise<void> {
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(resolvedCol, 'readwrite');
      const store = transaction.objectStore(resolvedCol);
      const request = store.delete(id);

      request.onsuccess = () => {
        this.notify();
        resolve();
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // Clear entire collection
  async clearCollection(collectionName: CollectionName): Promise<void> {
    const resolvedCol = this.resolveCollection(collectionName as string);
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
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
    });
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
        if (!item.id) {
          item.id = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        }
        store.put(item);
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

        await Promise.all([
          this.bulkPut('students', initialStudents),
          this.bulkPut('programs', initialPrograms),
          this.bulkPut('enrollments', initialEnrollments),
          this.bulkPut('study_periods', initialStudyPeriods),
          this.bulkPut('periodic_study_logs', initialPeriodicLogs),
          this.bulkPut('student_comments', initialComments),
          this.bulkPut('oral_exams', initialOralExams),
          this.bulkPut('todos', initialTodos)
        ]);
      }
    };
  }
}

export const localDb = new LocalDatabase();
