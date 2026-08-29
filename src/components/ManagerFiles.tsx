import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  FileText,
  Upload,
  Download,
  Trash2,
  Lock,
  Eye,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Users,
  User,
  BookOpen,
  CheckSquare,
  FolderOpen,
  ShieldCheck,
  KeyRound,
  X,
  Plus,
  Info,
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react';
import { useMentor, MENTORS } from '../context/MentorContext';
import {
  ManagerFileItem,
  uploadManagerFile,
  fetchManagerFiles,
  deleteManagerFile
} from '../lib/managerFiles';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const REQUIRED_PASSWORD = '8411924';

export default function ManagerFiles() {
  const { currentMentor, currentMentorId } = useMentor();
  const isManager = currentMentor.isHeadManager || currentMentorId === 'shahpoori';

  const [filesList, setFilesList] = useState<ManagerFileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Form State for Uploading New File (Manager Mode)
  const [titleInput, setTitleInput] = useState<string>('');
  const [descriptionInput, setDescriptionInput] = useState<string>('');
  const [categoryInput, setCategoryInput] = useState<'study_discussion' | 'attendance' | 'other'>('study_discussion');
  const [targetTypeInput, setTargetTypeInput] = useState<'all' | 'specific'>('all');
  const [targetMentorIdInput, setTargetMentorIdInput] = useState<string>('hayati');
  
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number; dataUrl: string } | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password Verification State for Download (User Mode)
  const [isPasswordVerified, setIsPasswordVerified] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [pendingDownloadFile, setPendingDownloadFile] = useState<ManagerFileItem | null>(null);

  // Search & Category Filter for Users View
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const records = await fetchManagerFiles(currentMentorId, isManager);
      setFilesList(records);
    } catch (e) {
      console.error('Error fetching manager files:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, [currentMentorId, isManager]);

  // Handle local file picking for upload
  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSelectedFile({
        name: file.name,
        size: file.size,
        dataUrl
      });
    };
    reader.readAsDataURL(file);
  };

  // Submit new file from Manager to Users
  const handleSendFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleInput.trim()) {
      setStatusMessage({ type: 'error', text: 'لطفاً عنوان فایل را وارد نمایید.' });
      return;
    }
    if (!selectedFile) {
      setStatusMessage({ type: 'error', text: 'لطفاً یک فایل جهت ارسال انتخاب کنید.' });
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);

    try {
      let targetName = 'همه کاربران';
      let targetId = 'all';

      if (targetTypeInput === 'specific') {
        targetId = targetMentorIdInput;
        const targetObj = MENTORS[targetMentorIdInput as keyof typeof MENTORS];
        targetName = targetObj ? targetObj.name : 'کاربر خاص';
      }

      let categoryLabel = 'مطالعات و مباحثات';
      if (categoryInput === 'attendance') categoryLabel = 'حضور و غیاب';
      if (categoryInput === 'other') categoryLabel = 'سایر فایل‌ها';

      const newRecord = await uploadManagerFile({
        title: titleInput.trim(),
        description: descriptionInput.trim(),
        category: categoryInput,
        categoryLabel,
        targetType: targetTypeInput,
        targetMentorId: targetId,
        targetMentorName: targetName,
        fileDataUrl: selectedFile.dataUrl,
        fileName: selectedFile.name,
        fileSizeBytes: selectedFile.size,
        senderName: `${currentMentor.name} (${currentMentor.role})`
      });

      setStatusMessage({
        type: 'success',
        text: `فایل «${newRecord.title}» با موفقیت ثبت و برای ${targetName} در دیتابیس ارسال شد.`
      });

      // Reset form
      setTitleInput('');
      setDescriptionInput('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      await loadFiles();
    } catch (err: any) {
      console.error('Error sending file:', err);
      setStatusMessage({
        type: 'error',
        text: `خطا در ارسال فایل: ${err?.message || 'مشکل اتصال'}`
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Download File Logic
  const triggerDownload = (fileItem: ManagerFileItem) => {
    const link = document.createElement('a');
    link.href = fileItem.fileDataUrl;
    link.download = fileItem.fileName || `${fileItem.title}.file`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setStatusMessage({
      type: 'success',
      text: `فایل «${fileItem.title}» با موفقیت دانلود شد.`
    });
  };

  const handleDownloadClick = (fileItem: ManagerFileItem) => {
    if (isPasswordVerified) {
      triggerDownload(fileItem);
    } else {
      setPendingDownloadFile(fileItem);
      setPasswordError('');
      setPasswordInput('');
      setShowPasswordModal(true);
    }
  };

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.trim() === REQUIRED_PASSWORD) {
      setIsPasswordVerified(true);
      setPasswordError('');
      setShowPasswordModal(false);
      setPasswordInput('');
      if (pendingDownloadFile) {
        triggerDownload(pendingDownloadFile);
        setPendingDownloadFile(null);
      }
    } else {
      setPasswordError('رمز عبور وارد شده نادرست است.');
    }
  };

  // Delete file
  const handleDeleteFile = async (fileId: string, title: string) => {
    try {
      await deleteManagerFile(fileId);
      setStatusMessage({
        type: 'info',
        text: `فایل «${title}» با موفقیت از دیتابیس حذف گردید.`
      });
      await loadFiles();
    } catch (e) {
      console.error('Error deleting file:', e);
    }
  };

  // Filtered list for display
  const displayFiles = filesList.filter((f) => {
    // Category Filter
    if (activeCategoryFilter !== 'all' && f.category !== activeCategoryFilter) {
      return false;
    }
    // Search Term
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      return (
        f.title.toLowerCase().includes(term) ||
        f.fileName.toLowerCase().includes(term) ||
        f.targetMentorName.toLowerCase().includes(term) ||
        (f.description && f.description.toLowerCase().includes(term))
      );
    }
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 text-right font-vazir" dir="rtl">
      {/* Hidden File Picker Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFilePicked}
        className="hidden"
      />

      {/* Header Banner */}
      <div className="bg-gradient-to-l from-indigo-900 via-indigo-800 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -left-12 -top-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/15 rounded-full text-xs font-bold backdrop-blur-md">
              <FolderOpen size={14} className="text-amber-300" />
              <span>پایگاه داده فایل‌های مدیریتی</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              {isManager ? 'ارسال فایل برای کاربران' : 'فایل‌های ارسالی مدیر'}
            </h1>
            <p className="text-indigo-100 text-xs sm:text-sm max-w-2xl leading-relaxed">
              {isManager
                ? 'مدیریت و ارسال فایل‌های مطالعات و مباحثات، حضور و غیاب و سایر جزوات آموزشی به صورت عمومی برای همه یا اختصاصی برای یک کاربر خاص.'
                : 'در این بخش می‌توانید کلیه فایل‌ها، مباحثات و فرم‌های ارسال شده توسط مدیر (استاد شاهپوری) را مشاهده و پس از ورود رمز عبور دانلود نمایید.'}
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 p-3.5 rounded-2xl backdrop-blur-md border border-white/20 shrink-0">
            <div className="text-center px-3 py-1">
              <span className="block text-2xl font-black text-white">{filesList.length}</span>
              <span className="text-[11px] text-indigo-200">کل فایل‌های ارسالی</span>
            </div>
            <div className="w-px h-8 bg-white/20"></div>
            <div className="text-center px-3 py-1">
              <span className="block text-2xl font-black text-amber-300">
                {filesList.filter((f) => f.targetType === 'all').length}
              </span>
              <span className="text-[11px] text-indigo-200">فایل‌های عمومی</span>
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

      {/* MANAGER FORM SECTION (Visible Only to Head Manager / Shahpoori) */}
      {isManager && (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
              <Send size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">فرم جدید ارسال فایل به کاربران</h2>
              <p className="text-xs text-slate-500">مشخصات فایل را تکمیل کرده و دریافت‌کننده را تعیین نمایید</p>
            </div>
          </div>

          <form onSubmit={handleSendFileSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* File Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">عنوان فایل / جزوه:</label>
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="مثلاً: برنامه مطالعاتی هفته اول آبان"
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">دسته‌بندی موضوعی فایل:</label>
                <select
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value as any)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                >
                  <option value="study_discussion">📚 فایل‌های مطالعات و مباحثات</option>
                  <option value="attendance">📋 فایل‌های حضور و غیاب</option>
                  <option value="other">📁 سایر فایل‌ها و فرم‌ها</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Recipient Type */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">ارسال به کدام کاربران؟</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setTargetTypeInput('all')}
                    className={cn(
                      "py-2 px-3 rounded-lg transition-all text-center",
                      targetTypeInput === 'all' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    👥 همه کاربران (عمومی)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetTypeInput('specific')}
                    className={cn(
                      "py-2 px-3 rounded-lg transition-all text-center",
                      targetTypeInput === 'specific' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    👤 یک کاربر خاص
                  </button>
                </div>
              </div>

              {/* Specific Mentor Dropdown */}
              {targetTypeInput === 'specific' ? (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">انتخاب کاربر/استاد مقصد:</label>
                  <select
                    value={targetMentorIdInput}
                    onChange={(e) => setTargetMentorIdInput(e.target.value)}
                    className="w-full p-3 border border-indigo-200 rounded-xl text-xs font-bold bg-indigo-50/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  >
                    <option value="hayati">استاد حیاتی (مسئول پایه ۷)</option>
                    <option value="hosseini">استاد حسینی (مسئول پایه ۸)</option>
                    <option value="soleimani">استاد سلیمانی (مسئول پایه ۹)</option>
                    <option value="asadi">استاد اسدی (مسئول پایه ۱۰)</option>
                  </select>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">وضعیت دسترسی:</label>
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>فایل در منوی تمامی اساتید (پایه ۷، ۸، ۹ و ۱۰) قابل مشاهده خواهد بود.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Description / Note */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">توضیحات و یادداشت مدیر (اختیاری):</label>
              <textarea
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                placeholder="توضیحاتی درباره این فایل، مهلت یا نحوه استفاده..."
                rows={2}
                className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 resize-none"
              />
            </div>

            {/* File Attachment Dropzone */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 border-2 border-dashed border-slate-300 p-4 rounded-2xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <Upload size={20} />
                </div>
                <div>
                  <span className="block text-xs font-bold text-slate-800">
                    {selectedFile ? selectedFile.name : 'انتخاب پیوست فایل (Excel, PDF, JSON, Word, ...)'}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {selectedFile ? `حجم: ${(selectedFile.size / 1024).toFixed(1)} کیلوبایت` : 'فایل مورد نظر را بارگذاری کنید'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all shrink-0"
              >
                {selectedFile ? 'تغییر فایل' : 'انتخاب فایل از سیستم'}
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isUploading}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl text-sm font-bold transition-all shadow-md hover:shadow-indigo-200 disabled:opacity-50"
            >
              {isUploading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
              <span>ثبت و ارسال فایل به دیتابیس</span>
            </button>
          </form>
        </div>
      )}

      {/* FILES LIST SECTION */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
              <FolderOpen size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-800">لیست فایل‌های ارسالی مدیر</h2>
                <span className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold">
                  <Lock size={12} /> نیازمند رمز عبور جهت دانلود
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {isManager ? 'مدیریت و مشاهده کل فایل‌های ارسال شده در دیتابیس' : 'فایل‌های اختصاصی شما و فایل‌های عمومی حوزه'}
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-xs w-full">
            <Search size={16} className="absolute right-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجوی نام یا عنوان فایل..."
              className="w-full pr-9 pl-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Category Tabs Filter */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3 text-xs font-bold">
          <button
            onClick={() => setActiveCategoryFilter('all')}
            className={cn(
              "py-2 px-3.5 rounded-xl transition-all",
              activeCategoryFilter === 'all'
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            همه فایل‌ها ({filesList.length})
          </button>

          <button
            onClick={() => setActiveCategoryFilter('study_discussion')}
            className={cn(
              "py-2 px-3.5 rounded-xl transition-all flex items-center gap-1.5",
              activeCategoryFilter === 'study_discussion'
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
            )}
          >
            <BookOpen size={14} />
            <span>مطالعات و مباحثات ({filesList.filter(f => f.category === 'study_discussion').length})</span>
          </button>

          <button
            onClick={() => setActiveCategoryFilter('attendance')}
            className={cn(
              "py-2 px-3.5 rounded-xl transition-all flex items-center gap-1.5",
              activeCategoryFilter === 'attendance'
                ? "bg-emerald-600 text-white shadow-xs"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            )}
          >
            <CheckSquare size={14} />
            <span>حضور و غیاب ({filesList.filter(f => f.category === 'attendance').length})</span>
          </button>

          <button
            onClick={() => setActiveCategoryFilter('other')}
            className={cn(
              "py-2 px-3.5 rounded-xl transition-all flex items-center gap-1.5",
              activeCategoryFilter === 'other'
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 text-amber-800 hover:bg-amber-100"
            )}
          >
            <FolderOpen size={14} />
            <span>سایر فایل‌ها ({filesList.filter(f => f.category === 'other').length})</span>
          </button>
        </div>

        {/* Files Grid / List */}
        {isLoading ? (
          <div className="py-12 text-center space-y-2 text-slate-400">
            <RefreshCw size={24} className="animate-spin mx-auto text-indigo-500" />
            <span className="text-xs">در حال دریافت فایل‌های مدیر از دیتابیس...</span>
          </div>
        ) : displayFiles.length === 0 ? (
          <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400 text-xs space-y-2">
            <FolderOpen size={36} className="mx-auto text-slate-300" />
            <p>هیچ فایلی در این دسته‌بندی یافت نشد.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayFiles.map((file) => (
              <div
                key={file.id}
                className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-indigo-300 transition-all shadow-2xs group"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn(
                      "text-[10px] px-2.5 py-0.5 rounded-full font-bold border",
                      file.category === 'study_discussion' && "bg-indigo-50 border-indigo-200 text-indigo-700",
                      file.category === 'attendance' && "bg-emerald-50 border-emerald-200 text-emerald-700",
                      file.category === 'other' && "bg-amber-50 border-amber-200 text-amber-800"
                    )}>
                      {file.categoryLabel}
                    </span>

                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-bold border",
                      file.targetType === 'all'
                        ? "bg-slate-100 border-slate-200 text-slate-700"
                        : "bg-purple-50 border-purple-200 text-purple-700"
                    )}>
                      {file.targetType === 'all' ? '👥 عمومی (همه)' : `👤 ${file.targetMentorName}`}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-black text-slate-800 text-xs sm:text-sm leading-snug">{file.title}</h3>
                    {file.description && (
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {file.description}
                      </p>
                    )}
                  </div>

                  <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 space-y-1 text-[11px]">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>نام فایل:</span>
                      <span className="font-bold text-slate-800 truncate max-w-[150px]">{file.fileName}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 text-[10px]">
                      <span>زمان ثبت:</span>
                      <span>{file.persianDate}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 text-[10px]">
                      <span>حجم فایل:</span>
                      <span className="font-mono">{file.fileSizeFormatted}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                  <button
                    onClick={() => handleDownloadClick(file)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
                  >
                    <Download size={14} />
                    <span>دانلود فایل</span>
                  </button>

                  {isManager && (
                    <button
                      onClick={() => handleDeleteFile(file.id, file.title)}
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      title="حذف از دیتابیس"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PASSWORD REQUIRED MODAL FOR DOWNLOAD */}
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
              <h3 className="text-base font-black text-slate-900">ورود رمز عبور جهت دانلود فایل</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                دانلود فایل‌های ارسالی مدیر مستلزم ورود رمز عبور می‌باشد. لطفاً رمز عبور را وارد کنید:
              </p>

              <form onSubmit={handleVerifyPassword} className="space-y-3">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="رمز عبور..."
                  autoFocus
                  className="w-full p-3 border border-slate-300 rounded-xl text-center font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                />

                {passwordError && (
                  <p className="text-xs font-bold text-rose-600 text-center">{passwordError}</p>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    تأیید و دانلود
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setPendingDownloadFile(null);
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
    </div>
  );
}
