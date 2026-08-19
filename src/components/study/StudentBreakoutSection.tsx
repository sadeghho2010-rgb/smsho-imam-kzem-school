import React, { useState, useRef, useEffect } from 'react';
import { 
  Zap, 
  FileSpreadsheet, 
  SlidersHorizontal, 
  ChevronDown, 
  Eye, 
  EyeOff, 
  ArrowUpRight, 
  ArrowDownRight, 
  BookOpen, 
  MessageSquare, 
  Calculator,
  User,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  CalendarCheck,
  Percent
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  ReferenceLine 
} from 'recharts';
import { Student, StudyPeriod, PeriodicStudyLog } from '../../types';
import { getLogMetrics, calculatePeriodAverages } from './studyUtils';
import { cn } from '../../lib/utils';

export type ChartMetricMode = 'TOTAL' | 'SPLIT_ALL' | 'STUDY_ONLY' | 'DISCUSSION_ONLY' | 'ADJUSTED';

interface StudentBreakoutSectionProps {
  students: Student[];
  periods: StudyPeriod[];
  allLogs: PeriodicStudyLog[];
  selectedStudentId: string | null;
  onSelectStudent: (studentId: string | null) => void;
}

export default function StudentBreakoutSection({
  students,
  periods,
  allLogs,
  selectedStudentId,
  onSelectStudent
}: StudentBreakoutSectionProps) {
  const [chartMetric, setChartMetric] = useState<ChartMetricMode>('TOTAL');
  const [showAverageOnChart, setShowAverageOnChart] = useState(true);
  const [showMandatoryOnChart, setShowMandatoryOnChart] = useState(true);
  const [isBreakoutFilterOpen, setIsBreakoutFilterOpen] = useState(false);
  const breakoutFilterRef = useRef<HTMLDivElement>(null);

  const [breakoutCols, setBreakoutCols] = useState({
    timeRange: true,
    studyMinutes: true,
    discussionMinutes: true,
    totalMinutes: true,
    mandatoryMinutes: true,
    gradeAvgTotal: true,
    gradeAvgStudy: false,
    gradeAvgDiscussion: false,
    diffMandatory: true,
    diffAvgTotal: true,
    perfRatio: true,
    relRatio: true,
    statusMandatory: true,
    statusAvg: true,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (breakoutFilterRef.current && !breakoutFilterRef.current.contains(event.target as Node)) {
        setIsBreakoutFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  // Compute student overall summary across all periods
  const studentLogs = allLogs.filter(l => l.studentId === selectedStudentId);
  const activeStudentLogs = studentLogs.filter(l => (l.hours || 0) > 0 || (l.studyHours || 0) > 0 || (l.discussionHours || 0) > 0);

  let totalStudyMinutes = 0;
  let totalDiscussionMinutes = 0;
  let totalMinutes = 0;
  let totalDev = 0;
  let belowAvgCount = 0;

  activeStudentLogs.forEach(l => {
    const m = getLogMetrics(l);
    totalStudyMinutes += m.studyMinutes;
    totalDiscussionMinutes += m.discussionMinutes;
    totalMinutes += m.totalMinutes;

    const periodAvg = calculatePeriodAverages(l.periodId, allLogs);
    if (m.totalMinutes < periodAvg.totalAvgMinutes) {
      belowAvgCount++;
    }
    totalDev += (m.totalMinutes - periodAvg.totalAvgMinutes);
  });

  const studentAvgTotalMinutes = activeStudentLogs.length > 0 ? Math.round(totalMinutes / activeStudentLogs.length) : 0;
  const studentAvgStudyMinutes = activeStudentLogs.length > 0 ? Math.round(totalStudyMinutes / activeStudentLogs.length) : 0;
  const studentAvgDiscussionMinutes = activeStudentLogs.length > 0 ? Math.round(totalDiscussionMinutes / activeStudentLogs.length) : 0;
  const avgDevMinutes = activeStudentLogs.length > 0 ? Math.round(totalDev / activeStudentLogs.length) : 0;
  const belowAvgPercentage = activeStudentLogs.length > 0 ? (belowAvgCount / activeStudentLogs.length) * 100 : 0;

  // Prepare Chart Data
  const chartData = periods.map(p => {
    const log = allLogs.find(l => l.studentId === selectedStudentId && l.periodId === p.id);
    const metrics = getLogMetrics(log);

    // Peer grade averages
    const gradeStudents = students.filter(s => s.grade === selectedStudent?.grade);
    const gradeAvg = calculatePeriodAverages(p.id, allLogs, gradeStudents.map(s => s.id));
    const overallAvg = calculatePeriodAverages(p.id, allLogs);

    const mandatoryMin = Math.round((p.mandatoryHours || 0) * 60);
    const avgTotalMin = gradeAvg.activeCount > 0 ? gradeAvg.totalAvgMinutes : overallAvg.totalAvgMinutes;
    const avgStudyMin = gradeAvg.activeCount > 0 ? gradeAvg.studyAvgMinutes : overallAvg.studyAvgMinutes;
    const avgDiscMin = gradeAvg.activeCount > 0 ? gradeAvg.discussionAvgMinutes : overallAvg.discussionAvgMinutes;

    const perfRatio = mandatoryMin > 0 ? (metrics.totalMinutes / mandatoryMin) * 100 : 0;
    const relRatio = avgTotalMin > 0 ? (metrics.totalMinutes / avgTotalMin) * 100 : 0;
    const adjustedIndex = (perfRatio * 0.5) + (relRatio * 0.5);

    return {
      name: p.title,
      totalMinutes: metrics.totalMinutes,
      studyMinutes: metrics.studyMinutes,
      discussionMinutes: metrics.discussionMinutes,
      mandatoryMinutes: mandatoryMin,
      avgTotalMinutes: avgTotalMin,
      avgStudyMinutes: avgStudyMin,
      avgDiscussionMinutes: avgDiscMin,
      adjustedIndex: Math.round(adjustedIndex),
      perfRatio: Math.round(perfRatio),
      relRatio: Math.round(relRatio)
    };
  });

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm space-y-6">
      {/* Header with Student Picker */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-6">
        <div>
          <h4 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Zap className="text-indigo-600" size={22} />
            <span>نمودار تحلیلی روند و مقایسه طلبه با سایر طلاب و موظفی</span>
          </h4>
          <p className="text-xs text-slate-400 font-bold mt-1">
            امکان مقایسه تفکیکی مطالعه و مباحثه طلبه با میانگین سایر طلاب و خط موظفی
          </p>
        </div>

        {/* Student Picker */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="space-y-1">
            <select 
              value={selectedStudentId || ''} 
              onChange={(e) => onSelectStudent(e.target.value || null)}
              className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 min-w-[220px]"
            >
              <option value="">-- لطفاً یک طلبه را انتخاب کنید --</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} (پایه {s.grade || '---'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedStudentId && selectedStudent ? (
        <div className="space-y-8">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400">مجموع دقایق (مطالعه + مباحثه):</p>
              <p className="text-base font-black text-slate-900">
                {totalMinutes.toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-500">دقیقه</span>
              </p>
              <p className="text-[10px] text-slate-400 font-medium">میانگین: {studentAvgTotalMinutes.toLocaleString('fa-IR')} د/دوره</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400">تفکیک مطالعه و مباحثه:</p>
              <div className="flex items-center gap-2 text-xs font-black">
                <span className="text-indigo-600">{totalStudyMinutes.toLocaleString('fa-IR')} د مطالعه</span>
                <span className="text-slate-300">|</span>
                <span className="text-emerald-600">{totalDiscussionMinutes.toLocaleString('fa-IR')} د مباحثه</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">مباحثه: {totalMinutes > 0 ? Math.round((totalDiscussionMinutes / totalMinutes) * 100) : 0}% کل</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400">متوسط انحراف از میانگین پایه:</p>
              <p className={cn(
                "text-base font-black",
                avgDevMinutes >= 0 ? "text-emerald-600" : "text-rose-600"
              )}>
                {avgDevMinutes > 0 ? '+' : ''}{avgDevMinutes.toLocaleString('fa-IR')} <span className="text-xs font-normal text-slate-400">دقیقه/دوره</span>
              </p>
              <p className="text-[10px] text-slate-400 font-medium">{avgDevMinutes >= 0 ? 'عملکرد بالاتر از میانگین' : 'کسری نسبت به میانگین'}</p>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-400">ثبت زیر میانگین پایه:</p>
              <p className="text-base font-black text-slate-800">
                {belowAvgPercentage.toFixed(0)}% <span className="text-xs font-normal text-slate-400">از دوره‌ها</span>
              </p>
              <p className="text-[10px] text-slate-400 font-medium">در {activeStudentLogs.length} دوره فعال</p>
            </div>
          </div>

          {/* Chart Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
            {/* Metric Mode Switcher */}
            <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setChartMetric('TOTAL')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  chartMetric === 'TOTAL' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                مجموع کل (ملاک اصلی)
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('SPLIT_ALL')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  chartMetric === 'SPLIT_ALL' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                نمایش همزمان (مطالعه + مباحثه + مجموع)
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('STUDY_ONLY')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  chartMetric === 'STUDY_ONLY' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                مقایسه مطالعه طلبه با طلاب
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('DISCUSSION_ONLY')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  chartMetric === 'DISCUSSION_ONLY' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                مقایسه مباحثه طلبه با طلاب
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('ADJUSTED')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  chartMetric === 'ADJUSTED' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                تراز رشد تعدیل‌شده (%)
              </button>
            </div>

            {/* Additional line toggles */}
            {chartMetric !== 'ADJUSTED' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAverageOnChart(!showAverageOnChart)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all border",
                    showAverageOnChart ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-white border-slate-200 text-slate-400"
                  )}
                >
                  میانگین پایه
                </button>
                <button
                  type="button"
                  onClick={() => setShowMandatoryOnChart(!showMandatoryOnChart)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all border",
                    showMandatoryOnChart ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-400"
                  )}
                >
                  خط موظفی
                </button>
              </div>
            )}
          </div>

          {/* Main Chart */}
          <div className="h-[380px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {chartMetric === 'ADJUSTED' ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} unit="%" />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    itemStyle={{ fontSize: '12px', fontWeight: 800 }}
                  />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '11px', fontWeight: 700 }} />
                  <Line name="شاخص تراز رشد تعدیل‌شده (%)" type="monotone" dataKey="adjustedIndex" stroke="#ec4899" strokeWidth={4} dot={{ r: 5, fill: '#ec4899' }} />
                  <Line name="نسبت به موظفی (%)" type="monotone" dataKey="perfRatio" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                  <Line name="نسبت به میانگین پایه (%)" type="monotone" dataKey="relRatio" stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                  <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'خط مبنا ۱۰۰٪', fill: '#94a3b8', fontSize: 10 }} />
                </LineChart>
              ) : chartMetric === 'STUDY_ONLY' ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} itemStyle={{ fontSize: '12px', fontWeight: 800 }} />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '11px', fontWeight: 700 }} />
                  <Line name={`دقایق مطالعه ${selectedStudent.name}`} type="monotone" dataKey="studyMinutes" stroke="#6366f1" strokeWidth={4} dot={{ r: 6, fill: '#6366f1' }} />
                  {showAverageOnChart && (
                    <Line name="میانگین مطالعه هم‌پایه‌ای‌ها" type="monotone" dataKey="avgStudyMinutes" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  )}
                  {showMandatoryOnChart && (
                    <Line name="دقیقه موظفی کل" type="stepAfter" dataKey="mandatoryMinutes" stroke="#0f172a" strokeWidth={1.5} dot={false} opacity={0.25} />
                  )}
                </LineChart>
              ) : chartMetric === 'DISCUSSION_ONLY' ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} itemStyle={{ fontSize: '12px', fontWeight: 800 }} />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '11px', fontWeight: 700 }} />
                  <Line name={`دقایق مباحثه ${selectedStudent.name}`} type="monotone" dataKey="discussionMinutes" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981' }} />
                  {showAverageOnChart && (
                    <Line name="میانگین مباحثه هم‌پایه‌ای‌ها" type="monotone" dataKey="avgDiscussionMinutes" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  )}
                </LineChart>
              ) : chartMetric === 'SPLIT_ALL' ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} itemStyle={{ fontSize: '12px', fontWeight: 800 }} />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '11px', fontWeight: 700 }} />
                  <Line name="مجموع کل دقایق" type="monotone" dataKey="totalMinutes" stroke="#0f172a" strokeWidth={3} dot={{ r: 5, fill: '#0f172a' }} />
                  <Line name="دقایق مطالعه" type="monotone" dataKey="studyMinutes" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1' }} />
                  <Line name="دقایق مباحثه" type="monotone" dataKey="discussionMinutes" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981' }} />
                  {showAverageOnChart && (
                    <Line name="میانگین مجموع پایه" type="monotone" dataKey="avgTotalMinutes" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                  )}
                  {showMandatoryOnChart && (
                    <Line name="موظفی" type="stepAfter" dataKey="mandatoryMinutes" stroke="#e11d48" strokeWidth={1.5} strokeDasharray="3 3" dot={false} opacity={0.5} />
                  )}
                </LineChart>
              ) : (
                /* Default TOTAL */
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }} itemStyle={{ fontSize: '12px', fontWeight: 800 }} />
                  <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '11px', fontWeight: 700 }} />
                  <Line name={`مجموع دقایق ${selectedStudent.name}`} type="monotone" dataKey="totalMinutes" stroke="#6366f1" strokeWidth={4} dot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                  {showAverageOnChart && (
                    <Line name="میانگین مجموع پایه" type="monotone" dataKey="avgTotalMinutes" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  )}
                  {showMandatoryOnChart && (
                    <Line name="دقیقه موظفی" type="stepAfter" dataKey="mandatoryMinutes" stroke="#0f172a" strokeWidth={2} dot={false} opacity={0.3} />
                  )}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Detailed Period-by-Period Breakout Table */}
          <div className="pt-6 border-t border-slate-100 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h5 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <FileSpreadsheet className="text-indigo-600" size={18} />
                  <span>جدول ریز عملکرد دوره‌ای {selectedStudent.name} (تفکیک مطالعه، مباحثه، موظفی و میانگین)</span>
                </h5>
                <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                  بررسی موظفی بر اساس مجموع، و مقایسه جزئی مطالعه و مباحثه با سایر طلاب
                </p>
              </div>

              {/* Column Filter Toggle */}
              <div ref={breakoutFilterRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsBreakoutFilterOpen(!isBreakoutFilterOpen)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors border border-slate-200 shadow-xs"
                >
                  <SlidersHorizontal size={13} className="text-indigo-600" />
                  <span>مدیریت ستون‌های ریز عملکرد</span>
                  <ChevronDown size={13} className={cn("text-slate-400 transition-transform", isBreakoutFilterOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {isBreakoutFilterOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute left-0 mt-2 w-80 p-4 bg-white rounded-2xl border border-slate-200 shadow-xl space-y-3 z-40"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-xs font-black text-slate-800">انتخاب ستون‌های ریز عملکرد:</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setBreakoutCols({
                              timeRange: true,
                              studyMinutes: true,
                              discussionMinutes: true,
                              totalMinutes: true,
                              mandatoryMinutes: true,
                              gradeAvgTotal: true,
                              gradeAvgStudy: true,
                              gradeAvgDiscussion: true,
                              diffMandatory: true,
                              diffAvgTotal: true,
                              perfRatio: true,
                              relRatio: true,
                              statusMandatory: true,
                              statusAvg: true,
                            })}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                          >
                            نمایش همه
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={() => setBreakoutCols({
                              timeRange: true,
                              studyMinutes: true,
                              discussionMinutes: true,
                              totalMinutes: true,
                              mandatoryMinutes: true,
                              gradeAvgTotal: true,
                              gradeAvgStudy: false,
                              gradeAvgDiscussion: false,
                              diffMandatory: true,
                              diffAvgTotal: true,
                              perfRatio: true,
                              relRatio: false,
                              statusMandatory: true,
                              statusAvg: true,
                            })}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-700"
                          >
                            پیش‌فرض
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-700 max-h-60 overflow-y-auto pr-1">
                        <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">
                          <input type="checkbox" checked={breakoutCols.timeRange} onChange={() => setBreakoutCols(p => ({ ...p, timeRange: !p.timeRange }))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>بازه زمانی</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">
                          <input type="checkbox" checked={breakoutCols.studyMinutes} onChange={() => setBreakoutCols(p => ({ ...p, studyMinutes: !p.studyMinutes }))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>دقیقه مطالعه</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">
                          <input type="checkbox" checked={breakoutCols.discussionMinutes} onChange={() => setBreakoutCols(p => ({ ...p, discussionMinutes: !p.discussionMinutes }))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>دقیقه مباحثه</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">
                          <input type="checkbox" checked={breakoutCols.totalMinutes} onChange={() => setBreakoutCols(p => ({ ...p, totalMinutes: !p.totalMinutes }))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>مجموع کل دقایق</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">
                          <input type="checkbox" checked={breakoutCols.mandatoryMinutes} onChange={() => setBreakoutCols(p => ({ ...p, mandatoryMinutes: !p.mandatoryMinutes }))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>دقیقه موظفی</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">
                          <input type="checkbox" checked={breakoutCols.gradeAvgTotal} onChange={() => setBreakoutCols(p => ({ ...p, gradeAvgTotal: !p.gradeAvgTotal }))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>میانگین کل پایه</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">
                          <input type="checkbox" checked={breakoutCols.gradeAvgStudy} onChange={() => setBreakoutCols(p => ({ ...p, gradeAvgStudy: !p.gradeAvgStudy }))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>میانگین مطالعه پایه</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">
                          <input type="checkbox" checked={breakoutCols.gradeAvgDiscussion} onChange={() => setBreakoutCols(p => ({ ...p, gradeAvgDiscussion: !p.gradeAvgDiscussion }))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>میانگین مباحثه پایه</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">
                          <input type="checkbox" checked={breakoutCols.diffMandatory} onChange={() => setBreakoutCols(p => ({ ...p, diffMandatory: !p.diffMandatory }))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>اختلاف با موظفی</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">
                          <input type="checkbox" checked={breakoutCols.diffAvgTotal} onChange={() => setBreakoutCols(p => ({ ...p, diffAvgTotal: !p.diffAvgTotal }))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>اختلاف با میانگین کل</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">
                          <input type="checkbox" checked={breakoutCols.perfRatio} onChange={() => setBreakoutCols(p => ({ ...p, perfRatio: !p.perfRatio }))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>تراز موظفی (%)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors">
                          <input type="checkbox" checked={breakoutCols.statusMandatory} onChange={() => setBreakoutCols(p => ({ ...p, statusMandatory: !p.statusMandatory }))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>وضعیت موظفی</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-indigo-600 transition-colors col-span-2 bg-indigo-50/50 p-1.5 rounded-lg">
                          <input type="checkbox" checked={breakoutCols.statusAvg} onChange={() => setBreakoutCols(p => ({ ...p, statusAvg: !p.statusAvg }))} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          <span>وضعیت میانگین (بالای / زیر میانگین)</span>
                        </label>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Breakout Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                    <th className="px-4 py-3.5">عنوان دوره</th>
                    {breakoutCols.timeRange && <th className="px-3 py-3.5 text-center">بازه زمانی</th>}
                    {breakoutCols.studyMinutes && <th className="px-3 py-3.5 text-center text-indigo-700 bg-indigo-50/40">مطالعه</th>}
                    {breakoutCols.discussionMinutes && <th className="px-3 py-3.5 text-center text-emerald-700 bg-emerald-50/40">مباحثه</th>}
                    {breakoutCols.totalMinutes && <th className="px-3 py-3.5 text-center bg-slate-100 font-extrabold">مجموع کل</th>}
                    {breakoutCols.mandatoryMinutes && <th className="px-3 py-3.5 text-center">دقیقه موظفی</th>}
                    {breakoutCols.gradeAvgTotal && <th className="px-3 py-3.5 text-center">میانگین کل پایه</th>}
                    {breakoutCols.gradeAvgStudy && <th className="px-3 py-3.5 text-center text-indigo-600">میانگین مطالعه پایه</th>}
                    {breakoutCols.gradeAvgDiscussion && <th className="px-3 py-3.5 text-center text-emerald-600">میانگین مباحثه پایه</th>}
                    {breakoutCols.diffMandatory && <th className="px-3 py-3.5 text-center">اختلاف با موظفی</th>}
                    {breakoutCols.diffAvgTotal && <th className="px-3 py-3.5 text-center">اختلاف با میانگین</th>}
                    {breakoutCols.perfRatio && <th className="px-3 py-3.5 text-center">تراز موظفی</th>}
                    {breakoutCols.statusMandatory && <th className="px-3 py-3.5 text-center">وضعیت موظفی</th>}
                    {breakoutCols.statusAvg && <th className="px-3 py-3.5 text-center bg-indigo-50/40 text-indigo-800">وضعیت میانگین</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {periods.map(p => {
                    const log = allLogs.find(l => l.studentId === selectedStudentId && l.periodId === p.id);
                    const metrics = getLogMetrics(log);
                    const mandatoryMin = Math.round((p.mandatoryHours || 0) * 60);

                    const gradeStudents = students.filter(s => s.grade === selectedStudent?.grade);
                    const gradeAvg = calculatePeriodAverages(p.id, allLogs, gradeStudents.map(s => s.id));
                    const overallAvg = calculatePeriodAverages(p.id, allLogs);

                    const avgTotMin = gradeAvg.activeCount > 0 ? gradeAvg.totalAvgMinutes : overallAvg.totalAvgMinutes;
                    const avgStudyMin = gradeAvg.activeCount > 0 ? gradeAvg.studyAvgMinutes : overallAvg.studyAvgMinutes;
                    const avgDiscMin = gradeAvg.activeCount > 0 ? gradeAvg.discussionAvgMinutes : overallAvg.discussionAvgMinutes;

                    const diffMandatory = metrics.totalMinutes - mandatoryMin;
                    const diffTotalAvg = metrics.totalMinutes - avgTotMin;
                    const perfRatio = mandatoryMin > 0 ? (metrics.totalMinutes / mandatoryMin) * 100 : 0;

                    const startDateFa = p.startDate ? new Date(p.startDate).toLocaleDateString('fa-IR') : '---';
                    const endDateFa = p.endDate ? new Date(p.endDate).toLocaleDateString('fa-IR') : '---';

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 font-bold text-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                            <span>{p.title}</span>
                          </div>
                        </td>

                        {breakoutCols.timeRange && (
                          <td className="px-3 py-3.5 text-center text-[11px] text-slate-500 whitespace-nowrap">
                            {startDateFa} تا {endDateFa}
                          </td>
                        )}

                        {breakoutCols.studyMinutes && (
                          <td className="px-3 py-3.5 text-center font-bold text-indigo-700 bg-indigo-50/20">
                            {metrics.studyMinutes > 0 ? `${metrics.studyMinutes.toLocaleString('fa-IR')} د` : <span className="text-slate-300">۰</span>}
                          </td>
                        )}

                        {breakoutCols.discussionMinutes && (
                          <td className="px-3 py-3.5 text-center font-bold text-emerald-700 bg-emerald-50/20">
                            {metrics.discussionMinutes > 0 ? `${metrics.discussionMinutes.toLocaleString('fa-IR')} د` : <span className="text-slate-300">۰</span>}
                          </td>
                        )}

                        {breakoutCols.totalMinutes && (
                          <td className="px-3 py-3.5 text-center font-black text-slate-900 bg-slate-50/60">
                            {metrics.totalMinutes > 0 ? `${metrics.totalMinutes.toLocaleString('fa-IR')} د` : <span className="text-slate-300">۰</span>}
                          </td>
                        )}

                        {breakoutCols.mandatoryMinutes && (
                          <td className="px-3 py-3.5 text-center font-bold text-slate-700">
                            {mandatoryMin.toLocaleString('fa-IR')} د
                          </td>
                        )}

                        {breakoutCols.gradeAvgTotal && (
                          <td className="px-3 py-3.5 text-center text-slate-600 font-bold">
                            {avgTotMin.toLocaleString('fa-IR')} د
                          </td>
                        )}

                        {breakoutCols.gradeAvgStudy && (
                          <td className="px-3 py-3.5 text-center text-indigo-600 font-bold">
                            {avgStudyMin.toLocaleString('fa-IR')} د
                          </td>
                        )}

                        {breakoutCols.gradeAvgDiscussion && (
                          <td className="px-3 py-3.5 text-center text-emerald-600 font-bold">
                            {avgDiscMin.toLocaleString('fa-IR')} د
                          </td>
                        )}

                        {breakoutCols.diffMandatory && (
                          <td className="px-3 py-3.5 text-center">
                            {metrics.totalMinutes > 0 ? (
                              <span className={cn(
                                "inline-flex items-center gap-0.5 font-bold text-[11px]",
                                diffMandatory >= 0 ? "text-emerald-600" : "text-rose-600"
                              )}>
                                {diffMandatory > 0 ? '+' : ''}{diffMandatory.toLocaleString('fa-IR')} د
                                {diffMandatory >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                              </span>
                            ) : (
                              <span className="text-slate-300">---</span>
                            )}
                          </td>
                        )}

                        {breakoutCols.diffAvgTotal && (
                          <td className="px-3 py-3.5 text-center">
                            {metrics.totalMinutes > 0 ? (
                              <span className={cn(
                                "font-bold text-[11px]",
                                diffTotalAvg >= 0 ? "text-emerald-600" : "text-amber-600"
                              )}>
                                {diffTotalAvg > 0 ? '+' : ''}{diffTotalAvg.toLocaleString('fa-IR')} د
                              </span>
                            ) : (
                              <span className="text-slate-300">---</span>
                            )}
                          </td>
                        )}

                        {breakoutCols.perfRatio && (
                          <td className="px-3 py-3.5 text-center">
                            {metrics.totalMinutes > 0 && mandatoryMin > 0 ? (
                              <span className={cn(
                                "px-2 py-0.5 rounded-lg text-[10px] font-black",
                                perfRatio >= 100 ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                              )}>
                                {perfRatio.toFixed(0)}%
                              </span>
                            ) : (
                              <span className="text-slate-300">---</span>
                            )}
                          </td>
                        )}

                        {breakoutCols.statusMandatory && (
                          <td className="px-3 py-3.5 text-center">
                            {metrics.totalMinutes >= mandatoryMin && mandatoryMin > 0 ? (
                              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-100 whitespace-nowrap">
                                موفق موظفی
                              </span>
                            ) : metrics.totalMinutes === 0 ? (
                              <span className="bg-slate-100 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                                ثبت نشده
                              </span>
                            ) : (
                              <span className="bg-rose-50 text-rose-600 text-[10px] font-black px-2 py-0.5 rounded-full border border-rose-100 whitespace-nowrap">
                                کسری موظفی
                              </span>
                            )}
                          </td>
                        )}

                        {breakoutCols.statusAvg && (
                          <td className="px-3 py-3.5 text-center">
                            {metrics.totalMinutes >= avgTotMin && avgTotMin > 0 ? (
                              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-100 whitespace-nowrap">
                                بالای میانگین
                              </span>
                            ) : metrics.totalMinutes === 0 ? (
                              <span className="bg-slate-100 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                                ثبت نشده
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
                {/* Table Footer Totals */}
                <tfoot>
                  <tr className="bg-slate-100/90 font-black text-slate-900 text-xs border-t-2 border-slate-200">
                    <td className="px-4 py-3.5">
                      مجموع کل دوره‌ها
                    </td>
                    {breakoutCols.timeRange && (
                      <td className="px-3 py-3.5 text-center text-slate-500 text-[11px]">
                        {periods.length} دوره
                      </td>
                    )}
                    {breakoutCols.studyMinutes && (
                      <td className="px-3 py-3.5 text-center text-indigo-700 font-black bg-indigo-50/50">
                        {totalStudyMinutes.toLocaleString('fa-IR')} د
                      </td>
                    )}
                    {breakoutCols.discussionMinutes && (
                      <td className="px-3 py-3.5 text-center text-emerald-700 font-black bg-emerald-50/50">
                        {totalDiscussionMinutes.toLocaleString('fa-IR')} د
                      </td>
                    )}
                    {breakoutCols.totalMinutes && (
                      <td className="px-3 py-3.5 text-center text-slate-900 font-black bg-slate-200/60">
                        {totalMinutes.toLocaleString('fa-IR')} د
                      </td>
                    )}
                    <td colSpan={
                      (breakoutCols.mandatoryMinutes ? 1 : 0) +
                      (breakoutCols.gradeAvgTotal ? 1 : 0) +
                      (breakoutCols.gradeAvgStudy ? 1 : 0) +
                      (breakoutCols.gradeAvgDiscussion ? 1 : 0) +
                      (breakoutCols.diffMandatory ? 1 : 0) +
                      (breakoutCols.diffAvgTotal ? 1 : 0) +
                      (breakoutCols.perfRatio ? 1 : 0) +
                      (breakoutCols.statusMandatory ? 1 : 0) +
                      (breakoutCols.statusAvg ? 1 : 0) || 1
                    } className="px-3 py-3.5 text-left text-slate-600 text-[11px] font-bold">
                      مشارکت: {activeStudentLogs.length} از {periods.length} دوره ({periods.length > 0 ? Math.round((activeStudentLogs.length / periods.length) * 100) : 0}٪ تعهد)
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Comprehensive Summary Cards Bento (جمع‌بندی جامع عملکرد طلبه) */}
            {(() => {
              // Exact computation of the 9 requested summary points
              let sumStudyAll = 0;
              let sumDiscAll = 0;
              let sumTotalAll = 0;
              let participatedCount = 0;
              let aboveAvgCount = 0;
              let belowAvgCount = 0;
              let aboveMandatoryCount = 0;
              let belowMandatoryCount = 0;

              periods.forEach(p => {
                const log = allLogs.find(l => l.studentId === selectedStudentId && l.periodId === p.id);
                const metrics = getLogMetrics(log);
                const mandatoryMin = Math.round((p.mandatoryHours || 0) * 60);

                const gradeStudents = students.filter(s => s.grade === selectedStudent?.grade);
                const gradeAvg = calculatePeriodAverages(p.id, allLogs, gradeStudents.map(s => s.id));
                const overallAvg = calculatePeriodAverages(p.id, allLogs);
                const avgTotMin = gradeAvg.activeCount > 0 ? gradeAvg.totalAvgMinutes : overallAvg.totalAvgMinutes;

                if (metrics.totalMinutes > 0) {
                  participatedCount++;
                  sumStudyAll += metrics.studyMinutes;
                  sumDiscAll += metrics.discussionMinutes;
                  sumTotalAll += metrics.totalMinutes;

                  if (metrics.totalMinutes >= avgTotMin && avgTotMin > 0) {
                    aboveAvgCount++;
                  } else {
                    belowAvgCount++;
                  }

                  if (mandatoryMin > 0) {
                    if (metrics.totalMinutes >= mandatoryMin) {
                      aboveMandatoryCount++;
                    } else {
                      belowMandatoryCount++;
                    }
                  }
                } else {
                  if (mandatoryMin > 0) {
                    belowMandatoryCount++;
                  }
                  if (avgTotMin > 0) {
                    belowAvgCount++;
                  }
                }
              });

              const totalPeriodsCount = periods.length;
              const commitmentRate = totalPeriodsCount > 0 ? Math.round((participatedCount / totalPeriodsCount) * 100) : 0;

              return (
                <div className="bg-slate-50/80 p-5 md:p-6 rounded-3xl border border-slate-200/80 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-xs">
                        <Award size={18} />
                      </div>
                      <div>
                        <h6 className="text-xs font-black text-slate-800">
                          جمع‌بندی و شاخص‌های کلیدی عملکرد {selectedStudent.name}
                        </h6>
                        <p className="text-[10px] font-bold text-slate-400">
                          خلاصه تجمیعی تمام دوره‌های مطالعاتی ثبت‌شده
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
                    {/* 1. مجموع مطالعه کل */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                      <div className="flex items-center justify-between text-indigo-600">
                        <span className="text-[11px] font-bold text-slate-500">مجموع مطالعه کل</span>
                        <BookOpen size={16} />
                      </div>
                      <div className="text-base font-black text-indigo-700">
                        {sumStudyAll.toLocaleString('fa-IR')} <span className="text-xs font-bold">دقیقه</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400">
                        معادل {(sumStudyAll / 60).toFixed(1)} ساعت
                      </p>
                    </div>

                    {/* 2. مجموع مباحثه کل */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                      <div className="flex items-center justify-between text-emerald-600">
                        <span className="text-[11px] font-bold text-slate-500">مجموع مباحثه کل</span>
                        <MessageSquare size={16} />
                      </div>
                      <div className="text-base font-black text-emerald-700">
                        {sumDiscAll.toLocaleString('fa-IR')} <span className="text-xs font-bold">دقیقه</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400">
                        معادل {(sumDiscAll / 60).toFixed(1)} ساعت
                      </p>
                    </div>

                    {/* 3. مجموع کل */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1 bg-slate-50/50">
                      <div className="flex items-center justify-between text-slate-800">
                        <span className="text-[11px] font-bold text-slate-600">مجموع کل (مطالعه + مباحثه)</span>
                        <Calculator size={16} />
                      </div>
                      <div className="text-base font-black text-slate-900">
                        {sumTotalAll.toLocaleString('fa-IR')} <span className="text-xs font-bold">دقیقه</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-500">
                        معادل {(sumTotalAll / 60).toFixed(1)} ساعت
                      </p>
                    </div>

                    {/* 4. تعداد دفعات مشارکت */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                      <div className="flex items-center justify-between text-blue-600">
                        <span className="text-[11px] font-bold text-slate-500">تعداد دفعات مشارکت</span>
                        <CalendarCheck size={16} />
                      </div>
                      <div className="text-base font-black text-blue-700">
                        {participatedCount.toLocaleString('fa-IR')} <span className="text-xs font-bold text-slate-400">از</span> {totalPeriodsCount.toLocaleString('fa-IR')} <span className="text-xs font-bold">دوره</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-400">
                        حضور در ثبت ساعات دوره
                      </p>
                    </div>

                    {/* 5. درصد تعهد به ثبت */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                      <div className="flex items-center justify-between text-purple-600">
                        <span className="text-[11px] font-bold text-slate-500">درصد تعهد به ثبت</span>
                        <Percent size={16} />
                      </div>
                      <div className="text-base font-black text-purple-700">
                        {commitmentRate.toLocaleString('fa-IR')}٪
                      </div>
                      <p className="text-[10px] font-bold text-slate-400">
                        نسبت دوره‌های فعال به کل دوره‌ها
                      </p>
                    </div>

                    {/* 6. تعداد دفعات بالاتر از موظفی */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                      <div className="flex items-center justify-between text-emerald-600">
                        <span className="text-[11px] font-bold text-slate-500">تعداد دفعات بالاتر از موظفی</span>
                        <CheckCircle2 size={16} />
                      </div>
                      <div className="text-base font-black text-emerald-600">
                        {aboveMandatoryCount.toLocaleString('fa-IR')} <span className="text-xs font-bold">مرتبه</span>
                      </div>
                      <p className="text-[10px] font-bold text-emerald-600/80">
                        دستیابی به سقف موظفی دوره
                      </p>
                    </div>

                    {/* 7. تعداد دفعات کمتر از موظفی */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                      <div className="flex items-center justify-between text-rose-600">
                        <span className="text-[11px] font-bold text-slate-500">تعداد دفعات کمتر از موظفی</span>
                        <XCircle size={16} />
                      </div>
                      <div className="text-base font-black text-rose-600">
                        {belowMandatoryCount.toLocaleString('fa-IR')} <span className="text-xs font-bold">مرتبه</span>
                      </div>
                      <p className="text-[10px] font-bold text-rose-500">
                        کسری یا عدم ثبت موظفی
                      </p>
                    </div>

                    {/* 8. تعداد دفعات بالاتر از میانگین */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                      <div className="flex items-center justify-between text-teal-600">
                        <span className="text-[11px] font-bold text-slate-500">تعداد دفعات بالاتر از میانگین</span>
                        <TrendingUp size={16} />
                      </div>
                      <div className="text-base font-black text-teal-600">
                        {aboveAvgCount.toLocaleString('fa-IR')} <span className="text-xs font-bold">مرتبه</span>
                      </div>
                      <p className="text-[10px] font-bold text-teal-600/80">
                        عملکرد فراتر از میانگین پایه
                      </p>
                    </div>

                    {/* 9. تعداد دفعات کمتر از میانگین */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
                      <div className="flex items-center justify-between text-amber-600">
                        <span className="text-[11px] font-bold text-slate-500">تعداد دفعات کمتر از میانگین</span>
                        <TrendingDown size={16} />
                      </div>
                      <div className="text-base font-black text-amber-600">
                        {belowAvgCount.toLocaleString('fa-IR')} <span className="text-xs font-bold">مرتبه</span>
                      </div>
                      <p className="text-[10px] font-bold text-amber-600/80">
                        عملکرد پایین‌تر از میانگین پایه
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="py-16 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <User className="mx-auto mb-3 text-slate-300" size={36} />
          <p className="font-bold text-sm text-slate-700">هیچ طلبه‌ای برای نمایش نمودار انتخاب نشده است</p>
          <p className="text-xs text-slate-400 mt-1">
            لطفاً از کشوی بالا یا جدول دوره‌ها، نام یک طلبه را انتخاب کنید.
          </p>
        </div>
      )}
    </div>
  );
}
