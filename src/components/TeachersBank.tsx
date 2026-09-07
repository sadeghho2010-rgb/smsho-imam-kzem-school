import React, { useState, useEffect, useRef } from 'react';
import { 
  UserPlus, 
  Search, 
  Filter, 
  Phone, 
  GraduationCap, 
  BookOpen, 
  Edit, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Star, 
  Upload, 
  Download, 
  Grid, 
  List, 
  FileSpreadsheet, 
  Copy, 
  Check, 
  Clock, 
  Sparkles, 
  ChevronDown,
  UserCheck,
  Award,
  HelpCircle,
  FileText,
  Printer,
  PhoneCall,
  ShieldAlert
} from 'lucide-react';
import { Teacher, TeacherCategory, TeacherDetailedSpecialties } from '../types';
import { localDb } from '../lib/localDb';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { exportElementToPdf } from '../lib/pdfExport';

const ALL_CATEGORIES: TeacherCategory[] = [
  'فقه',
  'اصول',
  'فلسفه',
  'مشاوره اصول',
  'مشاوره فقه',
  'مشاوره فلسفه',
  'دروس پنجشنبه',
  'ویژه'
];

export default function TeachersBank() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Search and Filters State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedPhoneFilter, setSelectedPhoneFilter] = useState<string>('all'); // all | has-phone | no-phone

  // Export Settings State
  const [includePhoneInExport, setIncludePhoneInExport] = useState<boolean>(true);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const pdfPrintRef = useRef<HTMLDivElement>(null);

  // Import State
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Layout View Mode
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  // Form State
  const [fullName, setFullName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [priority, setPriority] = useState<1 | 2 | 3>(1);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [selectedCategories, setSelectedCategories] = useState<TeacherCategory[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [experienceHistory, setExperienceHistory] = useState<string>('');

  // Detailed Specialties State
  const [usulSpecialties, setUsulSpecialties] = useState<('رسائل' | 'کفایه' | 'حلقات')[]>([]);
  const [fiqhSpecialties, setFiqhSpecialties] = useState<('مکاسب')[]>([]);
  const [falsafaSpecialties, setFalsafaSpecialties] = useState<('بدایه' | 'نهایه' | 'آموزش فلسفه')[]>([]);
  const [thursdayNote, setThursdayNote] = useState<string>('');

  // Fetch teachers from DB & cleanup any seed samples
  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const docs = (await localDb.getDocs('teachers')) as Teacher[];

      // Clean up previous seed sample data if exists
      const SEED_NAMES = [
        'استاد سید محمدحسین حسینی',
        'استاد رضا سلیمانی',
        'استاد علی‌اکبر اسدی'
      ];
      const seedDocs = docs.filter(d => SEED_NAMES.includes(d.fullName));
      
      if (seedDocs.length > 0) {
        for (const sd of seedDocs) {
          await localDb.deleteDoc('teachers', sd.id);
        }
        const cleanDocs = (await localDb.getDocs('teachers')) as Teacher[];
        setTeachers(cleanDocs);
      } else {
        setTeachers(docs);
      }
    } catch (err) {
      console.error('Error fetching teachers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const openAddModal = () => {
    setEditingTeacher(null);
    setFullName('');
    setPhoneNumber('');
    setPhotoUrl('');
    setPriority(1);
    setIsActive(true);
    setSelectedCategories(['اصول']);
    setNotes('');
    setExperienceHistory('');
    setUsulSpecialties([]);
    setFiqhSpecialties([]);
    setFalsafaSpecialties([]);
    setThursdayNote('');
    setShowModal(true);
  };

  const openEditModal = (t: Teacher) => {
    setEditingTeacher(t);
    setFullName(t.fullName || '');
    setPhoneNumber(t.phoneNumber || '');
    setPhotoUrl(t.photoUrl || '');
    setPriority((Number(t.priority) || 1) as 1 | 2 | 3);
    setIsActive(t.isActive !== false);
    setSelectedCategories(t.categories || []);
    setNotes(t.notes || '');
    setExperienceHistory(t.experienceHistory || '');
    setUsulSpecialties(t.detailedSpecialties?.usul || []);
    setFiqhSpecialties(t.detailedSpecialties?.fiqh || []);
    setFalsafaSpecialties(t.detailedSpecialties?.falsafa || []);
    setThursdayNote(t.detailedSpecialties?.thursdayNote || '');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;

    const teacherData: Partial<Teacher> = {
      fullName: fullName.trim(),
      phoneNumber: phoneNumber.trim(),
      photoUrl,
      priority,
      isActive,
      categories: selectedCategories,
      notes: notes.trim(),
      experienceHistory: experienceHistory.trim(),
      detailedSpecialties: {
        usul: (selectedCategories.includes('اصول') || selectedCategories.includes('مشاوره اصول')) ? usulSpecialties : [],
        fiqh: (selectedCategories.includes('فقه') || selectedCategories.includes('مشاوره فقه')) ? fiqhSpecialties : [],
        falsafa: (selectedCategories.includes('فلسفه') || selectedCategories.includes('مشاوره فلسفه')) ? falsafaSpecialties : [],
        thursdayNote: selectedCategories.includes('دروس پنجشنبه') ? thursdayNote.trim() : ''
      },
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingTeacher) {
        await localDb.updateDoc('teachers', editingTeacher.id, teacherData);
      } else {
        await localDb.addDoc('teachers', {
          ...teacherData,
          createdAt: new Date().toISOString()
        });
      }
      setShowModal(false);
      fetchTeachers();
    } catch (err) {
      console.error('Error saving teacher:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('آیا از حذف این استاد از بانک اساتید اطمینان دارید؟')) {
      try {
        await localDb.deleteDoc('teachers', id);
        fetchTeachers();
      } catch (err) {
        console.error('Error deleting teacher:', err);
      }
    }
  };

  const handleToggleStatus = async (t: Teacher) => {
    try {
      await localDb.updateDoc('teachers', t.id, {
        isActive: !t.isActive,
        updatedAt: new Date().toISOString()
      });
      fetchTeachers();
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('حجم عکس نباید بیشتر از ۲ مگابایت باشد.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleCategory = (cat: TeacherCategory) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(c => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const copyPhoneNumber = (id: string, num?: string) => {
    if (!num) return;
    navigator.clipboard.writeText(num);
    setCopiedPhoneId(id);
    setTimeout(() => setCopiedPhoneId(null), 2000);
  };

  // Filter logic
  const filteredTeachers = teachers.filter(t => {
    const searchLower = searchTerm.toLowerCase().trim();
    const matchesSearch = !searchLower || 
      t.fullName?.toLowerCase().includes(searchLower) ||
      t.phoneNumber?.includes(searchLower) ||
      t.notes?.toLowerCase().includes(searchLower) ||
      t.experienceHistory?.toLowerCase().includes(searchLower) ||
      t.categories?.some(c => c.toLowerCase().includes(searchLower)) ||
      t.detailedSpecialties?.usul?.some(u => u.includes(searchLower)) ||
      t.detailedSpecialties?.falsafa?.some(f => f.includes(searchLower)) ||
      t.detailedSpecialties?.thursdayNote?.toLowerCase().includes(searchLower);

    const matchesCategory = selectedCategoryFilter === 'all' || t.categories?.includes(selectedCategoryFilter as TeacherCategory);
    const matchesPriority = selectedPriorityFilter === 'all' || String(t.priority) === selectedPriorityFilter;
    const matchesStatus = selectedStatusFilter === 'all' || (selectedStatusFilter === 'active' ? t.isActive : !t.isActive);
    
    const matchesPhone = selectedPhoneFilter === 'all' || 
      (selectedPhoneFilter === 'has-phone' ? Boolean(t.phoneNumber && t.phoneNumber.trim()) : !t.phoneNumber || !t.phoneNumber.trim());

    return matchesSearch && matchesCategory && matchesPriority && matchesStatus && matchesPhone;
  });

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredTeachers.length === 0) {
      alert('هیچ استادی جهت خروجی در فیلتر فعلی وجود ندارد.');
      return;
    }

    const exportData = filteredTeachers.map((t, idx) => {
      const specList: string[] = [];
      if (t.detailedSpecialties?.usul?.length) specList.push(`اصول: ${t.detailedSpecialties.usul.join('، ')}`);
      if (t.detailedSpecialties?.fiqh?.length) specList.push(`فقه: ${t.detailedSpecialties.fiqh.join('، ')}`);
      if (t.detailedSpecialties?.falsafa?.length) specList.push(`فلسفه: ${t.detailedSpecialties.falsafa.join('، ')}`);
      if (t.detailedSpecialties?.thursdayNote) specList.push(`پنج‌شنبه: ${t.detailedSpecialties.thursdayNote}`);

      const row: Record<string, any> = {
        'ردیف': idx + 1,
        'نام و نام خانوادگی': t.fullName,
      };

      if (includePhoneInExport) {
        row['شماره تماس'] = t.phoneNumber || 'ثبت نشده';
      }

      row['تخصص‌های کلی'] = t.categories?.join(' | ') || '-';
      row['تخصص‌های جزئی'] = specList.join(' / ') || '-';
      row['سوابق تدریس در مجموعه'] = t.experienceHistory || '-';
      row['توضیحات'] = t.notes || '-';
      row['اولویت'] = `اولویت ${t.priority}`;
      row['وضعیت'] = t.isActive ? 'فعال' : 'غیرفعال';

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'بانک اساتید');
    XLSX.writeFile(workbook, `بانک_اساتید_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // Export to PDF
  const handleExportPdf = async () => {
    if (filteredTeachers.length === 0) {
      alert('هیچ استادی جهت خروجی در فیلتر فعلی وجود ندارد.');
      return;
    }
    if (!pdfPrintRef.current) return;

    try {
      setIsExportingPdf(true);
      await exportElementToPdf({
        element: pdfPrintRef.current,
        filename: `بانک_اساتید_${new Date().toISOString().slice(0,10)}.pdf`,
        orientation: 'landscape'
      });
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('خطا در صدور فایل PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Export to JSON
  const handleExportJson = () => {
    if (filteredTeachers.length === 0) {
      alert('هیچ استادی جهت خروجی در فیلتر فعلی وجود ندارد.');
      return;
    }

    const exportData = filteredTeachers.map((t) => {
      const copy = { ...t };
      if (!includePhoneInExport) {
        delete copy.phoneNumber;
      }
      return copy;
    });

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `بانک_اساتید_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import from Excel or JSON
  const handleProcessImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportMessage(null);

    const fileName = file.name.toLowerCase();

    try {
      let importedItems: any[] = [];

      if (fileName.endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          importedItems = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.teachers)) {
            importedItems = parsed.teachers;
          } else if (Array.isArray(parsed.data)) {
            importedItems = parsed.data;
          } else {
            throw new Error('فرمت JSON ساختار معتبری شامل لیست اساتید ندارد.');
          }
        }
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);

        importedItems = rows.map((row) => {
          const getVal = (...keys: string[]) => {
            for (const k of keys) {
              if (row[k] !== undefined && row[k] !== null && row[k] !== '') {
                return String(row[k]).trim();
              }
            }
            return '';
          };

          const fullName = getVal('نام و نام خانوادگی', 'نام خانوادگی', 'نام', 'fullName', 'Name', 'FullName');
          const phoneNumber = getVal('شماره تماس', 'تلفن', 'شماره همراه', 'موبایل', 'phoneNumber', 'Phone', 'Mobile');
          const catStr = getVal('تخصص‌های کلی', 'تخصص', 'دسته', 'دسته‌بندی', 'categories', 'Category');
          const specStr = getVal('تخصص‌های جزئی', 'کتاب‌ها', 'detailedSpecialties', 'Specialties');
          const experienceHistory = getVal('سوابق تدریس در مجموعه', 'سوابق تدریس', 'سوابق', 'experienceHistory');
          const notes = getVal('توضیحات', 'ملاحظات', 'notes', 'Notes');
          const priorityStr = getVal('اولویت', 'priority', 'Priority');
          const statusStr = getVal('وضعیت', 'isActive', 'Status', 'Active');

          let categories: TeacherCategory[] = [];
          if (catStr) {
            const parts = catStr.split(/[|،,/]/).map(s => s.trim());
            for (const p of parts) {
              if (ALL_CATEGORIES.includes(p as TeacherCategory)) {
                categories.push(p as TeacherCategory);
              }
            }
          }

          let priorityNum: 1 | 2 | 3 = 1;
          if (priorityStr.includes('2') || priorityStr.includes('۲') || priorityStr.includes('خوب')) priorityNum = 2;
          if (priorityStr.includes('3') || priorityStr.includes('۳')) priorityNum = 3;

          const isActiveVal = !statusStr || statusStr === 'فعال' || statusStr.toLowerCase() === 'true' || statusStr === '1';

          return {
            fullName,
            phoneNumber,
            categories: categories.length > 0 ? categories : ['اصول'],
            notes,
            experienceHistory,
            priority: priorityNum,
            isActive: isActiveVal,
            detailedSpecialties: {
              usul: specStr.includes('رسائل') ? ['رسائل'] : specStr.includes('کفایه') ? ['کفایه'] : specStr.includes('حلقات') ? ['حلقات'] : [],
              fiqh: specStr.includes('مکاسب') ? ['مکاسب'] : [],
              falsafa: specStr.includes('بدایه') ? ['بدایه'] : specStr.includes('نهایه') ? ['نهایه'] : [],
              thursdayNote: specStr.includes('پنج‌شنبه') ? specStr : ''
            }
          };
        });
      } else {
        throw new Error('فرمت فایل انتخاب شده پشتیبانی نمی‌شود. تنها فایل‌های JSON, XLSX, XLS, CSV مجاز هستند.');
      }

      const validTeachers = importedItems.filter((item) => item && typeof item === 'object' && item.fullName && String(item.fullName).trim());

      if (validTeachers.length === 0) {
        throw new Error('هیچ استادی با نام معتبر در فایل یافت نشد.');
      }

      let count = 0;
      for (const t of validTeachers) {
        const categories = Array.isArray(t.categories) && t.categories.length > 0 
          ? t.categories.filter((c: any) => ALL_CATEGORIES.includes(c))
          : ['اصول'];

        const teacherRecord: Partial<Teacher> = {
          fullName: String(t.fullName).trim(),
          phoneNumber: t.phoneNumber ? String(t.phoneNumber).trim() : '',
          photoUrl: t.photoUrl || '',
          priority: (Number(t.priority) === 2 ? 2 : Number(t.priority) === 3 ? 3 : 1) as 1 | 2 | 3,
          isActive: t.isActive !== false,
          categories: categories.length > 0 ? categories : ['اصول'],
          notes: t.notes ? String(t.notes).trim() : '',
          experienceHistory: t.experienceHistory ? String(t.experienceHistory).trim() : '',
          detailedSpecialties: t.detailedSpecialties || { usul: [], fiqh: [], falsafa: [], thursdayNote: '' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await localDb.addDoc('teachers', teacherRecord);
        count++;
      }

      setImportMessage({
        type: 'success',
        text: `تعداد ${count} استاد با موفقیت به بانک اساتید اضافه شد.`
      });
      fetchTeachers();
    } catch (err: any) {
      console.error('Import error:', err);
      setImportMessage({
        type: 'error',
        text: err?.message || 'خطا در بارگذاری و ورود اطلاعات از فایل.'
      });
    } finally {
      setImportLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const getPriorityBadge = (p: 1 | 2 | 3 | string) => {
    const num = Number(p);
    if (num === 1) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
          <Star size={11} className="fill-emerald-600 text-emerald-600" />
          اولویت ۱ (عالی)
        </span>
      );
    }
    if (num === 2) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <Star size={11} className="text-blue-600" />
          اولویت ۲ (خوب)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
        اولویت ۳
      </span>
    );
  };

  const getCategoryColor = (cat: TeacherCategory) => {
    switch (cat) {
      case 'فقه':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'اصول':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'فلسفه':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'مشاوره اصول':
        return 'bg-sky-50 text-sky-800 border-sky-200';
      case 'مشاوره فقه':
        return 'bg-orange-50 text-orange-800 border-orange-200';
      case 'مشاوره فلسفه':
        return 'bg-violet-50 text-violet-800 border-violet-200';
      case 'دروس پنجشنبه':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'ویژه':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const hasUsulOrCounseling = selectedCategories.includes('اصول') || selectedCategories.includes('مشاوره اصول');
  const hasFiqhOrCounseling = selectedCategories.includes('فقه') || selectedCategories.includes('مشاوره فقه');
  const hasFalsafaOrCounseling = selectedCategories.includes('فلسفه') || selectedCategories.includes('مشاوره فلسفه');
  const hasThursday = selectedCategories.includes('دروس پنجشنبه');

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 opacity-10 pointer-events-none">
          <GraduationCap size={240} />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-bold backdrop-blur-md">
              <Award size={14} className="text-amber-400" />
              <span>بانک جامع اساتید و مدرسین مدعو</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">بانک اساتید</h1>
            <p className="text-xs sm:text-sm text-indigo-100 opacity-90 max-w-2xl leading-relaxed">
              بانک اطلاعات کامل اساتید حوزه علمیه به تفکیک دروس فقه، اصول، فلسفه، مشاوره‌های آموزشی و دروس ۵شنبه جهت دعوت و همکاری
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto shrink-0">
            <button
              onClick={handleExportExcel}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-2 rounded-2xl text-xs transition-all shadow-md active:scale-95"
            >
              <FileSpreadsheet size={15} />
              <span>خروجی اکسل</span>
            </button>

            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold px-3 py-2 rounded-2xl text-xs transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <Download size={15} />
              <span>{isExportingPdf ? 'در حال دریافت...' : 'خروجی PDF'}</span>
            </button>

            <button
              onClick={handleExportJson}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-2 rounded-2xl text-xs transition-all shadow-md active:scale-95"
            >
              <FileText size={15} />
              <span>خروجی JSON</span>
            </button>

            <button
              onClick={() => {
                setImportMessage(null);
                setShowImportModal(true);
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold px-3 py-2 rounded-2xl text-xs transition-all shadow-md active:scale-95"
            >
              <Upload size={15} />
              <span>افزودن از فایل (اکسل/JSON)</span>
            </button>

            <button
              onClick={openAddModal}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white font-black px-4 py-2 rounded-2xl text-xs transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-95"
            >
              <UserPlus size={16} />
              <span>افزودن استاد جدید</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters and Controls Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs space-y-4">
        
        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          
          {/* Search Input */}
          <div className="relative col-span-1 sm:col-span-2 lg:col-span-1">
            <Search className="absolute right-3.5 top-3 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="جستجو نام، شماره، درس..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none transition-all"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">همه تخصص‌ها و دسته‌ها</option>
              {ALL_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div className="relative">
            <select
              value={selectedPriorityFilter}
              onChange={(e) => setSelectedPriorityFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">همه اولویت‌ها</option>
              <option value="1">اولویت ۱ (عالی)</option>
              <option value="2">اولویت ۲ (خوب)</option>
              <option value="3">اولویت ۳ (معمولی)</option>
            </select>
          </div>

          {/* Phone Presence Filter */}
          <div className="relative">
            <select
              value={selectedPhoneFilter}
              onChange={(e) => setSelectedPhoneFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">فیلتر شماره: همه اساتید</option>
              <option value="has-phone">فقط اساتید دارای شماره تماس</option>
              <option value="no-phone">فقط اساتید بدون شماره تماس</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="active">فقط اساتید فعال</option>
              <option value="inactive">فقط غیرفعال‌ها</option>
            </select>
          </div>

        </div>

        {/* Export Option Checkbox & Summary bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs font-medium">
          
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-slate-600">
              تعداد اساتید یافت‌شده: <span className="font-bold text-indigo-700">{filteredTeachers.length}</span> نفر
            </span>

            {/* Export Toggle: Include Phone Number */}
            <label className="inline-flex items-center gap-2 cursor-pointer select-none bg-indigo-50 text-indigo-900 border border-indigo-200/80 px-3 py-1.5 rounded-xl hover:bg-indigo-100/80 transition-all">
              <input 
                type="checkbox"
                checked={includePhoneInExport}
                onChange={(e) => setIncludePhoneInExport(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
              />
              <span className="text-[11px] font-bold">درج شماره تماس اساتید در فایل خروجی (اکسل / PDF)</span>
            </label>
          </div>

          {/* Layout View Mode Buttons */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                viewMode === 'table' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <List size={15} />
              <span>جدول کامل</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={cn(
                "p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1",
                viewMode === 'cards' ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <Grid size={15} />
              <span>کارت‌ها</span>
            </button>
          </div>

        </div>
      </div>

      {/* Main Content: Table or Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 font-medium text-xs">
          در حال دریافت اطلاعات بانک اساتید...
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
            <GraduationCap size={32} />
          </div>
          <h3 className="text-base font-bold text-slate-800">هیچ استادی یافت نشد</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            می‌توانید فیلترها را تغییر داده یا روی دکمه «افزودن استاد جدید» کلیک کنید.
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-xs"
          >
            <UserPlus size={16} />
            <span>ثبت اولین استاد</span>
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="py-3.5 px-4">#</th>
                  <th className="py-3.5 px-4">استاد</th>
                  <th className="py-3.5 px-4">شماره تماس</th>
                  <th className="py-3.5 px-4">تخصص‌های کلی</th>
                  <th className="py-3.5 px-4">تخصص‌های جزئی (کتاب/موضوع)</th>
                  <th className="py-3.5 px-4 min-w-[180px]">سوابق تدریس در مجموعه</th>
                  <th className="py-3.5 px-4 min-w-[150px]">توضیحات</th>
                  <th className="py-3.5 px-4">اولویت</th>
                  <th className="py-3.5 px-4">وضعیت</th>
                  <th className="py-3.5 px-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeachers.map((teacher, idx) => {
                  const spec = teacher.detailedSpecialties;

                  return (
                    <tr 
                      key={teacher.id} 
                      className={cn(
                        "hover:bg-slate-50/80 transition-colors",
                        !teacher.isActive && "bg-slate-50/50 opacity-70"
                      )}
                    >
                      <td className="py-3 px-4 font-bold text-slate-400">{idx + 1}</td>
                      
                      {/* Name & Photo */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {teacher.photoUrl ? (
                            <img 
                              src={teacher.photoUrl} 
                              alt={teacher.fullName} 
                              className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0" 
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-sm shrink-0 border border-indigo-200">
                              {teacher.fullName?.charAt(0) || 'ا'}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{teacher.fullName}</div>
                            {!teacher.isActive && (
                              <span className="text-[10px] text-rose-500 font-bold">غیرفعال</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Phone Number */}
                      <td className="py-3 px-4 font-mono font-medium text-slate-700">
                        {teacher.phoneNumber ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => copyPhoneNumber(teacher.id, teacher.phoneNumber)}
                              className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                              title="کپی شماره"
                            >
                              {copiedPhoneId === teacher.id ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                            </button>
                            <span>{teacher.phoneNumber}</span>
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Categories (Main Specialties) */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {teacher.categories?.map(cat => (
                            <span 
                              key={cat} 
                              className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-bold border",
                                getCategoryColor(cat)
                              )}
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Detailed Specialties */}
                      <td className="py-3 px-4">
                        <div className="space-y-1 text-[11px]">
                          {spec?.usul && spec.usul.length > 0 && (
                            <div className="text-indigo-900 font-medium">
                              <span className="font-bold text-indigo-700">اصول: </span>
                              {spec.usul.join('، ')}
                            </div>
                          )}
                          {spec?.fiqh && spec.fiqh.length > 0 && (
                            <div className="text-amber-900 font-medium">
                              <span className="font-bold text-amber-700">فقه: </span>
                              {spec.fiqh.join('، ')}
                            </div>
                          )}
                          {spec?.falsafa && spec.falsafa.length > 0 && (
                            <div className="text-purple-900 font-medium">
                              <span className="font-bold text-purple-700">فلسفه: </span>
                              {spec.falsafa.join('، ')}
                            </div>
                          )}
                          {spec?.thursdayNote && (
                            <div className="text-teal-900 font-medium">
                              <span className="font-bold text-teal-700">۵شنبه: </span>
                              {spec.thursdayNote}
                            </div>
                          )}
                          {(!spec?.usul?.length && !spec?.fiqh?.length && !spec?.falsafa?.length && !spec?.thursdayNote) && (
                            <span className="text-slate-300">-</span>
                          )}
                        </div>
                      </td>

                      {/* Experience History */}
                      <td className="py-3 px-4 text-slate-700 max-w-xs">
                        {teacher.experienceHistory ? (
                          <div className="line-clamp-2 text-[11px] leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100">
                            {teacher.experienceHistory}
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-3 px-4 text-slate-600 max-w-xs">
                        {teacher.notes ? (
                          <div className="line-clamp-2 text-[11px] leading-relaxed">
                            {teacher.notes}
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4">
                        {getPriorityBadge(teacher.priority)}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleStatus(teacher)}
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer",
                            teacher.isActive 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" 
                              : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                          )}
                        >
                          {teacher.isActive ? (
                            <>
                              <CheckCircle2 size={12} />
                              <span>فعال</span>
                            </>
                          ) : (
                            <>
                              <XCircle size={12} />
                              <span>غیرفعال</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(teacher)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="ویرایش استاد"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(teacher.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="حذف استاد"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTeachers.map((teacher) => {
            const spec = teacher.detailedSpecialties;

            return (
              <div 
                key={teacher.id}
                className={cn(
                  "bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all space-y-4 flex flex-col justify-between relative",
                  !teacher.isActive && "opacity-60 bg-slate-50/60"
                )}
              >
                <div className="space-y-3">
                  {/* Top Bar inside Card */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {teacher.photoUrl ? (
                        <img 
                          src={teacher.photoUrl} 
                          alt={teacher.fullName} 
                          className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shrink-0 shadow-xs" 
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black flex items-center justify-center text-lg shrink-0 shadow-xs">
                          {teacher.fullName?.charAt(0) || 'ا'}
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-slate-800 text-base">{teacher.fullName}</h3>
                        <p className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <Phone size={12} className="text-slate-400" />
                          <span>{teacher.phoneNumber || 'بدون شماره'}</span>
                        </p>
                      </div>
                    </div>

                    <div>
                      {getPriorityBadge(teacher.priority)}
                    </div>
                  </div>

                  {/* Categories */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {teacher.categories?.map(cat => (
                      <span 
                        key={cat} 
                        className={cn(
                          "px-2.5 py-0.5 rounded-lg text-[10px] font-bold border",
                          getCategoryColor(cat)
                        )}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>

                  {/* Detailed Specialties */}
                  {(spec?.usul?.length || spec?.fiqh?.length || spec?.falsafa?.length || spec?.thursdayNote) ? (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs space-y-1.5">
                      <div className="font-bold text-slate-700 text-[11px] mb-1">تخصص‌های جزئی (کتاب‌ها):</div>
                      {spec?.usul && spec.usul.length > 0 && (
                        <div className="text-indigo-900"><span className="font-bold text-indigo-700">اصول:</span> {spec.usul.join('، ')}</div>
                      )}
                      {spec?.fiqh && spec.fiqh.length > 0 && (
                        <div className="text-amber-900"><span className="font-bold text-amber-700">فقه:</span> {spec.fiqh.join('، ')}</div>
                      )}
                      {spec?.falsafa && spec.falsafa.length > 0 && (
                        <div className="text-purple-900"><span className="font-bold text-purple-700">فلسفه:</span> {spec.falsafa.join('، ')}</div>
                      )}
                      {spec?.thursdayNote && (
                        <div className="text-teal-900"><span className="font-bold text-teal-700">۵شنبه:</span> {spec.thursdayNote}</div>
                      )}
                    </div>
                  ) : null}

                  {/* Experience History */}
                  {teacher.experienceHistory && (
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-slate-700 text-[11px] flex items-center gap-1">
                        <FileText size={12} className="text-indigo-600" />
                        <span>سوابق تدریس و بازخورد:</span>
                      </div>
                      <p className="text-slate-600 text-[11px] leading-relaxed bg-amber-50/50 border border-amber-100 p-2.5 rounded-xl">
                        {teacher.experienceHistory}
                      </p>
                    </div>
                  )}

                  {/* Notes */}
                  {teacher.notes && (
                    <p className="text-[11px] text-slate-500 italic">
                      «{teacher.notes}»
                    </p>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => handleToggleStatus(teacher)}
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer",
                      teacher.isActive 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    )}
                  >
                    {teacher.isActive ? 'فعال' : 'غیرفعال'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(teacher)}
                      className="p-2 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors font-bold text-xs flex items-center gap-1"
                    >
                      <Edit size={14} />
                      <span>ویرایش</span>
                    </button>
                    <button
                      onClick={() => handleDelete(teacher.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      title="حذف"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* HIDDEN PRINT CONTAINER FOR PDF EXPORT */}
      <div style={{ position: 'fixed', left: '-9999px', top: '0px', width: '1100px', zIndex: -1000, pointerEvents: 'none', opacity: 0 }}>
        <div 
          ref={pdfPrintRef} 
          className="p-8 bg-white text-slate-900 font-sans space-y-5" 
          dir="rtl"
          style={{ width: '1100px', backgroundColor: '#ffffff' }}
        >
          {/* PDF Report Header */}
          <div className="flex items-center justify-between border-b-2 border-indigo-900 pb-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-indigo-950">بانک اطلاعات اساتید و مدرسین حوزه علمیه</h1>
              <p className="text-xs text-slate-600 font-bold">
                گزارش اساتید مدعو و مدرسین دروس فقه، اصول، فلسفه و مشاوره‌های علمی
              </p>
            </div>
            <div className="text-left space-y-1">
              <div className="text-xs font-black text-indigo-900">تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</div>
              <div className="text-[11px] font-bold text-slate-600">تعداد اساتید: {filteredTeachers.length} نفر</div>
              {!includePhoneInExport && (
                <div className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  (خروجی بدون شماره تماس اساتید)
                </div>
              )}
            </div>
          </div>

          {/* PDF Teachers Table */}
          <table className="w-full text-right text-xs border-collapse border border-slate-300">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <th className="p-2.5 border border-slate-300 text-center w-10">#</th>
                <th className="p-2.5 border border-slate-300">نام و نام خانوادگی استاد</th>
                {includePhoneInExport && (
                  <th className="p-2.5 border border-slate-300 text-center">شماره تماس</th>
                )}
                <th className="p-2.5 border border-slate-300">تخصص‌های اصلی</th>
                <th className="p-2.5 border border-slate-300">تخصص‌های جزئی (کتاب‌ها)</th>
                <th className="p-2.5 border border-slate-300">سوابق تدریس در مجموعه</th>
                <th className="p-2.5 border border-slate-300">توضیحات</th>
                <th className="p-2.5 border border-slate-300 text-center w-20">اولویت</th>
                <th className="p-2.5 border border-slate-300 text-center w-16">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.map((t, idx) => {
                const spec = t.detailedSpecialties;
                const specList: string[] = [];
                if (spec?.usul?.length) specList.push(`اصول: ${spec.usul.join('، ')}`);
                if (spec?.fiqh?.length) specList.push(`فقه: ${spec.fiqh.join('، ')}`);
                if (spec?.falsafa?.length) specList.push(`فلسفه: ${spec.falsafa.join('، ')}`);
                if (spec?.thursdayNote) specList.push(`۵شنبه: ${spec.thursdayNote}`);

                return (
                  <tr key={t.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                    <td className="p-2 border border-slate-300 text-center font-bold text-slate-500">{idx + 1}</td>
                    <td className="p-2 border border-slate-300 font-bold text-slate-900">{t.fullName}</td>
                    {includePhoneInExport && (
                      <td className="p-2 border border-slate-300 text-center font-mono text-slate-800">{t.phoneNumber || '-'}</td>
                    )}
                    <td className="p-2 border border-slate-300">{t.categories?.join('، ') || '-'}</td>
                    <td className="p-2 border border-slate-300 font-medium">{specList.join(' | ') || '-'}</td>
                    <td className="p-2 border border-slate-300 text-[11px] leading-relaxed">{t.experienceHistory || '-'}</td>
                    <td className="p-2 border border-slate-300 text-[11px] leading-relaxed">{t.notes || '-'}</td>
                    <td className="p-2 border border-slate-300 text-center font-bold">
                      اولویت {t.priority}
                    </td>
                    <td className="p-2 border border-slate-300 text-center font-bold">
                      {t.isActive ? 'فعال' : 'غیرفعال'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT TEACHER MODAL */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-2xl border border-slate-200 shadow-2xl my-8 space-y-5"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                    <GraduationCap size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800">
                      {editingTeacher ? 'ویرایش مشخصات استاد' : 'افزودن استاد جدید به بانک اساتید'}
                    </h2>
                    <p className="text-[11px] text-slate-400 font-medium">اطلاعات تخصص، اولویت و سوابق استاد را وارد کنید</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  <XCircle size={20} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                
                {/* Photo and Primary Spec */}
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="relative group shrink-0">
                    {photoUrl ? (
                      <img 
                        src={photoUrl} 
                        alt="استاد" 
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500 shadow-xs" 
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-xl border border-indigo-200">
                        {fullName?.charAt(0) || 'استاد'}
                      </div>
                    )}
                    <label className="absolute -bottom-1 -right-1 bg-indigo-600 text-white p-1.5 rounded-xl cursor-pointer hover:bg-indigo-700 transition-all shadow-md">
                      <Upload size={12} />
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload} 
                        className="hidden" 
                      />
                    </label>
                  </div>

                  <div className="flex-1 w-full space-y-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        نام و نام خانوادگی استاد <span className="text-rose-500">*</span>
                      </label>
                      <input 
                        type="text" 
                        required
                        placeholder="مثلا: استاد سید علی حسینی"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">شماره تماس</label>
                        <input 
                          type="text" 
                          placeholder="0912..."
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">اولویت پیشنهاد</label>
                        <select
                          value={priority}
                          onChange={(e) => setPriority(Number(e.target.value) as 1 | 2 | 3)}
                          className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value={1}>اولویت ۱ (عالی)</option>
                          <option value={2}>اولویت ۲ (خوب)</option>
                          <option value={3}>اولویت ۳ (معمولی)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Switch */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-700">وضعیت استاد:</span>
                  <button
                    type="button"
                    onClick={() => setIsActive(!isActive)}
                    className={cn(
                      "px-3 py-1 rounded-xl text-xs font-bold transition-all border",
                      isActive ? "bg-emerald-600 text-white border-emerald-600" : "bg-rose-100 text-rose-700 border-rose-300"
                    )}
                  >
                    {isActive ? 'فعال جهت دعوت' : 'غیرفعال (موقت)'}
                  </button>
                </div>

                {/* Main Categories Checkboxes */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    تخصص‌ها و زمینه‌های تدریس/مشاوره (امکان انتخاب چندتایی):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    {ALL_CATEGORIES.map((cat) => {
                      const isChecked = selectedCategories.includes(cat);
                      return (
                        <label 
                          key={cat} 
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-xl border text-xs font-bold cursor-pointer select-none transition-all",
                            isChecked 
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs" 
                              : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                          )}
                        >
                          <input 
                            type="checkbox" 
                            checked={isChecked}
                            onChange={() => toggleCategory(cat)}
                            className="w-3.5 h-3.5 accent-indigo-600 rounded"
                          />
                          <span className="text-[11px]">{cat}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Detailed Specialties (Conditional Sections) */}
                
                {/* 1. Usul (اصول / مشاوره اصول) */}
                {hasUsulOrCounseling && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-1.5">
                    <label className="block text-xs font-bold text-indigo-900">
                      کتاب‌ها و مباحث مناسب تدریس اصول / مشاوره اصول:
                    </label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(['رسائل', 'کفایه', 'حلقات'] as const).map(book => {
                        const isChecked = usulSpecialties.includes(book);
                        return (
                          <label key={book} className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all",
                            isChecked ? "bg-indigo-700 text-white border-indigo-700" : "bg-white border-indigo-200 text-indigo-800"
                          )}>
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setUsulSpecialties([...usulSpecialties, book]);
                                else setUsulSpecialties(usulSpecialties.filter(b => b !== book));
                              }}
                              className="w-3.5 h-3.5 accent-indigo-600"
                            />
                            <span>{book}</span>
                          </label>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* 2. Fiqh (فقه / مشاوره فقه) */}
                {hasFiqhOrCounseling && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-1.5">
                    <label className="block text-xs font-bold text-amber-900">
                      کتاب‌های مناسب تدریس فقه / مشاوره فقه:
                    </label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(['مکاسب'] as const).map(book => {
                        const isChecked = fiqhSpecialties.includes(book);
                        return (
                          <label key={book} className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all",
                            isChecked ? "bg-amber-700 text-white border-amber-700" : "bg-white border-amber-200 text-amber-800"
                          )}>
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setFiqhSpecialties([...fiqhSpecialties, book]);
                                else setFiqhSpecialties(fiqhSpecialties.filter(b => b !== book));
                              }}
                              className="w-3.5 h-3.5 accent-amber-600"
                            />
                            <span>{book}</span>
                          </label>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* 3. Falsafa (فلسفه / مشاوره فلسفه) */}
                {hasFalsafaOrCounseling && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-1.5">
                    <label className="block text-xs font-bold text-purple-900">
                      کتاب‌ها و مباحث مناسب تدریس فلسفه / مشاوره فلسفه:
                    </label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(['بدایه', 'نهایه', 'آموزش فلسفه'] as const).map(book => {
                        const isChecked = falsafaSpecialties.includes(book);
                        return (
                          <label key={book} className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all",
                            isChecked ? "bg-purple-700 text-white border-purple-700" : "bg-white border-purple-200 text-purple-800"
                          )}>
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setFalsafaSpecialties([...falsafaSpecialties, book]);
                                else setFalsafaSpecialties(falsafaSpecialties.filter(b => b !== book));
                              }}
                              className="w-3.5 h-3.5 accent-purple-600"
                            />
                            <span>{book}</span>
                          </label>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                {/* 4. Thursday Classes Note */}
                {hasThursday && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-teal-50/70 border border-teal-200 rounded-2xl space-y-1.5">
                    <label className="block text-xs font-bold text-teal-900">
                      مناسب برای چه برنامه‌ها یا دروس ۵شنبه‌ها؟ (دستی بنویسید)
                    </label>
                    <input 
                      type="text" 
                      placeholder="مثلا: کارگاه روش تحقیق، درس اخلاق کاربردی، تفسیر قرآن..."
                      value={thursdayNote}
                      onChange={(e) => setThursdayNote(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-teal-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </motion.div>
                )}

                {/* Experience History */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    سوابق تدریس در مجموعه و بازخوردها:
                  </label>
                  <textarea 
                    rows={2}
                    placeholder="بنویسید چه درسی تا حالا درس گفته تو مجموعه و نتیجه چی بوده..."
                    value={experienceHistory}
                    onChange={(e) => setExperienceHistory(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-none"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">توضیحات و ملاحظات تکمیلی:</label>
                  <textarea 
                    rows={2}
                    placeholder="ساعات ترجیحی حضور، نکات اخلاقی، ملاحظات مالی..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-none"
                  />
                </div>

                {/* Form Buttons */}
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition-all shadow-md active:scale-95"
                  >
                    {editingTeacher ? 'بروزرسانی اطلاعات استاد' : 'ذخیره استاد جدید'}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import File Modal */}
      <AnimatePresence>
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-slate-100 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-2xl bg-teal-50 text-teal-700">
                    <Upload size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-800">ورود و افزودن اساتید از فایل</h2>
                    <p className="text-[11px] font-medium text-slate-500">پشتیبانی از فایل‌های اکسل (XLSX, XLS, CSV) و JSON</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowImportModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                >
                  <XCircle size={20} />
                </button>
              </div>

              {importMessage && (
                <div className={cn(
                  "p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 border",
                  importMessage.type === 'success' ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
                )}>
                  {importMessage.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <XCircle size={16} className="text-rose-600 shrink-0" />}
                  <span>{importMessage.text}</span>
                </div>
              )}

              <div className="space-y-3">
                <div 
                  onClick={() => importFileRef.current?.click()}
                  className="border-2 border-dashed border-teal-200 hover:border-teal-400 bg-teal-50/40 hover:bg-teal-50 p-6 rounded-2xl text-center cursor-pointer transition-all space-y-2 group"
                >
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload size={24} />
                  </div>
                  <div className="text-xs font-bold text-slate-700">
                    {importLoading ? 'در حال پردازش و افزودن اساتید...' : 'برای انتخاب فایل اکسل یا JSON اینجا کلیک کنید'}
                  </div>
                  <div className="text-[11px] font-medium text-slate-400">فرمت‌های مجاز: .xlsx , .xls , .csv , .json</div>
                </div>

                <input 
                  type="file" 
                  ref={importFileRef}
                  onChange={handleProcessImportFile}
                  accept=".xlsx,.xls,.csv,.json"
                  className="hidden"
                />

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-600 leading-relaxed space-y-1">
                  <span className="font-bold text-slate-800 block">راهنمای ساختار فایل:</span>
                  <p>• <strong className="text-slate-800">اکسل:</strong> ستون اصلی باید شامل <strong className="text-slate-800">«نام و نام خانوادگی»</strong> باشد. ستون‌های اختیاری دیگر: «شماره تماس»، «تخصص‌های کلی» (مثلاً: فقه | اصول)، «تخصص‌های جزئی»، «سوابق تدریس»، «توضیحات» و «اولویت».</p>
                  <p>• <strong className="text-slate-800">JSON:</strong> آرایه‌ای از اشیای استاد شامل مشخصات <code>fullName</code>, <code>phoneNumber</code>, <code>categories</code>, <code>priority</code> و...</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                >
                  بستن
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
