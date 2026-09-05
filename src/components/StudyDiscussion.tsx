import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Edit,
  Search,
  BookOpen,
  GraduationCap,
  Download,
  Printer,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Award,
  CheckCircle2,
  X,
  FileText,
  UserCheck,
  UserPlus,
  BarChart2,
  ShieldCheck,
  Info,
  Calendar,
  Layers,
  HelpCircle,
  Clock,
  Activity
} from 'lucide-react';
import { localDb, isStudentActive } from '../lib/localDb';
import { Student, DiscussionGroup, PeriodicStudyLog, StudyStat, StudyPeriod } from '../types';
import { useMentor, MENTORS } from '../context/MentorContext';
import { exportElementToPdf } from '../lib/pdfExport';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface StudyDiscussionProps {
  initialStudentId?: string;
}

export default function StudyDiscussion({ initialStudentId }: StudyDiscussionProps) {
  const { currentMentor, currentMentorId, filterStudents } = useMentor();
  const isManager = currentMentor.isHeadManager || currentMentorId === 'shahpoori';

  // State
  const [groups, setGroups] = useState<DiscussionGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allStudentsList, setAllStudentsList] = useState<Student[]>([]);
  const [periodicLogs, setPeriodicLogs] = useState<PeriodicStudyLog[]>([]);
  const [studyStats, setStudyStats] = useState<StudyStat[]>([]);
  const [studyPeriods, setStudyPeriods] = useState<StudyPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters & Tabs
  const [activeSubTab, setActiveSubTab] = useState<'groups' | 'student_partners' | 'summary_report'>('groups');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudentForView, setSelectedStudentForView] = useState<string>(initialStudentId || '');

  // Modal & Toast State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingGroup, setEditingGroup] = useState<DiscussionGroup | null>(null);
  const [modalGradeFilter, setModalGradeFilter] = useState<string>('all');
  const [modalSearchQuery, setModalSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string>('');

  // Form State
  const [formTitle, setFormTitle] = useState<string>('');
  const [formSubject, setFormSubject] = useState<string>('فقه و اصول');
  const [formGrade, setFormGrade] = useState<string>('پایه ۷');
  const [formMemberStudentIds, setFormMemberStudentIds] = useState<string[]>([]);
  const [formExternalMembers, setFormExternalMembers] = useState<string[]>([]);
  const [externalInput, setExternalInput] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');

  // Export PDF State
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const pdfPrintRef = useRef<HTMLDivElement>(null);
  const compositionPdfRef = useRef<HTMLDivElement>(null);
  const [isExportingCompositionPdf, setIsExportingCompositionPdf] = useState<boolean>(false);

  // Load Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allStudents, allGroups, logs, stats, periods] = await Promise.all([
        localDb.getDocs<Student>('students'),
        localDb.getDocs<DiscussionGroup>('discussion_groups'),
        localDb.getDocs<PeriodicStudyLog>('periodic_study_logs'),
        localDb.getDocs<StudyStat>('study_stats'),
        localDb.getDocs<StudyPeriod>('study_periods')
      ]);

      setAllStudentsList(allStudents);
      const filteredStus = filterStudents(allStudents);
      setStudents(filteredStus);
      setGroups(allGroups);
      setStudyStats(stats);

      const defaultPeriods: StudyPeriod[] = [
        {
          id: 'period_1',
          title: 'دوره ۱: مهر و آبان',
          startDate: '1403/07/01',
          endDate: '1403/08/30',
          mandatoryHours: 80,
          createdAt: new Date().toISOString()
        },
        {
          id: 'period_2',
          title: 'دوره ۲: آذر و دی',
          startDate: '1403/09/01',
          endDate: '1403/10/30',
          mandatoryHours: 85,
          createdAt: new Date().toISOString()
        },
        {
          id: 'period_3',
          title: 'دوره ۳: بهمن و اسفند',
          startDate: '1403/11/01',
          endDate: '1403/12/29',
          mandatoryHours: 90,
          createdAt: new Date().toISOString()
        }
      ];

      const loadedPeriods = periods && periods.length > 0 ? periods : defaultPeriods;
      setStudyPeriods(loadedPeriods);

      // Only include logs for periods that currently exist in studyPeriods
      const validPeriodIds = new Set(loadedPeriods.map(p => p.id));
      const validLogs = (logs || []).filter(l => validPeriodIds.has(l.periodId));
      setPeriodicLogs(validLogs);

      if (!selectedStudentForView) {
        const activeList = allStudents.filter(s => isStudentActive(s));
        if (activeList.length > 0) {
          setSelectedStudentForView(activeList[0].id);
        } else if (filteredStus.length > 0) {
          setSelectedStudentForView(filteredStus[0].id);
        }
      }
    } catch (e) {
      console.error('Error loading discussion data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = localDb.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, [currentMentorId]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingGroup(null);
    setFormTitle('');
    setFormSubject('فقه و اصول');
    const defaultGrade = currentMentor.gradeLabel.includes('۸') ? 'پایه ۸' : currentMentor.gradeLabel.includes('۹') ? 'پایه ۹' : currentMentor.gradeLabel.includes('۱۰') ? 'پایه ۱۰' : 'پایه ۷';
    setFormGrade(defaultGrade);
    setModalGradeFilter('all');
    setModalSearchQuery('');
    setFormMemberStudentIds([]);
    setFormExternalMembers([]);
    setExternalInput('');
    setFormDescription('');
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (group: DiscussionGroup) => {
    setEditingGroup(group);
    setFormTitle(group.title);
    setFormSubject(group.subject || 'فقه و اصول');
    setFormGrade(group.grade || 'پایه ۷');
    setModalGradeFilter('all');
    setModalSearchQuery('');
    setFormMemberStudentIds(group.memberStudentIds || []);
    setFormExternalMembers(group.externalMembers || []);
    setExternalInput('');
    setFormDescription(group.description || '');
    setShowModal(true);
  };

  // Add External Member to Form
  const handleAddExternalMember = () => {
    const trimmed = externalInput.trim();
    if (!trimmed) return;
    if (!formExternalMembers.includes(trimmed)) {
      setFormExternalMembers([...formExternalMembers, trimmed]);
    }
    setExternalInput('');
  };

  // Remove External Member from Form
  const handleRemoveExternalMember = (name: string) => {
    setFormExternalMembers(formExternalMembers.filter(m => m !== name));
  };

  // Save Group (Create / Update)
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    try {
      const now = new Date().toISOString();
      if (editingGroup) {
        const updated: DiscussionGroup = {
          ...editingGroup,
          title: formTitle.trim(),
          subject: formSubject,
          grade: formGrade,
          mentorId: currentMentorId,
          memberStudentIds: formMemberStudentIds,
          externalMembers: formExternalMembers,
          description: formDescription.trim(),
          updatedAt: now
        };
        await localDb.updateDoc('discussion_groups', editingGroup.id, updated);
        setToastMessage('گروه مباحثه با موفقیت ویرایش و بروزرسانی شد.');
      } else {
        const newGroup: DiscussionGroup = {
          id: `group_${Date.now()}`,
          title: formTitle.trim(),
          subject: formSubject,
          grade: formGrade,
          mentorId: currentMentorId,
          memberStudentIds: formMemberStudentIds,
          externalMembers: formExternalMembers,
          description: formDescription.trim(),
          createdAt: now
        };
        await localDb.addDoc('discussion_groups', newGroup);
        setToastMessage('گروه مباحثه جدید با موفقیت ایجاد گردید.');
      }
      setShowModal(false);
      setSelectedGradeFilter('all');
      setSearchQuery('');
      await loadData();
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      console.error('Error saving discussion group:', err);
      alert('خطا در ذخیره‌سازی گروه مباحثه!');
    }
  };

  // Delete Group
  const handleDeleteGroup = async (groupId: string) => {
    try {
      await localDb.deleteDoc('discussion_groups', groupId);
      setToastMessage('گروه مباحثه با موفقیت حذف گردید.');
      await loadData();
      setTimeout(() => setToastMessage(''), 4000);
    } catch (err) {
      console.error('Error deleting group:', err);
    }
  };

  // Helper: Get student metrics (study hours, discussion hours, and combined total)
  const getStudentMetrics = (studentId: string, periodIdOverride?: string) => {
    const targetPeriodId = periodIdOverride !== undefined ? periodIdOverride : selectedPeriodId;

    let logs = periodicLogs.filter(l => l.studentId === studentId);
    if (targetPeriodId !== 'all') {
      logs = logs.filter(l => l.periodId === targetPeriodId);
    }

    let study = 0;
    let discussion = 0;

    if (logs.length > 0) {
      logs.forEach(l => {
        const sHours = l.studyHours !== undefined ? (Number(l.studyHours) || 0) : (Number(l.hours) || 0);
        const dHours = l.discussionHours !== undefined ? (Number(l.discussionHours) || 0) : 0;
        study += sHours;
        discussion += dHours;
      });
    } else if (targetPeriodId === 'all') {
      const stats = studyStats.filter(s => s.studentId === studentId);
      if (stats.length > 0) {
        study = stats.reduce((sum, s) => sum + (Number(s.studyHours) || 0), 0);
        discussion = stats.reduce((sum, s) => sum + (Number(s.discussionHours) || 0), 0);
      }
    }

    const studyHours = Math.round(study * 10) / 10;
    const discussionHours = Math.round(discussion * 10) / 10;
    const totalHours = Math.round((studyHours + discussionHours) * 10) / 10;

    return {
      studyHours,
      discussionHours,
      totalHours
    };
  };

  // Legacy compatibility helper
  const getStudentStudyHours = (studentId: string): number => {
    return getStudentMetrics(studentId).totalHours;
  };

  // Helper: Calculate Group Stats
  const calculateGroupStats = (group: DiscussionGroup) => {
    const activeMembers = allStudentsList.filter(s => group.memberStudentIds.includes(s.id) && isStudentActive(s));
    const memberCount = activeMembers.length;

    let totalStudyHours = 0;
    let totalDiscussionHours = 0;

    activeMembers.forEach(s => {
      const m = getStudentMetrics(s.id);
      totalStudyHours += m.studyHours;
      totalDiscussionHours += m.discussionHours;
    });

    totalStudyHours = Math.round(totalStudyHours * 10) / 10;
    totalDiscussionHours = Math.round(totalDiscussionHours * 10) / 10;
    const totalCombinedHours = Math.round((totalStudyHours + totalDiscussionHours) * 10) / 10;

    const avgStudyHours = memberCount > 0 ? Math.round((totalStudyHours / memberCount) * 10) / 10 : 0;
    const avgDiscussionHours = memberCount > 0 ? Math.round((totalDiscussionHours / memberCount) * 10) / 10 : 0;
    const avgCombinedHours = memberCount > 0 ? Math.round((totalCombinedHours / memberCount) * 10) / 10 : 0;

    const totalMembersCount = memberCount + (group.externalMembers?.length || 0);

    return {
      activeMembers,
      totalHours: totalCombinedHours,
      avgHours: avgCombinedHours,
      totalStudyHours,
      totalDiscussionHours,
      totalCombinedHours,
      avgStudyHours,
      avgDiscussionHours,
      avgCombinedHours,
      memberCount,
      totalMembersCount
    };
  };

  // Filter Groups List
  const filteredGroups = groups.filter(g => {
    if (selectedGradeFilter !== 'all' && g.grade !== selectedGradeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const titleMatch = g.title.toLowerCase().includes(q);
      const subjectMatch = g.subject?.toLowerCase().includes(q);
      const memberNames = allStudentsList.filter(s => g.memberStudentIds.includes(s.id)).map(s => s.name.toLowerCase());
      const studentMatch = memberNames.some(n => n.includes(q));
      const externalMatch = g.externalMembers?.some(m => m.toLowerCase().includes(q));
      return titleMatch || subjectMatch || studentMatch || externalMatch;
    }
    return true;
  });

  // Calculate Student Discussion Partners Analysis
  const getStudentDiscussionAnalysis = (studentId: string) => {
    const student = allStudentsList.find(s => s.id === studentId) || students.find(s => s.id === studentId);
    if (!student) return null;

    // Groups student belongs to
    const studentGroups = groups.filter(g => g.memberStudentIds.includes(studentId));

    // Collect all partner student IDs and external partners
    const partnerStudentIdsSet = new Set<string>();
    const externalPartnersSet = new Set<string>();

    studentGroups.forEach(g => {
      g.memberStudentIds.forEach(id => {
        if (id !== studentId) partnerStudentIdsSet.add(id);
      });
      g.externalMembers?.forEach(ext => externalPartnersSet.add(ext));
    });

    const partnerStudents = allStudentsList.filter(s => partnerStudentIdsSet.has(s.id) && isStudentActive(s));
    const externalPartners = Array.from(externalPartnersSet);

    // Student metrics
    const studentMetrics = getStudentMetrics(studentId);

    // Partners average study & discussion hours
    let partnersStudySum = 0;
    let partnersDiscussionSum = 0;
    let partnersTotalSum = 0;

    partnerStudents.forEach(p => {
      const pm = getStudentMetrics(p.id);
      partnersStudySum += pm.studyHours;
      partnersDiscussionSum += pm.discussionHours;
      partnersTotalSum += pm.totalHours;
    });

    const pCount = partnerStudents.length;
    const partnersAvgStudy = pCount > 0 ? Math.round((partnersStudySum / pCount) * 10) / 10 : 0;
    const partnersAvgDiscussion = pCount > 0 ? Math.round((partnersDiscussionSum / pCount) * 10) / 10 : 0;
    const partnersAvgTotal = pCount > 0 ? Math.round((partnersTotalSum / pCount) * 10) / 10 : 0;

    const diffStudy = Math.round((studentMetrics.studyHours - partnersAvgStudy) * 10) / 10;
    const diffDiscussion = Math.round((studentMetrics.discussionHours - partnersAvgDiscussion) * 10) / 10;
    const diffTotal = Math.round((studentMetrics.totalHours - partnersAvgTotal) * 10) / 10;

    const totalStatus: 'more' | 'less' | 'equal' = diffTotal > 0.5 ? 'more' : diffTotal < -0.5 ? 'less' : 'equal';
    const studyStatus: 'more' | 'less' | 'equal' = diffStudy > 0.5 ? 'more' : diffStudy < -0.5 ? 'less' : 'equal';

    return {
      student,
      studentGroups,
      partnerStudents,
      externalPartners,
      studentMetrics,
      partnersAvgStudy,
      partnersAvgDiscussion,
      partnersAvgTotal,
      diffStudy,
      diffDiscussion,
      diffTotal,
      totalStatus,
      studyStatus,
      // legacy field mappings
      studentHours: studentMetrics.totalHours,
      partnersAvgHours: partnersAvgTotal,
      diff: diffTotal,
      status: totalStatus
    };
  };

  // Selected Student Analysis Data
  const selectedStudentAnalysis = selectedStudentForView ? getStudentDiscussionAnalysis(selectedStudentForView) : null;

  // Handle Export PDF
  const handleExportGroupsPdf = async () => {
    if (!pdfPrintRef.current) return;
    setIsExportingPdf(true);
    try {
      await exportElementToPdf({
        element: pdfPrintRef.current,
        filename: `گزارش_عملکرد_گروه‌های_مباحثه_${new Date().toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-')}.pdf`,
        orientation: 'portrait',
        marginMM: 8
      });
    } catch (err) {
      console.error('PDF Export Error:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Handle Export Composition PDF (Group members and co-discussion partners)
  const handleExportCompositionPdf = async () => {
    if (!compositionPdfRef.current) return;
    setIsExportingCompositionPdf(true);
    try {
      await exportElementToPdf({
        element: compositionPdfRef.current,
        filename: `گزارش_ترکیب_گروه‌های_مباحثه_${new Date().toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-')}.pdf`,
        orientation: 'portrait',
        marginMM: 8
      });
    } catch (err) {
      console.error('Composition PDF Export Error:', err);
    } finally {
      setIsExportingCompositionPdf(false);
    }
  };

  // Active students available for modal selection
  const availableStudentsForModal = allStudentsList.filter(s => {
    // 1. Must be active student
    if (!isStudentActive(s)) return false;

    // 2. Grade filter if modalGradeFilter is active
    if (modalGradeFilter !== 'all') {
      const sGrade = s.grade || 'پایه ۷';
      const normS = sGrade.replace(/[77۷]/g, '۷').replace(/[88۸]/g, '۸').replace(/[99۹]/g, '۹');
      const normT = modalGradeFilter.replace(/[77۷]/g, '۷').replace(/[88۸]/g, '۸').replace(/[99۹]/g, '۹');

      if (normT.includes('۷') && !normS.includes('۷')) return false;
      if (normT.includes('۸') && !normS.includes('۸')) return false;
      if (normT.includes('۹') && !normS.includes('۹')) return false;
    }

    // 3. Search filter
    if (modalSearchQuery.trim()) {
      const q = modalSearchQuery.trim().toLowerCase();
      const nameMatch = s.name.toLowerCase().includes(q);
      const phoneMatch = s.phoneNumber?.includes(q);
      const nationalMatch = s.nationalId?.includes(q);
      return nameMatch || phoneMatch || nationalMatch;
    }

    return true;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-vazir" dir="rtl">

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="p-4 bg-emerald-600 text-white font-bold text-sm rounded-2xl shadow-lg flex items-center justify-between transition-all animate-bounce">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={20} />
            <span>{toastMessage}</span>
          </div>
          <button 
            onClick={() => setToastMessage('')}
            className="text-xs bg-emerald-700 hover:bg-emerald-800 px-2.5 py-1 rounded-lg"
          >
            بستن
          </button>
        </div>
      )}
      
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 backdrop-blur-md border border-indigo-400/30 flex items-center justify-center text-indigo-200 shrink-0">
                <Users size={26} />
              </div>
              <div>
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest">سامانه مدیریت علمی</span>
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">بخش گروه‌های مباحثه</h1>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-indigo-200/90 leading-relaxed max-w-2xl font-medium">
              تعیین هم‌مباحثه‌ای‌های طلاب، مدیریت گروه‌های درسی پایه، تحلیل ساعات مطالعه و مقایسه عملکرد علمی گروه‌های مباحثاتی
            </p>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleOpenCreateModal}
              className="px-5 py-3 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              <Plus size={18} />
              <span>تعریف گروه مباحثه جدید</span>
            </button>

            <button
              onClick={handleExportCompositionPdf}
              disabled={isExportingCompositionPdf || groups.length === 0}
              className="px-4 py-3 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 rounded-2xl"
              title="خروجی PDF اعضای گروه‌های بحثی و هم‌بحث‌ها به تفکیک عنوان هر گروه"
            >
              {isExportingCompositionPdf ? <Activity size={18} className="animate-spin" /> : <FileText size={18} />}
              <span>خروجی PDF ترکیب گروه‌ها و هم‌بحث‌ها</span>
            </button>

            <button
              onClick={handleExportGroupsPdf}
              disabled={isExportingPdf || groups.length === 0}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/20 text-white rounded-2xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all backdrop-blur-md disabled:opacity-50"
              title="خروجی PDF خلاصه آمار و ساعات مطالعه و مباحثه"
            >
              {isExportingPdf ? <Activity size={18} className="animate-spin" /> : <Printer size={18} />}
              <span>خروجی PDF آمار عملکرد</span>
            </button>
          </div>
        </div>

        {/* Top Summary Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-indigo-700/50">
          <div className="bg-indigo-950/40 border border-indigo-700/40 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold">
              <Layers size={20} />
            </div>
            <div>
              <span className="text-[11px] text-indigo-200 font-medium block">تعداد گروه‌ها</span>
              <span className="text-lg font-black text-white">{groups.length} گروه</span>
            </div>
          </div>

          <div className="bg-indigo-950/40 border border-indigo-700/40 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold">
              <UserCheck size={20} />
            </div>
            <div>
              <span className="text-[11px] text-indigo-200 font-medium block">طلاب فعال عضو</span>
              <span className="text-lg font-black text-white">
                {new Set(groups.flatMap(g => g.memberStudentIds)).size} نفر
              </span>
            </div>
          </div>

          <div className="bg-indigo-950/40 border border-indigo-700/40 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold">
              <UserPlus size={20} />
            </div>
            <div>
              <span className="text-[11px] text-indigo-200 font-medium block">هم‌بحثی‌های خارج (سایر)</span>
              <span className="text-lg font-black text-white">
                {groups.reduce((sum, g) => sum + (g.externalMembers?.length || 0), 0)} نفر
              </span>
            </div>
          </div>

          <div className="bg-indigo-950/40 border border-indigo-700/40 rounded-2xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold">
              <Clock size={20} />
            </div>
            <div>
              <span className="text-[11px] text-indigo-200 font-medium block">میانگین مطالعه گروه‌ها</span>
              <span className="text-lg font-black text-white">
                {groups.length > 0 
                  ? Math.round(groups.reduce((sum, g) => sum + calculateGroupStats(g).avgHours, 0) / groups.length) 
                  : 0} ساعت
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PERIOD SELECTOR BANNER */}
      <div className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
            <Calendar size={20} />
          </div>
          <div>
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <span>مبنای زمان‌بندی ارزیابی (دوره ثبت مطالعه و مباحثه):</span>
              {selectedPeriodId === 'all' ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
                  📊 آمار کل و تجمیعی
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  🗓️ بررسی بر اساس دوره خاص
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {selectedPeriodId === 'all'
                ? 'در این حالت تمامی آمار و گزارش‌ها بر اساس مجموع عملکرد کل دوره‌ها سنجیده می‌شوند.'
                : `در حال بررسی داده‌ها و گزارش‌های اختصاصی مربوط به: ${studyPeriods.find(p => p.id === selectedPeriodId)?.title || 'دوره انتخاب شده'}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <span className="text-xs font-bold text-slate-600 whitespace-nowrap hidden sm:inline">انتخاب بازه/دوره:</span>
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="w-full md:w-72 px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-black text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer shadow-sm"
          >
            <option value="all">📊 آمار کل و تجمیعی (تمام دوره‌ها)</option>
            {studyPeriods.map(period => (
              <option key={period.id} value={period.id}>
                🗓️ {period.title} ({period.startDate || ''} تا {period.endDate || ''})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SUB-TABS NAVIGATION */}
      <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveSubTab('groups')}
            className={cn(
              "flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2",
              activeSubTab === 'groups'
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            )}
          >
            <Layers size={16} />
            <span>گروه‌های مباحثه ({filteredGroups.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('student_partners')}
            className={cn(
              "flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2",
              activeSubTab === 'student_partners'
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            )}
          >
            <Sparkles size={16} />
            <span>هم‌مباحثه‌ای‌های یک فرد</span>
          </button>

          <button
            onClick={() => setActiveSubTab('summary_report')}
            className={cn(
              "flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2",
              activeSubTab === 'summary_report'
                ? "bg-indigo-600 text-white shadow-md"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            )}
          >
            <FileText size={16} />
            <span>گزارش و جمع‌بندی جامع (مطالعه + مباحثه)</span>
          </button>
        </div>

        {/* Filters */}
        {activeSubTab === 'groups' && (
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Grade Filter */}
            <select
              value={selectedGradeFilter}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">همه پایه‌ها</option>
              <option value="پایه ۷">پایه ۷</option>
              <option value="پایه ۸">پایه ۸</option>
              <option value="پایه ۹">پایه ۹</option>
              <option value="پایه ۱۰">پایه ۱۰</option>
            </select>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی گروه، نام طلبه..."
                className="w-full pr-8 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={handleExportCompositionPdf}
              disabled={isExportingCompositionPdf || groups.length === 0}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
              title="خروجی PDF ترکیب اعضا و هم‌بحث‌ها به تفکیک عنوان گروه‌ها"
            >
              {isExportingCompositionPdf ? <Activity size={14} className="animate-spin" /> : <Printer size={14} />}
              <span>PDF ترکیب اعضا</span>
            </button>
          </div>
        )}
      </div>

      {/* VIEW 1: GROUPS LIST VIEW */}
      {activeSubTab === 'groups' && (
        <div className="space-y-6">
          {filteredGroups.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-500 mx-auto flex items-center justify-center">
                <Users size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-800">هیچ گروه مباحثه‌ای یافت نشد</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  شما می‌توانید با زدن دکمه «تعریف گروه مباحثه جدید» اولین گروه هم‌بحثی را تعریف و اعضای آن را مشخص کنید.
                </p>
              </div>
              <button
                onClick={handleOpenCreateModal}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs inline-flex items-center gap-2 transition-all shadow-sm"
              >
                <Plus size={16} />
                <span>تعریف گروه مباحثه</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredGroups.map((group) => {
                const stats = calculateGroupStats(group);
                return (
                  <div
                    key={group.id}
                    className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                  >
                    {/* Card Header */}
                    <div className="p-5 border-b border-slate-100 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-black px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 inline-block mb-1">
                            {group.grade || 'پایه عمومی'}
                          </span>
                          <h3 className="text-base font-black text-slate-800 group-hover:text-indigo-600 transition-colors">
                            {group.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenEditModal(group)}
                            className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-indigo-600 rounded-xl transition-all"
                            title="ویرایش گروه"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteGroup(group.id)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all"
                            title="حذف گروه"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {group.subject && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                          <BookOpen size={14} className="text-indigo-500 shrink-0" />
                          <span>موضوع مباحثه: {group.subject}</span>
                        </div>
                      )}

                      {group.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          {group.description}
                        </p>
                      )}
                    </div>

                    {/* Members List */}
                    <div className="p-5 space-y-3 flex-1">
                      <div className="flex items-center justify-between text-xs font-black text-slate-700">
                        <span>اعضای گروه ({stats.totalMembersCount} نفر):</span>
                        <span className="text-[11px] text-indigo-600 font-bold">
                          میانگین مطالعه: {stats.avgHours} ساعت
                        </span>
                      </div>

                      {/* Active Students in Group */}
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {stats.activeMembers.map((s) => {
                          const stuHours = getStudentStudyHours(s.id);
                          return (
                            <div
                              key={s.id}
                              className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-indigo-50/50 transition-colors border border-slate-100 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-[11px] flex items-center justify-center shrink-0">
                                  {s.name[0]}
                                </div>
                                <span className="font-bold text-slate-800 truncate">{s.name}</span>
                              </div>
                              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md shrink-0">
                                {stuHours} ساعت
                              </span>
                            </div>
                          );
                        })}

                        {/* External Members in Group */}
                        {group.externalMembers?.map((extName, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-xl bg-amber-50/60 border border-amber-200/60 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] font-black px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded shrink-0">
                                سایر
                              </span>
                              <span className="font-bold text-amber-900 truncate">{extName}</span>
                            </div>
                            <span className="text-[10px] text-amber-700 font-medium">خارج از مدرسه</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Card Footer Bar */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
                      <span>طلاب مدرسه: {stats.memberCount} نفر</span>
                      <span>سایر: {group.externalMembers?.length || 0} نفر</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: INDIVIDUAL STUDENT PARTNERS ANALYSIS */}
      {activeSubTab === 'student_partners' && (
        <div className="space-y-6">
          {/* Student Selector Dropdown Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <UserCheck size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">انتخاب طلبه جهت مشاهده هم‌بحثی‌ها</h3>
                  <p className="text-xs text-slate-500">مشاهده تحلیل هم‌مباحثه‌ای‌ها و مقایسه ساعات مطالعه</p>
                </div>
              </div>

              <select
                value={selectedStudentForView}
                onChange={(e) => setSelectedStudentForView(e.target.value)}
                className="w-full sm:w-72 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {(allStudentsList.length > 0 ? allStudentsList.filter(s => isStudentActive(s)) : students).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.grade || 'پایه ۷'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Student Partners Analysis Card */}
          {selectedStudentAnalysis ? (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
                
                {/* Profile Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-black text-xl flex items-center justify-center shadow-md">
                      {selectedStudentAnalysis.student.name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-black text-slate-800">{selectedStudentAnalysis.student.name}</h2>
                        <span className="text-xs font-bold px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                          {selectedStudentAnalysis.student.grade || 'پایه ۷'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        عضو در {selectedStudentAnalysis.studentGroups.length} گروه مباحثاتی
                      </p>
                    </div>
                  </div>

                  {/* Comparative Hours Badges (Study, Discussion, Combined) */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                      <span className="text-[11px] text-slate-500 block font-bold">میزان مطالعه فردی</span>
                      <span className="text-lg font-black text-slate-800">{selectedStudentAnalysis.studentMetrics.studyHours} ساعت</span>
                      <span className="text-[10px] text-slate-400 block font-medium mt-0.5">میانگین هم‌بحثی‌ها: {selectedStudentAnalysis.partnersAvgStudy} ساعت</span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                      <span className="text-[11px] text-indigo-700 block font-bold">ساعات مباحثه درسی</span>
                      <span className="text-lg font-black text-indigo-600">{selectedStudentAnalysis.studentMetrics.discussionHours} ساعت</span>
                      <span className="text-[10px] text-indigo-400 block font-medium mt-0.5">میانگین هم‌بحثی‌ها: {selectedStudentAnalysis.partnersAvgDiscussion} ساعت</span>
                    </div>

                    <div className="bg-indigo-900 text-white p-3 rounded-xl shadow-sm">
                      <span className="text-[11px] text-indigo-200 block font-black">مجموع (مطالعه + مباحثه)</span>
                      <span className="text-xl font-black text-white">{selectedStudentAnalysis.studentMetrics.totalHours} ساعت</span>
                      <span className="text-[10px] text-indigo-300 block font-bold mt-0.5">میانگین مجموع: {selectedStudentAnalysis.partnersAvgTotal} ساعت</span>
                    </div>
                  </div>
                </div>

                {/* AI Comparative Status Banner */}
                <div className={cn(
                  "p-5 rounded-2xl border flex items-start gap-4",
                  selectedStudentAnalysis.totalStatus === 'more'
                    ? "bg-emerald-50/80 border-emerald-200 text-emerald-900"
                    : selectedStudentAnalysis.totalStatus === 'less'
                    ? "bg-rose-50/80 border-rose-200 text-rose-900"
                    : "bg-sky-50/80 border-sky-200 text-sky-900"
                )}>
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0",
                    selectedStudentAnalysis.totalStatus === 'more' ? "bg-emerald-500 text-white" :
                    selectedStudentAnalysis.totalStatus === 'less' ? "bg-rose-500 text-white" : "bg-sky-500 text-white"
                  )}>
                    {selectedStudentAnalysis.totalStatus === 'more' ? <TrendingUp size={20} /> :
                     selectedStudentAnalysis.totalStatus === 'less' ? <TrendingDown size={20} /> : <Activity size={20} />}
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-sm font-black">
                      {selectedStudentAnalysis.totalStatus === 'more' && `مجموع مطالعه و مباحثه بالاتر از هم‌مباحثه‌ای‌ها (+${selectedStudentAnalysis.diffTotal} ساعت)`}
                      {selectedStudentAnalysis.totalStatus === 'less' && `مجموع مطالعه و مباحثه پایین‌تر از هم‌مباحثه‌ای‌ها (${selectedStudentAnalysis.diffTotal} ساعت)`}
                      {selectedStudentAnalysis.totalStatus === 'equal' && `مجموع فعالیت علمی هم‌سطح با میانگین هم‌مباحثه‌ای‌ها`}
                    </h4>
                    <p className="text-xs leading-relaxed opacity-90">
                      {selectedStudentAnalysis.student.name} دارای <strong>{selectedStudentAnalysis.studentMetrics.studyHours} ساعت مطالعه فردی</strong> و <strong>{selectedStudentAnalysis.studentMetrics.discussionHours} ساعت مباحثه درسی</strong> می‌باشد (مجموع {selectedStudentAnalysis.studentMetrics.totalHours} ساعت).
                      {selectedStudentAnalysis.totalStatus === 'more' && ` مجموع عملکرد علمی وی ${selectedStudentAnalysis.diffTotal} ساعت بیشتر از میانگین هم‌بحثی‌هایش است و نقشی پیشتاز در گروه‌های مباحثه ایفا می‌کند.`}
                      {selectedStudentAnalysis.totalStatus === 'less' && ` مجموع عملکرد علمی وی ${Math.abs(selectedStudentAnalysis.diffTotal)} ساعت کمتر از میانگین هم‌بحثی‌ها است. پیشنهاد می‌شود استاد ناظر انگیزه‌بخشی بیشتری جهت مباحثه فعال داشته باشد.`}
                      {selectedStudentAnalysis.totalStatus === 'equal' && ` مجموع عملکرد علمی وی کاملاً پایاپای با هم‌بحثی‌ها پیش می‌رود.`}
                    </p>
                  </div>
                </div>

                {/* Discussion Partners Grouped By Group Title */}
                <div className="space-y-6 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                    <h3 className="text-sm font-black text-slate-800">
                      تفکیک هم‌بحث‌های {selectedStudentAnalysis.student.name} به تفکیک عنوان گروه‌های مباحثه:
                    </h3>
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 self-start sm:self-auto">
                      حضور در {selectedStudentAnalysis.studentGroups.length} گروه مباحثاتی
                    </span>
                  </div>

                  {selectedStudentAnalysis.studentGroups.length === 0 ? (
                    <div className="p-4 bg-slate-50 text-slate-500 rounded-2xl text-xs text-center italic">
                      این طلبه هنوز در هیچ گروه مباحثاتی عضو نشده است.
                    </div>
                  ) : (
                    selectedStudentAnalysis.studentGroups.map((group) => {
                      const groupActivePartners = allStudentsList.filter(
                        (s) => group.memberStudentIds.includes(s.id) && s.id !== selectedStudentAnalysis.student.id && isStudentActive(s)
                      );
                      const groupExternalPartners = group.externalMembers || [];

                      return (
                        <div key={group.id} className="bg-slate-50/80 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3.5">
                          {/* Group Header Banner */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                                گروه
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-black text-indigo-950">
                                    {group.title}
                                  </h4>
                                  {group.subject && (
                                    <span className="text-xs text-slate-600 font-bold">
                                      ({group.subject})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {group.grade && (
                                <span className="text-[10px] font-bold px-2 py-0.5 bg-white text-slate-700 rounded-md border border-slate-200">
                                  {group.grade}
                                </span>
                              )}
                              <span className="text-[10px] font-bold px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-md border border-indigo-200">
                                {groupActivePartners.length + groupExternalPartners.length} هم‌بحث در این گروه
                              </span>
                            </div>
                          </div>

                          {/* Partners Grid for THIS Group */}
                          {groupActivePartners.length === 0 && groupExternalPartners.length === 0 ? (
                            <p className="text-xs text-slate-400 italic p-2">عضو دیگری در این گروه ثبت نشده است.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {/* Internal Student Partners in this group */}
                              {groupActivePartners.map((partner) => {
                                const pMetrics = getStudentMetrics(partner.id);
                                const sharedGroups = selectedStudentAnalysis.studentGroups.filter((g) =>
                                  g.memberStudentIds.includes(partner.id)
                                );

                                return (
                                  <div key={partner.id} className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                                          {partner.name[0]}
                                        </div>
                                        <div>
                                          <h5 className="text-xs font-black text-slate-900">{partner.name}</h5>
                                          <span className="text-[10px] text-slate-500 font-medium">طلبه {partner.grade || 'پایه ۷'}</span>
                                        </div>
                                      </div>
                                      <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                        مجموع: {pMetrics.totalHours}س
                                      </span>
                                    </div>

                                    {sharedGroups.length > 1 && (
                                      <div className="text-[10px] font-bold text-amber-900 bg-amber-50/90 px-2 py-0.5 rounded border border-amber-200/80">
                                        هم‌بحث مشترک در {sharedGroups.length} گروه ({sharedGroups.map((g) => g.title).join('، ')})
                                      </div>
                                    )}

                                    <div className="flex items-center justify-between text-[10px] text-slate-600 pt-1.5 border-t border-slate-100 font-bold">
                                      <span>مطالعه: {pMetrics.studyHours} ساعت</span>
                                      <span>مباحثه: {pMetrics.discussionHours} ساعت</span>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* External Members in this group */}
                              {groupExternalPartners.map((ext, idx) => (
                                <div key={idx} className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200/80 flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                    <span className="text-[10px] font-black px-2 py-0.5 bg-amber-200 text-amber-900 rounded-md shrink-0">
                                      سایر
                                    </span>
                                    <div>
                                      <h5 className="text-xs font-black text-amber-900">{ext}</h5>
                                      <span className="text-[10px] text-amber-700 font-medium">هم‌بحثی خارج از مدرسه (در {group.title})</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-8 text-center text-slate-400 text-xs">
              لطفاً یک طلبه را جهت مشاهده هم‌بحثی‌ها انتخاب کنید.
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: FULL SUMMARY REPORT (گزارش و جمع‌بندی جامع مطالعه + مباحثه) */}
      {activeSubTab === 'summary_report' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                  <FileText size={26} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-800">گزارش جمع‌بندی جامع عملکرد علمی (مطالعه + مباحثه)</h2>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedPeriodId === 'all' 
                      ? 'بازه ارزیابی: آمار کل و تجمیعی (تمام دوره‌ها)' 
                      : `بازه ارزیابی: ${studyPeriods.find(p => p.id === selectedPeriodId)?.title || 'دوره انتخاب شده'}`}
                  </p>
                </div>
              </div>

              <button
                onClick={handleExportGroupsPdf}
                disabled={isExportingPdf}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs flex items-center gap-2 transition-all shadow-sm shrink-0 self-start sm:self-auto"
              >
                <Printer size={16} />
                <span>چاپ پی‌دی‌اف این گزارش</span>
              </button>
            </div>

            {/* Overall System Metrics Badges */}
            {(() => {
              const activeStus = allStudentsList.filter(s => isStudentActive(s));
              let totalSystemStudy = 0;
              let totalSystemDiscussion = 0;

              activeStus.forEach(s => {
                const m = getStudentMetrics(s.id);
                totalSystemStudy += m.studyHours;
                totalSystemDiscussion += m.discussionHours;
              });

              totalSystemStudy = Math.round(totalSystemStudy * 10) / 10;
              totalSystemDiscussion = Math.round(totalSystemDiscussion * 10) / 10;
              const totalSystemCombined = Math.round((totalSystemStudy + totalSystemDiscussion) * 10) / 10;
              const avgPerStudent = activeStus.length > 0 ? Math.round((totalSystemCombined / activeStus.length) * 10) / 10 : 0;

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                    <span className="text-[11px] text-slate-500 font-bold block">مجموع مطالعه فردی حوزه</span>
                    <span className="text-xl font-black text-slate-800">{totalSystemStudy} ساعت</span>
                  </div>

                  <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-1">
                    <span className="text-[11px] text-indigo-700 font-bold block">مجموع مباحثات درسی</span>
                    <span className="text-xl font-black text-indigo-700">{totalSystemDiscussion} ساعت</span>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl space-y-1 shadow-md">
                    <span className="text-[11px] text-indigo-200 font-bold block">مجموع کل (مطالعه + مباحثه)</span>
                    <span className="text-2xl font-black text-white">{totalSystemCombined} ساعت</span>
                  </div>

                  <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-1">
                    <span className="text-[11px] text-emerald-800 font-bold block">سرانه متوسط هر طلبه</span>
                    <span className="text-xl font-black text-emerald-700">{avgPerStudent} ساعت</span>
                  </div>
                </div>
              );
            })()}

            {/* Students Detailed Summary Table */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Award size={18} className="text-indigo-600" />
                <span>جدول جمع‌بندی عملکرد تمام طلاب به تفکیک مطالعه و مباحثه:</span>
              </h3>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                      <th className="py-3 px-4">نام و نام خانوادگی</th>
                      <th className="py-3 px-4">پایه تحصیلی</th>
                      <th className="py-3 px-4">گروه‌های مباحثه</th>
                      <th className="py-3 px-4">میزان مطالعه فردی</th>
                      <th className="py-3 px-4">ساعات مباحثه</th>
                      <th className="py-3 px-4 bg-indigo-50 text-indigo-950 font-black">مجموع (مطالعه + مباحثه)</th>
                      <th className="py-3 px-4">وضعیت عملکرد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {allStudentsList.filter(s => isStudentActive(s)).map((stu) => {
                      const m = getStudentMetrics(stu.id);
                      const stuGroups = groups.filter(g => g.memberStudentIds.includes(stu.id));
                      const groupTitles = stuGroups.map(g => g.title).join('، ') || 'بدون گروه';
                      const status = m.totalHours >= 80 ? 'عالی' : m.totalHours >= 50 ? 'خوب' : 'متوسط';

                      return (
                        <tr key={stu.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-black text-slate-800">{stu.name}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-600">{stu.grade || 'پایه ۷'}</td>
                          <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">{groupTitles}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-700">{m.studyHours} ساعت</td>
                          <td className="py-3.5 px-4 font-bold text-indigo-600">{m.discussionHours} ساعت</td>
                          <td className="py-3.5 px-4 font-black text-indigo-950 bg-indigo-50/50">
                            <span className="text-sm">{m.totalHours} ساعت</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-[10px] font-black inline-block",
                              status === 'عالی' ? "bg-emerald-100 text-emerald-800" :
                              status === 'خوب' ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"
                            )}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Executive Summary Narrative */}
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 space-y-2 text-indigo-950">
              <h4 className="text-xs font-black flex items-center gap-2 text-indigo-900">
                <Info size={16} />
                <span>جمع‌بندی تحلیلی استاد ناظر و مدیریت علمی:</span>
              </h4>
              <p className="text-xs leading-relaxed opacity-90">
                گزارش فوق نشان‌دهنده هم‌افزایی بالا میان ساعات مطالعه فردی و جلسات مباحثه گروهی طلاب است. مقایسه مجموع (مطالعه + مباحثه) این امکان را برای مسئولان فراهم می‌سازد تا علاوه بر سنجش انفرادی، میزان تعامل و هم‌بحثی‌های فعال علمی را نیز به‌طور دقیق ارزیابی نمایند.
              </p>
            </div>

          </div>
        </div>
      )}

      {/* SECTION 3: BOTTOM GROUP COMPARISON & GROUP STUDY STATUS TABLE */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shrink-0">
              <BarChart2 size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">جدول مقایسه‌ای مجموع (مطالعه + مباحثه) گروه‌ها</h2>
              <p className="text-xs text-slate-500">
                بررسی و مقایسه تفکیکی ساعات مطالعه فردی، مباحثه گروهی و مجموع کل فعالیت علمی
              </p>
            </div>
          </div>
        </div>

        {/* Groups Comparison Table */}
        {groups.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">گروهی جهت مقایسه ثبت نشده است.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                  <th className="py-3.5 px-4 rounded-r-xl">عنوان گروه مباحثه</th>
                  <th className="py-3.5 px-4">پایه تحصیلی</th>
                  <th className="py-3.5 px-4">تعداد اعضا</th>
                  <th className="py-3.5 px-4">میزان مطالعه (مجموع / میانگین)</th>
                  <th className="py-3.5 px-4">ساعات مباحثه (مجموع / میانگین)</th>
                  <th className="py-3.5 px-4 bg-indigo-50/50 text-indigo-900 font-black">مجموع (مطالعه + مباحثه)</th>
                  <th className="py-3.5 px-4 rounded-l-xl">ارزیابی عملکرد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {groups.map((g) => {
                  const stats = calculateGroupStats(g);
                  const statusLevel = stats.avgCombinedHours >= 80 ? 'ممتاز' : stats.avgCombinedHours >= 50 ? 'خوب' : 'متوسط';

                  return (
                    <tr key={g.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 font-black text-slate-800">
                        <div>{g.title}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{g.subject || 'فقه و اصول'}</div>
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-600">{g.grade || 'پایه عمومی'}</td>
                      <td className="py-4 px-4 font-bold text-slate-800">
                        {stats.memberCount} طلبه + {g.externalMembers?.length || 0} سایر
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-700">
                        <span>{stats.totalStudyHours}س</span>
                        <span className="text-[10px] text-slate-400 block font-normal">({stats.avgStudyHours}س/نفر)</span>
                      </td>
                      <td className="py-4 px-4 font-bold text-indigo-600">
                        <span>{stats.totalDiscussionHours}س</span>
                        <span className="text-[10px] text-indigo-400 block font-normal">({stats.avgDiscussionHours}س/نفر)</span>
                      </td>
                      <td className="py-4 px-4 font-black text-indigo-950 bg-indigo-50/30">
                        <span className="text-sm">{stats.totalCombinedHours} ساعت</span>
                        <span className="text-[10px] text-indigo-700 block font-bold">میانگین: {stats.avgCombinedHours}س / نفر</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-black inline-block",
                          statusLevel === 'ممتاز' ? "bg-emerald-100 text-emerald-800" :
                          statusLevel === 'خوب' ? "bg-sky-100 text-sky-800" : "bg-amber-100 text-amber-800"
                        )}>
                          {statusLevel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT GROUP MODAL */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-100 my-8"
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    <Users size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">
                      {editingGroup ? 'ویرایش گروه مباحثه' : 'تعریف گروه مباحثه جدید'}
                    </h3>
                    <p className="text-xs text-slate-500">مشخصات گروه و هم‌مباحثه‌ای‌ها را وارد کنید</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveGroup} className="space-y-4 text-xs font-bold text-slate-700">
                {/* Title */}
                <div className="space-y-1.5">
                  <label>عنوان گروه مباحثه *</label>
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="مثال: گروه مباحثه مکاسب محرمه پایه ۷"
                    required
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                  />
                </div>

                {/* Grade & Subject Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label>پایه تحصیلی</label>
                    <select
                      value={formGrade}
                      onChange={(e) => setFormGrade(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                    >
                      <option value="پایه ۷">پایه ۷</option>
                      <option value="پایه ۸">پایه ۸</option>
                      <option value="پایه ۹">پایه ۹</option>
                      <option value="پایه ۱۰">پایه ۱۰</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label>موضوع / درس مباحثه</label>
                    <input
                      type="text"
                      value={formSubject}
                      onChange={(e) => setFormSubject(e.target.value)}
                      placeholder="مثال: فقه، اصول، منطق..."
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                    />
                  </div>
                </div>

                {/* Active Students Selection */}
                <div className="space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="block text-xs font-black text-slate-800">
                      انتخاب اعضا از میان طلاب فعال مدرسه
                      {formMemberStudentIds.length > 0 && (
                        <span className="mr-2 px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-[11px] font-bold">
                          {formMemberStudentIds.length} نفر انتخاب شده
                        </span>
                      )}
                    </label>

                    <div className="flex items-center gap-2">
                      {/* Grade filter inside modal */}
                      <select
                        value={modalGradeFilter}
                        onChange={(e) => setModalGradeFilter(e.target.value)}
                        className="text-[11px] px-2.5 py-1 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                      >
                        <option value="all">همه پایه‌ها</option>
                        <option value="پایه ۷">پایه ۷</option>
                        <option value="پایه ۸">پایه ۸</option>
                        <option value="پایه ۹">پایه ۹</option>
                        <option value="پایه ۱۰">پایه ۱۰</option>
                      </select>

                      {/* Select all / Deselect all */}
                      {availableStudentsForModal.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const currentIds = availableStudentsForModal.map(s => s.id);
                            const allSelected = currentIds.every(id => formMemberStudentIds.includes(id));
                            if (allSelected) {
                              setFormMemberStudentIds(formMemberStudentIds.filter(id => !currentIds.includes(id)));
                            } else {
                              const combined = Array.from(new Set([...formMemberStudentIds, ...currentIds]));
                              setFormMemberStudentIds(combined);
                            }
                          }}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline"
                        >
                          {availableStudentsForModal.every(s => formMemberStudentIds.includes(s.id)) ? 'حذف انتخاب این گروه' : 'انتخاب همه این لیست'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search box inside modal */}
                  <div className="relative">
                    <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={modalSearchQuery}
                      onChange={(e) => setModalSearchQuery(e.target.value)}
                      placeholder="جستجوی نام یا کد ملی طلبه..."
                      className="w-full pr-8 pl-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  {/* Scrollable list */}
                  <div className="max-h-48 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                    {availableStudentsForModal.length === 0 ? (
                      <div className="p-4 text-center space-y-2">
                        <p className="text-xs text-slate-500 font-normal">طلبه فعالی با این مشخصات یا فیلتر پیدا نشد.</p>
                        {(modalGradeFilter !== 'all' || modalSearchQuery) && (
                          <button
                            type="button"
                            onClick={() => {
                              setModalGradeFilter('all');
                              setModalSearchQuery('');
                            }}
                            className="text-xs font-bold text-indigo-600 hover:underline"
                          >
                            مشاهده تمام طلاب فعال مدرسه
                          </button>
                        )}
                      </div>
                    ) : (
                      availableStudentsForModal.map((stu) => {
                        const isSelected = formMemberStudentIds.includes(stu.id);
                        return (
                          <label
                            key={stu.id}
                            className={cn(
                              "flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all",
                              isSelected
                                ? "bg-indigo-50/80 border-indigo-300 shadow-sm"
                                : "bg-white border-slate-200/80 hover:border-slate-300"
                            )}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormMemberStudentIds([...formMemberStudentIds, stu.id]);
                                  } else {
                                    setFormMemberStudentIds(formMemberStudentIds.filter(id => id !== stu.id));
                                  }
                                }}
                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                              />
                              <span className="text-xs font-bold text-slate-800">{stu.name}</span>
                            </div>

                            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                              {stu.grade || 'پایه ۷'}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* External Members ("سایر") */}
                <div className="space-y-2">
                  <label className="block">افزودن هم‌بحثی خارج از مدرسه (عنوان سایر)</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={externalInput}
                      onChange={(e) => setExternalInput(e.target.value)}
                      placeholder="نام هم‌بحثی خارج از مدرسه..."
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                    />
                    <button
                      type="button"
                      onClick={handleAddExternalMember}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-bold text-xs shrink-0"
                    >
                      + افزودن سایر
                    </button>
                  </div>

                  {/* External Members Chips */}
                  {formExternalMembers.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {formExternalMembers.map((ext, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-amber-100 border border-amber-300 text-amber-900 rounded-full text-xs font-bold flex items-center gap-1.5"
                        >
                          <span>{ext}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveExternalMember(ext)}
                            className="hover:text-rose-600"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <label>توضیحات و یادداشت</label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="توضیحات تکمیلی..."
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50/50"
                  />
                </div>

                {/* Modal Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs shadow-md"
                  >
                    {editingGroup ? 'ذخیره تغییرات' : 'ثبت گروه مباحثه'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRINT CONTAINER FOR PDF EXPORT */}
      <div style={{ position: 'fixed', left: '-9999px', top: '0px', width: '850px', zIndex: -1000, pointerEvents: 'none', opacity: 0 }}>
        <div ref={pdfPrintRef} className="p-8 bg-white font-vazir text-slate-900 space-y-6" dir="rtl">
          <div className="text-center border-b-2 border-indigo-600 pb-4 space-y-2">
            <h1 className="text-2xl font-black">گزارش جامع مطالعه و مباحثات علمی حوزه علمیه</h1>
            <p className="text-xs text-slate-600">
              بازه ارزیابی: {selectedPeriodId === 'all' ? 'آمار کل و تجمیعی (تمام دوره‌ها)' : studyPeriods.find(p => p.id === selectedPeriodId)?.title || 'دوره انتخاب شده'} | تاریخ تنظیم: {new Date().toLocaleDateString('fa-IR-u-nu-latn')} | مسئول پایه: {currentMentor.name}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-base font-black text-indigo-900">۱. خلاصه عملکرد گروه‌های مباحثه (مطالعه + مباحثه)</h2>
            <table className="w-full text-right text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 font-black">
                  <th className="p-2 border border-slate-300">نام گروه</th>
                  <th className="p-2 border border-slate-300">پایه</th>
                  <th className="p-2 border border-slate-300">موضوع</th>
                  <th className="p-2 border border-slate-300">تعداد اعضا</th>
                  <th className="p-2 border border-slate-300">مجموع مطالعه</th>
                  <th className="p-2 border border-slate-300">مجموع مباحثه</th>
                  <th className="p-2 border border-slate-300 bg-indigo-50">مجموع کل (مطالعه + مباحثه)</th>
                  <th className="p-2 border border-slate-300">میانگین کل هر نفر</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const stats = calculateGroupStats(g);
                  return (
                    <tr key={g.id}>
                      <td className="p-2 border border-slate-300 font-bold">{g.title}</td>
                      <td className="p-2 border border-slate-300">{g.grade}</td>
                      <td className="p-2 border border-slate-300">{g.subject}</td>
                      <td className="p-2 border border-slate-300">{stats.memberCount} طلبه</td>
                      <td className="p-2 border border-slate-300">{stats.totalStudyHours} ساعت</td>
                      <td className="p-2 border border-slate-300">{stats.totalDiscussionHours} ساعت</td>
                      <td className="p-2 border border-slate-300 font-black bg-indigo-50/50">{stats.totalCombinedHours} ساعت</td>
                      <td className="p-2 border border-slate-300 font-bold">{stats.avgCombinedHours} ساعت</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-4 pt-4">
            <h2 className="text-base font-black text-indigo-900">۲. جدول جمع‌بندی عملکرد انفرادی طلاب (مطالعه + مباحثه)</h2>
            <table className="w-full text-right text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 font-black">
                  <th className="p-2 border border-slate-300">نام و نام خانوادگی</th>
                  <th className="p-2 border border-slate-300">پایه</th>
                  <th className="p-2 border border-slate-300">میزان مطالعه فردی</th>
                  <th className="p-2 border border-slate-300">ساعات مباحثه</th>
                  <th className="p-2 border border-slate-300 bg-indigo-50 font-black">مجموع (مطالعه + مباحثه)</th>
                </tr>
              </thead>
              <tbody>
                {allStudentsList.filter(s => isStudentActive(s)).map((stu) => {
                  const m = getStudentMetrics(stu.id);
                  return (
                    <tr key={stu.id}>
                      <td className="p-2 border border-slate-300 font-bold">{stu.name}</td>
                      <td className="p-2 border border-slate-300">{stu.grade || 'پایه ۷'}</td>
                      <td className="p-2 border border-slate-300">{m.studyHours} ساعت</td>
                      <td className="p-2 border border-slate-300">{m.discussionHours} ساعت</td>
                      <td className="p-2 border border-slate-300 font-black bg-indigo-50/50">{m.totalHours} ساعت</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PRINT CONTAINER FOR GROUP COMPOSITION & PARTNERS PDF EXPORT */}
      <div style={{ position: 'fixed', left: '-9999px', top: '0px', width: '850px', zIndex: -1000, pointerEvents: 'none', opacity: 0 }}>
        <div ref={compositionPdfRef} className="p-8 bg-white font-vazir text-slate-900 space-y-6" dir="rtl">
          {/* Official Header */}
          <div className="text-center border-b-2 border-indigo-600 pb-4 space-y-2">
            <h1 className="text-2xl font-black text-indigo-950">گزارش ترکیب گروه‌های مباحثه علمی و اسامی هم‌بحث‌ها</h1>
            <p className="text-xs text-slate-600">
              استاد/مسئول پایه: <span className="font-bold text-slate-800">{currentMentor.name}</span> | تاریخ تنظیم: <span className="font-bold text-slate-800">{new Date().toLocaleDateString('fa-IR-u-nu-latn')}</span> | تعداد کل گروه‌ها: <span className="font-bold text-slate-800">{groups.length}</span> | تعداد طلاب فعال: <span className="font-bold text-slate-800">{allStudentsList.filter(s => isStudentActive(s)).length} نفر</span>
            </p>
          </div>

          {/* Section 1: Composition By Group */}
          <div className="space-y-6">
            <div className="border-b border-indigo-200 pb-2">
              <h2 className="text-base font-black text-indigo-900">۱. ترکیب اعضا و هم‌بحث‌ها به تفکیک گروه‌های مباحثه</h2>
              <p className="text-[11px] text-slate-500 font-medium">
                در این بخش اعضای هر گروه مباحثات به همراه عنوان گروه و اسامی کامل هم‌بحث‌های آنان آورده شده است.
              </p>
            </div>

            {groups.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-4">هیچ گروه مباحثه‌ای ثبت نشده است.</p>
            ) : (
              groups.map((g, gIdx) => {
                const activeGroupStudents = allStudentsList.filter(s => g.memberStudentIds.includes(s.id) && isStudentActive(s));
                const externalNames = g.externalMembers || [];

                return (
                  <div key={g.id} className="border border-slate-300 rounded-xl p-4 space-y-3 bg-slate-50/50">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                          {gIdx + 1}
                        </span>
                        <h3 className="text-sm font-black text-indigo-950">
                          {g.title}
                        </h3>
                        {g.subject && (
                          <span className="text-xs font-bold text-slate-600">
                            (موضوع: {g.subject})
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-full border border-indigo-200">
                        {g.grade || 'پایه عمومی'}
                      </span>
                    </div>

                    {g.description && (
                      <p className="text-xs text-slate-600 bg-white p-2 rounded-lg border border-slate-200 italic">
                        توضیحات: {g.description}
                      </p>
                    )}

                    {/* Table of members for this group */}
                    <table className="w-full text-right text-xs border-collapse border border-slate-300 bg-white">
                      <thead>
                        <tr className="bg-slate-100 font-black text-slate-800">
                          <th className="p-2 border border-slate-300 w-10 text-center">ردیف</th>
                          <th className="p-2 border border-slate-300">نام و نام خانوادگی</th>
                          <th className="p-2 border border-slate-300">پایه</th>
                          <th className="p-2 border border-slate-300">نوع عضویت</th>
                          <th className="p-2 border border-slate-300">هم‌بحث‌ها در این گروه</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeGroupStudents.map((stu, sIdx) => {
                          const otherInternal = activeGroupStudents.filter(m => m.id !== stu.id).map(m => m.name);
                          const allCoPartners = [...otherInternal, ...externalNames];

                          return (
                            <tr key={stu.id} className="hover:bg-slate-50">
                              <td className="p-2 border border-slate-300 text-center font-bold">{sIdx + 1}</td>
                              <td className="p-2 border border-slate-300 font-black text-slate-900">{stu.name}</td>
                              <td className="p-2 border border-slate-300">{stu.grade || 'پایه ۷'}</td>
                              <td className="p-2 border border-slate-300 text-indigo-700 font-bold">عضو اصلی (طلبه)</td>
                              <td className="p-2 border border-slate-300 font-medium text-slate-700">
                                {allCoPartners.length > 0 ? allCoPartners.join(' ، ') : '---'}
                              </td>
                            </tr>
                          );
                        })}

                        {externalNames.map((extName, extIdx) => {
                          const internalNames = activeGroupStudents.map(m => m.name);
                          const otherExternal = externalNames.filter((_, idx) => idx !== extIdx);
                          const allCoPartners = [...internalNames, ...otherExternal];

                          return (
                            <tr key={`ext_${extIdx}`} className="bg-amber-50/50">
                              <td className="p-2 border border-slate-300 text-center font-bold">
                                {activeGroupStudents.length + extIdx + 1}
                              </td>
                              <td className="p-2 border border-slate-300 font-black text-amber-900">{extName}</td>
                              <td className="p-2 border border-slate-300">---</td>
                              <td className="p-2 border border-slate-300 text-amber-800 font-bold">هم‌بحث خارج/مهمان</td>
                              <td className="p-2 border border-slate-300 font-medium text-slate-700">
                                {allCoPartners.length > 0 ? allCoPartners.join(' ، ') : '---'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })
            )}
          </div>

          {/* Section 2: Student-Centric Breakdown */}
          <div className="space-y-4 pt-6 border-t-2 border-indigo-600">
            <div className="border-b border-indigo-200 pb-2">
              <h2 className="text-base font-black text-indigo-900">۲. تفکیک هم‌بحث‌های هر طلبه (بر اساس عنوان دقیق هر گروه)</h2>
              <p className="text-[11px] text-slate-500 font-medium">
                در این بخش برای هر طلبه، تمام گروه‌هایی که در آن عضو است به همراه اسامی هم‌بحث‌ها به تفکیک عنوان گروه لیست شده است.
              </p>
            </div>

            <table className="w-full text-right text-xs border-collapse border border-slate-300 bg-white">
              <thead>
                <tr className="bg-slate-100 font-black text-slate-800">
                  <th className="p-2 border border-slate-300 w-10 text-center">ردیف</th>
                  <th className="p-2 border border-slate-300 w-44">نام طلبه</th>
                  <th className="p-2 border border-slate-300 w-20">پایه</th>
                  <th className="p-2 border border-slate-300">عنوان گروه‌ها و اسامی هم‌بحث‌ها</th>
                </tr>
              </thead>
              <tbody>
                {allStudentsList
                  .filter(s => isStudentActive(s))
                  .map((stu, sIdx) => {
                    const studentGroups = groups.filter(g => g.memberStudentIds.includes(stu.id));

                    return (
                      <tr key={stu.id} className={sIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                        <td className="p-2 border border-slate-300 text-center font-bold">{sIdx + 1}</td>
                        <td className="p-2 border border-slate-300 font-black text-indigo-950">{stu.name}</td>
                        <td className="p-2 border border-slate-300">{stu.grade || 'پایه ۷'}</td>
                        <td className="p-2 border border-slate-300">
                          {studentGroups.length === 0 ? (
                            <span className="text-slate-400 italic">در هیچ گروه مباحثه‌ای عضو نیست</span>
                          ) : (
                            <div className="space-y-2">
                              {studentGroups.map((g) => {
                                const activePartners = allStudentsList
                                  .filter(m => g.memberStudentIds.includes(m.id) && m.id !== stu.id && isStudentActive(m))
                                  .map(m => m.name);
                                const extPartners = g.externalMembers || [];
                                const allPartners = [...activePartners, ...extPartners];

                                return (
                                  <div key={g.id} className="bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
                                    <div className="font-black text-indigo-900 flex items-center gap-1.5">
                                      <span>در گروه: «{g.title}»</span>
                                      {g.subject && <span className="text-slate-600 font-bold">({g.subject})</span>}
                                    </div>
                                    <div className="text-slate-700 font-medium mt-1">
                                      <span className="font-bold text-slate-800">هم‌بحث‌ها: </span>
                                      {allPartners.length > 0 ? (
                                        <span className="text-slate-900 font-bold">{allPartners.join(' ، ')}</span>
                                      ) : (
                                        <span className="text-slate-400 italic">عضو دیگری ثبت نشده</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
