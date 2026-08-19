import React, { useRef, useState, useMemo } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  X, 
  Clock, 
  BookOpen, 
  MessageSquare, 
  Calculator,
  Loader2,
  SlidersHorizontal,
  RotateCcw,
  Trophy,
  AlertTriangle,
  BarChart3,
  GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Student, StudyPeriod, PeriodicStudyLog } from '../../types';
import { prepareAggregatedData } from './allPeriodsExport';
import { cn } from '../../lib/utils';
import { exportElementToPdf } from '../../lib/pdfExport';

interface AllPeriodsPDFModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  periods: StudyPeriod[];
  allLogs: PeriodicStudyLog[];
  mentorName?: string;
}

export default function AllPeriodsPDFModal({
  isOpen,
  onClose,
  students = [],
  periods = [],
  allLogs = [],
  mentorName
}: AllPeriodsPDFModalProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showColumnConfig, setShowColumnConfig] = useState(true);

  // Column visibility state for PDF
  const [pdfCols, setPdfCols] = useState({
    rank: true,
    name: true,
    grade: true,
    sumStudy: true,
    sumDisc: true,
    sumTotal: true,
    activeCount: true,
    commitmentRate: true,
    avgTotal: true,
    gradeAvg: true,
    belowAverageCount: true,
    statusAvg: true
  });

  // Section visibility toggles
  const [sections, setSections] = useState({
    kpiCards: true,
    dataTable: true,
    overallStats: true,
    topPerformers: true,
    lowPerformers: true,
    gradeBreakdown: true
  });

  const { items, globalAvgMinutes, grandTotalStudy, grandTotalDisc, grandTotalAll, gradeAverages } = useMemo(() => {
    try {
      return prepareAggregatedData(students || [], periods || [], allLogs || []);
    } catch (e) {
      console.error("Error preparing aggregated data:", e);
      return {
        items: [],
        globalAvgMinutes: 0,
        grandTotalStudy: 0,
        grandTotalDisc: 0,
        grandTotalAll: 0,
        gradeAverages: {}
      };
    }
  }, [students, periods, allLogs]);

  const formatHoursMinutes = (min: number) => {
    const num = Number(min) || 0;
    const h = Math.floor(num / 60);
    const m = num % 60;
    if (h === 0) return `${m} د`;
    if (m === 0) return `${h} س`;
    return `${h}س ${m}د`;
  };

  // Comprehensive analytics calculation
  const analytics = useMemo(() => {
    const safeItems = Array.isArray(items) ? items : [];
    const safeStudents = Array.isArray(students) ? students : [];
    const safePeriods = Array.isArray(periods) ? periods : [];

    const activeItems = safeItems.filter(it => it && it.sumTotal > 0);
    const inactiveItems = safeItems.filter(it => !it || it.sumTotal === 0);

    // Total possible logs
    const totalPossibleLogs = safeStudents.length * (safePeriods.length || 1);
    const actualActiveLogs = safeItems.reduce((acc, it) => acc + (it?.activeCount || 0), 0);
    const overallSchoolCommitment = totalPossibleLogs > 0 ? Math.round((actualActiveLogs / totalPossibleLogs) * 100) : 0;

    // Study vs Discussion ratio
    const studyRatio = grandTotalAll > 0 ? Math.round((grandTotalStudy / grandTotalAll) * 100) : 0;
    const discRatio = grandTotalAll > 0 ? Math.round((grandTotalDisc / grandTotalAll) * 100) : 0;

    // Above vs Below Global Average
    const aboveAvgCount = safeItems.filter(it => it && it.avgTotal >= globalAvgMinutes && it.sumTotal > 0).length;
    const belowAvgCount = safeItems.filter(it => it && it.avgTotal < globalAvgMinutes && it.sumTotal > 0).length;

    // Top performers
    const sortedByTotal = [...safeItems].sort((a, b) => (b?.sumTotal || 0) - (a?.sumTotal || 0));
    const sortedByStudy = [...safeItems].sort((a, b) => (b?.sumStudy || 0) - (a?.sumStudy || 0));
    const sortedByDisc = [...safeItems].sort((a, b) => (b?.sumDisc || 0) - (a?.sumDisc || 0));
    const sortedByCommitment = [...safeItems].sort((a, b) => ((b?.commitmentRate || 0) - (a?.commitmentRate || 0)) || ((b?.sumTotal || 0) - (a?.sumTotal || 0)));

    // Lowest performers (among those with at least some logs, or all)
    const lowestByTotal = [...activeItems].sort((a, b) => (a?.sumTotal || 0) - (b?.sumTotal || 0));
    const lowestByCommitment = [...safeItems].sort((a, b) => ((a?.commitmentRate || 0) - (b?.commitmentRate || 0)) || ((a?.sumTotal || 0) - (b?.sumTotal || 0)));
    const mostBelowAvgCount = [...safeItems].sort((a, b) => (b?.belowAverageCount || 0) - (a?.belowAverageCount || 0));

    // Zero registration count
    const zeroLogsCount = inactiveItems.length;

    // Consistent students (zero times below average)
    const zeroBelowAvgStudents = safeItems.filter(it => it && it.belowAverageCount === 0 && it.sumTotal > 0);

    return {
      activeItemsCount: activeItems.length,
      zeroLogsCount,
      overallSchoolCommitment,
      studyRatio,
      discRatio,
      aboveAvgCount,
      belowAvgCount,
      // Best
      topTotal: sortedByTotal[0] || null,
      topStudy: sortedByStudy[0] || null,
      topDisc: sortedByDisc[0] || null,
      topCommitment: sortedByCommitment[0] || null,
      top3Total: sortedByTotal.slice(0, 3).filter(Boolean),
      zeroBelowAvgStudents,
      // Weakest
      lowestTotal: lowestByTotal[0] || null,
      lowestCommitment: lowestByCommitment[0] || null,
      mostBelowAvg: mostBelowAvgCount[0] || null,
      bottom3Total: lowestByTotal.slice(0, 3).filter(Boolean)
    };
  }, [items, students, periods, grandTotalAll, grandTotalStudy, grandTotalDisc, globalAvgMinutes]);

  const handleSelectAllCols = () => {
    setPdfCols({
      rank: true,
      name: true,
      grade: true,
      sumStudy: true,
      sumDisc: true,
      sumTotal: true,
      activeCount: true,
      commitmentRate: true,
      avgTotal: true,
      gradeAvg: true,
      belowAverageCount: true,
      statusAvg: true
    });
  };

  const handleResetDefaultCols = () => {
    setPdfCols({
      rank: true,
      name: true,
      grade: true,
      sumStudy: true,
      sumDisc: true,
      sumTotal: true,
      activeCount: true,
      commitmentRate: true,
      avgTotal: true,
      gradeAvg: true,
      belowAverageCount: true,
      statusAvg: true
    });
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current || isGenerating) return;
    setIsGenerating(true);

    try {
      const fileName = `گزارش_جامع_تحلیلی_مطالعه_و_مباحثه_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.pdf`;
      await exportElementToPdf({
        element: reportRef.current,
        filename: fileName,
        orientation: 'landscape',
        marginMM: 4
      });
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("خطا در ایجاد فایل PDF. می‌توانید از دکمه چاپ مستقیم استفاده نمایید.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden border border-slate-100"
        >
          {/* Modal Header */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-800">
                  گزارش جامع، تحلیلی و آماری تمام دوره‌ها
                </h3>
                <p className="text-[11px] text-slate-500 font-bold">
                  شامل جدول تجمیعی، شاخص‌های کلان، برترین‌ها و موارد نیازمند پیگیری
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowColumnConfig(!showColumnConfig)}
                className={cn(
                  "px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border",
                  showColumnConfig 
                    ? "bg-indigo-50 text-indigo-700 border-indigo-200" 
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                )}
              >
                <SlidersHorizontal size={14} />
                <span>{showColumnConfig ? 'بستن تنظیمات گزارش' : 'تنظیم ستون‌ها و بخش‌ها'}</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Printer size={15} />
                <span className="hidden sm:inline">چاپ (Print)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isGenerating}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-200 flex items-center gap-1.5"
              >
                {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                <span>{isGenerating ? 'در حال ایجاد...' : 'دانلود فایل PDF'}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:bg-slate-200/50 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Column & Section Selection Toolbar */}
          {showColumnConfig && (
            <div className="bg-indigo-50/40 p-4 border-b border-indigo-100 shrink-0 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                  <SlidersHorizontal size={14} className="text-indigo-600" />
                  <span>انتخاب ستون‌های جدول در گزارش PDF:</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllCols}
                    className="text-[11px] font-bold text-indigo-700 hover:underline"
                  >
                    انتخاب همه ستون‌ها
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={handleResetDefaultCols}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1"
                  >
                    <RotateCcw size={11} />
                    <span>پیش‌فرض</span>
                  </button>
                </div>
              </div>

              {/* Column checkboxes */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs font-bold text-slate-700">
                <label className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300">
                  <input type="checkbox" checked={pdfCols.rank} onChange={() => setPdfCols(p => ({ ...p, rank: !p.rank }))} className="rounded text-indigo-600" />
                  <span>ردیف</span>
                </label>
                <label className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300">
                  <input type="checkbox" checked={pdfCols.name} onChange={() => setPdfCols(p => ({ ...p, name: !p.name }))} className="rounded text-indigo-600" />
                  <span>نام و نام خانوادگی</span>
                </label>
                <label className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300">
                  <input type="checkbox" checked={pdfCols.grade} onChange={() => setPdfCols(p => ({ ...p, grade: !p.grade }))} className="rounded text-indigo-600" />
                  <span>پایه تحصیلی</span>
                </label>
                <label className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300">
                  <input type="checkbox" checked={pdfCols.sumStudy} onChange={() => setPdfCols(p => ({ ...p, sumStudy: !p.sumStudy }))} className="rounded text-indigo-600" />
                  <span className="text-indigo-700">مجموع مطالعه</span>
                </label>
                <label className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300">
                  <input type="checkbox" checked={pdfCols.sumDisc} onChange={() => setPdfCols(p => ({ ...p, sumDisc: !p.sumDisc }))} className="rounded text-indigo-600" />
                  <span className="text-emerald-700">مجموع مباحثه</span>
                </label>
                <label className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300">
                  <input type="checkbox" checked={pdfCols.sumTotal} onChange={() => setPdfCols(p => ({ ...p, sumTotal: !p.sumTotal }))} className="rounded text-indigo-600" />
                  <span className="text-slate-900 font-black">مجموع کل</span>
                </label>
                <label className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300">
                  <input type="checkbox" checked={pdfCols.activeCount} onChange={() => setPdfCols(p => ({ ...p, activeCount: !p.activeCount }))} className="rounded text-indigo-600" />
                  <span>دوره‌های فعال</span>
                </label>
                <label className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300">
                  <input type="checkbox" checked={pdfCols.commitmentRate} onChange={() => setPdfCols(p => ({ ...p, commitmentRate: !p.commitmentRate }))} className="rounded text-indigo-600" />
                  <span className="text-blue-700">میزان تعهد به ثبت</span>
                </label>
                <label className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300">
                  <input type="checkbox" checked={pdfCols.avgTotal} onChange={() => setPdfCols(p => ({ ...p, avgTotal: !p.avgTotal }))} className="rounded text-indigo-600" />
                  <span className="text-indigo-600">میانگین کل دوره</span>
                </label>
                <label className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300">
                  <input type="checkbox" checked={pdfCols.gradeAvg} onChange={() => setPdfCols(p => ({ ...p, gradeAvg: !p.gradeAvg }))} className="rounded text-indigo-600" />
                  <span className="text-purple-700">میانگین کل پایه</span>
                </label>
                <label className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300">
                  <input type="checkbox" checked={pdfCols.belowAverageCount} onChange={() => setPdfCols(p => ({ ...p, belowAverageCount: !p.belowAverageCount }))} className="rounded text-indigo-600" />
                  <span className="text-amber-700">دفعات زیر میانگین</span>
                </label>
                <label className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 cursor-pointer hover:border-indigo-300">
                  <input type="checkbox" checked={pdfCols.statusAvg} onChange={() => setPdfCols(p => ({ ...p, statusAvg: !p.statusAvg }))} className="rounded text-indigo-600" />
                  <span>وضعیت تراز</span>
                </label>
              </div>

              {/* Section toggles */}
              <div className="pt-2 border-t border-indigo-100 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
                <span className="text-indigo-900 font-black">بخش‌های تحلیلی و تکمیلی گزارش:</span>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-600">
                  <input type="checkbox" checked={sections.topPerformers} onChange={() => setSections(p => ({ ...p, topPerformers: !p.topPerformers }))} className="rounded text-indigo-600" />
                  <span>آمار برترین‌ها و بهترین‌ها</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-600">
                  <input type="checkbox" checked={sections.lowPerformers} onChange={() => setSections(p => ({ ...p, lowPerformers: !p.lowPerformers }))} className="rounded text-indigo-600" />
                  <span>موارد نیازمند پیگیری و ضعیف‌ترین‌ها</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-600">
                  <input type="checkbox" checked={sections.overallStats} onChange={() => setSections(p => ({ ...p, overallStats: !p.overallStats }))} className="rounded text-indigo-600" />
                  <span>آمارهای کلان و تراز مدرسه</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-600">
                  <input type="checkbox" checked={sections.gradeBreakdown} onChange={() => setSections(p => ({ ...p, gradeBreakdown: !p.gradeBreakdown }))} className="rounded text-indigo-600" />
                  <span>تراز میانگین پایه‌های تحصیلی</span>
                </label>
              </div>
            </div>
          )}

          {/* Printable Report Canvas */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100">
            <div 
              ref={reportRef} 
              className="bg-white p-6 rounded-2xl shadow-sm text-slate-800 space-y-5 mx-auto max-w-5xl text-[11px]" 
              style={{ fontFamily: 'Tahoma, Arial, sans-serif' }}
            >
              {/* Report Header */}
              <div className="border-b-2 border-indigo-600 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-slate-900">
                    گزارش جامع، تحلیلی و آماری عملکرد مطالعه و مباحثه طلاب (تمامی دوره‌ها)
                  </h1>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    سامانه جامع ارزیابی آموزشی، رتبه‌بندی و آمار تفکیکی مطالعاتی حوزه علمیه
                    {mentorName ? ` • استاد راهنما: ${mentorName}` : ''}
                  </p>
                </div>
                <div className="text-left text-[10px] text-slate-500 space-y-0.5">
                  <div><b>تاریخ صدور:</b> {new Date().toLocaleDateString('fa-IR')}</div>
                  <div><b>تعداد دوره‌ها:</b> <b className="text-indigo-900">{(periods || []).length} دوره مطالعاتی</b></div>
                  <div><b>تعداد کل طلاب:</b> <b className="text-indigo-900">{(students || []).length} نفر</b></div>
                </div>
              </div>

              {/* KPI Summary Cards */}
              {sections.kpiCards && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center">
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[9px] text-slate-500 font-bold block">مجموع کل مطالعه</span>
                    <span className="text-[11px] font-black text-indigo-700 mt-0.5 block">
                      {grandTotalStudy.toLocaleString('fa-IR')} د ({formatHoursMinutes(grandTotalStudy)})
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[9px] text-slate-500 font-bold block">مجموع کل مباحثه</span>
                    <span className="text-[11px] font-black text-emerald-700 mt-0.5 block">
                      {grandTotalDisc.toLocaleString('fa-IR')} د ({formatHoursMinutes(grandTotalDisc)})
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[9px] text-slate-500 font-bold block">مجموع کل دقایق (کل مدرسه)</span>
                    <span className="text-[11px] font-black text-slate-900 mt-0.5 block">
                      {grandTotalAll.toLocaleString('fa-IR')} د ({formatHoursMinutes(grandTotalAll)})
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-200">
                    <span className="text-[9px] text-slate-500 font-bold block">میانگین کل دوره</span>
                    <span className="text-[11px] font-black text-indigo-600 mt-0.5 block">
                      {globalAvgMinutes.toLocaleString('fa-IR')} د / دوره ({formatHoursMinutes(globalAvgMinutes)})
                    </span>
                  </div>
                </div>
              )}

              {/* Data Table */}
              {sections.dataTable && (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-[10px] border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-200 text-slate-800 font-bold text-[9px]">
                        {pdfCols.rank && <th className="border border-slate-300 px-2 py-1.5 text-center w-7">#</th>}
                        {pdfCols.name && <th className="border border-slate-300 px-2 py-1.5">نام و نام خانوادگی</th>}
                        {pdfCols.grade && <th className="border border-slate-300 px-1.5 py-1.5 text-center">پایه</th>}
                        {pdfCols.sumStudy && <th className="border border-slate-300 px-1.5 py-1.5 text-center bg-indigo-100/60 text-indigo-900">مجموع مطالعه</th>}
                        {pdfCols.sumDisc && <th className="border border-slate-300 px-1.5 py-1.5 text-center bg-emerald-100/60 text-emerald-900">مجموع مباحثه</th>}
                        {pdfCols.sumTotal && <th className="border border-slate-300 px-1.5 py-1.5 text-center bg-slate-300/80 font-black">مجموع کل</th>}
                        {pdfCols.activeCount && <th className="border border-slate-300 px-1.5 py-1.5 text-center">دوره‌های فعال</th>}
                        {pdfCols.commitmentRate && <th className="border border-slate-300 px-1.5 py-1.5 text-center">تعهد به ثبت</th>}
                        {pdfCols.avgTotal && <th className="border border-slate-300 px-1.5 py-1.5 text-center">میانگین/دوره</th>}
                        {pdfCols.gradeAvg && <th className="border border-slate-300 px-1.5 py-1.5 text-center bg-purple-100/60 text-purple-900">میانگین پایه</th>}
                        {pdfCols.belowAverageCount && <th className="border border-slate-300 px-1.5 py-1.5 text-center bg-amber-100/60 text-amber-900">دفعات زیر میانگین</th>}
                        {pdfCols.statusAvg && <th className="border border-slate-300 px-1.5 py-1.5 text-center">وضعیت تراز</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={item?.student?.id || index} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'}>
                          {pdfCols.rank && (
                            <td className="border border-slate-300 px-1.5 py-1 text-center font-bold text-slate-500">
                              {index + 1}
                            </td>
                          )}
                          {pdfCols.name && (
                            <td className="border border-slate-300 px-2 py-1 font-bold text-slate-800">
                              {item?.student?.name || '---'}
                            </td>
                          )}
                          {pdfCols.grade && (
                            <td className="border border-slate-300 px-1.5 py-1 text-center text-slate-600">
                              {item?.student?.grade || '---'}
                            </td>
                          )}
                          {pdfCols.sumStudy && (
                            <td className="border border-slate-300 px-1.5 py-1 text-center font-bold text-indigo-700 bg-indigo-50/30">
                              {item?.sumStudy > 0 ? `${item.sumStudy.toLocaleString('fa-IR')} د` : '۰'}
                            </td>
                          )}
                          {pdfCols.sumDisc && (
                            <td className="border border-slate-300 px-1.5 py-1 text-center font-bold text-emerald-700 bg-emerald-50/30">
                              {item?.sumDisc > 0 ? `${item.sumDisc.toLocaleString('fa-IR')} د` : '۰'}
                            </td>
                          )}
                          {pdfCols.sumTotal && (
                            <td className="border border-slate-300 px-1.5 py-1 text-center font-black text-slate-900 bg-slate-100/50">
                              {item?.sumTotal > 0 ? `${item.sumTotal.toLocaleString('fa-IR')} د` : '۰'}
                            </td>
                          )}
                          {pdfCols.activeCount && (
                            <td className="border border-slate-300 px-1.5 py-1 text-center text-slate-600 font-bold">
                              {item?.activeCount || 0} از {item?.totalPeriods || (periods || []).length}
                            </td>
                          )}
                          {pdfCols.commitmentRate && (
                            <td className="border border-slate-300 px-1.5 py-1 text-center font-bold text-blue-700">
                              {item?.commitmentRate || 0}٪
                            </td>
                          )}
                          {pdfCols.avgTotal && (
                            <td className="border border-slate-300 px-1.5 py-1 text-center font-black text-indigo-600">
                              {item?.avgTotal > 0 ? `${item.avgTotal.toLocaleString('fa-IR')} د` : '۰'}
                            </td>
                          )}
                          {pdfCols.gradeAvg && (
                            <td className="border border-slate-300 px-1.5 py-1 text-center font-bold text-purple-700 bg-purple-50/30">
                              {item?.gradeAvg > 0 ? `${item.gradeAvg.toLocaleString('fa-IR')} د` : '۰'}
                            </td>
                          )}
                          {pdfCols.belowAverageCount && (
                            <td className="border border-slate-300 px-1.5 py-1 text-center font-bold text-amber-700 bg-amber-50/30">
                              {item?.belowAverageCount || 0} دوره
                            </td>
                          )}
                          {pdfCols.statusAvg && (
                            <td className="border border-slate-300 px-1.5 py-1 text-center text-[9px] font-bold">
                              {item?.statusAvg === 'بالای میانگین' ? (
                                <span className="text-emerald-700 font-black">بالای میانگین</span>
                              ) : item?.statusAvg === 'بدون ثبت' ? (
                                <span className="text-slate-400">بدون ثبت</span>
                              ) : (
                                <span className="text-amber-700 font-black">زیر میانگین</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}

                      {/* Table Footer */}
                      <tr className="bg-slate-200 font-black text-slate-900">
                        <td colSpan={(pdfCols.rank ? 1 : 0) + (pdfCols.name ? 1 : 0) + (pdfCols.grade ? 1 : 0)} className="border border-slate-300 px-2 py-1.5 text-right">
                          جمع کل ({(students || []).length} طلبه):
                        </td>
                        {pdfCols.sumStudy && (
                          <td className="border border-slate-300 px-1.5 py-1.5 text-center text-indigo-900">
                            {grandTotalStudy.toLocaleString('fa-IR')} د
                          </td>
                        )}
                        {pdfCols.sumDisc && (
                          <td className="border border-slate-300 px-1.5 py-1.5 text-center text-emerald-900">
                            {grandTotalDisc.toLocaleString('fa-IR')} د
                          </td>
                        )}
                        {pdfCols.sumTotal && (
                          <td className="border border-slate-300 px-1.5 py-1.5 text-center text-slate-900 font-black">
                            {grandTotalAll.toLocaleString('fa-IR')} د
                          </td>
                        )}
                        {pdfCols.activeCount && <td className="border border-slate-300 px-1 py-1.5 text-center">-</td>}
                        {pdfCols.commitmentRate && <td className="border border-slate-300 px-1 py-1.5 text-center">{analytics.overallSchoolCommitment}٪</td>}
                        {pdfCols.avgTotal && (
                          <td className="border border-slate-300 px-1.5 py-1.5 text-center text-indigo-900 font-black">
                            {globalAvgMinutes.toLocaleString('fa-IR')} د
                          </td>
                        )}
                        {pdfCols.gradeAvg && <td className="border border-slate-300 px-1 py-1.5 text-center">-</td>}
                        {pdfCols.belowAverageCount && <td className="border border-slate-300 px-1 py-1.5 text-center">-</td>}
                        {pdfCols.statusAvg && <td className="border border-slate-300 px-1 py-1.5 text-center">-</td>}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* ========================================================================= */}
              {/* ANALYTICAL REPORT SUMMARY: BEST, WEAKEST, OVERALL STATS & GRADE BREAKDOWN */}
              {/* ========================================================================= */}

              {/* SECTION: BEST PERFORMERS (آمارهای برترین‌ها و افتخارآفرینان) */}
              {sections.topPerformers && (
                <div className="border border-emerald-300 bg-emerald-50/40 rounded-xl p-3 space-y-2.5" style={{ pageBreakInside: 'avoid' }}>
                  <div className="flex items-center gap-2 border-b border-emerald-200 pb-1.5 text-emerald-900 font-black text-[11px]">
                    <Trophy size={14} className="text-amber-500" />
                    <span>آمار بهترین‌ها و برترین‌های تمامی دوره‌های مطالعاتی</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                    {/* Top 1 Total */}
                    <div className="bg-white p-2 rounded-lg border border-emerald-200 shadow-xs">
                      <div className="text-slate-500 font-bold">بیشترین مجموع کل (رتبه ۱)</div>
                      <div className="font-black text-slate-900 text-xs mt-0.5">
                        {analytics.topTotal?.student?.name || '---'}
                      </div>
                      <div className="text-emerald-700 font-bold text-[9px] mt-0.5">
                        {analytics.topTotal ? `${(analytics.topTotal.sumTotal || 0).toLocaleString('fa-IR')} دقیقه (${formatHoursMinutes(analytics.topTotal.sumTotal)})` : '---'}
                      </div>
                      {analytics.topTotal?.student?.grade && (
                        <div className="text-slate-400 text-[8px]">پایه {analytics.topTotal.student.grade}</div>
                      )}
                    </div>

                    {/* Top Individual Study */}
                    <div className="bg-white p-2 rounded-lg border border-indigo-200 shadow-xs">
                      <div className="text-slate-500 font-bold">بیشترین مطالعه فردی</div>
                      <div className="font-black text-indigo-900 text-xs mt-0.5">
                        {analytics.topStudy?.student?.name || '---'}
                      </div>
                      <div className="text-indigo-700 font-bold text-[9px] mt-0.5">
                        {analytics.topStudy ? `${(analytics.topStudy.sumStudy || 0).toLocaleString('fa-IR')} دقیقه (${formatHoursMinutes(analytics.topStudy.sumStudy)})` : '---'}
                      </div>
                      {analytics.topStudy?.student?.grade && (
                        <div className="text-slate-400 text-[8px]">پایه {analytics.topStudy.student.grade}</div>
                      )}
                    </div>

                    {/* Top Discussion */}
                    <div className="bg-white p-2 rounded-lg border border-emerald-200 shadow-xs">
                      <div className="text-slate-500 font-bold">بیشترین مباحثه</div>
                      <div className="font-black text-emerald-900 text-xs mt-0.5">
                        {analytics.topDisc?.student?.name || '---'}
                      </div>
                      <div className="text-emerald-700 font-bold text-[9px] mt-0.5">
                        {analytics.topDisc ? `${(analytics.topDisc.sumDisc || 0).toLocaleString('fa-IR')} دقیقه (${formatHoursMinutes(analytics.topDisc.sumDisc)})` : '---'}
                      </div>
                      {analytics.topDisc?.student?.grade && (
                        <div className="text-slate-400 text-[8px]">پایه {analytics.topDisc.student.grade}</div>
                      )}
                    </div>

                    {/* Most Consistent / Zero Below Average */}
                    <div className="bg-white p-2 rounded-lg border border-amber-200 shadow-xs">
                      <div className="text-slate-500 font-bold">باثبات‌ترین طلاب (همیشه بالای میانگین)</div>
                      <div className="font-black text-amber-900 text-xs mt-0.5">
                        {analytics.zeroBelowAvgStudents.length > 0 ? (
                          <span>{analytics.zeroBelowAvgStudents.length} طلبه برتر</span>
                        ) : '---'}
                      </div>
                      <div className="text-amber-800 font-bold text-[9px] mt-0.5 line-clamp-1">
                        {analytics.zeroBelowAvgStudents.length > 0 
                          ? analytics.zeroBelowAvgStudents.map(s => s?.student?.name || 'طلبه').slice(0, 3).join('، ')
                          : 'موردی یافت نشد'}
                      </div>
                      <div className="text-slate-400 text-[8px]">صفر مرتبه زیر میانگین دوره</div>
                    </div>
                  </div>

                  {/* Top 3 Podium List */}
                  {analytics.top3Total.length > 0 && (
                    <div className="bg-white/80 p-2 rounded-lg border border-emerald-200 flex flex-wrap items-center justify-between gap-2 text-[9px]">
                      <span className="font-black text-emerald-950">۳ طلبه برتر در مجموع کل دوره‌ها:</span>
                      <div className="flex flex-wrap items-center gap-3">
                        {analytics.top3Total.map((top, i) => (
                          <div key={top?.student?.id || i} className="flex items-center gap-1">
                            <span className="w-4 h-4 rounded-full bg-amber-400 text-amber-950 font-black flex items-center justify-center text-[8px]">
                              {i + 1}
                            </span>
                            <span className="font-bold text-slate-800">{top?.student?.name || '---'}</span>
                            <span className="text-emerald-700 font-black">({formatHoursMinutes(top?.sumTotal || 0)})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION: LOW PERFORMERS & NEED ATTENTION (آمار ضعیف‌ترین‌ها و نیازمند پیگیری) */}
              {sections.lowPerformers && (
                <div className="border border-rose-300 bg-rose-50/40 rounded-xl p-3 space-y-2.5" style={{ pageBreakInside: 'avoid' }}>
                  <div className="flex items-center gap-2 border-b border-rose-200 pb-1.5 text-rose-900 font-black text-[11px]">
                    <AlertTriangle size={14} className="text-rose-600" />
                    <span>آمار ضعیف‌ترین‌ها و موارد نیازمند مشاوره و پیگیری آموزشی</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                    {/* Lowest Total */}
                    <div className="bg-white p-2 rounded-lg border border-rose-200 shadow-xs">
                      <div className="text-slate-500 font-bold">کمترین مجموع کل (فعال)</div>
                      <div className="font-black text-rose-950 text-xs mt-0.5">
                        {analytics.lowestTotal?.student?.name || '---'}
                      </div>
                      <div className="text-rose-700 font-bold text-[9px] mt-0.5">
                        {analytics.lowestTotal ? `${(analytics.lowestTotal.sumTotal || 0).toLocaleString('fa-IR')} دقیقه (${formatHoursMinutes(analytics.lowestTotal.sumTotal)})` : '---'}
                      </div>
                      {analytics.lowestTotal?.student?.grade && (
                        <div className="text-slate-400 text-[8px]">پایه {analytics.lowestTotal.student.grade}</div>
                      )}
                    </div>

                    {/* Lowest Commitment */}
                    <div className="bg-white p-2 rounded-lg border border-rose-200 shadow-xs">
                      <div className="text-slate-500 font-bold">کمترین میزان تعهد به ثبت</div>
                      <div className="font-black text-rose-950 text-xs mt-0.5">
                        {analytics.lowestCommitment?.student?.name || '---'}
                      </div>
                      <div className="text-rose-700 font-bold text-[9px] mt-0.5">
                        {analytics.lowestCommitment ? `${analytics.lowestCommitment.commitmentRate || 0}٪ (${analytics.lowestCommitment.activeCount || 0} از ${(periods || []).length} دوره)` : '---'}
                      </div>
                      {analytics.lowestCommitment?.student?.grade && (
                        <div className="text-slate-400 text-[8px]">پایه {analytics.lowestCommitment.student.grade}</div>
                      )}
                    </div>

                    {/* Most times below average */}
                    <div className="bg-white p-2 rounded-lg border border-amber-200 shadow-xs">
                      <div className="text-slate-500 font-bold">بیشترین افت نسبت به میانگین</div>
                      <div className="font-black text-amber-950 text-xs mt-0.5">
                        {analytics.mostBelowAvg?.student?.name || '---'}
                      </div>
                      <div className="text-amber-800 font-bold text-[9px] mt-0.5">
                        {analytics.mostBelowAvg ? `${analytics.mostBelowAvg.belowAverageCount || 0} دوره زیر میانگین` : '---'}
                      </div>
                      {analytics.mostBelowAvg?.student?.grade && (
                        <div className="text-slate-400 text-[8px]">پایه {analytics.mostBelowAvg.student.grade}</div>
                      )}
                    </div>

                    {/* Zero logs count */}
                    <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-xs">
                      <div className="text-slate-500 font-bold">طلاب بدون هیچ ثبت در دوره‌ها</div>
                      <div className="font-black text-slate-800 text-xs mt-0.5">
                        {(analytics.zeroLogsCount || 0).toLocaleString('fa-IR')} طلبه
                      </div>
                      <div className="text-slate-500 font-bold text-[9px] mt-0.5">
                        {(students || []).length > 0 ? `${Math.round(((analytics.zeroLogsCount || 0) / (students || []).length) * 100)}٪ از کل طلاب` : 'فاقد داده'}
                      </div>
                      <div className="text-slate-400 text-[8px]">نیازمند پیگیری ثبت نام و لاگ</div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: OVERALL STATS & COMPREHENSIVE BENCHMARKS (آمارهای کلان و ترازهای کلی) */}
              {sections.overallStats && (
                <div className="border border-indigo-200 bg-indigo-50/30 rounded-xl p-3 space-y-2.5" style={{ pageBreakInside: 'avoid' }}>
                  <div className="flex items-center gap-2 border-b border-indigo-200 pb-1.5 text-indigo-900 font-black text-[11px]">
                    <BarChart3 size={14} className="text-indigo-600" />
                    <span>آمارهای کلی و شاخص‌های کلان مدرسه علمیه در تمامی دوره‌ها</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center text-[10px]">
                    <div className="bg-white p-2 rounded-lg border border-indigo-100">
                      <span className="text-slate-500 block text-[8px] font-bold">تعداد کل طلاب</span>
                      <span className="font-black text-slate-900 text-xs mt-0.5 block">{(students || []).length} نفر</span>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-indigo-100">
                      <span className="text-slate-500 block text-[8px] font-bold">تعداد دوره‌های ارزیابی‌شده</span>
                      <span className="font-black text-indigo-700 text-xs mt-0.5 block">{(periods || []).length} دوره</span>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-indigo-100">
                      <span className="text-slate-500 block text-[8px] font-bold">درصد تعهد کل مدرسه</span>
                      <span className="font-black text-blue-700 text-xs mt-0.5 block">{analytics.overallSchoolCommitment || 0}٪</span>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-indigo-100">
                      <span className="text-slate-500 block text-[8px] font-bold">نسبت مطالعه به مباحثه</span>
                      <span className="font-black text-slate-800 text-[10px] mt-0.5 block">
                        {analytics.studyRatio || 0}٪ به {analytics.discRatio || 0}٪
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-indigo-100">
                      <span className="text-slate-500 block text-[8px] font-bold">طلاب بالای میانگین</span>
                      <span className="font-black text-emerald-700 text-xs mt-0.5 block">{(analytics.aboveAvgCount || 0)} نفر</span>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-indigo-100">
                      <span className="text-slate-500 block text-[8px] font-bold">طلاب زیر میانگین</span>
                      <span className="font-black text-amber-700 text-xs mt-0.5 block">{(analytics.belowAvgCount || 0)} نفر</span>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: GRADE BREAKDOWN (میانگین به تفکیک پایه‌های تحصیلی) */}
              {sections.gradeBreakdown && gradeAverages && Object.keys(gradeAverages).length > 0 && (
                <div className="border border-purple-200 bg-purple-50/30 rounded-xl p-3 space-y-2" style={{ pageBreakInside: 'avoid' }}>
                  <div className="flex items-center gap-2 border-b border-purple-200 pb-1.5 text-purple-950 font-black text-[11px]">
                    <GraduationCap size={14} className="text-purple-600" />
                    <span>میانگین کل عملکرد به تفکیک پایه‌های تحصیلی</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-[10px]">
                    {Object.entries(gradeAverages).map(([grade, avgValue]) => {
                      const avg = Number(avgValue) || 0;
                      const gradeStudentsCount = (students || []).filter(s => (s?.grade || 'نامشخص') === grade).length;
                      return (
                        <div key={grade} className="bg-white p-2 rounded-lg border border-purple-200 text-center">
                          <span className="text-purple-900 font-black block text-[10px]">
                            {grade.startsWith('پایه') ? grade : `پایه ${grade}`}
                          </span>
                          <span className="text-purple-700 font-black text-xs mt-0.5 block">
                            {avg.toLocaleString('fa-IR')} د / دوره
                          </span>
                          <span className="text-slate-400 text-[8px] block mt-0.5">
                            ({formatHoursMinutes(avg)} • {gradeStudentsCount} طلبه)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Signatures Footer */}
              <div className="pt-6 flex justify-between items-end text-[11px] font-bold text-slate-600" style={{ pageBreakInside: 'avoid' }}>
                <div className="text-center space-y-6">
                  <p>امضای مسئول آموزش و آمار مطالعاتی</p>
                  <p className="text-[9px] text-slate-400">........................................</p>
                </div>
                <div className="text-center space-y-6">
                  <p>امضای مدیریت حوزه علمیه</p>
                  <p className="text-[9px] text-slate-400">........................................</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
