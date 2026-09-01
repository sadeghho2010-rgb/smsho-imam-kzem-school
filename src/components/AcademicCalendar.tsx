import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Edit2, 
  Download, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Settings, 
  CalendarDays, 
  Filter, 
  Printer, 
  FileSpreadsheet, 
  ChevronRight, 
  ChevronLeft, 
  Info,
  Layers,
  Check,
  Tag,
  BookOpen,
  FileText,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { localDb } from '../lib/localDb';
import { 
  AcademicCalendarPeriod, 
  AcademicHolidayItem, 
  AcademicHolidayType,
  AcademicCalendarExportPackage 
} from '../types';
import { 
  getTodayShamsi, 
  parseShamsiDate, 
  formatShamsiDate, 
  getShamsiDayOfWeek, 
  getShamsiDayOfWeekName, 
  getShamsiMonthName, 
  getDaysInShamsiMonth, 
  generateShamsiDateRange, 
  compareShamsi,
  isDateBetween,
  toPersianDigits,
  toEnglishDigits,
  SHAMSI_MONTH_NAMES,
  SHAMSI_WEEKDAY_NAMES
} from '../lib/jalali';
import { cn } from '../lib/utils';
import { exportElementToPdf } from '../lib/pdfExport';

// System Default Holiday Types with color presets
const DEFAULT_HOLIDAY_TYPES: AcademicHolidayType[] = [
  { id: 'type-official', name: 'تعطیلی رسمی', color: 'rose', isSystemDefault: true },
  { id: 'type-occasion', name: 'تعطیلی مناسبتی', color: 'purple', isSystemDefault: true },
  { id: 'type-tablighi', name: 'تعطیلی تبلیغی', color: 'sky', isSystemDefault: true },
  { id: 'type-exams', name: 'امتحانات و ارزیابی', color: 'amber', isSystemDefault: true },
  { id: 'type-emergency', name: 'تعطیلی اضطراری / برودت هوا', color: 'emerald', isSystemDefault: true },
  { id: 'type-hawza', name: 'تعطیلی حوزوی', color: 'indigo', isSystemDefault: true },
];

// Color mapping helper
const COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  rose: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', badge: 'bg-rose-500 text-white' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-500 text-white' },
  sky: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', badge: 'bg-sky-500 text-white' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-amber-500 text-white' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-500 text-white' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', badge: 'bg-indigo-500 text-white' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', badge: 'bg-slate-600 text-white' },
};

