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
  X
} from 'lucide-react';
import { localDb, FullBackupPackage, StudentBackupPackage } from '../lib/localDb';
import { Student } from '../types';
import { useMentor } from '../context/MentorContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function BackupAndRestore() {
  const { currentMentor } = useMentor();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentSearchTerm, setStudentSearchTerm] = useState<string>('');
  const [isExportingFull, setIsExportingFull] = useState<boolean>(false);
  const [isExportingStudent, setIsExportingStudent] = useState<boolean>(false);
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

  const fullFileInputRef = useRef<HTMLInputElement>(null);
  const studentFileInputRef = useRef<HTMLInputElement>(null);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState<boolean>(false);
  const [resetConfirmText, setResetConfirmText] = useState<string>('');

  const loadData = async () => {
    try {
      const allStudents = await localDb.getDocs<Student>('students');
      setStudents(allStudents);
      const storageStats = await localDb.getStorageStats();
      setStats(storageStats);
      if (allStudents.length > 0 && !selectedStudentId) {
        setSelectedStudentId(allStudents[0].id);
      }
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

  const handleExportFullBackup = async () => {
    setIsExportingFull(true);
    setStatusMessage(null);
    try {
      const backup = await localDb.exportFullBackup();
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
      const timeStr = new Date().toTimeString().slice(0, 5).replace(/:/g, '-');
      const filename = `tolab_full_backup_${dateStr}_${timeStr}.json`;
      downloadJsonFile(backup, filename);
      setStatusMessage({
        type: 'success',
        text: `فایل پشتیبان کامل سیستم با موفقیت تولید و دانلود شد (${backup._meta.totalRecords} رکورد شامل تمامی عکس‌ها).`
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

  const handleExportStudentBackup = async () => {
    if (!selectedStudentId) {
      alert('لطفاً یک طلبه را برای دریافت پشتیبان انتخاب کنید.');
      return;
    }
    setIsExportingStudent(true);
    setStatusMessage(null);
    try {
      const backup = await localDb.exportStudentBackup(selectedStudentId);
      const studentName = backup.student.name.replace(/\s+/g, '_');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
      const filename = `student_backup_${studentName}_${dateStr}.json`;
      downloadJsonFile(backup, filename);
      setStatusMessage({
        type: 'success',
        text: `فایل پشتیبان پرونده «${backup.student.name}» با موفقیت تولید و دانلود شد (شامل عکس، مقالات، نمرات و اطلاعات).`
      });
    } catch (err: any) {
      console.error('Student backup error:', err);
      setStatusMessage({
        type: 'error',
        text: `خطا در دریافت پشتیبان طلبه: ${err?.message || 'خطای ناشناخته'}`
      });
    } finally {
      setIsExportingStudent(false);
    }
  };

  const handleFullFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setStatusMessage(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data._meta || data._meta.exportType !== 'full') {
        // If it lacks full meta but has collections, try accepting
        if (!data.students && !data.programs) {
          throw new Error('این فایل ساختار استاندارد پشتیبان کامل نرم‌افزار را ندارد.');
        }
      }

      const result = await localDb.restoreFullBackup(data, importMode);
      setStatusMessage({
        type: 'success',
        text: result.message
      });
      await loadData();
    } catch (err: any) {
      console.error('Import full backup error:', err);
      setStatusMessage({
        type: 'error',
        text: `خطا در بازیابی فایل پشتیبان کامل: ${err?.message || 'فرمت فایل پشتیبان نامعتبر است'}`
      });
    } finally {
      setIsImporting(false);
      if (fullFileInputRef.current) fullFileInputRef.current.value = '';
    }
  };

  const handleStudentFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setStatusMessage(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.student || !data.student.name) {
        throw new Error('این فایل ساختار پشتیبان اختصاصی طلبه را ندارد.');
      }

      const result = await localDb.restoreStudentBackup(data, importMode);
      setStatusMessage({
        type: 'success',
        text: `اطلاعات و پرونده کامل طلبه «${result.studentName}» با موفقیت به نرم‌افزار افزوده شد.`
      });
      await loadData();
    } catch (err: any) {
      console.error('Import student backup error:', err);
      setStatusMessage({
        type: 'error',
        text: `خطا در بازیابی فایل طلبه: ${err?.message || 'فرمت فایل نامعتبر است'}`
      });
    } finally {
      setIsImporting(false);
      if (studentFileInputRef.current) studentFileInputRef.current.value = '';
    }
  };

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

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
      (s.nationalId && s.nationalId.includes(studentSearchTerm)) ||
      (s.grade && s.grade.includes(studentSearchTerm))
  );

  const selectedStudentObj = students.find((s) => s.id === selectedStudentId);

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-right font-vazir" dir="rtl">
      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fullFileInputRef}
        onChange={handleFullFileSelected}
        accept=".json"
        className="hidden"
      />
      <input
        type="file"
        ref={studentFileInputRef}
        onChange={handleStudentFileSelected}
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
              <span>ذخیره‌سازی ۱۰۰٪ آفلاین بر روی دستگاه شما</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              پشتیبان‌گیری و بازیابی داده‌ها
            </h1>
            <p className="text-indigo-100 text-xs sm:text-sm max-w-2xl leading-relaxed">
              تمام اطلاعات نرم‌افزار، پرونده‌ها و عکس‌های طلاب به صورت محلی و امن روی لپ‌تاپ شما نگهداری می‌شوند.
              در این بخش می‌توانید از کل نرم‌افزار یا تک‌تک طلاب فایل پشتیبان تهیه کرده و در مواقع نیاز آن را بازیابی کنید.
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

      {/* Main Grid: 2 Major Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Full System Backup & Restore */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                <Database size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">۱. پشتیبان‌گیری کل سیستم</h2>
                <p className="text-xs text-slate-500">پشتیبان‌گیری و بازیابی از کلیه جداول، طلاب، دوره‌ها و تنظیمات</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="flex items-center justify-between font-bold text-slate-700">
                <span>محتوای ذخیره شده در فایل:</span>
                <span className="text-indigo-600 font-mono">JSON خودکفا</span>
              </div>
              <ul className="grid grid-cols-2 gap-2 text-[11px]">
                <li className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" /> مشخصات کامل طلاب</li>
                <li className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" /> کلیه عکس‌های بارگذاری شده</li>
                <li className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" /> سوابق پژوهش و مقالات</li>
                <li className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" /> دوره‌ها و ساعات مطالعه</li>
                <li className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" /> نظرات و امتحانات شفاهی</li>
                <li className="flex items-center gap-1.5"><Check size={14} className="text-emerald-500" /> پیگیری‌ها و برنامه‌ها</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {/* Export Full Backup Button */}
            <button
              onClick={handleExportFullBackup}
              disabled={isExportingFull}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl font-bold transition-all shadow-md hover:shadow-indigo-200 disabled:opacity-50"
            >
              {isExportingFull ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <ArrowDownToLine size={18} />
              )}
              <span>دانلود فایل پشتیبان کامل نرم‌افزار (با عکس‌ها)</span>
            </button>

            {/* Restore Full Backup Box */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <ArrowUpFromLine size={14} className="text-indigo-600" />
                  <span>بارگذاری و بازیابی فایل پشتیبان کل سیستم:</span>
                </span>
                
                {/* Import Mode Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
                  <button
                    onClick={() => setImportMode('merge')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-all",
                      importMode === 'merge' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                    )}
                    title="داده‌های جدید اضافه شده و داده‌های فعلی حفظ می‌شوند"
                  >
                    ادغام
                  </button>
                  <button
                    onClick={() => setImportMode('overwrite')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg transition-all",
                      importMode === 'overwrite' ? "bg-rose-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                    )}
                    title="داده‌های موجود کاملاً حذف و با فایل پشتیبان جایگزین می‌شوند"
                  >
                    جایگزینی کامل
                  </button>
                </div>
              </div>

              <button
                onClick={() => fullFileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border-2 border-dashed border-indigo-200 hover:border-indigo-400 text-indigo-700 rounded-2xl font-bold transition-all disabled:opacity-50"
              >
                <Upload size={16} />
                <span>انتخاب و بارگذاری فایل پشتیبان کل نرم‌افزار (.json)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Single Student Backup & Restore */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
                <User size={24} />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800">۲. پشتیبان‌گیری پرونده تک‌تک طلاب</h2>
                <p className="text-xs text-slate-500">پشتیبان‌گیری مستقل از پرونده یک طلبه خاص با امکان انتقال و بازیابی</p>
              </div>
            </div>

            {/* Student Picker */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">انتخاب طلبه مورد نظر:</label>
              
              <div className="relative">
                <Search size={14} className="absolute right-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="جستجوی نام یا کد ملی..."
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  className="w-full pr-8 pl-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-2xl p-1 space-y-1 divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <p className="text-center py-4 text-xs text-slate-400">طلبه‌ای یافت نشد.</p>
                ) : (
                  filteredStudents.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStudentId(s.id)}
                      className={cn(
                        "w-full flex items-center justify-between p-2 rounded-xl text-right transition-all text-xs",
                        selectedStudentId === s.id
                          ? "bg-emerald-50 text-emerald-900 font-bold border border-emerald-200"
                          : "hover:bg-slate-50 text-slate-700"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {s.photoUrl ? (
                          <img src={s.photoUrl} alt={s.name} className="w-6 h-6 rounded-full object-cover border border-slate-200" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-600 font-bold">
                            {s.name[0]}
                          </div>
                        )}
                        <span>{s.name}</span>
                        {s.grade && <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">{s.grade}</span>}
                      </div>
                      {selectedStudentId === s.id && <Check size={14} className="text-emerald-600" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {/* Export Student Backup Button */}
            <button
              onClick={handleExportStudentBackup}
              disabled={isExportingStudent || !selectedStudentId}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl font-bold transition-all shadow-md hover:shadow-emerald-200 disabled:opacity-50"
            >
              {isExportingStudent ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <ArrowDownToLine size={18} />
              )}
              <span>
                دانلود پشتیبان پرونده {selectedStudentObj ? `«${selectedStudentObj.name}»` : 'طلبه انتخابی'}
              </span>
            </button>

            {/* Restore Student Backup Box */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <span className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <ArrowUpFromLine size={14} className="text-emerald-600" />
                <span>بارگذاری فایل پشتیبان پرونده یک طلبه:</span>
              </span>

              <button
                onClick={() => studentFileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border-2 border-dashed border-emerald-200 hover:border-emerald-400 text-emerald-700 rounded-2xl font-bold transition-all disabled:opacity-50"
              >
                <Upload size={16} />
                <span>انتخاب و افزودن فایل پشتیبان طلبه (.json)</span>
              </button>
            </div>
          </div>
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
                کلیه تصاویر به صورت مستقیم در فایل‌های پشتیبان ذخیره می‌شوند و می‌توانید آرشیو مجزای عکس‌ها را نیز دانلود کنید.
              </p>
            </div>
          </div>

          <button
            onClick={handleExportAllPhotosJson}
            disabled={stats.totalPhotos === 0}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold transition-all disabled:opacity-40"
          >
            <Download size={15} />
            <span>دانلود پکیج مجزای عکس‌ها (JSON)</span>
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
