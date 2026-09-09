import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Clock, 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Edit3, 
  FileSpreadsheet, 
  Printer, 
  TrendingUp, 
  CheckCircle2, 
  Search,
  X,
  FileText,
  Download,
  Loader2,
  Sparkles
} from 'lucide-react';
import { ShamsiDatePicker } from './ShamsiDatePicker';
import { localDb } from '../lib/localDb';
import { useMentor } from '../context/MentorContext';
import { PresenceHoursLog } from '../types';
import { 
  getTodayShamsi, 
  parseShamsiDate, 
  formatShamsiDate, 
  getShamsiDayOfWeekName, 
  compareShamsi, 
  getDaysInShamsiMonth, 
  SHAMSI_MONTH_NAMES 
} from '../lib/jalali';
import { cn } from '../lib/utils';
import { exportElementToPdf } from '../lib/pdfExport';

export default function PresenceHours() {
  const { currentMentor } = useMentor();

  // Cycle Range State (Defaults to 1st to 30th/31st of current Shamsi month)
  const today = getTodayShamsi();
  const todayParts = parseShamsiDate(today);
  const defaultStart = formatShamsiDate(todayParts.year, todayParts.month, 1);
  const defaultDaysInMonth = getDaysInShamsiMonth(todayParts.year, todayParts.month);
  const defaultEnd = formatShamsiDate(todayParts.year, todayParts.month, defaultDaysInMonth);

  const [cycleStart, setCycleStart] = useState<string>(defaultStart);
  const [cycleEnd, setCycleEnd] = useState<string>(defaultEnd);
  const [cycleTitle, setCycleTitle] = useState<string>(`کارکرد ${SHAMSI_MONTH_NAMES[todayParts.month - 1]} ${todayParts.year}`);

  // Form State - Single Duration Input Only
  const [editingId, setEditingId] = useState<string | null>(null);
  const [logDate, setLogDate] = useState<string>(getTodayShamsi());
  const [durationHours, setDurationHours] = useState<number | string>(8);
  const [category, setCategory] = useState<string>('حضور عمومی');
  const [description, setDescription] = useState<string>('');

  // Data & Search
  const [logs, setLogs] = useState<PresenceHoursLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string>('');

  // PDF Export States
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Hidden print & PDF export refs
  const pdfPrintableRef = useRef<HTMLDivElement | null>(null);
  const printIframeRef = useRef<HTMLIFrameElement | null>(null);

  // Load logs from localDb
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const stored = await localDb.getDocs<PresenceHoursLog>('presence_hours_logs');
      setLogs(stored || []);
    } catch (err) {
      console.error("Error loading presence hours logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Save / Update Log Entry
  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logDate) {
      alert("لطفا تاریخ حضور را انتخاب کنید.");
      return;
    }

    const numericDuration = typeof durationHours === 'string' ? parseFloat(durationHours) : durationHours;
    if (isNaN(numericDuration) || numericDuration <= 0) {
      alert("لطفاً مقدار ساعت حضور معتبری (بزرگتر از صفر) وارد نمایید.");
      return;
    }

    try {
      if (editingId) {
        const existing = logs.find(l => l.id === editingId);
        const updated: PresenceHoursLog = {
          ...existing!,
          date: logDate,
          durationHours: numericDuration,
          category,
          description: description.trim(),
          updatedAt: new Date().toISOString()
        };
        await localDb.setDoc('presence_hours_logs', updated);
        setLogs(prev => prev.map(l => l.id === editingId ? updated : l));
        showToast("رکورد حضور با موفقیت به‌روزرسانی شد.");
      } else {
        const newLog: PresenceHoursLog = {
          id: `log-${Date.now()}`,
          mentorId: currentMentor.id,
          date: logDate,
          durationHours: numericDuration,
          category,
          description: description.trim(),
          createdAt: new Date().toISOString()
        };
        await localDb.setDoc('presence_hours_logs', newLog);
        setLogs(prev => [...prev, newLog]);
        showToast("ساعت حضور جدید با موفقیت ثبت شد.");
      }

      // Reset form
      setEditingId(null);
      setDescription('');
    } catch (err) {
      console.error("Error saving presence log:", err);
      alert("خطا در ثبت ساعت حضور.");
    }
  };

  // Edit action
  const handleEdit = (log: PresenceHoursLog) => {
    setEditingId(log.id);
    setLogDate(log.date);
    setDurationHours(log.durationHours);
    setCategory(log.category || 'حضور عمومی');
    setDescription(log.description || '');
    // Scroll smoothly to form
    window.scrollTo({ top: 350, behavior: 'smooth' });
  };

  // Delete action
  const handleDelete = async (id: string) => {
    if (!window.confirm("آیا از حذف این رکورد ساعت حضور اطمینان دارید؟")) return;
    try {
      await localDb.deleteDoc('presence_hours_logs', id);
      setLogs(prev => prev.filter(l => l.id !== id));
      showToast("رکورد مورد نظر حذف شد.");
    } catch (err) {
      console.error("Error deleting log:", err);
    }
  };

  // Preset Cycle Selectors
  const setMonthPreset = (monthOffset: number = 0) => {
    let y = todayParts.year;
    let m = todayParts.month + monthOffset;
    if (m > 12) {
      m -= 12;
      y += 1;
    } else if (m < 1) {
      m += 12;
      y -= 1;
    }

    const start = formatShamsiDate(y, m, 1);
    const daysInM = getDaysInShamsiMonth(y, m);
    const end = formatShamsiDate(y, m, daysInM);

    setCycleStart(start);
    setCycleEnd(end);
    setCycleTitle(`کارکرد ${SHAMSI_MONTH_NAMES[m - 1]} ${y}`);
  };

  const setCustomShiftPreset = () => {
    // Standard custom cycle: 25th of last month to 24th of current month
    let prevM = todayParts.month - 1;
    let prevY = todayParts.year;
    if (prevM < 1) {
      prevM = 12;
      prevY -= 1;
    }

    const start = formatShamsiDate(prevY, prevM, 25);
    const end = formatShamsiDate(todayParts.year, todayParts.month, 24);

    setCycleStart(start);
    setCycleEnd(end);
    setCycleTitle(`بازه ۲۵ ${SHAMSI_MONTH_NAMES[prevM - 1]} تا ۲۴ ${SHAMSI_MONTH_NAMES[todayParts.month - 1]}`);
  };

  // Filter logs for the selected cycle
  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const isWithinCycle = compareShamsi(l.date, cycleStart) >= 0 && compareShamsi(l.date, cycleEnd) <= 0;
      if (!isWithinCycle) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchesDesc = l.description?.toLowerCase().includes(q);
        const matchesCat = l.category?.toLowerCase().includes(q);
        const matchesDate = l.date.includes(q);
        return matchesDesc || matchesCat || matchesDate;
      }

      return true;
    }).sort((a, b) => compareShamsi(a.date, b.date));
  }, [logs, cycleStart, cycleEnd, searchTerm]);

  // Aggregate Stats
  const totalHours = useMemo(() => {
    return Math.round(filteredLogs.reduce((sum, l) => sum + (Number(l.durationHours) || 0), 0) * 100) / 100;
  }, [filteredLogs]);

  const uniqueDaysCount = useMemo(() => {
    const datesSet = new Set(filteredLogs.map(l => l.date));
    return datesSet.size;
  }, [filteredLogs]);

  const avgHoursPerDay = useMemo(() => {
    return uniqueDaysCount > 0 ? (totalHours / uniqueDaysCount).toFixed(1) : '0';
  }, [totalHours, uniqueDaysCount]);

  // Direct PDF Download via exportElementToPdf (html2canvas-pro + jsPDF)
  const handleDownloadPdfDirectly = async () => {
    if (filteredLogs.length === 0) {
      alert("هیچ رکوردی در این بازه زمانی برای صدور PDF وجود ندارد.");
      return;
    }

    if (!pdfPrintableRef.current) {
      alert("خطا در بارگذاری بخش گزارش چاپی.");
      return;
    }

    setIsExportingPdf(true);
    try {
      const sanitizedTitle = (cycleTitle || 'گزارش_حضور').replace(/[\s/\\:]+/g, '_');
      const startClean = cycleStart.replace(/\//g, '-');
      const endClean = cycleEnd.replace(/\//g, '-');
      const filename = `گزارش_کارکرد_${sanitizedTitle}_${startClean}_تا_${endClean}.pdf`;

      await exportElementToPdf({
        element: pdfPrintableRef.current,
        filename,
        orientation: 'portrait',
        marginMM: 8
      });

      showToast("فایل PDF با موفقیت ایجاد و دانلود شد.");
    } catch (err) {
      console.error("PDF Export Error:", err);
      alert("خطا در تولید فایل PDF. از دکمه «چاپ مستقیم» استفاده نمایید.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Export CSV / Excel
  const handleExportExcel = () => {
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'ردیف,تاریخ,روز هفته,میزان حضور (ساعت),دسته‌بندی,توضیحات و فعالیت\n';

    filteredLogs.forEach((l, idx) => {
      const dayName = getShamsiDayOfWeekName(l.date);
      const dur = l.durationHours;
      const cat = l.category || 'عمومی';
      const desc = (l.description || '').replace(/,/g, '،').replace(/\n/g, ' ');

      csv += `${idx + 1},${l.date},${dayName},${dur},${cat},"${desc}"\n`;
    });

    csv += `\n,,,,${totalHours},مجموع ساعت حضور در بازه ${cycleStart} تا ${cycleEnd}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `گزارش_حضور_${cycleStart.replace(/\//g, '-')}_تا_${cycleEnd.replace(/\//g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("فایل خروجی اکسل (CSV) با موفقیت دریافت شد.");
  };

  // Direct Print via hidden iframe
  const triggerIframePrint = () => {
    if (!pdfPrintableRef.current) return;
    const printContent = pdfPrintableRef.current.innerHTML;
    
    let iframe = printIframeRef.current;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      printIframeRef.current = iframe;
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="fa">
        <head>
          <meta charset="utf-8" />
          <title>${cycleTitle}</title>
          <style>
            @page { size: A4 portrait; margin: 10mm; }
            * { box-sizing: border-box; font-family: Tahoma, 'Vazirmatn', Arial, sans-serif; }
            body { background: #fff; color: #0f172a; margin: 0; padding: 10px; font-size: 11pt; direction: rtl; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #64748b; padding: 6px 8px; font-size: 10pt; }
            th { background-color: #1e293b; color: #fff; text-align: center; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .total-row { background-color: #e2e8f0 !important; font-weight: bold; }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        try {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
        } catch (e) {
          console.warn("Iframe print fallback:", e);
          window.print();
        }
      }, 350);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 text-right" dir="rtl">
      {/* Hidden print iframe */}
      <iframe ref={printIframeRef} className="hidden" title="print-frame" />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl font-bold text-xs flex items-center gap-2 border border-slate-700 animate-bounce">
          <CheckCircle2 size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header & Title */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute -left-10 -top-10 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-indigo-200 text-xs font-bold backdrop-blur-xs">
              <Clock size={14} className="text-amber-400" />
              <span>سامانه ثبت ساعت حضور و کارکرد</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              ثبت ساعت و گزارش کارکرد حضور
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200/80 font-medium max-w-2xl">
              ثبت سریع مقدار ساعت حضور روزانه، محاسبه خودکار مجموع کارکرد و دریافت خروجی PDF رسمی و فایل اکسل.
            </p>
          </div>

          {/* Quick Stats Banner */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 flex items-center gap-6 w-full md:w-auto justify-around">
            <div className="text-center space-y-0.5">
              <span className="text-[10px] font-bold text-indigo-200 block">مجموع کارکرد</span>
              <span className="text-2xl font-black text-amber-300">{totalHours} <span className="text-xs text-white">ساعت</span></span>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-center space-y-0.5">
              <span className="text-[10px] font-bold text-indigo-200 block">روزهای حضور</span>
              <span className="text-2xl font-black text-white">{uniqueDaysCount} <span className="text-xs text-indigo-200">روز</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* --- SECTION 1: SET CYCLE RANGE (شروع و پایان ماه) --- */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black">
              <CalendarIcon size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800">تعیین دوره و بازه زمانی ماه (شروع تا پایان)</h2>
              <p className="text-[11px] text-slate-500">تعیین بازه برای محاسبه مجموع ساعت و خروجی گزارش PDF</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <span className="hidden sm:inline text-slate-400">میانبرها:</span>
            <button
              onClick={() => setMonthPreset(0)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-colors cursor-pointer"
            >
              ماه جاری
            </button>
            <button
              onClick={() => setMonthPreset(-1)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl transition-colors cursor-pointer"
            >
              ماه قبل
            </button>
            <button
              onClick={setCustomShiftPreset}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl transition-colors cursor-pointer"
            >
              ۲۵ام تا ۲۴ام
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <ShamsiDatePicker
              label="تاریخ شروع ماه / بازه *"
              value={cycleStart}
              onChange={(d) => setCycleStart(d)}
            />
          </div>

          <div>
            <ShamsiDatePicker
              label="تاریخ پایان ماه / بازه *"
              value={cycleEnd}
              onChange={(d) => setCycleEnd(d)}
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 text-xs mb-1">عنوان گزارش / ماه</label>
            <input
              type="text"
              value={cycleTitle}
              onChange={(e) => setCycleTitle(e.target.value)}
              placeholder="مثلا: گزارش حضور مهر ماه"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* --- SECTION 2: ENTRY FORM (فقط یک فیلد برای ثبت مقدار ساعت) --- */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Plus size={18} className="text-indigo-600" />
            <span>{editingId ? 'ویرایش رکورد ساعت حضور' : 'ثبت ساعت حضور روزانه'}</span>
          </h2>

          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setDescription('');
                setDurationHours(8);
              }}
              className="text-xs text-rose-600 hover:underline font-bold cursor-pointer"
            >
              انصراف از ویرایش
            </button>
          )}
        </div>

        <form onSubmit={handleSaveLog} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* 1. Date */}
            <div>
              <ShamsiDatePicker
                label="تاریخ حضور *"
                required
                value={logDate}
                onChange={(d) => setLogDate(d)}
              />
            </div>

            {/* 2. Single Hours Duration Input */}
            <div>
              <label className="block font-bold text-slate-700 text-xs mb-1">
                مقدار ساعت حضور در این روز *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="24"
                  required
                  value={durationHours}
                  onChange={(e) => setDurationHours(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-base text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                  placeholder="مثلا: 8 یا 7.5"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">ساعت</span>
              </div>
              {/* Quick shortcut chips */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] text-slate-400 font-bold">میانبرها:</span>
                {[4, 6, 7.5, 8, 9].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDurationHours(val)}
                    className={cn(
                      "px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer",
                      Number(durationHours) === val
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                  >
                    {val} ساعت
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Category */}
            <div>
              <label className="block font-bold text-slate-700 text-xs mb-1">دسته‌بندی فعالیت</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="حضور عمومی">حضور عمومی و اداری</option>
                <option value="تدریس و کلاس">تدریس و کلاس درس</option>
                <option value="پژوهش و مطالعه">پژوهش و مقاله</option>
                <option value="جلسه و مشاوره">جلسات و مشاوره</option>
                <option value="سایر">سایر موارد</option>
              </select>
            </div>
          </div>

          {/* 4. Description */}
          <div>
            <label className="block font-bold text-slate-700 text-xs mb-1">توضیحات و شرح فعالیت در این روز (اختیاری)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثلا: حضور در بخش آموزش، پاسخگویی به طلاب، مشاوره درسی و..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer text-xs"
            >
              <Clock size={16} />
              <span>{editingId ? 'به‌روزرسانی رکورد حضور' : 'ثبت ساعت حضور'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* --- SECTION 3: MONTHLY REPORT & TABLE --- */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
              <TrendingUp size={18} className="text-indigo-600" />
              <span>گزارش ماهانه حضور: {cycleTitle}</span>
            </h2>
            <p className="text-xs text-slate-500">
              بازه زمانی: <span className="font-bold text-slate-700">{cycleStart}</span> تا <span className="font-bold text-slate-700">{cycleEnd}</span>
            </p>
          </div>

          {/* Action Buttons: Excel & PDF / Print */}
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            <button
              onClick={handleExportExcel}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl border border-emerald-200 transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet size={16} />
              <span>خروجی اکسل</span>
            </button>

            {/* Direct PDF Download Button */}
            <button
              onClick={handleDownloadPdfDirectly}
              disabled={isExportingPdf || filteredLogs.length === 0}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer"
              title="دانلود مستقیم فایل PDF گزارش کارکرد"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>در حال ایجاد PDF...</span>
                </>
              ) : (
                <>
                  <Download size={16} />
                  <span>دانلود فایل PDF</span>
                </>
              )}
            </button>

            {/* Print & Preview Button */}
            <button
              onClick={() => setShowPrintModal(true)}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-xs transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer size={16} />
              <span>چاپ و پیش‌نمایش</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
          <Search size={18} className="text-slate-400 mr-2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجو در شرح فعالیت‌ها یا تاریخ..."
            className="w-full bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none"
          />
        </div>

        {/* Logs Table */}
        {filteredLogs.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full text-right border-collapse">
              <thead className="bg-slate-900 text-white text-xs font-black">
                <tr>
                  <th className="p-3.5 text-center">ردیف</th>
                  <th className="p-3.5">تاریخ شمسی</th>
                  <th className="p-3.5">روز هفته</th>
                  <th className="p-3.5 text-center">میزان حضور (ساعت)</th>
                  <th className="p-3.5">دسته‌بندی</th>
                  <th className="p-3.5">توضیحات و فعالیت</th>
                  <th className="p-3.5 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {filteredLogs.map((log, idx) => {
                  const dayName = getShamsiDayOfWeekName(log.date);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-3.5 font-bold text-slate-900">{log.date}</td>
                      <td className="p-3.5 text-slate-600 font-bold">{dayName}</td>
                      <td className="p-3.5 text-center">
                        <span className="px-3.5 py-1.5 bg-indigo-50 text-indigo-900 font-black rounded-xl border border-indigo-200 inline-block text-xs shadow-2xs">
                          {log.durationHours} ساعت
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200 text-[11px]">
                          {log.category || 'عمومی'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-700 max-w-xs truncate">
                        {log.description || '—'}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEdit(log)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="ویرایش"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(log.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 text-slate-900 text-xs font-black border-t-2 border-slate-300">
                <tr>
                  <td colSpan={3} className="p-3.5 text-left pl-4 font-black">
                    مجموع کل کارکرد حضور در این بازه:
                  </td>
                  <td className="p-3.5 text-center">
                    <span className="px-4 py-2 bg-indigo-600 text-white font-black text-sm rounded-xl shadow-xs">
                      {totalHours} ساعت
                    </span>
                  </td>
                  <td colSpan={3} className="p-3.5 text-slate-600">
                    تعداد روزهای حضور: {uniqueDaysCount} روز | میانگین روزانه: {avgHoursPerDay} ساعت
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
            <Clock size={36} className="text-slate-300 mx-auto" />
            <p className="text-xs font-bold text-slate-600">
              هیچ رکوردی برای ساعت حضور در بازه زمانی انتخاب‌شده ({cycleStart} تا {cycleEnd}) ثبت نشده است.
            </p>
            <p className="text-[11px] text-slate-400">
              از فرم بالای صفحه برای افزودن کارکرد و ساعت حضور جدید استفاده نمایید.
            </p>
          </div>
        )}
      </div>

      {/* --- HIDDEN HIGH-RES CONTAINER FOR DIRECT PDF EXPORT (A4 Layout) --- */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div 
          ref={pdfPrintableRef} 
          className="p-8 bg-white text-slate-900 space-y-6 w-[800px]" 
          dir="rtl"
          style={{ fontFamily: 'Tahoma, Vazirmatn, Arial, sans-serif' }}
        >
          {/* Header */}
          <div className="border-2 border-slate-800 rounded-xl p-5 bg-slate-50 flex justify-between items-center">
            <div>
              <h1 className="text-xl font-black text-slate-900 m-0">گزارش کارکرد و ساعت حضور ماهانه</h1>
              <p className="text-sm font-bold text-slate-600 mt-1">{cycleTitle}</p>
            </div>
            <div className="text-xs font-bold text-slate-700 space-y-1 text-left">
              <div>استاد / همکار: <span className="text-slate-900 font-black">{currentMentor.name}</span> ({currentMentor.role})</div>
              <div>بازه زمانی: <span className="text-slate-900 font-black">{cycleStart}</span> تا <span className="text-slate-900 font-black">{cycleEnd}</span></div>
              <div>تاریخ صدور سند: <span className="text-slate-900 font-black">{today}</span></div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3 bg-slate-100 rounded-xl p-3 border border-slate-300 text-center">
            <div>
              <span className="text-xs text-slate-500 font-bold block">مجموع کل کارکرد</span>
              <span className="text-lg font-black text-indigo-900">{totalHours} ساعت</span>
            </div>
            <div className="border-r border-l border-slate-300">
              <span className="text-xs text-slate-500 font-bold block">تعداد روزهای حضور</span>
              <span className="text-lg font-black text-slate-900">{uniqueDaysCount} روز</span>
            </div>
            <div>
              <span className="text-xs text-slate-500 font-bold block">میانگین روزانه</span>
              <span className="text-lg font-black text-slate-900">{avgHoursPerDay} ساعت</span>
            </div>
          </div>

          {/* Table */}
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="border border-slate-400 p-2 text-center w-10">ردیف</th>
                <th className="border border-slate-400 p-2 text-center w-28">تاریخ شمسی</th>
                <th className="border border-slate-400 p-2 text-center w-24">روز</th>
                <th className="border border-slate-400 p-2 text-center w-28">میزان حضور</th>
                <th className="border border-slate-400 p-2 text-center w-28">دسته‌بندی</th>
                <th className="border border-slate-400 p-2 text-right">شرح فعالیت و ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log, idx) => (
                  <tr key={log.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    <td className="border border-slate-300 p-2 text-center font-bold">{idx + 1}</td>
                    <td className="border border-slate-300 p-2 text-center font-bold">{log.date}</td>
                    <td className="border border-slate-300 p-2 text-center">{getShamsiDayOfWeekName(log.date)}</td>
                    <td className="border border-slate-300 p-2 text-center font-black text-indigo-950 bg-indigo-50/40">
                      {log.durationHours} ساعت
                    </td>
                    <td className="border border-slate-300 p-2 text-center">{log.category || 'عمومی'}</td>
                    <td className="border border-slate-300 p-2 text-right">{log.description || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="border border-slate-300 p-6 text-center text-slate-400">
                    هیچ رکوردی در این دوره زمانی ثبت نشده است.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-200 font-black text-slate-900 border-2 border-slate-400">
                <td colSpan={3} className="p-3 text-left pl-4 font-black border border-slate-400">
                  جمع کل کارکرد حضور:
                </td>
                <td className="p-3 text-center text-sm font-black text-indigo-950 border border-slate-400">
                  {totalHours} ساعت
                </td>
                <td colSpan={2} className="p-3 text-slate-600 text-[11px] border border-slate-400">
                  تایید شده بر اساس ثبت روزانه
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-10 border-t-2 border-dashed border-slate-300 text-xs font-bold text-center">
            <div className="space-y-12">
              <p>امضا و تایید استاد / متقاضی</p>
              <p className="text-[10px] text-slate-400">تاریخ: ....................</p>
            </div>
            <div className="space-y-12">
              <p>امضا و مهر مدیریت حوزه / مسئول مالی</p>
              <p className="text-[10px] text-slate-400">تاریخ: ....................</p>
            </div>
          </div>
        </div>
      </div>

      {/* --- MODAL: PDF / PRINT PREVIEW --- */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-amber-400" />
                <div>
                  <h3 className="text-sm sm:text-base font-black">پیش‌نمایش و چاپ سند کارکرد</h3>
                  <p className="text-[11px] text-slate-300">سند رسمی کارکرد ماهانه آماده چاپ یا ذخیره PDF</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPdfDirectly}
                  disabled={isExportingPdf}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isExportingPdf ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                  <span>دانلود فایل PDF</span>
                </button>

                <button
                  onClick={triggerIframePrint}
                  className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer size={15} />
                  <span>چاپگر مستقیم</span>
                </button>

                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-2 bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Document Preview Container (A4 Look) */}
            <div className="p-4 sm:p-8 overflow-y-auto bg-slate-100 flex justify-center">
              <div className="bg-white rounded-xl shadow-lg border border-slate-300 p-6 sm:p-10 w-full max-w-3xl space-y-6 text-right text-slate-800">
                {/* Formal Letterhead */}
                <div className="border-2 border-slate-800 rounded-2xl p-4 sm:p-5 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-black text-slate-900">گزارش کارکرد و ساعت حضور ماهانه</h2>
                    <p className="text-xs font-bold text-slate-600">{cycleTitle}</p>
                  </div>
                  <div className="text-xs font-bold text-slate-700 space-y-1 text-left sm:text-right border-t sm:border-t-0 sm:border-r border-slate-300 pt-2 sm:pt-0 sm:pr-4">
                    <div>استاد / همکار: <span className="text-slate-900 font-black">{currentMentor.name}</span> ({currentMentor.role})</div>
                    <div>بازه زمانی: <span className="text-slate-900 font-black">{cycleStart}</span> تا <span className="text-slate-900 font-black">{cycleEnd}</span></div>
                    <div>تاریخ صدور سند: <span className="text-slate-900 font-black">{today}</span></div>
                  </div>
                </div>

                {/* Summary Bar */}
                <div className="grid grid-cols-3 gap-3 bg-slate-100 rounded-xl p-3 border border-slate-300 text-center">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block">مجموع کارکرد</span>
                    <span className="text-base font-black text-indigo-900">{totalHours} ساعت</span>
                  </div>
                  <div className="border-r border-l border-slate-300">
                    <span className="text-[10px] text-slate-500 font-bold block">تعداد روزهای حضور</span>
                    <span className="text-base font-black text-slate-900">{uniqueDaysCount} روز</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block">میانگین روزانه</span>
                    <span className="text-base font-black text-slate-900">{avgHoursPerDay} ساعت</span>
                  </div>
                </div>

                {/* Table in Document */}
                <div className="rounded-xl border border-slate-400 overflow-hidden">
                  <table className="w-full border-collapse text-xs">
                    <thead className="bg-slate-900 text-white font-black">
                      <tr>
                        <th className="p-2.5 text-center border-b border-slate-400">ردیف</th>
                        <th className="p-2.5 text-center border-b border-slate-400">تاریخ شمسی</th>
                        <th className="p-2.5 text-center border-b border-slate-400">روز</th>
                        <th className="p-2.5 text-center border-b border-slate-400">میزان حضور</th>
                        <th className="p-2.5 text-center border-b border-slate-400">دسته‌بندی</th>
                        <th className="p-2.5 text-right border-b border-slate-400">شرح فعالیت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300">
                      {filteredLogs.map((log, idx) => (
                        <tr key={log.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                          <td className="p-2.5 text-center font-bold text-slate-500">{idx + 1}</td>
                          <td className="p-2.5 text-center font-bold text-slate-900">{log.date}</td>
                          <td className="p-2.5 text-center text-slate-700">{getShamsiDayOfWeekName(log.date)}</td>
                          <td className="p-2.5 text-center font-black text-indigo-900 bg-indigo-50/50">{log.durationHours} ساعت</td>
                          <td className="p-2.5 text-center text-slate-700">{log.category || 'عمومی'}</td>
                          <td className="p-2.5 text-slate-700 max-w-xs">{log.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-200 font-black border-t-2 border-slate-400">
                      <tr>
                        <td colSpan={3} className="p-3 text-left pl-4 font-black">مجموع کل کارکرد حضور:</td>
                        <td className="p-3 text-center text-sm font-black text-indigo-950">{totalHours} ساعت</td>
                        <td colSpan={2} className="p-3 text-slate-600 text-[11px]">تایید شده جهت درج در سوابق کارکرد</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-8 pt-8 border-t-2 border-dashed border-slate-300 text-xs font-bold text-center">
                  <div className="space-y-12">
                    <p>امضا و تایید استاد / متقاضی</p>
                    <p className="text-[10px] text-slate-400">تاریخ: ....................</p>
                  </div>
                  <div className="space-y-12">
                    <p>امضا و مهر مدیریت حوزه / مسئول مالی</p>
                    <p className="text-[10px] text-slate-400">تاریخ: ....................</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600">
              <p>جهت دریافت برگه، روی دکمه «دانلود فایل PDF» یا «چاپگر مستقیم» کلیک نمایید.</p>
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
