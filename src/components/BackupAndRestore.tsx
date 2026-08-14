import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Upload,
  Database,
  HardDrive,
  User,
  Users,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  RefreshCw,
  Trash2,
  FileCheck,
  ShieldCheck,
  Sparkles,
  Info,
  Calendar,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  FileText,
  Search,
  Check,
  X,
  UserCheck,
  GraduationCap
} from 'lucide-react';
import { localDb, FullBackupPackage, MentorBackupPackage, StudentBackupPackage, MENTOR_META, getMentorKeyForGrade } from '../lib/localDb';
import { Student } from '../types';
import { useMentor, MentorId } from '../context/MentorContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

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
}

export default function BackupAndRestore() {
  const { currentMentor } = useMentor();
  const [students, setStudents] = useState<Student[]>([]);
  const [isExportingFull, setIsExportingFull] = useState<boolean>(false);
  const [exportingMentorId, setExportingMentorId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'overwrite' | 'merge'>('merge');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

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
    } catch (e) {
      console.error('Error loading backup stats:', e);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = localDb.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

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

  // 1. Export Full System Backup
  const handleExportFullBackup = async () => {
    setIsExportingFull(true);
    setStatusMessage(null);
    try {
      const backup = await localDb.exportFullBackup();
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
      const timeStr = new Date().toTimeString().slice(0, 5).replace(/:/g, '-');
      const filename = `tolab_full_backup_all_users_${dateStr}_${timeStr}.json`;
      downloadJsonFile(backup, filename);
      setStatusMessage({
        type: 'success',
        text: `فایل پشتیبان کامل نرم‌افزار (شامل کلیه اساتید، طلاب و عکس‌ها) با موفقیت دانلود شد (${backup._meta.totalRecords} رکورد).`
      });
    } catch (err: any) {
      console.error('Full backup error:', err);
      setStatusMessage({
        type: 'error',
        text: `خطا در دریافت پشتیبان کامل: ${err?.message || 'خطای ناشناخته'}`
      });
    } finally {
      setIsExportingFull(false);
    }
  };

  // 2. Export Individual User/Mentor Backup (استاد حسینی، استاد حیاتی، استاد سلیمانی، استاد شاهپوری)
  const handleExportMentorBackup = async (mentorId: MentorId) => {
    setExportingMentorId(mentorId);
    setStatusMessage(null);
    try {
      const backup = await localDb.exportMentorBackup(mentorId);
      const mentorName = backup.mentor.name.replace(/\s+/g, '_');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
      const filename = `mentor_backup_${mentorName}_${dateStr}.json`;
      downloadJsonFile(backup, filename);
      setStatusMessage({
        type: 'success',
        text: `فایل پشتیبان دیتای «${backup.mentor.name} (${backup.mentor.role})» با موفقیت دانلود شد (شامل ${backup.students.length} طلبه، سوابق و عکس‌ها).`
      });
    } catch (err: any) {
      console.error('Mentor backup error:', err);
      setStatusMessage({
        type: 'error',
        text: `خطا در پشتیبان‌گیری کاربر: ${err?.message || 'خطای ناشناخته'}`
      });
    } finally {
      setExportingMentorId(null);
    }
  };

  // 3. Universal File Import Handler (Detects Full, Mentor, or Student)
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setStatusMessage(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const result = await localDb.restoreAnyBackup(data, importMode);
      setStatusMessage({
        type: 'success',
        text: result.message
      });
      await loadData();
    } catch (err: any) {
      console.error('Universal import backup error:', err);
      setStatusMessage({
        type: 'error',
        text: `خطا در بازیابی فایل پشتیبان: ${err?.message || 'فرمت فایل پشتیبان نامعتبر است'}`
      });
    } finally {
      setIsImporting(false);
      if (universalFileInputRef.current) universalFileInputRef.current.value = '';
    }
  };

  // 4. Export Photo Archive
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
      downloadJsonFile(photoPackage, `tolab_photos_archive_${dateStr}.json`);
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

  // Calculate stats for each mentor/user
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

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-right font-vazir" dir="rtl">
      {/* Hidden Universal File Input */}
      <input
        type="file"
        ref={universalFileInputRef}
        onChange={handleFileSelected}
        accept=".json"
        className="hidden"
      />

      {/* Header Banner */}
      <div className="bg-gradient-to-l from-indigo-700 via-indigo-600 to-indigo-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -left-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 rounded-full text-xs font-bold backdrop-blur-md">
              <HardDrive size={14} className="text-emerald-300" />
              <span>پایگاه داده ۱۰۰٪ آفلاین و محلی</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              پشتیبان‌گیری و بازیابی داده‌ها
            </h1>
            <p className="text-indigo-100 text-xs sm:text-sm max-w-2xl leading-relaxed">
              در این بخش می‌توانید از دیتای کل نرم‌افزار و تمام کاربران به صورت یکجا، و یا از دیتای تک‌تک اساتید (استاد حیاتی، استاد حسینی، استاد سلیمانی، استاد شاهپوری) فایل پشتیبان دانلود نموده و در زمان نیاز آن را با یک کلیک به سیستم بازگردانید.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/20">
            <div className="text-center px-3 py-1">
              <span className="block text-2xl font-black text-white">{stats.totalStudents}</span>
              <span className="text-[11px] text-indigo-200">کل طلاب</span>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="text-center px-3 py-1">
              <span className="block text-2xl font-black text-emerald-300">{stats.totalPhotos}</span>
              <span className="text-[11px] text-indigo-200">عکس ذخیره شده</span>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="text-center px-3 py-1">
              <span className="block text-2xl font-black text-amber-300">{stats.photosSizeEstimateKB} KB</span>
              <span className="text-[11px] text-indigo-200">حجم عکس‌ها</span>
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

      {/* Section 1: Full System Backup & Restore Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Full System Export Box */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                <Database size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">۱. پشتیبان‌گیری کل نرم‌افزار و تمام کاربران</h2>
                <p className="text-xs text-slate-500">دانلود یک بسته جامع شامل تمامی اساتید، پایه‌های ۷، ۸، ۹، سوابق و کلیه عکس‌ها</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs text-slate-600 leading-relaxed">
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>محتوای ذخیره شده در فایل پشتیبان کل:</span>
                <span className="text-indigo-600 font-mono">JSON خودکفا + تصاویر Base64</span>
              </div>
              <ul className="grid grid-cols-2 gap-2 text-[11px]">
                <li className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" /> مشخصات طلاب تمام پایه‌ها</li>
                <li className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" /> کلیه عکس‌های بارگذاری شده</li>
                <li className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" /> سوابق پژوهش و مقالات</li>
                <li className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" /> دوره‌ها و ساعات مطالعه</li>
                <li className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" /> نظرات اساتید و امتحانات</li>
                <li className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" /> پیگیری‌ها و برنامه‌ها</li>
              </ul>
            </div>
          </div>

          <button
            onClick={handleExportFullBackup}
            disabled={isExportingFull}
            className="w-full flex items-center justify-center gap-2.5 py-4 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl font-bold transition-all shadow-md hover:shadow-indigo-200 disabled:opacity-50 text-sm"
          >
            {isExportingFull ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <ArrowDownToLine size={18} />
            )}
            <span>دانلود پشتیبان کامل کل نرم‌افزار و تمام کاربران (با عکس‌ها)</span>
          </button>
        </div>

        {/* Restore Hub (Supports any file) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <Upload size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">بازیابی فایل پشتیبان</h2>
                <p className="text-xs text-slate-500">بارگذاری پشتیبان کل نرم‌افزار یا پشتیبان هر یک از اساتید</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">نحوه اعمال داده‌های بارگذاری شده:</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl text-xs font-bold">
                <button
                  onClick={() => setImportMode('merge')}
                  className={cn(
                    "py-2 px-3 rounded-xl transition-all text-center",
                    importMode === 'merge' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  ادغام (پیشنهادی)
                </button>
                <button
                  onClick={() => setImportMode('overwrite')}
                  className={cn(
                    "py-2 px-3 rounded-xl transition-all text-center",
                    importMode === 'overwrite' ? "bg-rose-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  جایگزینی کامل
                </button>
              </div>
              <p className="text-[10px] text-slate-400 leading-normal px-1">
                {importMode === 'merge' 
                  ? 'داده‌های جدید اضافه شده و اطلاعات قبلی محفوظ می‌ماند.' 
                  : 'اطلاعات موجود پاک شده و دقیقاً با محتوای فایل پشتیبان جایگزین می‌شود.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => universalFileInputRef.current?.click()}
            disabled={isImporting}
            className="w-full flex items-center justify-center gap-2 py-4 px-4 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border-2 border-dashed border-emerald-300 hover:border-emerald-500 text-emerald-800 rounded-2xl font-bold transition-all disabled:opacity-50 text-xs sm:text-sm"
          >
            <Upload size={18} className="text-emerald-600" />
            <span>انتخاب و بارگذاری فایل پشتیبان (.json)</span>
          </button>
        </div>
      </div>

      {/* Section 2: Individual Mentors/Users Backup (استاد حسینی، حیاتی، سلیمانی، شاهپوری) */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold shrink-0">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">۲. پشتیبان‌گیری به تفکیک تک‌تک کاربران (اساتید)</h2>
              <p className="text-xs text-slate-500">
                در این قسمت می‌توانید فقط دیتای اختصاصی یک استاد خاص (شامل طلاب، سوابق و عکس‌های پایه او) را دانلود نمایید.
              </p>
            </div>
          </div>
        </div>

        {/* 4 Cards for 4 Mentors */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mentorCards.map((m) => {
            const isExportingThis = exportingMentorId === m.id;
            return (
              <div
                key={m.id}
                className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={cn("w-10 h-10 rounded-xl text-white font-bold flex items-center justify-center text-sm shadow-sm", m.avatarBg)}>
                      {m.name.split(' ')[1]?.[0] || 'ا'}
                    </div>
                    <span className={cn("text-[11px] px-2.5 py-1 rounded-full font-bold border", m.badgeBg, m.badgeText, m.badgeBorder)}>
                      {m.gradeLabel}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-black text-slate-800 text-sm flex items-center gap-1.5">
                      <span>{m.name}</span>
                      {m.id === 'shahpoori' && <ShieldCheck size={14} className="text-amber-600" />}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">{m.role}</p>
                  </div>

                  <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="text-slate-500">تعداد طلاب:</span>
                    <span className="font-black text-slate-800">{m.studentCount} طلبه</span>
                  </div>

                  <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="text-slate-500">عکس‌های ثبت شده:</span>
                    <span className="font-black text-emerald-600">{m.photoCount} عکس</span>
                  </div>
                </div>

                <button
                  onClick={() => handleExportMentorBackup(m.id)}
                  disabled={isExportingThis}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50"
                  title={`دانلود فایل پشتیبان اختصاصی ${m.name}`}
                >
                  {isExportingThis ? (
                    <RefreshCw size={14} className="animate-spin text-indigo-600" />
                  ) : (
                    <Download size={14} className="text-slate-600" />
                  )}
                  <span>دانلود دیتای {m.name}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Photo Management & Dedicated Image Archive */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
              <ImageIcon size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">۳. مدیریت و پشتیبان‌گیری اختصاصی عکس‌ها</h2>
              <p className="text-xs text-slate-500">
                تمامی عکس‌ها در فایل‌های پشتیبان فوق به صورت خودکار گنجانده شده‌اند؛ در صورت تمایل می‌توانید آرشیو مستقل تصاویر را نیز دریافت کنید.
              </p>
            </div>
          </div>

          <button
            onClick={handleExportAllPhotosJson}
            disabled={stats.totalPhotos === 0}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
          >
            <Download size={15} />
            <span>دانلود پکیج مستقل عکس‌ها (JSON)</span>
          </button>
        </div>

        {/* Photos Preview Grid */}
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
          <div className="flex items-center justify-between mb-3 text-xs font-bold text-slate-700">
            <span>عکس‌های موجود در پایگاه داده محلی ({stats.totalPhotos} مورد):</span>
            <span className="text-slate-400 font-normal">ذخیره شده به صورت Base64 مستقیم در حافظه سیستم</span>
          </div>

          {stats.totalPhotos === 0 ? (
            <p className="text-center py-6 text-xs text-slate-400">
              هنوز عکسی برای طلاب بارگذاری نشده است. هنگام ویرایش یا ثبت طلبه جدید می‌توانید عکس اضافه کنید.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
              {students
                .filter((s) => s.photoUrl)
                .map((s) => (
                  <div key={s.id} className="flex flex-col items-center gap-1 group">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-white shadow-sm group-hover:scale-105 transition-transform relative">
                      <img src={s.photoUrl} alt={s.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[10px] text-slate-600 font-medium text-center truncate max-w-full">
                      {s.name}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 4: Storage Breakdown & Reset Tools */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">جزئیات اطلاعات ذخیره شده در پایگاه داده محلی</h3>
          </div>
          <button
            onClick={() => setShowResetConfirmModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-xl transition-all font-bold"
          >
            <Trash2 size={14} />
            <span>پاک‌سازی کامل پایگاه داده</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-center">
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

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirmModal && (
          <div className="fixed inset-0 bg-[#00000044] backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
