import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, 
  MessageSquare, 
  Calculator, 
  ArrowUpRight, 
  ArrowDownRight, 
  SlidersHorizontal, 
  ChevronDown, 
  Eye, 
  EyeOff, 
  Search, 
  Check, 
  Info,
  Clock,
  Layers,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Student, StudyPeriod, PeriodicStudyLog, Todo } from '../../types';
import { getLogMetrics, calculatePeriodAverages } from './studyUtils';
import { localDb } from '../../lib/localDb';
import { cn } from '../../lib/utils';

export type TableDisplayMode = 'ALL_SPLIT' | 'TOTAL_ONLY' | 'STUDY_ONLY' | 'DISCUSSION_ONLY';

export interface PeriodColumnsVisibility {
  grade: boolean;
  needsFollowUp: boolean;
  studyMinutes: boolean;
  discussionMinutes: boolean;
  totalMinutes: boolean;
  diffMandatory: boolean;
  diffAvg: boolean;
  diffStudyAvg: boolean;
  diffDiscussionAvg: boolean;
  statusMandatory: boolean;
  statusAvg: boolean;
  action: boolean;
}

interface PeriodViewTableProps {
  period: StudyPeriod;
  students: Student[];
  allLogs: PeriodicStudyLog[];
  selectedStudentId: string | null;
  onSelectStudent: (studentId: string) => void;
  onUpdateFollowUp?: (studentId: string, currentStatus?: string) => void;
}