export default function AcademicCalendar() {
  // State
  const [periods, setPeriods] = useState<AcademicCalendarPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [holidays, setHolidays] = useState<AcademicHolidayItem[]>([]);
  const [holidayTypes, setHolidayTypes] = useState<AcademicHolidayType[]>(DEFAULT_HOLIDAY_TYPES);
  const [loading, setLoading] = useState(true);

  // Active Main View Tab
  const [activeTab, setActiveTab] = useState<'calendar' | 'holidays_list' | 'stats_tables' | 'study_days'>('calendar');

  // Selected Month for Calendar Grid view
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(0);

  // Filter for holiday category tables
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Modals
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<AcademicCalendarPeriod | null>(null);

  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<AcademicHolidayItem | null>(null);

  const [showTypesModal, setShowTypesModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeColor, setNewTypeColor] = useState('indigo');

  const [showImportExportModal, setShowImportExportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // PDF Preview & Export State
  const pdfTemplateRef = useRef<HTMLDivElement>(null);
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleExportHolidaysPdf = async () => {
    if (!pdfTemplateRef.current) return;
    setIsGeneratingPdf(true);
    try {
      await exportElementToPdf({
        element: pdfTemplateRef.current,
        filename: `جدول_تعطیلات_${selectedPeriod?.title ? selectedPeriod.title.replace(/\s+/g, '_') : 'دوره'}_${getTodayShamsi().replace(/\//g, '-')}.pdf`,
        orientation: 'landscape',
        marginMM: 8
      });
      showToast("فایل PDF جدول تعطیلات با موفقیت تولید و دانلود شد.");
    } catch (err) {
      console.error("PDF Export Error:", err);
      alert("خطا در تولید فایل PDF. لطفا مجددا تلاش کنید.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Form States for Period Modal
  const [periodForm, setPeriodForm] = useState({
    title: '',
    startDate: '1405/06/15',
    endDate: '1406/03/20',
    description: '',
    includeThursdayAsStudyDay: true,
    includeFridayAsStudyDay: false
  });

  // Form States for Holiday Modal
  const [holidayForm, setHolidayForm] = useState({
    title: '',
    typeId: '',
    startDate: getTodayShamsi(),
    endDate: getTodayShamsi(),
    description: ''
  });

  // Load Initial Data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const storedPeriods = await localDb.getDocs<AcademicCalendarPeriod>('academic_calendar_periods');
      const storedHolidays = await localDb.getDocs<AcademicHolidayItem>('academic_holidays');
      const storedTypes = await localDb.getDocs<AcademicHolidayType>('academic_holiday_types');

      let currentTypes = storedTypes;
      if (storedTypes.length === 0) {
        // Initialize default types
        for (const t of DEFAULT_HOLIDAY_TYPES) {
          await localDb.setDoc('academic_holiday_types', t);
        }
        currentTypes = DEFAULT_HOLIDAY_TYPES;
      }
      setHolidayTypes(currentTypes);

      if (storedPeriods.length > 0) {
        setPeriods(storedPeriods);
        // Select active period or first period
        if (!selectedPeriodId || !storedPeriods.some(p => p.id === selectedPeriodId)) {
          setSelectedPeriodId(storedPeriods[0].id);
        }
      } else {
        // Create default initial sample period for 1405-1406 if database is brand new
        const samplePeriod: AcademicCalendarPeriod = {
          id: 'period-1405-1406',
          title: 'سال تحصیلی ۱۴۰۵ - ۱۴۰۶',
          startDate: '1405/06/15',
          endDate: '1406/03/20',
          description: 'دوره عمومی آموزش و تدریس حوزه علمیه',
          includeThursdayAsStudyDay: true,
          includeFridayAsStudyDay: false,
          createdAt: new Date().toISOString()
        };
        await localDb.setDoc('academic_calendar_periods', samplePeriod);
        setPeriods([samplePeriod]);
        setSelectedPeriodId(samplePeriod.id);

        // Add standard initial sample holidays
        const sampleHolidays: AcademicHolidayItem[] = [
          {
            id: 'h-1',
            periodId: 'period-1405-1406',
            title: 'تاسوعا و عاشورای حسینی',
            typeId: 'type-tablighi',
            typeName: 'تعطیلی تبلیغی',
            startDate: '1405/04/15',
            endDate: '1405/04/25',
            description: 'اعزام طلاب به امکنه‌ زیارتی و تبلیغی',
            createdAt: new Date().toISOString()
          },
          {
            id: 'h-2',
            periodId: 'period-1405-1406',
            title: 'تعطیلات نوروز و عید مبعث',
            typeId: 'type-official',
            typeName: 'تعطیلی رسمی',
            startDate: '1406/01/01',
            endDate: '1406/01/13',
            description: 'تعطیلات رسمی سال جدید',
            createdAt: new Date().toISOString()
          }
        ];
        for (const h of sampleHolidays) {
          await localDb.setDoc('academic_holidays', h);
        }
        setHolidays(sampleHolidays);
      }

      setHolidays(storedHolidays);
    } catch (err) {
      console.error("Error loading academic calendar data:", err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Currently Selected Period Object
  const selectedPeriod = useMemo(() => {
    return periods.find(p => p.id === selectedPeriodId) || null;
  }, [periods, selectedPeriodId]);

  // Holidays belonging to current period
  const periodHolidays = useMemo(() => {
    if (!selectedPeriodId) return [];
    return holidays.filter(h => h.periodId === selectedPeriodId);
  }, [holidays, selectedPeriodId]);

  // Period Date Range Array
  const periodDateList = useMemo(() => {
    if (!selectedPeriod) return [];
    return generateShamsiDateRange(selectedPeriod.startDate, selectedPeriod.endDate);
  }, [selectedPeriod]);

  // Map each Shamsi date string to its holiday info if exists
  const holidayDateMap = useMemo(() => {
    const map = new Map<string, { holiday: AcademicHolidayItem; type: AcademicHolidayType | undefined }>();
    for (const h of periodHolidays) {
      const type = holidayTypes.find(t => t.id === h.typeId || t.name === h.typeName);
      const dates = generateShamsiDateRange(h.startDate, h.endDate || h.startDate);
      for (const d of dates) {
        map.set(d, { holiday: h, type });
      }
    }
    return map;
  }, [periodHolidays, holidayTypes]);

  // Comprehensive Date Classification for the Period
  const dateAnalysis = useMemo(() => {
    if (!selectedPeriod || periodDateList.length === 0) {
      return {
        totalDays: 0,
        studyDays: 0,
        weekendDays: 0,
        holidayDaysCount: 0,
        typeBreakdown: {} as Record<string, number>,
        dayDetailsList: []
      };
    }

    let studyDays = 0;
    let weekendDays = 0;
    let holidayDaysCount = 0;
    const typeBreakdown: Record<string, number> = {};

    const dayDetailsList = periodDateList.map(dateStr => {
      const dayOfWeek = getShamsiDayOfWeek(dateStr); // 0=Sat ... 5=Thu, 6=Fri
      const dayName = getShamsiDayOfWeekName(dateStr);
      const isThu = dayOfWeek === 5;
      const isFri = dayOfWeek === 6;

      const holidayInfo = holidayDateMap.get(dateStr);
      let isHoliday = false;
      let isStudyDay = false;
      let isWeekend = false;

      if (holidayInfo) {
        isHoliday = true;
        holidayDaysCount++;
        const tName = holidayInfo.holiday.typeName || 'سایر';
        typeBreakdown[tName] = (typeBreakdown[tName] || 0) + 1;
      } else {
        // Not a registered holiday
        if (isFri) {
          if (selectedPeriod.includeFridayAsStudyDay) {
            isStudyDay = true;
          } else {
            isWeekend = true;
            weekendDays++;
          }
        } else if (isThu) {
          if (selectedPeriod.includeThursdayAsStudyDay) {
            isStudyDay = true;
          } else {
            isWeekend = true;
            weekendDays++;
          }
        } else {
          // Saturday to Wednesday normal study days
          isStudyDay = true;
        }
      }

      if (isStudyDay) {
        studyDays++;
      }

      return {
        dateStr,
        dayOfWeek,
        dayName,
        isThu,
        isFri,
        isHoliday,
        isStudyDay,
        isWeekend,
        holidayInfo
      };
    });

    return {
      totalDays: periodDateList.length,
      studyDays,
      weekendDays,
      holidayDaysCount,
      typeBreakdown,
      dayDetailsList
    };
  }, [selectedPeriod, periodDateList, holidayDateMap]);

  // Group days by Shamsi Months for Month View
  const periodMonthsGrouped = useMemo(() => {
    if (!selectedPeriod || dateAnalysis.dayDetailsList.length === 0) return [];
    
    const monthsMap = new Map<string, typeof dateAnalysis.dayDetailsList>();
    for (const item of dateAnalysis.dayDetailsList) {
      const p = parseShamsiDate(item.dateStr);
      const monthKey = `${p.year}/${String(p.month).padStart(2, '0')}`;
      if (!monthsMap.has(monthKey)) {
        monthsMap.set(monthKey, []);
      }
      monthsMap.get(monthKey)!.push(item);
    }

    const result = Array.from(monthsMap.entries()).map(([key, days]) => {
      const [yearStr, monthStr] = key.split('/');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      return {
        key,
        year,
        month,
        monthName: getShamsiMonthName(month),
        title: `${getShamsiMonthName(month)} ${year}`,
        days
      };
    });

    return result;
  }, [selectedPeriod, dateAnalysis]);

  // --- Handlers for Period Management ---
  const handleOpenNewPeriod = () => {
    setEditingPeriod(null);
    setPeriodForm({
      title: 'سال تحصیلی ۱۴۰۵ - ۱۴۰۶',
      startDate: '1405/06/15',
      endDate: '1406/03/20',
      description: '',
      includeThursdayAsStudyDay: true,
      includeFridayAsStudyDay: false
    });
    setShowPeriodModal(true);
  };

  const handleOpenEditPeriod = (period: AcademicCalendarPeriod) => {
    setEditingPeriod(period);
    setPeriodForm({
      title: period.title,
      startDate: period.startDate,
      endDate: period.endDate,
      description: period.description || '',
      includeThursdayAsStudyDay: period.includeThursdayAsStudyDay ?? true,
      includeFridayAsStudyDay: period.includeFridayAsStudyDay ?? false
    });
    setShowPeriodModal(true);
  };

  const handleSavePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodForm.title.trim() || !periodForm.startDate || !periodForm.endDate) {
      alert("لطفا عنوان، تاریخ شروع و پایان دوره را تکمیل کنید.");
      return;
    }

    try {
      if (editingPeriod) {
        const updated: AcademicCalendarPeriod = {
          ...editingPeriod,
          title: periodForm.title.trim(),
          startDate: periodForm.startDate.trim(),
          endDate: periodForm.endDate.trim(),
          description: periodForm.description.trim(),
          includeThursdayAsStudyDay: periodForm.includeThursdayAsStudyDay,
          includeFridayAsStudyDay: periodForm.includeFridayAsStudyDay,
          updatedAt: new Date().toISOString()
        };
        await localDb.updateDoc('academic_calendar_periods', editingPeriod.id, updated);
        setPeriods(periods.map(p => p.id === editingPeriod.id ? updated : p));
        showToast("دوره آموزشی با موفقیت ویرایش شد.");
      } else {
        const newPeriod: AcademicCalendarPeriod = {
          id: `period-${Date.now()}`,
          title: periodForm.title.trim(),
          startDate: periodForm.startDate.trim(),
          endDate: periodForm.endDate.trim(),
          description: periodForm.description.trim(),
          includeThursdayAsStudyDay: periodForm.includeThursdayAsStudyDay,
          includeFridayAsStudyDay: periodForm.includeFridayAsStudyDay,
          createdAt: new Date().toISOString()
        };
        await localDb.setDoc('academic_calendar_periods', newPeriod);
        setPeriods([...periods, newPeriod]);
        setSelectedPeriodId(newPeriod.id);
        showToast("دوره آموزشی جدید با موفقیت ایجاد شد.");
      }
      setShowPeriodModal(false);
    } catch (err) {
      console.error("Error saving period:", err);
      alert("خطا در ذخیره دوره آموزشی.");
    }
  };

  const handleDeletePeriod = async (periodId: string) => {
    try {
      await localDb.deleteDoc('academic_calendar_periods', periodId);
      // delete associated holidays
      const toDeleteHolidays = holidays.filter(h => h.periodId === periodId);
      for (const h of toDeleteHolidays) {
        await localDb.deleteDoc('academic_holidays', h.id);
      }

      const updatedPeriods = periods.filter(p => p.id !== periodId);
      setPeriods(updatedPeriods);
      setHolidays(holidays.filter(h => h.periodId !== periodId));

      if (selectedPeriodId === periodId) {
        setSelectedPeriodId(updatedPeriods[0]?.id || '');
      }
      showToast("دوره آموزشی با موفقیت حذف گردید.");
    } catch (err) {
      console.error("Error deleting period:", err);
    }
  };

  // --- Handlers for Toggle Settings on Period ---
  const handleToggleThursday = async (val: boolean) => {
    if (!selectedPeriod) return;
    const updated = { ...selectedPeriod, includeThursdayAsStudyDay: val };
    await localDb.updateDoc('academic_calendar_periods', selectedPeriod.id, updated);
    setPeriods(periods.map(p => p.id === selectedPeriod.id ? updated : p));
    showToast(val ? "پنج‌شنبه‌ها به عنوان روز درسی محاسبه شدند." : "پنج‌شنبه‌ها به عنوان تعطیلی آخر هفته لحاظ شدند.");
  };

  const handleToggleFriday = async (val: boolean) => {
    if (!selectedPeriod) return;
    const updated = { ...selectedPeriod, includeFridayAsStudyDay: val };
    await localDb.updateDoc('academic_calendar_periods', selectedPeriod.id, updated);
    setPeriods(periods.map(p => p.id === selectedPeriod.id ? updated : p));
    showToast(val ? "جمعه‌ها به عنوان روز درسی محاسبه شدند." : "جمعه‌ها به عنوان تعطیلی لحاظ شدند.");
  };

  // --- Handlers for Holiday Management ---
  const handleOpenAddHoliday = (presetDate?: string) => {
    if (!selectedPeriodId) {
      alert("لطفا ابتدا یک دوره آموزشی انتخاب یا تعریف کنید.");
      return;
    }
    setEditingHoliday(null);
    const defaultType = holidayTypes[0]?.id || '';
    const initialDate = presetDate || (selectedPeriod ? selectedPeriod.startDate : getTodayShamsi());
    setHolidayForm({
      title: '',
      typeId: defaultType,
      startDate: initialDate,
      endDate: initialDate,
      description: ''
    });
    setShowHolidayModal(true);
  };

  const handleOpenEditHoliday = (h: AcademicHolidayItem) => {
    setEditingHoliday(h);
    setHolidayForm({
      title: h.title,
      typeId: h.typeId,
      startDate: h.startDate,
      endDate: h.endDate || h.startDate,
      description: h.description || ''
    });
    setShowHolidayModal(true);
  };

  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayForm.title.trim() || !holidayForm.startDate) {
      alert("لطفا عنوان و تاریخ تعطیلی را وارد کنید.");
      return;
    }

    const typeObj = holidayTypes.find(t => t.id === holidayForm.typeId);
    const typeName = typeObj ? typeObj.name : 'تعطیلی عمومی';

    try {
      if (editingHoliday) {
        const updated: AcademicHolidayItem = {
          ...editingHoliday,
          title: holidayForm.title.trim(),
          typeId: holidayForm.typeId,
          typeName,
          startDate: holidayForm.startDate.trim(),
          endDate: (holidayForm.endDate || holidayForm.startDate).trim(),
          description: holidayForm.description.trim(),
          updatedAt: new Date().toISOString()
        };
        await localDb.updateDoc('academic_holidays', editingHoliday.id, updated);
        setHolidays(holidays.map(h => h.id === editingHoliday.id ? updated : h));
        showToast("تعطیلی با موفقیت ویرایش شد.");
      } else {
        const newHoliday: AcademicHolidayItem = {
          id: `h-${Date.now()}`,
          periodId: selectedPeriodId,
          title: holidayForm.title.trim(),
          typeId: holidayForm.typeId,
          typeName,
          startDate: holidayForm.startDate.trim(),
          endDate: (holidayForm.endDate || holidayForm.startDate).trim(),
          description: holidayForm.description.trim(),
          createdAt: new Date().toISOString()
        };
        await localDb.setDoc('academic_holidays', newHoliday);
        setHolidays([...holidays, newHoliday]);
        showToast("تعطیلی جدید ثبت شد.");
      }
      setShowHolidayModal(false);
    } catch (err) {
      console.error("Error saving holiday:", err);
      alert("خطا در ثبت تعطیلی.");
    }
  };

  const handleDeleteHoliday = async (holidayId: string) => {
    try {
      await localDb.deleteDoc('academic_holidays', holidayId);
      setHolidays(holidays.filter(h => h.id !== holidayId));
      showToast("تعطیلی با موفقیت حذف شد.");
    } catch (err) {
      console.error("Error deleting holiday:", err);
    }
  };

  // --- Handlers for Holiday Types ---
  const handleAddHolidayType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;

    const newType: AcademicHolidayType = {
      id: `type-${Date.now()}`,
      name: newTypeName.trim(),
      color: newTypeColor,
      isSystemDefault: false
    };

    try {
      await localDb.setDoc('academic_holiday_types', newType);
      setHolidayTypes([...holidayTypes, newType]);
      setNewTypeName('');
      showToast(`نوع تعطیلی جدید «${newType.name}» اضافه شد.`);
    } catch (err) {
      console.error("Error adding holiday type:", err);
    }
  };

  const handleDeleteHolidayType = async (typeId: string, typeName: string) => {
    try {
      await localDb.deleteDoc('academic_holiday_types', typeId);
      setHolidayTypes(holidayTypes.filter(t => t.id !== typeId));
      showToast(`نوع تعطیلی «${typeName}» حذف شد.`);
    } catch (err) {
      console.error("Error deleting holiday type:", err);
    }
  };

  // --- IMPORT & EXPORT HANDLERS (GUARANTEED MATCH) ---
  const handleExportData = () => {
    const exportData: AcademicCalendarExportPackage = {
      _meta: {
        system: 'TOLAB_ACADEMIC_CALENDAR',
        version: '1.0',
        exportDate: new Date().toISOString(),
        totalPeriods: periods.length,
        totalHolidays: holidays.length,
        totalHolidayTypes: holidayTypes.length
      },
      periods,
      holidays,
      holidayTypes
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `academic_calendar_backup_${getTodayShamsi().replace(/\//g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("فایل خروجی تقویم آموزشی با موفقیت دانلود شد.");
  };

  const handleImportData = async (overwriteMode: 'replace' | 'merge') => {
    if (!importJsonText.trim()) {
      alert("لطفا محتوای فایل JSON را وارد یا بارگذاری کنید.");
      return;
    }

    try {
      const parsed = JSON.parse(importJsonText) as AcademicCalendarExportPackage;
      if (!parsed._meta || parsed._meta.system !== 'TOLAB_ACADEMIC_CALENDAR' || !Array.isArray(parsed.periods)) {
        alert("فایل وارد شده ساختار معتبر تقویم آموزشی حوزه علمیه را ندارد.");
        return;
      }

      if (overwriteMode === 'replace') {
        // Clear existing collections
        for (const p of periods) await localDb.deleteDoc('academic_calendar_periods', p.id);
        for (const h of holidays) await localDb.deleteDoc('academic_holidays', h.id);
        for (const t of holidayTypes) await localDb.deleteDoc('academic_holiday_types', t.id);

        // Insert imported items
        for (const p of parsed.periods) await localDb.setDoc('academic_calendar_periods', p);
        for (const h of parsed.holidays) await localDb.setDoc('academic_holidays', h);
        for (const t of (parsed.holidayTypes || DEFAULT_HOLIDAY_TYPES)) await localDb.setDoc('academic_holiday_types', t);

        setPeriods(parsed.periods);
        setHolidays(parsed.holidays);
        setHolidayTypes(parsed.holidayTypes || DEFAULT_HOLIDAY_TYPES);
        if (parsed.periods.length > 0) setSelectedPeriodId(parsed.periods[0].id);
        showToast("اطلاعات تقویم آموزشی با موفقیت جایگزین گردید.");
      } else {
        // Merge mode
        for (const p of parsed.periods) await localDb.setDoc('academic_calendar_periods', p);
        for (const h of parsed.holidays) await localDb.setDoc('academic_holidays', h);
        for (const t of (parsed.holidayTypes || [])) await localDb.setDoc('academic_holiday_types', t);

        await loadAllData();
        showToast("اطلاعات تقویم آموزشی با موفقیت ادغام شد.");
      }

      setShowImportExportModal(false);
      setImportJsonText('');
    } catch (err) {
      console.error("Error importing data:", err);
      alert("خطا در خواندن فایل JSON. لطفا از صحت فایل اطمینان حاصل کنید.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportJsonText(text);
    };
    reader.readAsText(file);
  };

  // Export to Excel handler
  const handleExportToExcel = () => {
    if (!selectedPeriod) return;

    const summarySheetData = [
      { 'شاخص': 'عنوان دوره تحصیلی', 'مقدار': selectedPeriod.title },
      { 'شاخص': 'تاریخ شروع دوره', 'مقدار': selectedPeriod.startDate },
      { 'شاخص': 'تاریخ پایان دوره', 'مقدار': selectedPeriod.endDate },
      { 'شاخص': 'مجموع کل روزهای دوره', 'مقدار': dateAnalysis.totalDays },
      { 'شاخص': 'تعداد روزهای درسی', 'مقدار': dateAnalysis.studyDays },
      { 'شاخص': 'روزهای تعطیل رسمی و مناسبتی', 'مقدار': dateAnalysis.holidayDaysCount },
      { 'شاخص': 'تعطیلات آخر هفته (پنج‌شنبه/جمعه)', 'مقدار': dateAnalysis.weekendDays },
      { 'شاخص': 'وضعیت درسی پنج‌شنبه‌ها', 'مقدار': selectedPeriod.includeThursdayAsStudyDay ? 'روز درسی' : 'تعطیل' },
    ];

    const holidaysSheetData = periodHolidays.map((h, i) => ({
      'ردیف': i + 1,
      'عنوان تعطیلی': h.title,
      'نوع تعطیلی': h.typeName,
      'تاریخ شروع': h.startDate,
      'تاریخ پایان': h.endDate || h.startDate,
      'روزهای هفته': `${getShamsiDayOfWeekName(h.startDate)} الی ${getShamsiDayOfWeekName(h.endDate || h.startDate)}`,
      'توضیحات': h.description || ''
    }));

    const studyDaysSheetData = dateAnalysis.dayDetailsList
      .filter(d => d.isStudyDay)
      .map((d, i) => ({
        'ردیف': i + 1,
        'تاریخ شمسی': d.dateStr,
        'روز هفته': d.dayName,
        'وضعیت': 'روز درسی'
      }));

    const wb = XLSX.utils.book_new();
    const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);
    const wsHolidays = XLSX.utils.json_to_sheet(holidaysSheetData);
    const wsStudyDays = XLSX.utils.json_to_sheet(studyDaysSheetData);

    XLSX.utils.book_append_sheet(wb, wsSummary, 'خلاصه آمار');
    XLSX.utils.book_append_sheet(wb, wsHolidays, 'جدول تعطیلات');
    XLSX.utils.book_append_sheet(wb, wsStudyDays, 'روزهای درسی');

    XLSX.writeFile(wb, `تقویم_آموزشی_${selectedPeriod.title.replace(/\s+/g, '_')}.xlsx`);
    showToast("فایل اکسل تقویم آموزشی دانلود شد.");
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-bold">در حال بارگذاری تقویم آموزشی...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-slate-700"
          >
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Top Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold">
              <CalendarIcon size={18} />
              <span>سامانه هوشمند مدیریت برنامه‌ریزی حوزه علمیه</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white">تقویم آموزشی و سالنامه تحصیلی</h1>
            <p className="text-xs text-indigo-200/80 max-w-xl">
              تعریف دوره تحصیلی، برنامه‌ریزی تعطیلات رسمی، مناسبتی و تبلیغی، محاسبه هوشمند روزهای درسی و استخراج گزارش‌های آماری.
            </p>
          </div>

          {/* Active Period Selector & Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 flex items-center gap-2">
              <span className="text-[11px] text-indigo-200 font-bold px-2 hidden sm:inline">دوره فعال:</span>
              <select
                value={selectedPeriodId}
                onChange={(e) => {
                  setSelectedPeriodId(e.target.value);
                  setSelectedMonthIndex(0);
                }}
                className="bg-slate-900/90 text-white text-xs font-bold py-2 px-3 rounded-xl border border-indigo-400/30 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {periods.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.startDate} تا {p.endDate})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleOpenNewPeriod}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 shrink-0"
            >
              <Plus size={16} />
              <span>ایجاد دوره جدید</span>
            </button>

            <button
              onClick={() => setShowImportExportModal(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-indigo-700/80 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl border border-indigo-500/30 transition-all shrink-0"
              title="ورودی و خروجی پشتیبان تقویم"
            >
              <Download size={15} />
              <span>خروجی / ورودی</span>
            </button>

            <button
              onClick={() => setShowPdfPreviewModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-all shrink-0 border border-rose-400/30"
              title="خروجی PDF جدول تعطیلات"
            >
              <FileText size={15} />
              <span>خروجی PDF تعطیلات</span>
            </button>
          </div>
        </div>

        {/* Selected Period Quick Summary Banner */}
        {selectedPeriod && (
          <div className="mt-5 pt-4 border-t border-indigo-700/50 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-indigo-100 font-bold">
                <CalendarDays size={15} className="text-emerald-400" />
                <span>بازه زمانی: {selectedPeriod.startDate} الی {selectedPeriod.endDate}</span>
              </div>
              <span className="text-indigo-400 hidden sm:inline">•</span>
              <div className="flex items-center gap-2 text-indigo-200">
                <span>وضعیت پنج‌شنبه‌ها:</span>
                <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-bold border", selectedPeriod.includeThursdayAsStudyDay ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border-rose-500/30")}>
                  {selectedPeriod.includeThursdayAsStudyDay ? 'روز درسی' : 'تعطیل آخر هفته'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenEditPeriod(selectedPeriod)}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-indigo-100 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1"
              >
                <Edit2 size={12} />
                <span>ویرایش دوره</span>
              </button>
              {periods.length > 1 && (
                <button
                  onClick={() => handleDeletePeriod(selectedPeriod.id)}
                  className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  <span>حذف</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-xs flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveTab('calendar')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeTab === 'calendar'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <CalendarIcon size={16} />
            <span>تقویم ماهانه و روزهای درسی</span>
          </button>

          <button
            onClick={() => setActiveTab('holidays_list')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeTab === 'holidays_list'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Layers size={16} />
            <span>ثبت و مدیریت تعطیلات ({periodHolidays.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('stats_tables')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeTab === 'stats_tables'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Filter size={16} />
            <span>جدول تعطیلات و آمار تفکیکی</span>
          </button>

          <button
            onClick={() => setActiveTab('study_days')}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all",
              activeTab === 'study_days'
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <BookOpen size={16} />
            <span>لیست روزهای درسی ({dateAnalysis.studyDays})</span>
          </button>
        </div>

        {/* Secondary controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTypesModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
          >
            <Tag size={14} className="text-indigo-600" />
            <span>انواع تعطیلات ({holidayTypes.length})</span>
          </button>

          <button
            onClick={handleExportToExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold rounded-xl border border-emerald-200 transition-colors"
            title="دانلود جدول کامل اکسل"
          >
            <FileSpreadsheet size={14} />
            <span className="hidden sm:inline">خروجی Excel</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 block">کل روزهای دوره</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-slate-800">{dateAnalysis.totalDays}</span>
            <span className="text-[10px] text-slate-500 font-bold">روز</span>
          </div>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-emerald-800 block">روزهای درسی محاسبه‌شده</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-emerald-700">{dateAnalysis.studyDays}</span>
            <span className="text-[10px] text-emerald-600 font-bold">روز درسی</span>
          </div>
        </div>

        <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-rose-800 block">روزهای تعطیل رسمی و مناسبتی</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-rose-700">{dateAnalysis.holidayDaysCount}</span>
            <span className="text-[10px] text-rose-600 font-bold">روز تعطیل</span>
          </div>
        </div>

        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-xs space-y-1">
          <span className="text-[10px] font-bold text-amber-800 block">تعطیلات آخر هفته</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-amber-700">{dateAnalysis.weekendDays}</span>
            <span className="text-[10px] text-amber-600 font-bold">روز</span>
          </div>
        </div>
      </div>

      {/* TAB 1: MONTHLY CALENDAR GRID VIEW */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          {/* Calendar Controls & Month Switcher */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-700">ماه مورد نظر:</span>
              <div className="flex items-center gap-1">
                <button
                  disabled={selectedMonthIndex === 0}
                  onClick={() => setSelectedMonthIndex(prev => Math.max(0, prev - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-100 transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
                <select
                  value={selectedMonthIndex}
                  onChange={(e) => setSelectedMonthIndex(Number(e.target.value))}
                  className="bg-slate-50 font-black text-slate-800 text-xs py-1.5 px-3 rounded-xl border border-slate-200 focus:outline-none"
                >
                  {periodMonthsGrouped.map((m, idx) => (
                    <option key={m.key} value={idx}>
                      {m.title} ({m.days.length} روز)
                    </option>
                  ))}
                </select>
                <button
                  disabled={selectedMonthIndex === periodMonthsGrouped.length - 1}
                  onClick={() => setSelectedMonthIndex(prev => Math.min(periodMonthsGrouped.length - 1, prev + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-slate-100 transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
              </div>
            </div>

            {/* Quick Thursday / Friday Toggles */}
            {selectedPeriod && (
              <div className="flex items-center gap-4 flex-wrap bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPeriod.includeThursdayAsStudyDay}
                    onChange={(e) => handleToggleThursday(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="font-bold text-slate-700">پنج‌شنبه‌ها روز درسی باشند</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPeriod.includeFridayAsStudyDay}
                    onChange={(e) => handleToggleFriday(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="font-bold text-slate-700">جمعه‌ها روز درسی باشند</span>
                </label>
              </div>
            )}

            <button
              onClick={() => handleOpenAddHoliday()}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
            >
              <Plus size={15} />
              <span>ثبت تعطیلی جدید</span>
            </button>
          </div>

          {/* Month Calendar Grid */}
          {periodMonthsGrouped[selectedMonthIndex] ? (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <CalendarDays className="text-indigo-600" size={20} />
                  <span>تقویم {periodMonthsGrouped[selectedMonthIndex].title}</span>
                </h3>

                {/* Legend Badges */}
                <div className="flex items-center gap-3 flex-wrap text-[11px] font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-emerald-500"></span>
                    <span className="text-slate-600">روز درسی</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-rose-500"></span>
                    <span className="text-slate-600">تعطیلی مناسبتی / رسمی</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-md bg-slate-300"></span>
                    <span className="text-slate-600">آخر هفته</span>
                  </div>
                </div>
              </div>

              {/* Day Headers (شنبه تا جمعه) */}
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-black text-slate-500 bg-slate-50 p-2 rounded-xl">
                {SHAMSI_WEEKDAY_NAMES.map((name, i) => (
                  <div key={name} className={cn(i === 6 ? "text-rose-600" : i === 5 ? "text-amber-600" : "")}>
                    {name}
                  </div>
                ))}
              </div>

              {/* Calendar Cells */}
              <div className="grid grid-cols-7 gap-2">
                {/* Offset empty slots for the first day of the month */}
                {(() => {
                  const firstDay = periodMonthsGrouped[selectedMonthIndex].days[0];
                  const offset = firstDay ? firstDay.dayOfWeek : 0;
                  return Array.from({ length: offset }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-24 bg-slate-50/40 rounded-xl border border-dashed border-slate-100"></div>
                  ));
                })()}

                {periodMonthsGrouped[selectedMonthIndex].days.map(dayItem => {
                  const dayParts = parseShamsiDate(dayItem.dateStr);
                  const colorConfig = dayItem.holidayInfo?.type 
                    ? (COLOR_MAP[dayItem.holidayInfo.type.color] || COLOR_MAP.rose)
                    : null;

                  return (
                    <div
                      key={dayItem.dateStr}
                      onClick={() => {
                        if (dayItem.holidayInfo) {
                          handleOpenEditHoliday(dayItem.holidayInfo.holiday);
                        } else {
                          handleOpenAddHoliday(dayItem.dateStr);
                        }
                      }}
                      className={cn(
                        "min-h-24 p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden",
                        dayItem.isHoliday
                          ? `${colorConfig?.bg || 'bg-rose-50'} ${colorConfig?.border || 'border-rose-200'} hover:shadow-md`
                          : dayItem.isWeekend
                          ? "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300"
                          : "bg-white border-slate-200 hover:border-emerald-400 hover:shadow-sm"
                      )}
                    >
                      {/* Day Number Header */}
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center",
                          dayItem.isHoliday
                            ? colorConfig?.badge || "bg-rose-600 text-white"
                            : dayItem.isWeekend
                            ? "bg-slate-200 text-slate-600"
                            : "bg-emerald-100 text-emerald-800"
                        )}>
                          {dayParts.day}
                        </span>

                        <span className="text-[9px] font-bold opacity-60">
                          {dayItem.dayName}
                        </span>
                      </div>

                      {/* Day Label / Holiday Badge */}
                      <div className="mt-1">
                        {dayItem.isHoliday && dayItem.holidayInfo ? (
                          <div className="space-y-0.5">
                            <span className={cn("text-[10px] font-black line-clamp-2 block leading-tight", colorConfig?.text || "text-rose-800")}>
                              {dayItem.holidayInfo.holiday.title}
                            </span>
                            <span className="text-[9px] opacity-75 font-bold block">
                              ({dayItem.holidayInfo.holiday.typeName})
                            </span>
                          </div>
                        ) : dayItem.isWeekend ? (
                          <span className="text-[10px] font-bold text-slate-400">آخر هفته</span>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                            <Check size={11} />
                            روز درسی
                          </span>
                        )}
                      </div>

                      {/* Hover action indicator */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-slate-400 font-bold text-left pt-1">
                        {dayItem.isHoliday ? 'ویرایش' : '+ تعطیلی'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
              ماهی برای این دوره تعریف نشده است.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REGISTER & MANAGE HOLIDAYS LIST */}
      {activeTab === 'holidays_list' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-800">لیست تمامی تعطیلات ثبت‌شده دوره</h3>
              <p className="text-xs text-slate-400">ثبت تعطیلات مناسبتی، تبلیغی، رسمی و حوزوی مربوط به دوره انتخاب‌شده</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPdfPreviewModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
              >
                <FileText size={16} />
                <span>خروجی PDF جدول تعطیلات</span>
              </button>

              <button
                onClick={() => handleOpenAddHoliday()}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                <Plus size={16} />
                <span>افزودن تعطیلی جدید</span>
              </button>
            </div>
          </div>

          {periodHolidays.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
              <CalendarIcon size={36} className="mx-auto text-slate-300" />
              <p className="text-xs font-bold text-slate-500">هیچ تعطیلی خاصی برای این دوره ثبت نشده است.</p>
              <button
                onClick={() => handleOpenAddHoliday()}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors"
              >
                ثبت اولین تعطیلی
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-black">
                    <th className="p-3">ردیف</th>
                    <th className="p-3">عنوان تعطیلی</th>
                    <th className="p-3">نوع تعطیلی</th>
                    <th className="p-3">تاریخ شروع</th>
                    <th className="p-3">تاریخ پایان</th>
                    <th className="p-3">مدت (روز)</th>
                    <th className="p-3">توضیحات</th>
                    <th className="p-3 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {periodHolidays.map((h, idx) => {
                    const daysCount = generateShamsiDateRange(h.startDate, h.endDate || h.startDate).length;
                    const typeObj = holidayTypes.find(t => t.id === h.typeId || t.name === h.typeName);
                    const colorConfig = typeObj ? (COLOR_MAP[typeObj.color] || COLOR_MAP.rose) : COLOR_MAP.rose;

                    return (
                      <tr key={h.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-800">{h.title}</td>
                        <td className="p-3">
                          <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold border inline-block", colorConfig.bg, colorConfig.text, colorConfig.border)}>
                            {h.typeName}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-700">{h.startDate} ({getShamsiDayOfWeekName(h.startDate)})</td>
                        <td className="p-3 font-bold text-slate-700">{h.endDate || h.startDate} ({getShamsiDayOfWeekName(h.endDate || h.startDate)})</td>
                        <td className="p-3 font-black text-indigo-700">{daysCount} روز</td>
                        <td className="p-3 text-slate-500 max-w-xs truncate">{h.description || '---'}</td>
                        <td className="p-3 text-left">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditHoliday(h)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="ویرایش"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteHoliday(h.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="حذف"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HOLIDAYS BREAKDOWN & GROUPED TABLES */}
      {activeTab === 'stats_tables' && (
        <div className="space-y-6">
          {/* Category Breakdown Stat Cards */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                <Tag className="text-indigo-600" size={18} />
                <span>تعداد روزهای تعطیلی تفکیک‌شده بر اساس نوع تعطیلی</span>
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {holidayTypes.map(type => {
                const count = dateAnalysis.typeBreakdown[type.name] || 0;
                const colorConfig = COLOR_MAP[type.color] || COLOR_MAP.indigo;

                return (
                  <div key={type.id} className={cn("p-3.5 rounded-2xl border space-y-1.5", colorConfig.bg, colorConfig.border)}>
                    <span className={cn("text-[11px] font-bold block truncate", colorConfig.text)}>
                      {type.name}
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className={cn("text-xl font-black", colorConfig.text)}>{count}</span>
                      <span className="text-[10px] opacity-75 font-bold">روز</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grouped / Filterable Holidays Table */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-800">جدول تعطیلات به تفکیک نوع</h3>
                <p className="text-xs text-slate-400">مشاهده همزمان همه تعطیلات یا فیلتر کردن بر اساس نوع مشخص (مناسبتی، تبلیغی و...)</p>
              </div>

              {/* Filter Pills & PDF Button */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setShowPdfPreviewModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs shrink-0"
                >
                  <FileText size={15} />
                  <span>دانلود PDF تعطیلات</span>
                </button>

                <button
                  onClick={() => setSelectedCategoryFilter('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                    selectedCategoryFilter === 'all'
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  همه تعطیلات ({periodHolidays.length})
                </button>

                {holidayTypes.map(type => {
                  const filteredCount = periodHolidays.filter(h => h.typeId === type.id || h.typeName === type.name).length;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setSelectedCategoryFilter(type.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
                        selectedCategoryFilter === type.id
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {type.name} ({filteredCount})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filtered Table */}
            {(() => {
              const displayHolidays = selectedCategoryFilter === 'all'
                ? periodHolidays
                : periodHolidays.filter(h => h.typeId === selectedCategoryFilter || h.typeName === holidayTypes.find(t => t.id === selectedCategoryFilter)?.name);

              if (displayHolidays.length === 0) {
                return (
                  <div className="p-8 text-center text-slate-400 text-xs font-bold">
                    هیچ تعطیلی با نوع انتخابی یافت نشد.
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-black">
                        <th className="p-3">ردیف</th>
                        <th className="p-3">عنوان تعطیلی</th>
                        <th className="p-3">نوع تعطیلی</th>
                        <th className="p-3">تاریخ شروع</th>
                        <th className="p-3">تاریخ پایان</th>
                        <th className="p-3">روزهای هفته</th>
                        <th className="p-3">تعداد روز</th>
                        <th className="p-3">توضیحات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {displayHolidays.map((h, i) => {
                        const days = generateShamsiDateRange(h.startDate, h.endDate || h.startDate).length;
                        const typeObj = holidayTypes.find(t => t.id === h.typeId || t.name === h.typeName);
                        const colorConfig = typeObj ? (COLOR_MAP[typeObj.color] || COLOR_MAP.indigo) : COLOR_MAP.indigo;

                        return (
                          <tr key={h.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-3 font-bold text-slate-400">{i + 1}</td>
                            <td className="p-3 font-bold text-slate-800">{h.title}</td>
                            <td className="p-3">
                              <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold border inline-block", colorConfig.bg, colorConfig.text, colorConfig.border)}>
                                {h.typeName}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-slate-700">{h.startDate}</td>
                            <td className="p-3 font-bold text-slate-700">{h.endDate || h.startDate}</td>
                            <td className="p-3 text-slate-600">
                              {getShamsiDayOfWeekName(h.startDate)} تا {getShamsiDayOfWeekName(h.endDate || h.startDate)}
                            </td>
                            <td className="p-3 font-black text-indigo-700">{days} روز</td>
                            <td className="p-3 text-slate-500 max-w-xs truncate">{h.description || '---'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* TAB 4: FULL STUDY DAYS SCHEDULE TABLE */}
      {activeTab === 'study_days' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-800">لیست و جدول تمامی روزهای درسی دوره</h3>
              <p className="text-xs text-slate-400">
                مجموع {dateAnalysis.studyDays} روز درسی (بدون احتساب تعطیلات و آخر هفته‌ها)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportToExcel}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                <FileSpreadsheet size={15} />
                <span>دانلود اکسل روزهای درسی</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-right border-collapse">
              <thead className="sticky top-0 bg-slate-900 text-white text-xs font-black z-10">
                <tr>
                  <th className="p-3">شماره روز درسی</th>
                  <th className="p-3">تاریخ شمسی</th>
                  <th className="p-3">روز هفته</th>
                  <th className="p-3">ماه تحصیلی</th>
                  <th className="p-3">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {(() => {
                  let studyCounter = 0;
                  return dateAnalysis.dayDetailsList.map(item => {
                    if (!item.isStudyDay) return null;
                    studyCounter++;
                    const dateParts = parseShamsiDate(item.dateStr);

                    return (
                      <tr key={item.dateStr} className="hover:bg-emerald-50/40 transition-colors">
                        <td className="p-3 font-black text-emerald-700">روز {studyCounter}</td>
                        <td className="p-3 font-bold text-slate-800">{item.dateStr}</td>
                        <td className="p-3 font-bold text-slate-700">{item.dayName}</td>
                        <td className="p-3 text-slate-600">{getShamsiMonthName(dateParts.month)} {dateParts.year}</td>
                        <td className="p-3">
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-200">
                            روز درسی فعال
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- MODAL 1: ADD / EDIT PERIOD MODAL --- */}
      <AnimatePresence>
        {showPeriodModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-5 my-auto"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-800">
                  {editingPeriod ? 'ویرایش دوره تحصیلی' : 'تعریف دوره تحصیلی جدید'}
                </h3>
                <button onClick={() => setShowPeriodModal(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle size={22} />
                </button>
              </div>

              <form onSubmit={handleSavePeriod} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">عنوان دوره تحصیلی *</label>
                  <input
                    type="text"
                    required
                    value={periodForm.title}
                    onChange={(e) => setPeriodForm({ ...periodForm, title: e.target.value })}
                    placeholder="مثلا: سال تحصیلی ۱۴۰۵ - ۱۴۰۶"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">تاریخ شروع (شمسی) *</label>
                    <input
                      type="text"
                      required
                      value={periodForm.startDate}
                      onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })}
                      placeholder="1405/06/15"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">تاریخ پایان (شمسی) *</label>
                    <input
                      type="text"
                      required
                      value={periodForm.endDate}
                      onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })}
                      placeholder="1406/03/20"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-800 block mb-1">تنظیمات روزهای درسی هفته:</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={periodForm.includeThursdayAsStudyDay}
                      onChange={(e) => setPeriodForm({ ...periodForm, includeThursdayAsStudyDay: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span className="font-bold text-slate-700">پنج‌شنبه‌ها روز درسی محاسبه شوند</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={periodForm.includeFridayAsStudyDay}
                      onChange={(e) => setPeriodForm({ ...periodForm, includeFridayAsStudyDay: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span className="font-bold text-slate-700">جمعه‌ها روز درسی محاسبه شوند</span>
                  </label>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">توضیحات تکمیلی</label>
                  <textarea
                    rows={2}
                    value={periodForm.description}
                    onChange={(e) => setPeriodForm({ ...periodForm, description: e.target.value })}
                    placeholder="توضیحات یا یادداشت‌های مربوط به این دوره تحصیلی..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPeriodModal(false)}
                    className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md"
                  >
                    ذخیره دوره
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 2: ADD / EDIT HOLIDAY MODAL --- */}
      <AnimatePresence>
        {showHolidayModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-5 my-auto"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-800">
                  {editingHoliday ? 'ویرایش تعطیلی' : 'ثبت تعطیلی جدید در تقویم'}
                </h3>
                <button onClick={() => setShowHolidayModal(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle size={22} />
                </button>
              </div>

              <form onSubmit={handleSaveHoliday} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">عنوان تعطیلی *</label>
                  <input
                    type="text"
                    required
                    value={holidayForm.title}
                    onChange={(e) => setHolidayForm({ ...holidayForm, title: e.target.value })}
                    placeholder="مثلا: تاسوعا و عاشورای حسینی، عید مبعث، تعطیلات تبلیغی و..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">نوع تعطیلی *</label>
                  <select
                    value={holidayForm.typeId}
                    onChange={(e) => setHolidayForm({ ...holidayForm, typeId: e.target.value })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {holidayTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">تاریخ شروع (شمسی) *</label>
                    <input
                      type="text"
                      required
                      value={holidayForm.startDate}
                      onChange={(e) => setHolidayForm({ ...holidayForm, startDate: e.target.value })}
                      placeholder="1405/04/15"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">تاریخ پایان (شمسی)</label>
                    <input
                      type="text"
                      value={holidayForm.endDate}
                      onChange={(e) => setHolidayForm({ ...holidayForm, endDate: e.target.value })}
                      placeholder="همان روز یا تاریخ پایان"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">توضیحات</label>
                  <textarea
                    rows={2}
                    value={holidayForm.description}
                    onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                    placeholder="جزئیات و توضیحات مربوط به این تعطیلی..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowHolidayModal(false)}
                    className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md"
                  >
                    ذخیره تعطیلی
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 3: MANAGE HOLIDAY TYPES MODAL --- */}
      <AnimatePresence>
        {showTypesModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-5 my-auto"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Tag className="text-indigo-600" size={18} />
                  <span>مدیریت انواع تعطیلات مجموعه‌</span>
                </h3>
                <button onClick={() => setShowTypesModal(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle size={22} />
                </button>
              </div>

              {/* Add New Type Form */}
              <form onSubmit={handleAddHolidayType} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3 text-xs">
                <span className="font-bold text-slate-800 block">افزودن نوع تعطیلی جدید:</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={newTypeName}
                    onChange={(e) => setNewTypeName(e.target.value)}
                    placeholder="عنوان نوع تعطیلی جدید (مثلا: اردو زیارتی)"
                    className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />

                  <select
                    value={newTypeColor}
                    onChange={(e) => setNewTypeColor(e.target.value)}
                    className="p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none"
                  >
                    <option value="rose">قرمز (Rose)</option>
                    <option value="purple">بنفش (Purple)</option>
                    <option value="sky">آبی (Sky)</option>
                    <option value="amber">نارنجی (Amber)</option>
                    <option value="emerald">سبز (Emerald)</option>
                    <option value="indigo">نیلی (Indigo)</option>
                  </select>

                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shrink-0"
                  >
                    افزودن
                  </button>
                </div>
              </form>

              {/* Existing Holiday Types List */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                <span className="text-xs font-bold text-slate-500 block">انواع تعطیلات فعال:</span>
                {holidayTypes.map(t => {
                  const colorConfig = COLOR_MAP[t.color] || COLOR_MAP.indigo;
                  return (
                    <div key={t.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold border", colorConfig.bg, colorConfig.text, colorConfig.border)}>
                          {t.name}
                        </span>
                        {t.isSystemDefault && (
                          <span className="text-[9px] text-slate-400 font-bold">(پیش‌فرض سیستم)</span>
                        )}
                      </div>

                      {!t.isSystemDefault && (
                        <button
                          onClick={() => handleDeleteHolidayType(t.id, t.name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="حذف این نوع تعطیلی"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowTypesModal(false)}
                  className="px-5 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 shadow-md"
                >
                  تایید و بستن
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 4: IMPORT / EXPORT BACKUP MODAL (GUARANTEED MATCH) --- */}
      <AnimatePresence>
        {showImportExportModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-xl w-full border border-slate-200 shadow-2xl space-y-6 my-auto"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Download className="text-indigo-600" size={20} />
                  <span>ورودی و خروجی داده‌های تقویم آموزشی</span>
                </h3>
                <button onClick={() => setShowImportExportModal(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle size={22} />
                </button>
              </div>

              {/* Section 1: Export */}
              <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-black text-indigo-900 text-sm">۱. خروجی گرفتن از اطلاعات تقویم</span>
                  <span className="text-[10px] bg-indigo-200 text-indigo-800 font-bold px-2 py-0.5 rounded-full">فرمت JSON</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  دانلود فایل پشتیبان استاندارد شامل تمامی دوره‌های تحصیلی، تعطیلات ثبت‌شده و انواع تعطیلات تعریف‌شده با ساختار کاملا تطبیق‌پذیر جهت بازیابی.
                </p>
                <button
                  onClick={handleExportData}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  <span>دانلود فایل خروجی تقویم (.json)</span>
                </button>
              </div>

              {/* Section 2: Import */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-800 text-sm">۲. وارد کردن اطلاعات تقویم (بازیابی)</span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">پشتیبانی کامل</span>
                </div>
                <p className="text-slate-500 leading-relaxed">
                  فایل پشتیبان قبلی را بارگذاری کرده یا محتوای JSON آن را در کادر زیر قرار دهید.
                </p>

                <div className="flex items-center gap-2">
                  <label className="flex-1 py-2 px-3 bg-white border border-slate-300 rounded-xl cursor-pointer text-slate-700 font-bold text-center hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                    <Upload size={15} className="text-indigo-600" />
                    <span>انتخاب فایل JSON از سیستم</span>
                    <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>

                <textarea
                  rows={4}
                  value={importJsonText}
                  onChange={(e) => setImportJsonText(e.target.value)}
                  placeholder="یا کدهای JSON خروجی گرفته شده را مستقیم اینجا وارد کنید..."
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl font-mono text-[10px] text-slate-700 dir-ltr focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleImportData('merge')}
                    className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors shadow-xs"
                  >
                    ادغام با داده‌های موجود
                  </button>
                  <button
                    onClick={() => handleImportData('replace')}
                    className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition-colors shadow-xs"
                  >
                    جایگزینی کامل دیتای تقویم
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 5: HOLIDAYS PDF PREVIEW & EXPORT MODAL --- */}
      <AnimatePresence>
        {showPdfPreviewModal && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-100 rounded-3xl p-6 max-w-5xl w-full border border-slate-300 shadow-2xl space-y-5 max-h-[92vh] flex flex-col my-auto"
              dir="rtl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 bg-white -mx-6 -mt-6 p-6 rounded-t-3xl">
                <div>
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                    <FileText className="text-rose-600" size={20} />
                    <span>پیش‌نمایش سند PDF رسمی جدول تعطیلات</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    فرمت مرتب، رسمی و شکیل جهت چاپ یا خروجی فایل PDF
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                  >
                    <Printer size={15} />
                    <span>چاپ مرورگر</span>
                  </button>

                  <button
                    onClick={handleExportHolidaysPdf}
                    disabled={isGeneratingPdf}
                    className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white text-xs font-bold rounded-xl shadow-md transition-all"
                  >
                    {isGeneratingPdf ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>در حال تولید PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download size={15} />
                        <span>دانلود فایل PDF</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setShowPdfPreviewModal(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
                  >
                    <XCircle size={22} />
                  </button>
                </div>
              </div>

              {/* Printable Document Container Scrollable Preview */}
              <div className="overflow-y-auto flex-1 p-2 bg-slate-200/60 rounded-2xl border border-slate-300/60">
                <div 
                  ref={pdfTemplateRef}
                  className="bg-white p-8 text-slate-800 space-y-6 rounded-xl shadow-md mx-auto print:shadow-none print:p-0"
                  style={{ width: '980px', backgroundColor: '#ffffff' }}
                >
                  {/* Document Header */}
                  <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-indigo-900 font-black text-sm">
                        <BookOpen size={18} className="text-indigo-700" />
                        <span>حوزه علمیه — معاونت آموزش و برنامه‌ریزی تحصیلی</span>
                      </div>
                      <h2 className="text-xl font-black text-slate-900">جدول جامع تعطیلات سالنامه آموزشی</h2>
                      <div className="text-xs font-bold text-slate-700">
                        عنوان دوره: <span className="text-indigo-900 font-black">{selectedPeriod?.title || '---'}</span>
                      </div>
                    </div>

                    <div className="text-left space-y-1 text-[11px] font-bold text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div>بازه زمانی دوره: <span className="text-slate-900 font-black">{selectedPeriod?.startDate} الی {selectedPeriod?.endDate}</span></div>
                      <div>تاریخ صدور گزارش: <span className="text-slate-900 font-black">{getTodayShamsi()}</span></div>
                      <div>وضعیت ۵شنبه‌ها: <span className="text-slate-900 font-black">{selectedPeriod?.includeThursdayAsStudyDay ? 'روز درسی' : 'تعطیل آخر هفته'}</span></div>
                    </div>
                  </div>

                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-center text-xs">
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold block">مجموع روزهای دوره</span>
                      <span className="text-sm font-black text-slate-900">{dateAnalysis.totalDays} روز</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold block">تعداد عناوین تعطیلی</span>
                      <span className="text-sm font-black text-rose-700">{periodHolidays.length} عنوان</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold block">مجموع ایام تعطیل دوره</span>
                      <span className="text-sm font-black text-rose-800">{dateAnalysis.holidayDaysCount} روز</span>
                    </div>

                    <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 font-bold block">تعداد روزهای درسی فعال</span>
                      <span className="text-sm font-black text-emerald-700">{dateAnalysis.studyDays} روز</span>
                    </div>
                  </div>

                  {/* Holidays Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-slate-800 border-r-4 border-indigo-600 pr-2">
                      جدول تفصیلی کلیه تعطیلات ثبت‌شده در سالنامه
                    </h4>

                    {periodHolidays.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        هیچ تعطیلی مشخصی برای این دوره ثبت نشده است.
                      </div>
                    ) : (
                      <table className="w-full text-right border-collapse border border-slate-300 text-xs">
                        <thead>
                          <tr className="bg-slate-900 text-white font-black">
                            <th className="p-2 border border-slate-700 text-center w-10">ردیف</th>
                            <th className="p-2 border border-slate-700">عنوان تعطیلی</th>
                            <th className="p-2 border border-slate-700 w-28">نوع تعطیلی</th>
                            <th className="p-2 border border-slate-700 text-center w-24">تاریخ شروع</th>
                            <th className="p-2 border border-slate-700 text-center w-24">تاریخ پایان</th>
                            <th className="p-2 border border-slate-700 text-center w-32">ایام هفته</th>
                            <th className="p-2 border border-slate-700 text-center w-16">مدت</th>
                            <th className="p-2 border border-slate-700">توضیحات و ملاحظات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {periodHolidays.map((h, i) => {
                            const daysCount = generateShamsiDateRange(h.startDate, h.endDate || h.startDate).length;
                            const typeObj = holidayTypes.find(t => t.id === h.typeId || t.name === h.typeName);
                            const colorConfig = typeObj ? (COLOR_MAP[typeObj.color] || COLOR_MAP.rose) : COLOR_MAP.rose;

                            return (
                              <tr key={h.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="p-2 border border-slate-200 text-center font-bold text-slate-500">{i + 1}</td>
                                <td className="p-2 border border-slate-200 font-black text-slate-900">{h.title}</td>
                                <td className="p-2 border border-slate-200">
                                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border inline-block", colorConfig.bg, colorConfig.text, colorConfig.border)}>
                                    {h.typeName}
                                  </span>
                                </td>
                                <td className="p-2 border border-slate-200 text-center font-bold text-slate-800">{h.startDate}</td>
                                <td className="p-2 border border-slate-200 text-center font-bold text-slate-800">{h.endDate || h.startDate}</td>
                                <td className="p-2 border border-slate-200 text-center font-bold text-slate-700">
                                  {getShamsiDayOfWeekName(h.startDate)} تا {getShamsiDayOfWeekName(h.endDate || h.startDate)}
                                </td>
                                <td className="p-2 border border-slate-200 text-center font-black text-indigo-900">{daysCount} روز</td>
                                <td className="p-2 border border-slate-200 text-slate-600 text-[11px]">{h.description || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Types Breakdown Bar */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                    <span className="font-black text-slate-800 block">تفکیک روزهای تعطیلی به نسبت دسته‌بندی:</span>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {holidayTypes.map(type => {
                        const count = dateAnalysis.typeBreakdown[type.name] || 0;
                        if (count === 0) return null;
                        return (
                          <div key={type.id} className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 font-bold flex items-center gap-1">
                            <span className="text-slate-600">{type.name}:</span>
                            <span className="text-indigo-900 font-black">{count} روز</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Signatures & Seal */}
                  <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs font-bold text-slate-700">
                    <div className="space-y-6">
                      <div>واحد برنامه‌ریزی و تقویم آموزشی</div>
                      <div className="text-slate-400 font-normal">امضا و تاریخ: ...........................................</div>
                    </div>

                    <div className="space-y-6">
                      <div>مدیریت و معاونت آموزش حوزه</div>
                      <div className="text-slate-400 font-normal">محل مهر و امضاء: ...........................................</div>
                    </div>
                  </div>

                  {/* Footer note */}
                  <div className="text-center text-[9px] text-slate-400 pt-2 border-t border-slate-100">
                    این فایل به عنوان سند رسمی سالنامه و تقویم آموزشی صادره از سیستم نرم‌افزاری ارائه گردیده است.
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
