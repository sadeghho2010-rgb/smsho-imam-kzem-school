import React, { useState, useEffect, useMemo } from 'react';
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
  Sparkles,
  Search,
  Filter,
  Info,
  ChevronLeft,
  ArrowRightLeft
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

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [logDate, setLogDate] = useState<string>(getTodayShamsi());
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('16:00');
  const [durationHours, setDurationHours] = useState<number>(8);
  const [category, setCategory] = useState<string>('حضور عمومی');
  const [description, setDescription] = useState<string>('');
  const [isCustomDuration, setIsCustomDuration] = useState<boolean>(false);

  // Data & Search
  const [logs, setLogs] = useState<PresenceHoursLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string>('');

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

  // Automatically calculate duration when startTime or endTime changes
  useEffect(() => {
    if (!isCustomDuration && startTime && endTime) {
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);

      if (!isNaN(startH) && !isNaN(startM) && !isNaN(endH) && !isNaN(endM)) {
        let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        if (diffMinutes < 0) diffMinutes += 24 * 60; // Overnight shift fallback
        const hours = Math.round((diffMinutes / 60) * 100) / 100;
        setDurationHours(hours > 0 ? hours : 0);
      }
    }
  }, [startTime, endTime, isCustomDuration]);

  // Save / Update Log Entry
  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logDate) {
      alert("لطفا تاریخ حضور را انتخاب کنید.");
      return;
    }

    if (durationHours <= 0) {
      alert("لطفاً ساعت حضور معتبری (بزرگتر از صفر) وارد نمایید.");
      return;
    }

    try {
      if (editingId) {
        const existing = logs.find(l => l.id === editingId);
        const updated: PresenceHoursLog = {
          ...existing!,
          date: logDate,
          startTime: isCustomDuration ? undefined : startTime,
          endTime: isCustomDuration ? undefined : endTime,
          durationHours,
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
          startTime: isCustomDuration ? undefined : startTime,
          endTime: isCustomDuration ? undefined : endTime,
          durationHours,
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
    if (log.startTime && log.endTime) {
      setStartTime(log.startTime);
      setEndTime(log.endTime);
      setIsCustomDuration(false);
    } else {
      setIsCustomDuration(true);
    }
    setDurationHours(log.durationHours);
    setCategory(log.category || 'حضور عمومی');
    setDescription(log.description || '');
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
    setCycleTitle(`بازه کارکرد ۲۵ ${SHAMSI_MONTH_NAMES[prevM - 1]} تا ۲۴ ${SHAMSI_MONTH_NAMES[todayParts.month - 1]}`);
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
    return filteredLogs.reduce((sum, l) => sum + (l.durationHours || 0), 0);
  }, [filteredLogs]);

  const uniqueDaysCount = useMemo(() => {
    const datesSet = new Set(filteredLogs.map(l => l.date));
    return datesSet.size;
  }, [filteredLogs]);

  const avgHoursPerDay = useMemo(() => {
    return uniqueDaysCount > 0 ? (totalHours / uniqueDaysCount).toFixed(1) : '0';
  }, [totalHours, uniqueDaysCount]);

  // Export CSV / Excel
  const handleExportExcel = () => {
    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'ردیف,تاریخ,روز هفته,ساعت ورود,ساعت خروج,مجموع (ساعت),دسته‌بندی,توضیحات و فعالیت\n';

    filteredLogs.forEach((l, idx) => {
      const dayName = getShamsiDayOfWeekName(l.date);
      const start = l.startTime || '—';
      const end = l.endTime || '—';
      const dur = l.durationHours;
      const cat = l.category || 'عمومی';
      const desc = (l.description || '').replace(/,/g, '،').replace(/\n/g, ' ');

      csv += `${idx + 1},${l.date},${dayName},${start},${end},${dur},${cat},"${desc}"\n`;
    });

    csv += `\n,,,,,${totalHours},مجموع ساعت حضور در بازه ${cycleStart} تا ${cycleEnd}\n`;

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

  // Export PDF / Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 text-right" dir="rtl">
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
              در این بخش می‌توانید ساعت ورود، خروج و میزان حضور روزانه خود در مجموعه را ثبت کرده و گزارش‌های تفکیکی ماهانه با خروجی اکسل و چاپی دریافت نمایید.
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
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black">
              <CalendarIcon size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800">تعیین دوره و بازه زمانی ماه (شروع تا پایان)</h2>
              <p className="text-[11px] text-slate-500">تاریخ ابتدا و انتها برای محاسبه مجموع ساعت حضور و تنظیم گزارش</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <span className="hidden sm:inline text-slate-400">میانبرهای متداول:</span>
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

      {/* --- SECTION 2: ENTRY FORM (ثبت جدید / ویرایش) --- */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <Plus size={18} className="text-indigo-600" />
            <span>{editingId ? 'ویرایش رکورد ساعت حضور' : 'ثبت جدید ساعت حضور در مجموعه'}</span>
          </h2>

          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setDescription('');
              }}
              className="text-xs text-rose-600 hover:underline font-bold"
            >
              انصراف از ویرایش
            </button>
          )}
        </div>

        <form onSubmit={handleSaveLog} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <ShamsiDatePicker
                label="تاریخ حضور *"
                required
                value={logDate}
                onChange={(d) => setLogDate(d)}
              />
            </div>

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

            {!isCustomDuration ? (
              <>
                <div>
                  <label className="block font-bold text-slate-700 text-xs mb-1">ساعت ورود</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 text-xs mb-1">ساعت خروج</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </>
            ) : (
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 text-xs mb-1">میزان حضور (بر حسب ساعت) *</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  value={durationHours}
                  onChange={(e) => setDurationHours(parseFloat(e.target.value) || 0)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="مثلا 7.5"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setIsCustomDuration(!isCustomDuration)}
              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <ArrowRightLeft size={13} />
              <span>{isCustomDuration ? 'ثبت بر اساس ساعت ورود و خروج' : 'ورود مستقیم مجموع ساعت (بدون ثبت زمان دقیق ورود/خروج)'}</span>
            </button>

            <div className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl">
              محاسبه کارکرد این رکورد: <span className="text-indigo-600 text-sm font-black">{durationHours} ساعت</span>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 text-xs mb-1">توضیحات و عناوین فعالیت در این روز (اختیاری)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثلا: حضور در بخش آموزش، برگزاری کارگاه پژوهشی، پاسخگویی به طلاب..."
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

          {/* Action Buttons: Excel & PDF/Print */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportExcel}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-xl border border-emerald-200 transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet size={16} />
              <span>خروجی اکسل</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl shadow-xs transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer size={16} />
              <span>چاپ / خروجی PDF</span>
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

        {/* Printable Report Header (Visible when printing) */}
        <div className="hidden print:block text-center space-y-2 mb-6 p-4 border-b-2 border-slate-800">
          <h1 className="text-xl font-black text-slate-900">گزارش کارکرد و حضور ماهانه</h1>
          <p className="text-sm font-bold text-slate-700">نام استاد / کاربر: {currentMentor.name} ({currentMentor.role})</p>
          <p className="text-xs text-slate-600">بازه زمانی گزارش: {cycleStart} تا {cycleEnd} — عنوان: {cycleTitle}</p>
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
                  <th className="p-3.5 text-center">ورود - خروج</th>
                  <th className="p-3.5 text-center">کارکرد (ساعت)</th>
                  <th className="p-3.5">دسته‌بندی</th>
                  <th className="p-3.5">توضیحات و فعالیت</th>
                  <th className="p-3.5 text-center print:hidden">عملیات</th>
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
                      <td className="p-3.5 text-center text-slate-700 dir-ltr font-mono font-bold">
                        {log.startTime && log.endTime ? `${log.startTime} - ${log.endTime}` : 'ساعتی'}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-900 font-black rounded-lg border border-indigo-200 inline-block">
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
                      <td className="p-3.5 text-center print:hidden">
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
                  <td colSpan={4} className="p-3.5 text-left pl-4 font-black">
                    مجموع کل کارکرد حضور در این بازه:
                  </td>
                  <td className="p-3.5 text-center">
                    <span className="px-3 py-1.5 bg-indigo-600 text-white font-black text-sm rounded-xl shadow-xs">
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

        {/* Printable Sign-off (Visible only in print) */}
        <div className="hidden print:grid grid-cols-2 gap-8 pt-12 mt-8 border-t border-slate-300 text-xs font-bold text-center">
          <div>
            <p>امضا و تایید استاد / کاربر</p>
            <div className="h-16" />
            <p className="text-[10px] text-slate-400">تاریخ: ....................</p>
          </div>
          <div>
            <p>امضا و تایید مسئول مدیریت حوزه</p>
            <div className="h-16" />
            <p className="text-[10px] text-slate-400">تاریخ: ....................</p>
          </div>
        </div>
      </div>
    </div>
  );
}
