import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart2, 
  Plus, 
  Calendar, 
  Clock, 
  TrendingUp, 
  Users, 
  Target, 
  ChevronDown, 
  FileSpreadsheet, 
  Download, 
  Edit3, 
  Trash2, 
  History,
  Layers,
  BookOpen,
  MessageSquare,
  Calculator,
  Sparkles,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { localDb } from '../lib/localDb';
import { Student, StudyPeriod, PeriodicStudyLog } from '../types';
import { useMentor, getStudentMentorKey } from '../context/MentorContext';
import { cn } from '../lib/utils';
import StudyEntryModal from './study/StudyEntryModal';
import RankingModal, { RankingModalData } from './study/RankingModal';
import DeletePeriodModal from './study/DeletePeriodModal';
import PeriodViewTable from './study/PeriodViewTable';
import AllPeriodsTable from './study/AllPeriodsTable';
import StudentBreakoutSection from './study/StudentBreakoutSection';
import DashboardAnalytics from './study/DashboardAnalytics';
import PeriodAnalytics from './study/PeriodAnalytics';
import { calculatePeriodAverages, exportStudyStatsCSV } from './study/studyUtils';

interface StudyStatsProps {
  initialStudentId?: string;
}

export default function StudyStats({ initialStudentId }: StudyStatsProps) {
  const { currentMentor, currentMentorId, shahpooriFilter, filterStudents } = useMentor();
  const [periods, setPeriods] = useState<StudyPeriod[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allLogs, setAllLogs] = useState<PeriodicStudyLog[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId || null);

  // Main table tab: 'PERIOD' (Single period) or 'ALL_PERIODS' (Aggregated all periods)
  const [activeMainTab, setActiveMainTab] = useState<'PERIOD' | 'ALL_PERIODS'>('PERIOD');

  // Period dropdown state
  const [isPeriodDropdownOpen, setIsPeriodDropdownOpen] = useState(false);
  const periodDropdownRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<StudyPeriod | null>(null);
  const [deleteConfirmPeriod, setDeleteConfirmPeriod] = useState<StudyPeriod | null>(null);
  const [rankingModalData, setRankingModalData] = useState<RankingModalData | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target as Node)) {
        setIsPeriodDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    try {
      const allStudents = await localDb.getDocs<Student>('students');
      
      // Filter active students for the current mentor
      const activeStudents = filterStudents(allStudents, true);
      setStudents(activeStudents);

      const allPeriods = await localDb.getDocs<StudyPeriod>('study_periods');
      const mentorPeriods = allPeriods
        .filter(p => {
          if (currentMentorId === 'shahpoori') {
            if (shahpooriFilter === 'all') return true;
            return p.mentorId === shahpooriFilter;
          }
          if (p.mentorId) {
            return p.mentorId === currentMentorId;
          }
          return (p.mentorId || '1') === currentMentor.id;
        })
        .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
      setPeriods(mentorPeriods);

      if (mentorPeriods.length > 0) {
        setSelectedPeriodId(prev => {
          if (prev && mentorPeriods.some(p => p.id === prev)) return prev;
          return mentorPeriods[0].id;
        });
      } else {
        setSelectedPeriodId(null);
      }

      const rawLogs = await localDb.getDocs<PeriodicStudyLog>('periodic_study_logs');
      const validPeriodIds = new Set(mentorPeriods.map(p => p.id));
      const logs = rawLogs.filter(l => validPeriodIds.has(l.periodId));
      setAllLogs(logs);
    } catch (error) {
      console.error("Error fetching study stats data:", error);
    }
  };

  useEffect(() => {
    fetchData();
    const unsub = localDb.subscribe(() => {
      fetchData();
    });
    return () => unsub();
  }, [currentMentor.id, currentMentorId, shahpooriFilter]);

  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
    }
  }, [initialStudentId]);

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId) || periods[0] || null;

  const handleOpenCreatePeriod = () => {
    setEditingPeriod(null);
    setShowEntryModal(true);
  };

  const handleOpenEditPeriod = (period: StudyPeriod) => {
    setEditingPeriod(period);
    setShowEntryModal(true);
  };

  const handleConfirmDeletePeriod = async () => {
    if (!deleteConfirmPeriod) return;
    try {
      await localDb.deleteDoc('study_periods', deleteConfirmPeriod.id);
      
      // Delete associated logs across all logs in database
      const rawLogs = await localDb.getDocs<PeriodicStudyLog>('periodic_study_logs');
      const associatedLogs = rawLogs.filter(l => l.periodId === deleteConfirmPeriod.id);
      for (const log of associatedLogs) {
        await localDb.deleteDoc('periodic_study_logs', log.id);
      }

      setDeleteConfirmPeriod(null);
      if (selectedPeriodId === deleteConfirmPeriod.id) {
        setSelectedPeriodId(null);
      }
      await fetchData();
    } catch (error) {
      console.error("Error deleting period:", error);
      alert("خطا در حذف دوره");
    }
  };

  const selectedPeriodAvg = selectedPeriod 
    ? calculatePeriodAverages(selectedPeriod.id, allLogs) 
    : null;

  return (
    <div className="space-y-8 pb-16" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <BarChart2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">آمار و تحلیل جامع مطالعه و مباحثه</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                ثبت همزمان و تفکیکی دقایق مطالعه و مباحثه، ارزیابی موظفی و مقایسه تراز طلاب
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => exportStudyStatsCSV(periods, allLogs, students)}
            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl flex items-center gap-2 transition-all"
          >
            <Download size={16} />
            <span>خروجی اکسل / CSV</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreatePeriod}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-200"
          >
            <Plus size={18} />
            <span>ثبت دوره مطالعاتی جدید</span>
          </button>
        </div>
      </div>

      {/* Top Analytics Widgets: Statistics across ALL periods */}
      <DashboardAnalytics
        students={students}
        periods={periods}
        allLogs={allLogs}
        onOpenRankingModal={setRankingModalData}
      />

      {/* Main Full-Width Content Area */}
      <div className="space-y-6">
        {/* Main View Tabs (Single Period vs All Periods) */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
          {/* Top Control Bar: Tabs & Dropdown Period Selector */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            {/* View Mode Tabs */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveMainTab('PERIOD')}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2",
                  activeMainTab === 'PERIOD' 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                    : "text-slate-600 hover:text-slate-900 bg-slate-100"
                )}
              >
                <Clock size={15} />
                <span>جدول عملکرد دوره انتخابی</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMainTab('ALL_PERIODS')}
                className={cn(
                  "px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2",
                  activeMainTab === 'ALL_PERIODS' 
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                    : "text-slate-600 hover:text-slate-900 bg-slate-100"
                )}
              >
                <Layers size={15} />
                <span>جدول تجمیعی تمام دوره‌ها ({periods.length})</span>
              </button>
            </div>

            {/* Dropdown Period Selector */}
            {activeMainTab === 'PERIOD' && (
              <div className="flex flex-wrap items-center gap-2.5">
                <div ref={periodDropdownRef} className="relative min-w-[260px]">
                  <button
                    type="button"
                    onClick={() => setIsPeriodDropdownOpen(!isPeriodDropdownOpen)}
                    className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 rounded-2xl text-xs font-black text-slate-800 flex items-center justify-between gap-3 transition-all shadow-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <History size={15} className="text-indigo-600 shrink-0" />
                      <span className="truncate">
                        {selectedPeriod ? selectedPeriod.title : 'انتخاب دوره مطالعاتی...'}
                      </span>
                    </div>
                    <ChevronDown size={15} className={cn("text-slate-400 transition-transform shrink-0", isPeriodDropdownOpen && "rotate-180")} />
                  </button>

                  <AnimatePresence>
                    {isPeriodDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 mt-2 w-80 max-h-80 overflow-y-auto bg-white rounded-2xl border border-slate-200 shadow-2xl p-2 z-50 space-y-1"
                      >
                        <div className="px-3 py-2 text-[11px] font-black text-slate-400 border-b border-slate-100 flex items-center justify-between">
                          <span>لیست دوره‌های مطالعاتی</span>
                          <span>{periods.length} دوره</span>
                        </div>

                        {periods.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400">
                            هیچ دوره‌ای ثبت نشده است
                          </div>
                        ) : (
                          periods.map(period => {
                            const isSelected = selectedPeriod?.id === period.id;
                            const pAvg = calculatePeriodAverages(period.id, allLogs);

                            return (
                              <div
                                key={period.id}
                                onClick={() => {
                                  setSelectedPeriodId(period.id);
                                  setIsPeriodDropdownOpen(false);
                                }}
                                className={cn(
                                  "p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between group",
                                  isSelected ? "bg-indigo-50 text-indigo-900 font-black" : "hover:bg-slate-50 text-slate-700"
                                )}
                              >
                                <div className="space-y-0.5 truncate pr-1">
                                  <div className="flex items-center gap-1.5">
                                    {isSelected && <Check size={14} className="text-indigo-600" />}
                                    <span className="text-xs truncate">{period.title}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 font-medium">
                                    موظفی: {Math.round((period.mandatoryHours || 0) * 60)} د • {pAvg.activeCount} ثبت
                                  </p>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsPeriodDropdownOpen(false);
                                      handleOpenEditPeriod(period);
                                    }}
                                    className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-white"
                                    title="ویرایش"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsPeriodDropdownOpen(false);
                                      setDeleteConfirmPeriod(period);
                                    }}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white"
                                    title="حذف"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {selectedPeriod && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditPeriod(selectedPeriod)}
                      className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                      title="ویرایش این دوره"
                    >
                      <Edit3 size={14} />
                      <span className="hidden sm:inline">ویرایش</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmPeriod(selectedPeriod)}
                      className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                      title="حذف این دوره"
                    >
                      <Trash2 size={14} />
                      <span className="hidden sm:inline">حذف</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Top Period Banner (if single period selected) */}
          {activeMainTab === 'PERIOD' && selectedPeriod && (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200/60">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <h3 className="text-base font-black text-slate-800">{selectedPeriod.title}</h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  بازه زمانی: {selectedPeriod.startDate ? new Date(selectedPeriod.startDate).toLocaleDateString('fa-IR') : '---'} تا {selectedPeriod.endDate ? new Date(selectedPeriod.endDate).toLocaleDateString('fa-IR') : '---'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-slate-800 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-xs">
                  موظفی دوره: {Math.round((selectedPeriod.mandatoryHours || 0) * 60).toLocaleString('fa-IR')} دقیقه
                </span>
                {selectedPeriodAvg && (
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3.5 py-2 rounded-xl border border-indigo-100">
                    میانگین دوره: {selectedPeriodAvg.totalAvgMinutes.toLocaleString('fa-IR')} د (مطالعه: {selectedPeriodAvg.studyAvgMinutes.toLocaleString('fa-IR')} د | مباحثه: {selectedPeriodAvg.discussionAvgMinutes.toLocaleString('fa-IR')} د)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Tab Body */}
          {activeMainTab === 'PERIOD' && selectedPeriod ? (
            <PeriodViewTable
              period={selectedPeriod}
              students={students}
              allLogs={allLogs}
              selectedStudentId={selectedStudentId}
              onSelectStudent={setSelectedStudentId}
            />
          ) : (
            <AllPeriodsTable
              students={students}
              periods={periods}
              allLogs={allLogs}
              selectedStudentId={selectedStudentId}
              onSelectStudent={setSelectedStudentId}
            />
          )}

          {/* Period Specific Analytics - placed under the period table and above the chart! */}
          {activeMainTab === 'PERIOD' && selectedPeriod && (
            <PeriodAnalytics
              period={selectedPeriod}
              students={students}
              allLogs={allLogs}
              onOpenRankingModal={setRankingModalData}
            />
          )}
        </div>

        {/* Student Detailed Breakout & Chart Section */}
        <StudentBreakoutSection
          students={students}
          periods={periods}
          allLogs={allLogs}
          selectedStudentId={selectedStudentId}
          onSelectStudent={setSelectedStudentId}
        />
      </div>

      {/* Entry Modal */}
      <StudyEntryModal
        isOpen={showEntryModal}
        onClose={() => setShowEntryModal(false)}
        editingPeriod={editingPeriod}
        students={students}
        allLogs={allLogs}
        currentMentorId={currentMentor.id}
        onSaveSuccess={fetchData}
      />

      {/* Ranking Modal */}
      <RankingModal
        data={rankingModalData}
        onClose={() => setRankingModalData(null)}
      />

      {/* Delete Confirmation Modal */}
      <DeletePeriodModal
        period={deleteConfirmPeriod}
        onClose={() => setDeleteConfirmPeriod(null)}
        onConfirm={handleConfirmDeletePeriod}
      />
    </div>
  );
}
