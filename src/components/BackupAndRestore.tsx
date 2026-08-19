import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Upload,
  Database,
  HardDrive,
  Users,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Info,
  Layers,
  ArrowDownToLine,
  Search,
  Check,
  X,
  Lock,
  Unlock,
  Eye,
  CloudUpload,
  CloudDownload,
  History,
  KeyRound,
  FileText
} from 'lucide-react';
import { localDb, getMentorKeyForGrade } from '../lib/localDb';
import { Student } from '../types';
import { useMentor, MentorId, MENTORS } from '../context/MentorContext';
import {
  CloudBackupRecord,
  uploadBackupToCloud,
  fetchCloudBackups,
  deleteCloudBackup,
  downloadBackupPackage,
  generateBackupFilename,
  getPersianDateTime
} from '../lib/cloudBackups';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const REQUIRED_PASSWORD = '8411924';

interface MentorStats {
  id: MentorId;
  name: string;
  role: string;
  gradeLabel: string;
  avatarBg: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  studentCount: number;
  photoCount: number;
  lastBackupDate?: string;
}

export default function BackupAndRestore() {
  const { currentMentor, currentMentorId } = useMentor();
  const [students, setStudents] = useState<Student[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportingMentorId, setExportingMentorId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'overwrite' | 'merge'>('merge');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Cloud Backups & Password State
  const [cloudBackups, setCloudBackups] = useState<CloudBackupRecord[]>([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState<boolean>(false);
  const [isUploadingToCloud, setIsUploadingToCloud] = useState<boolean>(false);
  const [selectedMentorFilter, setSelectedMentorFilter] = useState<string>('all');

  // Password Verification State
  const [isPasswordVerified, setIsPasswordVerified] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Modals State
  const [showAllFilesModal, setShowAllFilesModal] = useState<boolean>(false);
  const [fileSearchTerm, setFileSearchTerm] = useState<string>('');
  const [showOverwriteConfirmModal, setShowOverwriteConfirmModal] = useState<boolean>(false);
  const [pendingFileToRestore, setPendingFileToRestore] = useState<{ data: any; name: string } | null>(null);

  const [stats, setStats] = useState<{
    totalStudents: number;
    totalActiveStudents: number;
    totalPhotos: number;
    photosSizeEstimateKB: number;
    collectionCounts: Record<string, number>;
  }>({
    totalStudents: 0,
    totalActiveStudents: 0,
    totalPhotos: 0,
    photosSizeEstimateKB: 0,
    collectionCounts: {}
  });

  const universalFileInputRef = useRef<HTMLInputElement>(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [resetConfirmText, setResetConfirmText] = useState<string>('');

  const loadData = async () => {
    try {
      const allStudents = await localDb.getDocs<Student>('students');
      setStudents(allStudents);
      const storageStats = await localDb.getStorageStats();
      setStats(storageStats);
      await loadCloudBackups();
    } catch (e) {
      console.error('Error loading backup stats:', e);
    }
  };

  const loadCloudBackups = async () => {
    setIsLoadingCloud(true);
    try {
      const isManager = currentMentor.isHeadManager || currentMentorId === 'shahpoori';
      const records = await fetchCloudBackups(selectedMentorFilter, isManager);
      setCloudBackups(records);
    } catch (err) {
      console.error('Error fetching cloud backups:', err);
    } finally {
      setIsLoadingCloud(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = localDb.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [currentMentorId, selectedMentorFilter]);

  // Utility to download JSON
  const downloadJsonFile = (data: any, filename: string) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Password verification logic
  const handleVerifyPassword = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passwordInput.trim() === REQUIRED_PASSWORD) {
      setIsPasswordVerified(true);
      setPasswordError('');
      setShowPasswordModal(false);
      setPasswordInput('');
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    } else {
      setPasswordError(`رمز عبور وارد شده نادرست است.`);
    }
  };

  const requirePassword = (action: () => void) => {
    if (isPasswordVerified) {
      action();
    } else {
      setPendingAction(() => action);
      setPasswordError('');
      setPasswordInput('');
      setShowPasswordModal(true);
    }
  };

  // 1. Offline Backup Download
  const handleExportOfflineBackup = async (mentorIdTarget?: MentorId) => {
    setIsExporting(true);
    setStatusMessage(null);
    try {
      const targetId = mentorIdTarget || currentMentorId;
      const targetMentor = MENTORS[targetId] || currentMentor;
      
      let backupPackage: any;
      if (targetId === 'shahpoori' || targetMentor.isHeadManager) {
        backupPackage = await localDb.exportFullBackup();
      } else {
        backupPackage = await localDb.exportMentorBackup(targetId);
      }

      const filename = generateBackupFilename(targetMentor.name);
      downloadJsonFile(backupPackage, filename);

      setStatusMessage({
        type: 'success',
        text: `فایل پشتیبان آفلاین کاربر «${targetMentor.name}» با موفقیت با تاریخ امروز دانلود شد (${filename}).`
      });
    } catch (err: any) {
      console.error('Offline backup export error:', err);
      setStatusMessage({
        type: 'error',
        text: `خطا در دانلود پشتیبان آفلاین: ${err?.message || 'خطای ناشناخته'}`
      });
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Upload Backup to Cloud Database
  const handleUploadToDatabase = async () => {
    setIsUploadingToCloud(true);
    setStatusMessage(null);
    try {
      let backupPackage: any;
      if (currentMentorId === 'shahpoori' || currentMentor.isHeadManager) {
        backupPackage = await localDb.exportFullBackup();
      } else {
        backupPackage = await localDb.exportMentorBackup(currentMentorId);
      }

      const record = await uploadBackupToCloud(
        currentMentorId,
        currentMentor.name,
        currentMentor.role,
        backupPackage
      );

      setStatusMessage({
        type: 'success',
        text: `یک نسخه پشتیبان با موفقیت تحت نام کاربر «${currentMentor.name}» و تاریخ «${record.persianDate}» در دیتابیس ثبت و ذخیره گردید.`
      });

      await loadCloudBackups();
    } catch (err: any) {
      console.error('Database backup upload error:', err);
      setStatusMessage({
        type: 'error',
        text: `خطا در ارسال نسخه پشتیبان به دیتابیس: ${err?.message || 'خطای اتصال'}`
      });
    } finally {
      setIsUploadingToCloud(false);
    }
  };

  // 3. Restore Data Logic (Handles Merge vs Overwrite with confirmation)
  const executeRestore = async (backupData: any, filename: string, overrideMode?: 'overwrite' | 'merge') => {
    const effectiveMode = overrideMode || importMode;
    setIsImporting(true);
    setStatusMessage(null);
    try {
      const result = await localDb.restoreAnyBackup(backupData, effectiveMode);
      setStatusMessage({
        type: 'success',
        text: result.message
      });
      await loadData();
    } catch (err: any) {
      console.error('Restore error:', err);
      setStatusMessage({
        type: 'error',
        text: `خطا در بازیابی اطلاعات: ${err?.message || 'فرمت فایل پشتیبان نامعتبر است'}`
      });
    } finally {
      setIsImporting(false);
      setPendingFileToRestore(null);
      setShowOverwriteConfirmModal(false);
      if (universalFileInputRef.current) universalFileInputRef.current.value = '';
    }
  };

  const handleSelectFileToRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsedData = JSON.parse(text);

      if (importMode === 'overwrite') {
        // Must prompt confirmation first if in Overwrite mode!
        setPendingFileToRestore({ data: parsedData, name: file.name });
        setShowOverwriteConfirmModal(true);
      } else {
        await executeRestore(parsedData, file.name, 'merge');
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `خطا در خواندن فایل انتخاب شده: ${err?.message || 'فایل JSON معتبر نیست'}`
      });
      if (universalFileInputRef.current) universalFileInputRef.current.value = '';
    }
  };

  const handleDownloadCloudRecord = (record: CloudBackupRecord) => {
    requirePassword(async () => {
      try {
        const pkg = await downloadBackupPackage(record);
        downloadJsonFile(pkg, record.fileName);
        setStatusMessage({
          type: 'success',
          text: `فایل پشتیبان دیتابیس «${record.fileName}» با موفقیت دانلود شد.`
        });
      } catch (e: any) {
        setStatusMessage({
          type: 'error',
          text: `خطا در دریافت فایل: ${e?.message || 'مشکل اتصال'}`
        });
      }
    });
  };

  const handleRestoreCloudRecord = (record: CloudBackupRecord) => {
    requirePassword(async () => {
      try {
        const pkg = await downloadBackupPackage(record);
        if (importMode === 'overwrite') {
          setPendingFileToRestore({ data: pkg, name: record.fileName });
          setShowOverwriteConfirmModal(true);
        } else {
          executeRestore(pkg, record.fileName, 'merge');
        }
      } catch (e: any) {
        setStatusMessage({
          type: 'error',
          text: `خطا در بازیابی فایل: ${e?.message || 'مشکل اتصال'}`
        });
      }
    });
  };

  const handleDeleteCloudRecord = async (record: CloudBackupRecord) => {
    requirePassword(async () => {
      try {
        await deleteCloudBackup(record);
        setStatusMessage({
          type: 'info',
          text: 'فایل پشتیبان انتخاب شده از دیتابیس حذف گردید.'
        });
        await loadCloudBackups();
      } catch (err: any) {
        console.error('Error deleting cloud backup:', err);
      }
    });
  };

  // Export photos package
  const handleExportAllPhotosJson = async () => {
    try {
      const allStudents = await localDb.getDocs<Student>('students');
      const studentsWithPhotos = allStudents.filter((s) => s.photoUrl);
      const photoPackage = {
        _meta: {
          exportType: 'photos_only',
          exportDate: new Date().toISOString(),
          totalPhotos: studentsWithPhotos.length
        },
        photos: studentsWithPhotos.map((s) => ({
          studentId: s.id,
          studentName: s.name,
          nationalId: s.nationalId,
          photoUrl: s.photoUrl
        }))
      };

      const dateStr = new Date().toISOString().slice(0, 10);
      downloadJsonFile(photoPackage, `آرشیو_عکس_طلاب_${dateStr}.json`);
      setStatusMessage({
        type: 'success',
        text: `پکیج اختصاصی عکس‌های طلاب با موفقیت دانلود شد (${studentsWithPhotos.length} عکس).`
      });
    } catch (e: any) {
      setStatusMessage({
        type: 'error',
        text: `خطا در استخراج عکس‌ها: ${e?.message || 'نامشخص'}`
      });
    }
  };

  // Mentor card information
  const mentorCards: MentorStats[] = [
    {
      id: 'hayati',
      name: 'استاد حیاتی',
      role: 'مسئول پایه ۷',
      gradeLabel: 'پایه ۷',
      avatarBg: 'bg-emerald-600',
      badgeBg: 'bg-emerald-50',
      badgeText: 'text-emerald-700',
      badgeBorder: 'border-emerald-200',
      dotColor: 'bg-emerald-500',
      studentCount: students.filter((s) => getMentorKeyForGrade(s.grade) === 'hayati').length,
      photoCount: students.filter((s) => getMentorKeyForGrade(s.grade) === 'hayati' && s.photoUrl).length
    },
    {
      id: 'hosseini',
      name: 'استاد حسینی',
      role: 'مسئول پایه ۸',
      gradeLabel: 'پایه ۸',
      avatarBg: 'bg-sky-600',
      badgeBg: 'bg-sky-50',
      badgeText: 'text-sky-700',
      badgeBorder: 'border-sky-200',
      dotColor: 'bg-sky-500',
      studentCount: students.filter((s) => getMentorKeyForGrade(s.grade) === 'hosseini').length,
      photoCount: students.filter((s) => getMentorKeyForGrade(s.grade) === 'hosseini' && s.photoUrl).length
    },
    {
      id: 'soleimani',
      name: 'استاد سلیمانی',
      role: 'مسئول پایه ۹',
      gradeLabel: 'پایه ۹',
      avatarBg: 'bg-purple-600',
      badgeBg: 'bg-purple-50',
      badgeText: 'text-purple-700',
      badgeBorder: 'border-purple-200',
      dotColor: 'bg-purple-500',
      studentCount: students.filter((s) => getMentorKeyForGrade(s.grade) === 'soleimani').length,
      photoCount: students.filter((s) => getMentorKeyForGrade(s.grade) === 'soleimani' && s.photoUrl).length
    },
    {
      id: 'shahpoori',
      name: 'استاد شاهپوری',
      role: 'مدیر اصلی',
      gradeLabel: 'کل پایه‌ها',
      avatarBg: 'bg-amber-600',
      badgeBg: 'bg-amber-50',
      badgeText: 'text-amber-800',
      badgeBorder: 'border-amber-200',
      dotColor: 'bg-amber-500',
      studentCount: students.length,
      photoCount: stats.totalPhotos
    }
  ];

  // Recent 4 cloud files for preview in database section
  const recentCloudFiles = cloudBackups.slice(0, 4);

  // Filtered files for "View All Files" modal
  const filteredModalFiles = cloudBackups.filter(r => {
    if (!fileSearchTerm.trim()) return true;
    const term = fileSearchTerm.trim().toLowerCase();
    return (
      r.fileName.toLowerCase().includes(term) ||
      r.mentorName.toLowerCase().includes(term) ||
      r.persianDate.includes(term)
    );
  });

  const isHeadManager = currentMentor.isHeadManager || currentMentorId === 'shahpoori';

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-right font-vazir" dir="rtl">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={universalFileInputRef}
        onChange={handleSelectFileToRestore}
        accept=".json"
        className="hidden"
      />

      {/* Header Banner */}
      <div className="bg-gradient-to-l from-indigo-800 via-indigo-700 to-indigo-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -left-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 rounded-full text-xs font-bold backdrop-blur-md">
              <HardDrive size={14} className="text-emerald-300" />
              <span>پشتیبانی کامل آنلاین و آفلاین دیتابیس</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              بخش پشتیبانی و مدیریت فایل‌های دیتا
            </h1>
            <p className="text-indigo-100 text-xs sm:text-sm max-w-2xl leading-relaxed">
              کاربر جاری: <strong className="text-amber-300">{currentMentor.name} ({currentMentor.role})</strong> — 
              در این بخش می‌توانید از دیتای اختصاصی خود پشتیبان آفلاین با نام و تاریخ دریافت کنید، نسخه پشتیبان را به دیتابیس ارسال کنید و یا با وارد کردن رمز عبور فایل‌های ثبت شده قبلی را دانلود و بازیابی نمایید.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-white/10 p-3.5 rounded-2xl backdrop-blur-md border border-white/20">
            <div className="text-center px-3 py-1">
              <span className="block text-2xl font-black text-white">{stats.totalStudents}</span>
              <span className="text-[11px] text-indigo-200">کل طلاب</span>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="text-center px-3 py-1">
              <span className="block text-2xl font-black text-emerald-300">{cloudBackups.length}</span>
              <span className="text-[11px] text-indigo-200">نسخه‌های دیتابیس</span>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="text-center px-3 py-1">
              <span className="block text-2xl font-black text-amber-300">{stats.totalPhotos}</span>
              <span className="text-[11px] text-indigo-200">عکس موجود</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Notifications */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "p-4 rounded-2xl flex items-start gap-3 shadow-sm border",
              statusMessage.type === 'success' && "bg-emerald-50 border-emerald-200 text-emerald-900",
              statusMessage.type === 'error' && "bg-rose-50 border-rose-200 text-rose-900",
              statusMessage.type === 'info' && "bg-sky-50 border-sky-200 text-sky-900"
            )}
          >
            {statusMessage.type === 'success' && <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={20} />}
            {statusMessage.type === 'error' && <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />}
            {statusMessage.type === 'info' && <Info className="text-sky-600 shrink-0 mt-0.5" size={20} />}
            <div className="flex-1 text-sm font-medium">{statusMessage.text}</div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECTION 1: Offline Backup & Upload to Database */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Offline Backup Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                <Download size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">۱. پشتیبان‌گیری آفلاین کاربر</h2>
                <p className="text-xs text-slate-500">ذخیره کامل دیتای کاربر روی سیستم شخصی همراه با درج نام و تاریخ دقیق</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-xs text-slate-600 leading-relaxed">
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>عنوان فایل خروجی آفلاین:</span>
                <span className="text-indigo-600 font-mono text-[11px]">پشتیبان_{currentMentor.name.replace(/\s+/g, '_')}_[تاریخ].json</span>
              </div>
              <p className="text-[11px] text-slate-500">
                این فایل شامل تمامی طلاب، عکس‌های پایه مربوطه، سوابق پژوهش، ساعات مطالعه، نظرات و امتحانات مربوط به {currentMentor.name} می‌باشد.
              </p>
            </div>
          </div>

          <button
            onClick={() => handleExportOfflineBackup()}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2.5 py-4 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl font-bold transition-all shadow-md hover:shadow-indigo-200 disabled:opacity-50 text-sm"
          >
            {isExporting ? <RefreshCw size={18} className="animate-spin" /> : <ArrowDownToLine size={18} />}
            <span>دانلود فایل پشتیبان آفلاین ({currentMentor.name})</span>
          </button>
        </div>

        {/* Upload to Cloud Database Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <CloudUpload size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">۲. ارسال نسخه پشتیبان به دیتابیس</h2>
                <p className="text-xs text-slate-500">ثبت و ذخیره‌سازی نسخه پشتیبان در دیتابیس تحت پوشه اختصاصی کاربر با برچسب تاریخ</p>
              </div>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-2 text-xs text-emerald-900 leading-relaxed">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>ذخیره خودکار در پوشه اختصاصی دیتابیس:</span>
              </div>
              <p className="text-[11px] text-emerald-800">
                با زدن این دکمه، دیتای فعلی نرم‌افزار تحت شناسه <strong>{currentMentor.name}</strong> همراه با زمان دقیق ثبت در دیتابیس قرار می‌گیرد تا هر زمان بتوانید آن را دانلود یا بازیابی کنید.
              </p>
            </div>
          </div>

          <button
            onClick={handleUploadToDatabase}
            disabled={isUploadingToCloud}
            className="w-full flex items-center justify-center gap-2.5 py-4 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl font-bold transition-all shadow-md hover:shadow-emerald-200 disabled:opacity-50 text-sm"
          >
            {isUploadingToCloud ? <RefreshCw size={18} className="animate-spin" /> : <CloudUpload size={18} />}
            <span>ارسال و ثبت نسخه پشتیبان جدید در دیتابیس</span>
          </button>
        </div>
      </div>

      {/* SECTION 2: Download Data from Database (Password Protected + Admin Access) */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold shrink-0">
              <CloudDownload size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-800">۳. دانلود دیتا از دیتابیس</h2>
                <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold">
                  <Lock size={12} /> نیازمند رمز عبور
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                لیست فایل‌های ثبت شده از نسخه‌های سابق کاربران همراه با امکان دانلود و مشاهده تاریخچه کامل
              </p>
            </div>
          </div>

          {/* Admin Mentor Filter Selector */}
          {isHeadManager ? (
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl text-xs">
              <ShieldCheck size={16} className="text-amber-600 shrink-0 mr-1" />
              <span className="font-bold text-slate-700 hidden md:inline">دسترسی مدیر (فیلتر کاربر):</span>
              <select
                value={selectedMentorFilter}
                onChange={(e) => setSelectedMentorFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-1.5 font-bold focus:outline-none text-xs"
              >
                <option value="all">همه کاربران (کل به‌روزرسانی‌ها)</option>
                <option value="hayati">استاد حیاتی (پایه ۷)</option>
                <option value="hosseini">استاد حسینی (پایه ۸)</option>
                <option value="soleimani">استاد سلیمانی (پایه ۹)</option>
                <option value="shahpoori">استاد شاهپوری (مدیر کل)</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-2xl border border-slate-200">
              <span>فایل‌های ثبت شده برای:</span>
              <span className="text-indigo-600">{currentMentor.name}</span>
            </div>
          )}
        </div>

        {/* Password Lock Status Banner or Prompt */}
        {!isPasswordVerified ? (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
              <KeyRound size={28} />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-base font-black text-slate-800">تأیید رمز عبور جهت مشاهده و دانلود فایل‌ها</h3>
              <p className="text-xs text-slate-500">
                جهت حفظ امنیت اطلاعات، تمامی دانلودهای این بخش مستلزم ورود رمز عبور می‌باشند.
              </p>
            </div>

            <form onSubmit={handleVerifyPassword} className="max-w-xs mx-auto flex gap-2">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="رمز عبور را وارد کنید..."
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shrink-0"
              >
                تأیید
              </button>
            </form>

            {passwordError && (
              <p className="text-xs font-bold text-rose-600">{passwordError}</p>
            )}
          </div>
        ) : (
          /* Unlocked Content: Display Recent Files List */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <History size={16} className="text-sky-600" />
                <span>لیست فایل‌های اخیر ثبت شده در دیتابیس ({recentCloudFiles.length} مورد از {cloudBackups.length}):</span>
              </div>

              <button
                onClick={() => setShowAllFilesModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 rounded-xl text-xs font-bold transition-all shadow-2xs"
              >
                <Eye size={15} />
                <span>مشاهده همه فایل‌ها ({cloudBackups.length})</span>
              </button>
            </div>

            {isLoadingCloud ? (
              <div className="py-12 text-center space-y-2 text-slate-400">
                <RefreshCw size={24} className="animate-spin mx-auto text-sky-500" />
                <span className="text-xs">در حال دریافت فایل‌های دیتابیس...</span>
              </div>
            ) : recentCloudFiles.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 text-xs space-y-2">
                <FileJson size={32} className="mx-auto text-slate-300" />
                <p>هنوز نسخه پشتیبانی در دیتابیس ثبت نشده است.</p>
                <p className="text-[11px] text-slate-400">
                  از دکمه «ارسال نسخه پشتیبان به دیتابیس» بالا برای ذخیره‌سازی اولین نسخه استفاده کنید.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {recentCloudFiles.map((rec) => (
                  <div
                    key={rec.id}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-sky-300 transition-all shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-xs sm:text-sm">{rec.fileName}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          <span className="text-indigo-600 font-bold">{rec.mentorName}</span>
                          <span>•</span>
                          <span>{rec.persianDate}</span>
                        </div>
                      </div>

                      <span className="text-[10px] px-2.5 py-1 bg-white border border-slate-200 rounded-full font-bold text-slate-600 shrink-0">
                        {rec.fileSizeFormatted}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                      <button
                        onClick={() => handleDownloadCloudRecord(rec)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all"
                      >
                        <Download size={14} className="text-sky-600" />
                        <span>دانلود فایل</span>
                      </button>

                      <button
                        onClick={() => handleRestoreCloudRecord(rec)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all"
                      >
                        <Upload size={14} />
                        <span>بازیابی در سیستم</span>
                      </button>

                      <button
                        onClick={() => handleDeleteCloudRecord(rec)}
                        className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        title="حذف از دیتابیس"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 3: Load Downloaded Backup into Software (Merge vs Full Overwrite) */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold shrink-0">
            <Upload size={24} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800">۴. بارگذاری فایل پشتیبان دانلودی در نرم‌افزار</h2>
            <p className="text-xs text-slate-500">انتخاب فایل پشتیبان (.json) و اعمال آن بر روی پایگاه داده محلی سیستم</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Mode Selector */}
          <div className="md:col-span-5 space-y-3 bg-slate-50 border border-slate-200 p-4 rounded-2xl">
            <label className="block text-xs font-bold text-slate-700">نحوه بارگذاری اطلاعات:</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1.5 rounded-xl text-xs font-bold">
              <button
                onClick={() => setImportMode('merge')}
                className={cn(
                  "py-2 px-3 rounded-lg transition-all text-center",
                  importMode === 'merge' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                ادغام (پیش‌فرض)
              </button>
              <button
                onClick={() => setImportMode('overwrite')}
                className={cn(
                  "py-2 px-3 rounded-lg transition-all text-center",
                  importMode === 'overwrite' ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                جایگذاری کامل
              </button>
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              {importMode === 'merge'
                ? 'حالت پیش‌فرض: اطلاعات جدید اضافه شده و رکوردها با حفظ پرونده‌های قبلی ادغام می‌گردند.'
                : 'حالت جایگذاری کامل: پیش از اعمال نیازمند تأییدیه کاربر می‌باشد و داده‌های فعلی پاک خواهند شد.'}
            </p>
          </div>

          {/* Upload Dropzone */}
          <div className="md:col-span-7 flex flex-col justify-center">
            <button
              onClick={() => universalFileInputRef.current?.click()}
              disabled={isImporting}
              className="w-full h-full min-h-[120px] flex flex-col items-center justify-center gap-2 p-6 bg-purple-50/50 hover:bg-purple-100/60 border-2 border-dashed border-purple-300 hover:border-purple-500 text-purple-900 rounded-2xl font-bold transition-all disabled:opacity-50"
            >
              <Upload size={28} className="text-purple-600" />
              <span className="text-sm">انتخاب و بارگذاری فایل پشتیبان (.json)</span>
              <span className="text-[11px] text-purple-600/80 font-normal">کلیک کنید تا فایل از سیستم شما انتخاب گردد</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 5: Photos Archive & Database Clear Tools */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
              <ImageIcon size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">۵. آرشیو تصاویر و پاک‌سازی داده‌ها</h2>
              <p className="text-xs text-slate-500">
                دریافت آرشیو مستقل عکس‌های طلاب یا پاک‌سازی کامل دیتابیس محلی
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportAllPhotosJson}
              disabled={stats.totalPhotos === 0}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
            >
              <Download size={15} />
              <span>دانلود آرشیو عکس‌ها (JSON)</span>
            </button>

            <button
              onClick={() => setShowResetConfirmModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all font-bold"
            >
              <Trash2 size={14} />
              <span>پاک‌سازی کامل دیتابیس</span>
            </button>
          </div>
        </div>

        {/* Local DB Collections Breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center pt-2">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
            <span className="block text-lg font-black text-slate-800">{stats.collectionCounts.students || 0}</span>
            <span className="text-[11px] text-slate-500 font-medium">پرونده طلاب</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
            <span className="block text-lg font-black text-slate-800">{stats.collectionCounts.research || 0}</span>
            <span className="text-[11px] text-slate-500 font-medium">سوابق پژوهشی</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
            <span className="block text-lg font-black text-slate-800">{stats.collectionCounts.study_periods || 0}</span>
            <span className="text-[11px] text-slate-500 font-medium">دوره‌های مطالعاتی</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
            <span className="block text-lg font-black text-slate-800">{stats.collectionCounts.periodic_study_logs || 0}</span>
            <span className="text-[11px] text-slate-500 font-medium">ثبت ساعت مطالعه</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
            <span className="block text-lg font-black text-slate-800">{stats.collectionCounts.student_comments || 0}</span>
            <span className="text-[11px] text-slate-500 font-medium">نظرات و جلسات</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
            <span className="block text-lg font-black text-slate-800">{stats.collectionCounts.oral_exams || 0}</span>
            <span className="text-[11px] text-slate-500 font-medium">امتحانات شفاهی</span>
          </div>
        </div>
      </div>

      {/* MODAL 1: Password Required Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4 text-right"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <KeyRound size={24} />
              </div>
              <h3 className="text-base font-black text-slate-900">ورود رمز عبور جهت دانلود و بازیابی</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                جهت دسترسی به دیتای دیتابیس، لطفاً رمز عبور را وارد کنید:
              </p>

              <form onSubmit={handleVerifyPassword} className="space-y-3">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="رمز عبور..."
                  autoFocus
                  className="w-full p-3 border border-slate-300 rounded-xl text-center font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50"
                />

                {passwordError && (
                  <p className="text-xs font-bold text-rose-600 text-center">{passwordError}</p>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    تأیید و ادامه
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setPendingAction(null);
                    }}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: View All Files Modal */}
      <AnimatePresence>
        {showAllFilesModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-3xl w-full border border-slate-200 shadow-2xl space-y-4 text-right max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                    <History size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">تاریخچه کامل فایل‌های دیتابیس</h3>
                    <p className="text-xs text-slate-500">لیست تمامی نسخه‌های ثبت شده به ترتیب تاریخ</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowAllFilesModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search size={16} className="absolute right-3 top-3 text-slate-400" />
                <input
                  type="text"
                  value={fileSearchTerm}
                  onChange={(e) => setFileSearchTerm(e.target.value)}
                  placeholder="جستجو بر اساس نام فایل، تاریخ یا اسم کاربر..."
                  className="w-full pr-9 pl-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Files Table / List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {filteredModalFiles.length === 0 ? (
                  <p className="text-center py-8 text-xs text-slate-400">هیچ فایلی مطابق جستجوی شما پیدا نشد.</p>
                ) : (
                  filteredModalFiles.map((rec) => (
                    <div
                      key={rec.id}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-sky-300 transition-all text-xs"
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-slate-800 flex items-center gap-2">
                          <FileText size={15} className="text-sky-600 shrink-0" />
                          <span>{rec.fileName}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-white border border-slate-200 rounded-full font-bold text-slate-600">
                            {rec.fileSizeFormatted}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500">
                          <span className="text-indigo-600 font-bold">{rec.mentorName}</span>
                          <span>•</span>
                          <span>{rec.persianDate}</span>
                          <span>•</span>
                          <span>رکوردهای ثبت شده: {rec.totalRecords}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleDownloadCloudRecord(rec)}
                          className="flex items-center gap-1 py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all"
                        >
                          <Download size={13} className="text-sky-600" />
                          <span>دانلود</span>
                        </button>

                        <button
                          onClick={() => {
                            setShowAllFilesModal(false);
                            handleRestoreCloudRecord(rec);
                          }}
                          className="flex items-center gap-1 py-1.5 px-3 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold transition-all"
                        >
                          <Upload size={13} />
                          <span>بازیابی</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: Full Replacement / Overwrite Confirmation Modal */}
      <AnimatePresence>
        {showOverwriteConfirmModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 text-right"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-base font-black text-slate-900">تأییدیه جایگذاری کامل اطلاعات</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                توجه: شما حالت <strong>«جایگذاری کامل»</strong> را انتخاب کرده‌اید. با تأیید این عملیات، تمامی داده‌های فعلی پایگاه داده محلی پاک شده و دقیقاً اطلاعات موجود در فایل <strong>«{pendingFileToRestore?.name}»</strong> جایگزین خواهد شد.
              </p>

              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 font-bold">
                آیا از جایگذاری کامل اطلاعات اطمینان دارید؟
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    if (pendingFileToRestore) {
                      executeRestore(pendingFileToRestore.data, pendingFileToRestore.name, 'overwrite');
                    }
                  }}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all"
                >
                  تأیید و جایگذاری کامل
                </button>
                <button
                  onClick={() => {
                    setShowOverwriteConfirmModal(false);
                    setPendingFileToRestore(null);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  انصراف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: Reset DB Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirmModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 text-right"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-base font-black text-slate-900">آیا از حذف کامل اطلاعات اطمینان دارید؟</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                این عملیات تمامی طلاب، نمرات، عکس‌ها، دوره‌ها و داده‌های ذخیره شده در مرورگر را پاک می‌کند. قبل از این کار حتماً یک نسخه پشتیبان دانلود نمایید.
              </p>

              <div className="space-y-1 text-xs">
                <label className="text-slate-600 font-bold">جهت تأیید، عبارت «حذف» را تایپ کنید:</label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="حذف"
                  className="w-full p-2.5 border border-rose-200 rounded-xl text-center font-bold text-rose-700 bg-rose-50/50 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={async () => {
                    if (resetConfirmText.trim() === 'حذف') {
                      await localDb.resetAllDatabase();
                      setShowResetConfirmModal(false);
                      setResetConfirmText('');
                      setStatusMessage({
                        type: 'info',
                        text: 'تمامی اطلاعات پایگاه داده محلی پاک‌سازی شد.'
                      });
                      await loadData();
                    } else {
                      alert('عبارت تأیید صحیح نیست.');
                    }
                  }}
                  disabled={resetConfirmText.trim() !== 'حذف'}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all"
                >
                  تأیید و پاک‌سازی کامل
                </button>
                <button
                  onClick={() => {
                    setShowResetConfirmModal(false);
                    setResetConfirmText('');
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  انصراف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
