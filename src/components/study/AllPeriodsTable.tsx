import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  MessageSquare, 
  Calculator, 
  Search, 
  TrendingUp, 
  Sparkles, 
  Layers, 
  SlidersHorizontal,
  ChevronDown,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Student, StudyPeriod, PeriodicStudyLog } from '../../types';
import { getLogMetrics, calculatePeriodAverages } from './studyUtils';
import { exportAllPeriodsToExcel, prepareAggregatedData } from './allPeriodsExport';
import AllPeriodsPDFModal from './AllPeriodsPDFModal';
import { useMentor } from '../../context/MentorContext';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface AllPeriodsTableProps {
  students: Student[];
  periods: StudyPeriod[];
  allLogs: PeriodicStudyLog[];
  selectedStudentId: string | null;
  onSelectStudent: (studentId: string) => void;
}

export default function AllPeriodsTable({
  students,
  periods,
  allLogs,
  selectedStudentId,
  onSelectStudent
}: AllPeriodsTableProps) {
  const { currentMentor } = useMentor();
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Column visibility state
  const [cols, setCols] = useState({
    grade: true,
    sumStudy: true,
    sumDisc: true,
    sumTotal: true,
    activeCount: true,
    commitmentRate: true,
    gradeCommitmentRate: true,
    avgTotal: true,
    gradeAvg: true,
    belowAverageCount: true,
    avgStudy: false,
    avgDisc: false,
    statusAvg: true
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const uniqueGrades = Array.from(new Set(students.map(s => s.grade).filter(Boolean))) as string[];

  const filteredStudents = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.nationalId && s.nationalId.includes(searchTerm));
    const matchGrade = gradeFilter === 'ALL' || s.grade === gradeFilter;
    return matchSearch && matchGrade;
  });

  const { items, globalAvgMinutes, grandTotalStudy, grandTotalDisc, grandTotalAll } = prepareAggregatedData(
    filteredStudents,
    periods,
    allLogs
  );

  const handleExcelExport = () => {
    exportAllPeriodsToExcel(filteredStudents, periods, allLogs, currentMentor?.name);
  };

  return (
    <div className="space-y-4">
      {/* Search, Filter & Export Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-700">
            جدول تجمیعی تمام دوره‌ها ({periods.length} دوره مطالعاتی)
          </span>
          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
            {filteredStudents.length} طلبه
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Excel Export Button */}
          <button
            type="button"
            onClick={handleExcelExport}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            title="دانلود گزارش اکسل جدول تجمیعی"
          >
            <FileSpreadsheet size={15} />
            <span>خروجی اکسل</span>
          </button>

          {/* PDF Report Button */}
          <button
            type="button"
            onClick={() => setIsPdfModalOpen(true)}
            className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            title="انتخاب ستون‌ها و چاپ گزارش PDF جدول تجمیعی"
          >
            <FileText size={15} />
            <span>گزارش PDF / چاپ</span>
          </button>

          {uniqueGrades.length > 0 && (
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            >
              <option value="ALL">همه پایه‌ها</option>
              {uniqueGrades.map(g => (
                <option key={g} value={g}>پایه {g}</option>
              ))}
            </select>
          )}

          <div className="relative min-w-[180px]">
            <input
              type="text"
              placeholder="جستجوی طلبه..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
            />
            <Search size={14} className="absolute right-2.5 top-2.5 text-slate-400" />
          </div>

          {/* Column Toggle Filter */}
          <div ref={filterRef} className="relative">
            <button
              type="button"
              onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
              className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-all shadow-xs"
            >
              <SlidersHorizontal size={14} className="text-indigo-600" />
              <span>مدیریت ستون‌ها</span>
              <ChevronDown size={14} className={cn("text-slate-400 transition-transform", isFilterDropdownOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isFilterDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 mt-2 w-80 p-4 bg-white rounded-2xl border border-slate-200 shadow-xl space-y-3 z-40"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-xs font-black text-slate-800">انتخاب ستون‌های جدول:</span>
                    <button
                      type="button"
                      onClick={() => setCols({
                        grade: true,
                        sumStudy: true,
                        sumDisc: true,
                        sumTotal: true,
                        activeCount: true,
                        commitmentRate: true,
                        avgTotal: true,
                        gradeAvg: true,
                        belowAverageCount: true,
                        avgStudy: true,
                        avgDisc: true,
                        statusAvg: true
                      })}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      نمایش همه
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700 max-h-72 overflow-y-auto pr-1">
                    <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600">
                      <input type="checkbox" checked={cols.grade} onChange={() => setCols(p => ({ ...p, grade: !p.grade }))} className="rounded text-indigo-600" />
                      <span>پایه تحصیلی</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600">
                      <input type="checkbox" checked={cols.sumStudy} onChange={() => setCols(p => ({ ...p, sumStudy: !p.sumStudy }))} className="rounded text-indigo-600" />
                      <span>مجموع مطالعه</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600">
                      <input type="checkbox" checked={cols.sumDisc} onChange={() => setCols(p => ({ ...p, sumDisc: !p.sumDisc }))} className="rounded text-indigo-600" />
                      <span>مجموع مباحثه</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600">
                      <input type="checkbox" checked={cols.sumTotal} onChange={() => setCols(p => ({ ...p, sumTotal: !p.sumTotal }))} className="rounded text-indigo-600" />
                      <span>مجموع کل</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600">
                      <input type="checkbox" checked={cols.activeCount} onChange={() => setCols(p => ({ ...p, activeCount: !p.activeCount }))} className="rounded text-indigo-600" />
                      <span>دوره‌های فعال</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600">
                      <input type="checkbox" checked={cols.commitmentRate} onChange={() => setCols(p => ({ ...p, commitmentRate: !p.commitmentRate }))} className="rounded text-indigo-600" />
                      <span className="text-blue-700">میزان تعهد به ثبت</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600">
                      <input type="checkbox" checked={cols.gradeCommitmentRate} onChange={() => setCols(p => ({ ...p, gradeCommitmentRate: !p.gradeCommitmentRate }))} className="rounded text-indigo-600" />
                      <span className="text-teal-700">میانگین تعهد به ثبت پایه</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600">
                      <input type="checkbox" checked={cols.avgTotal} onChange={() => setCols(p => ({ ...p, avgTotal: !p.avgTotal }))} className="rounded text-indigo-600" />
                      <span>میانگین کل دوره</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600">
                      <input type="checkbox" checked={cols.gradeAvg} onChange={() => setCols(p => ({ ...p, gradeAvg: !p.gradeAvg }))} className="rounded text-indigo-600" />
                      <span className="text-purple-700">میانگین کل پایه</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600">
                      <input type="checkbox" checked={cols.belowAverageCount} onChange={() => setCols(p => ({ ...p, belowAverageCount: !p.belowAverageCount }))} className="rounded text-indigo-600" />
                      <span className="text-amber-700">دفعات زیر میانگین</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600">
                      <input type="checkbox" checked={cols.avgStudy} onChange={() => setCols(p => ({ ...p, avgStudy: !p.avgStudy }))} className="rounded text-indigo-600" />
                      <span>میانگین مطالعه</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600">
                      <input type="checkbox" checked={cols.avgDisc} onChange={() => setCols(p => ({ ...p, avgDisc: !p.avgDisc }))} className="rounded text-indigo-600" />
                      <span>میانگین مباحثه</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 col-span-2 bg-indigo-50/50 p-1.5 rounded-lg">
                      <input type="checkbox" checked={cols.statusAvg} onChange={() => setCols(p => ({ ...p, statusAvg: !p.statusAvg }))} className="rounded text-indigo-600" />
                      <span>وضعیت میانگین کل</span>
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
              <th className="px-4 py-3.5">ردیف</th>
              <th className="px-4 py-3.5">نام و نام خانوادگی</th>
              {cols.grade && <th className="px-3 py-3.5 text-center">پایه</th>}
              {cols.sumStudy && <th className="px-3 py-3.5 text-center bg-indigo-50/60 text-indigo-700">مجموع مطالعه (د)</th>}
              {cols.sumDisc && <th className="px-3 py-3.5 text-center bg-emerald-50/60 text-emerald-700">مجموع مباحثه (د)</th>}
              {cols.sumTotal && <th className="px-3 py-3.5 text-center bg-slate-100 text-slate-900 font-extrabold">مجموع کل (دقیقه)</th>}
              {cols.activeCount && <th className="px-3 py-3.5 text-center">دوره‌های فعال</th>}
              {cols.commitmentRate && <th className="px-3 py-3.5 text-center bg-blue-50/50 text-blue-800">میزان تعهد به ثبت</th>}
              {cols.gradeCommitmentRate && <th className="px-3 py-3.5 text-center bg-teal-50/60 text-teal-800">میانگین تعهد به ثبت پایه</th>}
              {cols.avgTotal && <th className="px-3 py-3.5 text-center">میانگین کل دوره</th>}
              {cols.gradeAvg && <th className="px-3 py-3.5 text-center bg-purple-50/60 text-purple-800">میانگین کل پایه</th>}
              {cols.belowAverageCount && <th className="px-3 py-3.5 text-center bg-amber-50/60 text-amber-800">تعداد دفعات زیر میانگین</th>}
              {cols.avgStudy && <th className="px-3 py-3.5 text-center">میانگین مطالعه</th>}
              {cols.avgDisc && <th className="px-3 py-3.5 text-center">میانگین مباحثه</th>}
              {cols.statusAvg && <th className="px-3 py-3.5 text-center bg-indigo-50/40 text-indigo-800">وضعیت میانگین</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {items.map((item, idx) => {
              const isSelected = selectedStudentId === item.student.id;

              return (
                <tr
                  key={item.student.id}
                  onClick={() => onSelectStudent(item.student.id)}
                  className={cn(
                    "cursor-pointer transition-colors",
                    isSelected ? "bg-indigo-50/70 font-semibold" : "hover:bg-slate-50/80"
                  )}
                >
                  <td className="px-4 py-3.5 text-slate-400 text-[11px] font-bold">{idx + 1}</td>
                  <td className="px-4 py-3.5 font-bold text-slate-800 flex items-center gap-2">
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                    <span>{item.student.name}</span>
                  </td>
                  {cols.grade && <td className="px-3 py-3.5 text-center text-slate-500">{item.student.grade || '---'}</td>}
                  
                  {/* Total Study */}
                  {cols.sumStudy && (
                    <td className="px-3 py-3.5 text-center font-bold text-indigo-700 bg-indigo-50/30">
                      {item.sumStudy > 0 ? `${item.sumStudy.toLocaleString('fa-IR')} د` : <span className="text-slate-300">۰</span>}
                    </td>
                  )}

                  {/* Total Discussion */}
                  {cols.sumDisc && (
                    <td className="px-3 py-3.5 text-center font-bold text-emerald-700 bg-emerald-50/30">
                      {item.sumDisc > 0 ? `${item.sumDisc.toLocaleString('fa-IR')} د` : <span className="text-slate-300">۰</span>}
                    </td>
                  )}

                  {/* Grand Total */}
                  {cols.sumTotal && (
                    <td className="px-3 py-3.5 text-center font-black text-slate-900 bg-slate-50">
                      {item.sumTotal > 0 ? `${item.sumTotal.toLocaleString('fa-IR')} د` : <span className="text-slate-300">۰</span>}
                    </td>
                  )}

                  {cols.activeCount && (
                    <td className="px-3 py-3.5 text-center text-slate-600 font-bold">
                      {item.activeCount} از {item.totalPeriods}
                    </td>
                  )}

                  {/* Commitment Rate */}
                  {cols.commitmentRate && (
                    <td className="px-3 py-3.5 text-center font-black text-blue-700 bg-blue-50/20">
                      <span className={cn(
                        "px-2 py-0.5 rounded-lg text-[11px]",
                        item.commitmentRate === 100 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        item.commitmentRate >= 50 ? "bg-blue-50 text-blue-700 border border-blue-100" :
                        "bg-slate-100 text-slate-500"
                      )}>
                        {item.commitmentRate}٪
                      </span>
                    </td>
                  )}

                  {/* Grade Commitment Rate */}
                  {cols.gradeCommitmentRate && (
                    <td className="px-3 py-3.5 text-center font-black text-teal-800 bg-teal-50/20">
                      <span className={cn(
                        "px-2 py-0.5 rounded-lg text-[11px]",
                        item.gradeCommitmentRate === 100 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        item.gradeCommitmentRate >= 50 ? "bg-teal-50 text-teal-700 border border-teal-100" :
                        "bg-slate-100 text-slate-500"
                      )}>
                        {item.gradeCommitmentRate}٪
                      </span>
                    </td>
                  )}

                  {cols.avgTotal && (
                    <td className="px-3 py-3.5 text-center font-black text-indigo-600">
                      {item.avgTotal > 0 ? `${item.avgTotal.toLocaleString('fa-IR')} د` : '۰'}
                    </td>
                  )}

                  {/* Grade Average */}
                  {cols.gradeAvg && (
                    <td className="px-3 py-3.5 text-center font-black text-purple-700 bg-purple-50/20">
                      {item.gradeAvg > 0 ? `${item.gradeAvg.toLocaleString('fa-IR')} د` : '۰'}
                    </td>
                  )}

                  {/* Below Average Count */}
                  {cols.belowAverageCount && (
                    <td className="px-3 py-3.5 text-center font-black text-amber-700 bg-amber-50/20">
                      {item.belowAverageCount > 0 ? (
                        <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded-lg border border-amber-200 text-[11px]">
                          {item.belowAverageCount} دوره
                        </span>
                      ) : (
                        <span className="text-emerald-600 text-[11px] font-bold">۰ (همیشه بالا)</span>
                      )}
                    </td>
                  )}

                  {cols.avgStudy && (
                    <td className="px-3 py-3.5 text-center text-indigo-700 font-bold">
                      {item.avgStudy > 0 ? `${item.avgStudy.toLocaleString('fa-IR')} د` : '۰'}
                    </td>
                  )}

                  {cols.avgDisc && (
                    <td className="px-3 py-3.5 text-center text-emerald-700 font-bold">
                      {item.avgDisc > 0 ? `${item.avgDisc.toLocaleString('fa-IR')} د` : '۰'}
                    </td>
                  )}

                  {cols.statusAvg && (
                    <td className="px-3 py-3.5 text-center">
                      {item.avgTotal >= globalAvgMinutes && globalAvgMinutes > 0 ? (
                        <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-100 whitespace-nowrap">
                          بالای میانگین
                        </span>
                      ) : item.avgTotal === 0 ? (
                        <span className="bg-slate-100 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                          بدون ثبت
                        </span>
                      ) : (
                        <span className="bg-amber-50 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-100 whitespace-nowrap">
                          زیر میانگین
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* PDF Export / Print Modal */}
      <AllPeriodsPDFModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        students={filteredStudents}
        periods={periods}
        allLogs={allLogs}
        mentorName={currentMentor?.name}
      />
    </div>
  );
}