export default function PeriodViewTable({
  period,
  students,
  allLogs,
  selectedStudentId,
  onSelectStudent
}: PeriodViewTableProps) {
  const [displayMode, setDisplayMode] = useState<TableDisplayMode>('ALL_SPLIT');
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const [cols, setCols] = useState<PeriodColumnsVisibility>({
    grade: true,
    needsFollowUp: true,
    studyMinutes: true,
    discussionMinutes: true,
    totalMinutes: true,
    diffMandatory: true,
    diffAvg: true,
    diffStudyAvg: false,
    diffDiscussionAvg: false,
    statusMandatory: true,
    statusAvg: true,
    action: true
  });

  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    const fetchTodos = async () => {
      try {
        const list = await localDb.getDocs<Todo>('todos');
        setTodos(list);
      } catch (e) {
        console.error("Error loading todos:", e);
      }
    };
    fetchTodos();
    const unsub = localDb.subscribe(() => {
      fetchTodos();
    });
    return () => unsub();
  }, []);

  const handleToggleFollowUp = async (student: Student, activeTodo?: Todo) => {
    try {
      if (activeTodo) {
        // Mark as completed so it leaves active follow-ups list
        await localDb.updateDoc('todos', activeTodo.id, { completed: true });
      } else {
        // Check for an existing completed todo to re-enable or create new
        const existingCompleted = todos.find(t => 
          t.studentId === student.id && 
          t.completed && 
          (t.isStudyFollowUp || (t.title && t.title.includes('[پیگیری مطالعه]'))) && 
          (t.periodId === period.id || (t.title && t.title.includes(period.title)))
        );

        if (existingCompleted) {
          await localDb.updateDoc('todos', existingCompleted.id, { completed: false });
        } else {
          await localDb.addDoc('todos', {
            title: `[پیگیری مطالعه] ${student.name} - ${period.title}`,
            studentId: student.id,
            completed: false,
            isStudyFollowUp: true,
            periodId: period.id,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      console.error("Error toggling follow-up todo:", e);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const mandatoryMinutes = Math.round((period.mandatoryHours || 0) * 60);
  const periodLogs = allLogs.filter(l => l.periodId === period.id);

  // Overall Period Averages
  const overallAvg = calculatePeriodAverages(period.id, allLogs);

  // Unique grades for filter
  const uniqueGrades = Array.from(new Set(students.map(s => s.grade).filter(Boolean))) as string[];

  // Filter students
  const filteredStudents = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.nationalId && s.nationalId.includes(searchTerm));
    const matchGrade = gradeFilter === 'ALL' || s.grade === gradeFilter;
    return matchSearch && matchGrade;
  });

  return (
    <div className="space-y-4">
      {/* Controls: Display Mode Tabs & Search & Filter Dropdown */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
        {/* View Mode Selector */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
          <button
            type="button"
            onClick={() => setDisplayMode('ALL_SPLIT')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
              displayMode === 'ALL_SPLIT' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Layers size={13} />
            <span>تفکیکی و مجموع (پیش‌فرض)</span>
          </button>

          <button
            type="button"
            onClick={() => setDisplayMode('TOTAL_ONLY')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
              displayMode === 'TOTAL_ONLY' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Calculator size={13} />
            <span>فقط مجموع کل</span>
          </button>

          <button
            type="button"
            onClick={() => setDisplayMode('STUDY_ONLY')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
              displayMode === 'STUDY_ONLY' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <BookOpen size={13} />
            <span>فقط مطالعه</span>
          </button>

          <button
            type="button"
            onClick={() => setDisplayMode('DISCUSSION_ONLY')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
              displayMode === 'DISCUSSION_ONLY' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <MessageSquare size={13} />
            <span>فقط مباحثه</span>
          </button>
        </div>

        {/* Search, Grade & Columns Drawer */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Grade filter */}
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

          {/* Search Box */}
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

          {/* Column Toggle Button */}
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
                    <span className="text-xs font-black text-slate-800">ستون‌های قابل نمایش:</span>
                    <button
                      type="button"
                      onClick={() => setCols({
                        grade: true,
                        needsFollowUp: true,
                        studyMinutes: true,
                        discussionMinutes: true,
                        totalMinutes: true,
                        diffMandatory: true,
                        diffAvg: true,
                        diffStudyAvg: true,
                        diffDiscussionAvg: true,
                        statusMandatory: true,
                        statusAvg: true,
                        action: true
                      })}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      نمایش همه
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-xs font-bold text-slate-700">
                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={cols.grade} onChange={() => setCols(p => ({ ...p, grade: !p.grade }))} className="rounded text-indigo-600" />
                      <span>پایه تحصیلی</span>
                    </label>
                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-amber-50/50 cursor-pointer bg-amber-50/30">
                      <input type="checkbox" checked={cols.needsFollowUp} onChange={() => setCols(p => ({ ...p, needsFollowUp: !p.needsFollowUp }))} className="rounded text-amber-600" />
                      <span className="text-amber-800 font-black">نیاز به پیگیری</span>
                    </label>
                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={cols.studyMinutes} onChange={() => setCols(p => ({ ...p, studyMinutes: !p.studyMinutes }))} className="rounded text-indigo-600" />
                      <span>دقیقه مطالعه</span>
                    </label>
                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={cols.discussionMinutes} onChange={() => setCols(p => ({ ...p, discussionMinutes: !p.discussionMinutes }))} className="rounded text-indigo-600" />
                      <span>دقیقه مباحثه</span>
                    </label>
                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={cols.totalMinutes} onChange={() => setCols(p => ({ ...p, totalMinutes: !p.totalMinutes }))} className="rounded text-indigo-600" />
                      <span>مجموع دقایق</span>
                    </label>
                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={cols.diffMandatory} onChange={() => setCols(p => ({ ...p, diffMandatory: !p.diffMandatory }))} className="rounded text-indigo-600" />
                      <span>اختلاف با موظفی</span>
                    </label>
                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={cols.diffAvg} onChange={() => setCols(p => ({ ...p, diffAvg: !p.diffAvg }))} className="rounded text-indigo-600" />
                      <span>اختلاف با میانگین کل</span>
                    </label>
                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={cols.diffStudyAvg} onChange={() => setCols(p => ({ ...p, diffStudyAvg: !p.diffStudyAvg }))} className="rounded text-indigo-600" />
                      <span>اختلاف با میانگین مطالعه</span>
                    </label>
                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={cols.diffDiscussionAvg} onChange={() => setCols(p => ({ ...p, diffDiscussionAvg: !p.diffDiscussionAvg }))} className="rounded text-indigo-600" />
                      <span>اختلاف با میانگین مباحثه</span>
                    </label>
                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={cols.statusMandatory} onChange={() => setCols(p => ({ ...p, statusMandatory: !p.statusMandatory }))} className="rounded text-indigo-600" />
                      <span>وضعیت موظفی</span>
                    </label>
                    <label className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                      <input type="checkbox" checked={cols.statusAvg} onChange={() => setCols(p => ({ ...p, statusAvg: !p.statusAvg }))} className="rounded text-indigo-600" />
                      <span>وضعیت میانگین</span>
                    </label>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-3.5">ردیف</th>
              <th className="px-4 py-3.5">نام و نام خانوادگی</th>
              {cols.grade && <th className="px-3 py-3.5 text-center">پایه</th>}
              {cols.needsFollowUp && <th className="px-3 py-3.5 text-center bg-amber-50/60 text-amber-800 font-extrabold">نیاز به پیگیری</th>}

              {/* Show Study column if mode allows and column enabled */}
              {cols.studyMinutes && (displayMode === 'ALL_SPLIT' || displayMode === 'STUDY_ONLY') && (
                <th className="px-3 py-3.5 text-center bg-indigo-50/50 text-indigo-700">دقیقه مطالعه</th>
              )}

              {/* Show Discussion column if mode allows and column enabled */}
              {cols.discussionMinutes && (displayMode === 'ALL_SPLIT' || displayMode === 'DISCUSSION_ONLY') && (
                <th className="px-3 py-3.5 text-center bg-emerald-50/50 text-emerald-700">دقیقه مباحثه</th>
              )}

              {/* Show Total column if mode allows and column enabled */}
              {cols.totalMinutes && (displayMode === 'ALL_SPLIT' || displayMode === 'TOTAL_ONLY') && (
                <th className="px-3 py-3.5 text-center bg-slate-100 text-slate-800 font-extrabold">مجموع کل (دقیقه)</th>
              )}

              {cols.diffMandatory && <th className="px-3 py-3.5 text-center">اختلاف با موظفی</th>}
              {cols.diffAvg && <th className="px-3 py-3.5 text-center">اختلاف با میانگین کل</th>}
              {cols.diffStudyAvg && <th className="px-3 py-3.5 text-center">اختلاف با میانگین مطالعه</th>}
              {cols.diffDiscussionAvg && <th className="px-3 py-3.5 text-center">اختلاف با میانگین مباحثه</th>}
              {cols.statusMandatory && <th className="px-3 py-3.5 text-center">وضعیت موظفی</th>}
              {cols.statusAvg && <th className="px-3 py-3.5 text-center">وضعیت میانگین</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-slate-400 font-bold">
                  هیچ طلبه‌ای یافت نشد.
                </td>
              </tr>
            ) : (
              filteredStudents.map((student, index) => {
                const log = periodLogs.find(l => l.studentId === student.id);
                const metrics = getLogMetrics(log);

                // Student's grade peers averages
                const gradeStudents = students.filter(s => s.grade === student.grade);
                const gradeAvg = calculatePeriodAverages(period.id, allLogs, gradeStudents.map(s => s.id));

                const diffMandatory = metrics.totalMinutes - mandatoryMinutes;
                const diffTotalAvg = metrics.totalMinutes - (gradeAvg.activeCount > 0 ? gradeAvg.totalAvgMinutes : overallAvg.totalAvgMinutes);
                const diffStudyAvg = metrics.studyMinutes - (gradeAvg.activeCount > 0 ? gradeAvg.studyAvgMinutes : overallAvg.studyAvgMinutes);
                const diffDiscAvg = metrics.discussionMinutes - (gradeAvg.activeCount > 0 ? gradeAvg.discussionAvgMinutes : overallAvg.discussionAvgMinutes);

                const activeTodo = todos.find(t => 
                  t.studentId === student.id && 
                  !t.completed && 
                  (t.isStudyFollowUp || (t.title && t.title.includes('[پیگیری مطالعه]'))) && 
                  (t.periodId === period.id || (t.title && t.title.includes(period.title)))
                );
                const hasActiveFollowUp = !!activeTodo;

                const isSelected = selectedStudentId === student.id;

                return (
                  <tr 
                    key={student.id}
                    onClick={() => onSelectStudent(student.id)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSelected ? "bg-indigo-50/70 font-semibold" : "hover:bg-slate-50/80"
                    )}
                  >
                    <td className="px-4 py-3.5 text-slate-400 text-[11px] font-bold">{index + 1}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-800 flex items-center gap-2">
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                      <span>{student.name}</span>
                    </td>
                    {cols.grade && <td className="px-3 py-3.5 text-center text-slate-500">{student.grade || '---'}</td>}

                    {/* Needs Follow-Up Column */}
                    {cols.needsFollowUp && (
                      <td className="px-3 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleToggleFollowUp(student, activeTodo)}
                          className={cn(
                            "px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 mx-auto border shadow-2xs",
                            hasActiveFollowUp
                              ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600"
                              : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-800"
                          )}
                          title={hasActiveFollowUp ? "در حال پیگیری - کلیک کنید تا تکمیل شود" : "افزودن به لیست پیگیری‌ها"}
                        >
                          <input
                            type="checkbox"
                            checked={hasActiveFollowUp}
                            onChange={() => {}}
                            className="w-3.5 h-3.5 rounded text-amber-600 pointer-events-none cursor-pointer"
                          />
                          <span>{hasActiveFollowUp ? "در پیگیری" : "نیازمند پیگیری"}</span>
                        </button>
                      </td>
                    )}

                    {/* Study Minutes Column */}
                    {cols.studyMinutes && (displayMode === 'ALL_SPLIT' || displayMode === 'STUDY_ONLY') && (
                      <td className="px-3 py-3.5 text-center font-bold text-indigo-700 bg-indigo-50/30">
                        {metrics.studyMinutes > 0 ? `${metrics.studyMinutes.toLocaleString('fa-IR')} د` : <span className="text-slate-300 font-normal">۰</span>}
                      </td>
                    )}

                    {/* Discussion Minutes Column */}
                    {cols.discussionMinutes && (displayMode === 'ALL_SPLIT' || displayMode === 'DISCUSSION_ONLY') && (
                      <td className="px-3 py-3.5 text-center font-bold text-emerald-700 bg-emerald-50/30">
                        {metrics.discussionMinutes > 0 ? `${metrics.discussionMinutes.toLocaleString('fa-IR')} د` : <span className="text-slate-300 font-normal">۰</span>}
                      </td>
                    )}

                    {/* Total Minutes Column */}
                    {cols.totalMinutes && (displayMode === 'ALL_SPLIT' || displayMode === 'TOTAL_ONLY') && (
                      <td className="px-3 py-3.5 text-center font-black text-slate-900 bg-slate-50">
                        {metrics.totalMinutes > 0 ? `${metrics.totalMinutes.toLocaleString('fa-IR')} د` : <span className="text-slate-300 font-normal">۰</span>}
                      </td>
                    )}

                    {/* Diff with Mandatory (Total vs Mandatory) */}
                    {cols.diffMandatory && (
                      <td className="px-3 py-3.5 text-center">
                        {metrics.totalMinutes > 0 && mandatoryMinutes > 0 ? (
                          <span className={cn(
                            "inline-flex items-center gap-0.5 font-bold text-[11px]",
                            diffMandatory >= 0 ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {diffMandatory > 0 ? '+' : ''}{diffMandatory.toLocaleString('fa-IR')} د
                            {diffMandatory >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                          </span>
                        ) : (
                          <span className="text-slate-300">---</span>
                        )}
                      </td>
                    )}

                    {/* Diff with Total Average */}
                    {cols.diffAvg && (
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

                    {/* Diff with Study Average */}
                    {cols.diffStudyAvg && (
                      <td className="px-3 py-3.5 text-center">
                        {metrics.studyMinutes > 0 ? (
                          <span className={cn(
                            "font-bold text-[11px]",
                            diffStudyAvg >= 0 ? "text-indigo-600" : "text-amber-600"
                          )}>
                            {diffStudyAvg > 0 ? '+' : ''}{diffStudyAvg.toLocaleString('fa-IR')} د
                          </span>
                        ) : (
                          <span className="text-slate-300">---</span>
                        )}
                      </td>
                    )}

                    {/* Diff with Discussion Average */}
                    {cols.diffDiscussionAvg && (
                      <td className="px-3 py-3.5 text-center">
                        {metrics.discussionMinutes > 0 ? (
                          <span className={cn(
                            "font-bold text-[11px]",
                            diffDiscAvg >= 0 ? "text-emerald-600" : "text-amber-600"
                          )}>
                            {diffDiscAvg > 0 ? '+' : ''}{diffDiscAvg.toLocaleString('fa-IR')} د
                          </span>
                        ) : (
                          <span className="text-slate-300">---</span>
                        )}
                      </td>
                    )}

                    {/* Status Mandatory */}
                    {cols.statusMandatory && (
                      <td className="px-3 py-3.5 text-center">
                        {metrics.totalMinutes >= mandatoryMinutes && mandatoryMinutes > 0 ? (
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

                    {/* Status Average */}
                    {cols.statusAvg && (
                      <td className="px-3 py-3.5 text-center">
                        {metrics.totalMinutes >= overallAvg.totalAvgMinutes && overallAvg.totalAvgMinutes > 0 ? (
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
              })
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100/80 font-black text-slate-800 text-xs border-t-2 border-slate-200">
              <td colSpan={2 + (cols.grade ? 1 : 0) + (cols.needsFollowUp ? 1 : 0)} className="px-4 py-3.5">
                میانگین دوره (مشارکت: {overallAvg.activeCount} نفر)
              </td>
              {cols.studyMinutes && (displayMode === 'ALL_SPLIT' || displayMode === 'STUDY_ONLY') && (
                <td className="px-3 py-3.5 text-center text-indigo-700 font-black">
                  {overallAvg.studyAvgMinutes.toLocaleString('fa-IR')} د
                </td>
              )}
              {cols.discussionMinutes && (displayMode === 'ALL_SPLIT' || displayMode === 'DISCUSSION_ONLY') && (
                <td className="px-3 py-3.5 text-center text-emerald-700 font-black">
                  {overallAvg.discussionAvgMinutes.toLocaleString('fa-IR')} د
                </td>
              )}
              {cols.totalMinutes && (displayMode === 'ALL_SPLIT' || displayMode === 'TOTAL_ONLY') && (
                <td className="px-3 py-3.5 text-center text-slate-900 font-black">
                  {overallAvg.totalAvgMinutes.toLocaleString('fa-IR')} د
                </td>
              )}
              <td colSpan={
                (cols.diffMandatory ? 1 : 0) +
                (cols.diffAvg ? 1 : 0) +
                (cols.diffStudyAvg ? 1 : 0) +
                (cols.diffDiscussionAvg ? 1 : 0) +
                (cols.statusMandatory ? 1 : 0) +
                (cols.statusAvg ? 1 : 0) || 1
              } className="px-3 py-3.5 text-center text-slate-500 text-[11px] font-bold">
                میزان موظفی این دوره: {mandatoryMinutes.toLocaleString('fa-IR')} دقیقه
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
