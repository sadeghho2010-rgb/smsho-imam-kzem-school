import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart2, 
  Plus, 
  Calendar, 
  Clock, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  User,
  Users,
  Target,
  ChevronDown,
  ChevronUp,
  Activity,
  History,
  Info,
  Filter,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  Upload,
  UserPlus,
  AlertTriangle,
  Award,
  Sparkles,
  Zap,
  HelpCircle,
  FileText,
  ListOrdered,
  Layers,
  Search,
  X,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Check,
  Edit3,
  Trash2
} from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, getDocs, query, where, orderBy, limit, doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, StudyPeriod, PeriodicStudyLog } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  AreaChart,
  Area,
  ReferenceLine
} from 'recharts';

export default function StudyStats() {
  const [students, setStudents] = useState<Student[]>([]);
  const [periods, setPeriods] = useState<StudyPeriod[]>([]);
  const [allLogs, setAllLogs] = useState<PeriodicStudyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [logs, setLogs] = useState<PeriodicStudyLog[]>([]);
  const [growthRange, setGrowthRange] = useState(3);
  const [dashRange, setDashRange] = useState<number>(0); // 0 = all periods, 3 = 3 recent, 5 = 5 recent, 10 = 10 recent
  const [chartMode, setChartMode] = useState<'raw' | 'adjusted'>('raw');
  const [followUpAdded, setFollowUpAdded] = useState<Record<string, boolean>>({});
  
  // Table Filters & Column Visibility State
  const [tableSearch, setTableSearch] = useState('');
  const [tableGradeFilter, setTableGradeFilter] = useState('ALL');
  const [tableMandatoryFilter, setTableMandatoryFilter] = useState('ALL'); // ALL, SUCCESS, DEFICIT, NOT_SUBMITTED
  const [tableAvgFilter, setTableAvgFilter] = useState('ALL'); // ALL, ABOVE_AVG, BELOW_AVG

  // Collapsible Filter Drawer & Column Toggle State (Closed by default)
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement | null>(null);

  // Column visibility for single-period view
  const [periodCols, setPeriodCols] = useState({
    grade: true,
    hours: true,
    diffMandatory: true,
    diffAvg: true,
    statusMandatory: true,
    statusAvg: true,
    action: true,
  });

  // Column visibility for breakout table (Student detail per period)
  const [breakoutCols, setBreakoutCols] = useState({
    timeRange: true,
    studentHours: true,
    mandatoryHours: true,
    gradeAvg: true,
    diffMandatory: true,
    diffAvg: true,
    perfRatio: false, // Default false per user request
    relRatio: true,
    statusMandatory: false, // Default false per user request
    statusAvg: true,
  });

  const [isBreakoutFilterOpen, setIsBreakoutFilterOpen] = useState(false);
  const breakoutFilterRef = useRef<HTMLDivElement>(null);

  // Column visibility for all-periods view
  const [allCols, setAllCols] = useState({
    grade: true,
    totalHours: true,
    activeCount: true,
    avg: true,
    avgDev: true,
    consistency: true,
  });

  // Click Outside Listener to close the breakout filter panel when clicking anywhere outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (breakoutFilterRef.current && !breakoutFilterRef.current.contains(event.target as Node)) {
        setIsBreakoutFilterOpen(false);
      }
    };
    if (isBreakoutFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isBreakoutFilterOpen]);

  // Click Outside Listener to close the filter panel when clicking anywhere outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen]);

  // Full Ranking Modal State
  const [rankingModal, setRankingModal] = useState<{
    title: string;
    metricLabel: string;
    items: { rank: number; studentId: string; name: string; grade: string; displayValue: string }[];
  } | null>(null);
  
  // Delete Period Confirmation Modal State
  const [deleteConfirmPeriod, setDeleteConfirmPeriod] = useState<StudyPeriod | null>(null);
  
  // Form states
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [periodTitle, setPeriodTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [mandatoryHours, setMandatoryHours] = useState<number>(0);
  const [entryValues, setEntryValues] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sSnap, pSnap, lSnap] = await Promise.all([
        getDocs(query(collection(db, 'students'), where('isActive', '==', true))),
        getDocs(query(collection(db, 'study_periods'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'periodic_study_logs'))
      ]);
      
      const sData = sSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
      const pData = pSnap.docs.map(d => ({ id: d.id, ...d.data() } as StudyPeriod));
      const allL = lSnap.docs.map(d => ({ id: d.id, ...d.data() } as PeriodicStudyLog));
      
      setStudents(sData);
      setPeriods(pData);
      setAllLogs(allL);
      
      if (pData.length > 0 && !selectedPeriodId) {
        setSelectedPeriodId(pData[0].id);
        setLogs(allL.filter(l => l.periodId === pData[0].id));
      }
    } catch (error) {
      console.error("Error fetching study data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPeriodLogs = (periodId: string) => {
    setLogs(allLogs.filter(l => l.periodId === periodId));
  };

  const openNewPeriodModal = () => {
    setEditingPeriodId(null);
    resetForm();
    setShowEntryModal(true);
  };

  const openEditPeriodModal = (period: StudyPeriod) => {
    setEditingPeriodId(period.id);
    setPeriodTitle(period.title);
    setStartDate(period.startDate);
    setEndDate(period.endDate);
    setMandatoryHours(Math.round((period.mandatoryHours || 0) * 60));
    
    const pLogs = allLogs.filter(l => l.periodId === period.id);
    const initialValues: Record<string, string> = {};
    pLogs.forEach(l => {
      if (l.hours > 0) {
        initialValues[l.studentId] = Math.round(l.hours * 60).toString();
      }
    });
    setEntryValues(initialValues);
    setShowEntryModal(true);
  };

  const handleDeletePeriod = (periodId: string) => {
    const p = periods.find(item => item.id === periodId);
    if (p) {
      setDeleteConfirmPeriod(p);
    }
  };

  const confirmDeletePeriodAction = async () => {
    if (!deleteConfirmPeriod) return;
    const periodId = deleteConfirmPeriod.id;

    try {
      setLoading(true);
      const batch = writeBatch(db);
      batch.delete(doc(db, 'study_periods', periodId));

      const pLogs = allLogs.filter(l => l.periodId === periodId);
      pLogs.forEach(l => {
        batch.delete(doc(db, 'periodic_study_logs', l.id));
      });
      await batch.commit();

      const remainingPeriods = periods.filter(p => p.id !== periodId);
      const remainingLogs = allLogs.filter(l => l.periodId !== periodId);

      setPeriods(remainingPeriods);
      setAllLogs(remainingLogs);

      if (selectedPeriodId === periodId) {
        const nextId = remainingPeriods.length > 0 ? remainingPeriods[0].id : null;
        setSelectedPeriodId(nextId);
        if (nextId) {
          setLogs(remainingLogs.filter(l => l.periodId === nextId));
        } else {
          setLogs([]);
        }
      } else if (selectedPeriodId) {
        setLogs(remainingLogs.filter(l => l.periodId === selectedPeriodId));
      }
      setDeleteConfirmPeriod(null);
    } catch (err) {
      console.error("Error deleting period:", err);
      alert("خطا در حذف دوره: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleSavePeriod = async () => {
    if (!periodTitle || !startDate || !endDate || mandatoryHours <= 0) {
      alert('لطفا تمامی فیلدها را به دقت پر کنید (میزان موظفی به دقیقه باید بزرگتر از صفر باشد)');
      return;
    }

    try {
      const mandatoryInHours = mandatoryHours / 60;

      if (editingPeriodId) {
        // Update existing period
        await updateDoc(doc(db, 'study_periods', editingPeriodId), {
          title: periodTitle,
          startDate,
          endDate,
          mandatoryHours: mandatoryInHours,
          updatedAt: new Date().toISOString()
        });

        const existingPeriodLogs = allLogs.filter(l => l.periodId === editingPeriodId);
        const batch = writeBatch(db);

        students.forEach(student => {
          const minutesStr = entryValues[student.id];
          const valMinutes = minutesStr ? parseFloat(minutesStr) : 0;
          const existingLog = existingPeriodLogs.find(l => l.studentId === student.id);

          if (existingLog) {
            if (valMinutes > 0) {
              batch.update(doc(db, 'periodic_study_logs', existingLog.id), {
                hours: valMinutes / 60
              });
            } else {
              batch.delete(doc(db, 'periodic_study_logs', existingLog.id));
            }
          } else if (valMinutes > 0) {
            const newLogRef = doc(collection(db, 'periodic_study_logs'));
            batch.set(newLogRef, {
              periodId: editingPeriodId,
              studentId: student.id,
              hours: valMinutes / 60
            });
          }
        });

        await batch.commit();
      } else {
        // Create new period
        const periodRef = await addDoc(collection(db, 'study_periods'), {
          title: periodTitle,
          startDate,
          endDate,
          mandatoryHours: mandatoryInHours,
          createdAt: new Date().toISOString()
        });

        const batch = writeBatch(db);
        Object.entries(entryValues).forEach(([studentId, minutesStr]) => {
          const valMinutes = parseFloat(minutesStr as string);
          if (valMinutes > 0) {
            const logRef = doc(collection(db, 'periodic_study_logs'));
            batch.set(logRef, {
              periodId: periodRef.id,
              studentId,
              hours: valMinutes / 60
            });
          }
        });

        await batch.commit();
      }

      setShowEntryModal(false);
      setEditingPeriodId(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving period:", error);
      alert("خطا در ذخیره‌سازی دوره");
    }
  };

  const resetForm = () => {
    setEditingPeriodId(null);
    setPeriodTitle('');
    setStartDate('');
    setEndDate('');
    setMandatoryHours(0);
    setEntryValues({});
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextIndex = index + 1;
      const nextStudentId = students[nextIndex]?.id;
      if (nextStudentId) {
        inputRefs.current[nextStudentId]?.focus();
      }
    }
  };

  const handleAddToFollowUp = async (student: Student, currentPeriodTitle: string, hours: number) => {
    try {
      const minutes = Math.round(hours * 60);
      await addDoc(collection(db, 'todos'), {
        title: `[پیگیری مطالعه] بررسی وضعیت مطالعه ${student.name} در ${currentPeriodTitle} (${minutes > 0 ? `${minutes} دقیقه` : '۰ دقیقه'})`,
        completed: false,
        isStudyFollowUp: true,
        studentId: student.id,
        createdAt: new Date().toISOString()
      });
      setFollowUpAdded(prev => ({ ...prev, [student.id]: true }));
    } catch (err) {
      console.error("Error adding to follow-up:", err);
    }
  };

  const handleExportCSV = () => {
    if (periods.length === 0) {
      alert("هیچ دوره‌ای برای خروجی گرفتن وجود ندارد.");
      return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "عنوان دوره,تاریخ شروع,تاریخ پایان,نام طلبه,پایه,ساعت مطالعه,ساعت موظفی,اختلاف با موظفی,اختلاف با میانگین,وضعیت موظفی,وضعیت میانگین\n";

    const sortedPeriods = [...periods].reverse();

    sortedPeriods.forEach(p => {
      const pLogs = allLogs.filter(l => l.periodId === p.id);
      const activePLogs = pLogs.filter(l => l.hours > 0);
      const pAvg = activePLogs.length > 0 
        ? activePLogs.reduce((acc, l) => acc + l.hours, 0) / activePLogs.length 
        : 0;

      students.forEach(student => {
        const log = pLogs.find(l => l.studentId === student.id);
        const hours = log?.hours || 0;
        const diffMandatory = hours - p.mandatoryHours;
        const diffAverage = hours - pAvg;
        const statusMandatory = hours >= p.mandatoryHours ? "موفق موظفی" : hours === 0 ? "ثبت نشده" : "کسری موظفی";
        const statusAvg = hours >= pAvg ? "بالای میانگین" : "زیر میانگین";

        const startDateFa = p.startDate ? new Date(p.startDate).toLocaleDateString('fa-IR') : '';
        const endDateFa = p.endDate ? new Date(p.endDate).toLocaleDateString('fa-IR') : '';

        csvContent += `"${p.title}","${startDateFa}","${endDateFa}","${student.name}","${student.grade || ''}",${hours},${p.mandatoryHours},${diffMandatory.toFixed(1)},${diffAverage.toFixed(1)},"${statusMandatory}","${statusAvg}"\n`;
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `گزارش_جامع_مطالعات_تمام_دوره_ها.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const data = {
      periods,
      allLogs,
      exportedAt: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `backup_study_stats_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target?.result as string;
        const data = JSON.parse(content);
        if (data.periods && Array.isArray(data.periods) && data.allLogs && Array.isArray(data.allLogs)) {
          if (!confirm("آیا از وارد کردن اطلاعات مطمئن هستید؟")) return;

          const batch = writeBatch(db);
          for (const p of data.periods) {
            const pRef = doc(collection(db, 'study_periods'), p.id);
            batch.set(pRef, {
              title: p.title,
              startDate: p.startDate,
              endDate: p.endDate,
              mandatoryHours: p.mandatoryHours,
              createdAt: p.createdAt || new Date().toISOString()
            }, { merge: true });
          }
          for (const l of data.allLogs) {
            const lRef = doc(collection(db, 'periodic_study_logs'), l.id);
            batch.set(lRef, {
              periodId: l.periodId,
              studentId: l.studentId,
              hours: l.hours
            }, { merge: true });
          }
          await batch.commit();
          alert("اطلاعات با موفقیت بازیابی و ثبت شد.");
          fetchData();
        } else {
          alert("فرمت فایل پشتیبان معتبر نیست.");
        }
      } catch (err) {
        console.error("Error importing JSON:", err);
        alert("خطا در خواندن فایل پشتیبان.");
      }
    };
    reader.readAsText(file);
  };

  // Current Period Calculations
  const currentPeriod = periods.find(p => p.id === selectedPeriodId);
  const currentLogs = logs;
  const activeLogs = currentLogs.filter(l => l.hours > 0);
  const periodAverage = activeLogs.length > 0 
    ? activeLogs.reduce((acc, l) => acc + l.hours, 0) / activeLogs.length 
    : 0;

  // Period Highest and Lowest with Student Names
  const maxInPeriodLog = activeLogs.length > 0 
    ? activeLogs.reduce((prev, curr) => (curr.hours > prev.hours ? curr : prev), activeLogs[0])
    : null;
  const maxInPeriodStudent = maxInPeriodLog ? students.find(s => s.id === maxInPeriodLog.studentId) : null;

  const minInPeriodLog = activeLogs.length > 0 
    ? activeLogs.reduce((prev, curr) => (curr.hours < prev.hours ? curr : prev), activeLogs[0])
    : null;
  const minInPeriodStudent = minInPeriodLog ? students.find(s => s.id === minInPeriodLog.studentId) : null;

  // Periods filter for Dashboard Analytics Range (dashRange: 0 = all, 3, 5, 10)
  const targetPeriods = dashRange > 0 ? periods.slice(0, dashRange) : periods;
  const targetPeriodIds = new Set(targetPeriods.map(p => p.id));

  // Student Summary & Deviation Analytics based on targetPeriods
  const studentSummary = students.map(s => {
    const sLogs = allLogs.filter(l => l.studentId === s.id && targetPeriodIds.has(l.periodId));
    const totalHours = sLogs.reduce((acc, l) => acc + l.hours, 0);
    const activeCount = sLogs.filter(l => l.hours > 0).length;

    let totalDev = 0;
    let belowAvgCount = 0;
    let periodCount = 0;

    targetPeriods.forEach(p => {
      const log = sLogs.find(l => l.periodId === p.id);
      if (log && log.hours > 0) {
        periodCount++;
        const periodGradeLogs = allLogs.filter(l => {
          if (l.periodId !== p.id) return false;
          const st = students.find(st => st.id === l.studentId);
          return st?.grade === s.grade;
        });
        const gradeAvg = periodGradeLogs.length > 0
          ? periodGradeLogs.reduce((a, b) => a + b.hours, 0) / periodGradeLogs.length
          : 0;

        if (gradeAvg > 0) {
          totalDev += (log.hours - gradeAvg);
          if (log.hours < gradeAvg) {
            belowAvgCount++;
          }
        }
      }
    });

    return {
      id: s.id,
      name: s.name,
      grade: s.grade,
      totalHours,
      activeCount,
      avg: activeCount > 0 ? totalHours / activeCount : 0,
      consistency: activeCount / Math.max(targetPeriods.length, 1),
      avgDev: periodCount > 0 ? totalDev / periodCount : 0,
      belowAvgPercentage: periodCount > 0 ? (belowAvgCount / periodCount) * 100 : 0
    };
  });

  // Highest and Lowest Total Hours
  const highestTotalStudent = [...studentSummary].sort((a,b) => b.totalHours - a.totalHours)[0];
  const lowestTotalStudent = [...studentSummary].filter(s => s.totalHours > 0).sort((a,b) => a.totalHours - b.totalHours)[0];

  // Most & Least Consistent
  const mostConsistent = [...studentSummary].sort((a,b) => b.consistency - a.consistency)[0];
  const leastConsistent = [...studentSummary].filter(s => s.activeCount > 0).sort((a,b) => a.consistency - b.consistency)[0];

  // Growth calculation (latest vs previous or first)
  const getGrowth = (studentId: string, range?: number) => {
    const sLogs = allLogs
      .filter(l => l.studentId === studentId)
      .map(l => ({
        ...l,
        date: periods.find(p => p.id === l.periodId)?.startDate || ''
      }))
      .sort((a,b) => a.date.localeCompare(b.date));
    
    if (sLogs.length < 2) return 0;
    
    const targetLogs = range ? sLogs.slice(-range) : sLogs;
    if (targetLogs.length < 2) return 0;

    const latest = targetLogs[targetLogs.length - 1].hours;
    const initial = targetLogs[0].hours;
    return initial > 0 ? ((latest - initial) / initial) * 100 : 0;
  };

  const mostImproved = [...studentSummary]
    .map(s => ({ ...s, growth: getGrowth(s.id, growthRange) }))
    .sort((a,b) => b.growth - a.growth)[0];

  // Full Leaderboard Helper
  const openRankingModal = (type: 'highest' | 'lowest' | 'improved' | 'most_consistent' | 'least_consistent') => {
    let title = '';
    let metricLabel = '';
    const sorted = [...studentSummary];

    if (type === 'highest') {
      title = 'رتبه‌بندی کامل: بالاترین مجموع مطالعه';
      metricLabel = 'مجموع ساعات مطالعه';
      sorted.sort((a,b) => b.totalHours - a.totalHours);
    } else if (type === 'lowest') {
      title = 'رتبه‌بندی کامل: کمترین مجموع مطالعه';
      metricLabel = 'مجموع ساعات مطالعه';
      sorted.sort((a,b) => a.totalHours - b.totalHours);
    } else if (type === 'improved') {
      title = 'رتبه‌بندی کامل: بیشترین رشد مطالعه';
      metricLabel = 'درصد پیشرفت (رشد)';
      sorted.map(s => ({ ...s, gVal: getGrowth(s.id, growthRange) }))
            .sort((a,b) => b.gVal - a.gVal);
    } else if (type === 'most_consistent') {
      title = 'رتبه‌بندی کامل: منظم‌ترین طلاب در ثبت';
      metricLabel = 'درصد مشارکت در ثبت';
      sorted.sort((a,b) => b.consistency - a.consistency);
    } else if (type === 'least_consistent') {
      title = 'رتبه‌بندی کامل: کم‌نظم‌ترین طلاب در ثبت';
      metricLabel = 'درصد مشارکت در ثبت';
      sorted.sort((a,b) => a.consistency - b.consistency);
    }

    const items = sorted.map((s, idx) => {
      let displayVal = '';
      if (type === 'highest' || type === 'lowest') {
        displayVal = `${s.totalHours} ساعت (${s.activeCount} دوره)`;
      } else if (type === 'improved') {
        const g = getGrowth(s.id, growthRange);
        displayVal = `${g > 0 ? '+' : ''}${g.toFixed(1)}%`;
      } else {
        displayVal = `${(s.consistency * 100).toFixed(0)}% (${s.activeCount} از ${targetPeriods.length} دوره)`;
      }
      return {
        rank: idx + 1,
        studentId: s.id,
        name: s.name,
        grade: s.grade || '---',
        displayValue: displayVal
      };
    });

    setRankingModal({ title, metricLabel, items });
  };

  // Chart Data Generator
  const getChartData = (studentId: string) => {
    const selectedStudent = students.find(s => s.id === studentId);
    return periods.slice().reverse().map(p => {
      const log = allLogs.find(l => l.periodId === p.id && l.studentId === studentId);
      const hours = log?.hours || 0;
      
      let periodLogs = allLogs.filter(l => l.periodId === p.id);
      if (selectedStudent && selectedStudent.grade) {
        const sameGradeStudentIds = students.filter(s => s.grade === selectedStudent.grade).map(s => s.id);
        periodLogs = periodLogs.filter(l => sameGradeStudentIds.includes(l.studentId));
      }
      
      const avg = periodLogs.length > 0 ? periodLogs.reduce((acc, l) => acc + l.hours, 0) / periodLogs.length : 0;

      // Adjusted Growth Ratios calculation
      const perfRatio = p.mandatoryHours > 0 ? (hours / p.mandatoryHours) * 100 : 0;
      const relRatio = avg > 0 ? (hours / avg) * 100 : 0;
      const adjustedIndex = parseFloat(((perfRatio + relRatio) / 2).toFixed(1));

      return {
        name: p.title,
        hours: hours,
        mandatory: p.mandatoryHours,
        average: parseFloat(avg.toFixed(1)),
        adjustedIndex: adjustedIndex,
        perfRatio: parseFloat(perfRatio.toFixed(1)),
        relRatio: parseFloat(relRatio.toFixed(1))
      };
    });
  };

  const [showAverageOnChart, setShowAverageOnChart] = useState(true);
  const [showMandatoryOnChart, setShowMandatoryOnChart] = useState(true);

  // Selected Student Analytics Summary
  const selectedStudent = students.find(s => s.id === selectedStudentId);
  const selectedStudentSummary = studentSummary.find(s => s.id === selectedStudentId);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-8 pb-20" dir="rtl">
      {/* Header with Export / Import Actions */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-6 items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <BarChart2 className="text-indigo-600" size={28} />
            آمار و تحلیل مطالعات
          </h2>
          <p className="text-xs text-slate-400 font-bold">پایش هوشمند روند تحصیلی، تراز رشد تعدیل‌شده و ثبت دوره‌ای</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all"
            title="دانلود فایل پشتیبان JSON"
          >
            <Download size={16} />
            <span>پشتیبان‌گیری (JSON)</span>
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all"
            title="بارگذاری فایل پشتیبان JSON"
          >
            <Upload size={16} />
            <span>بازیابی (JSON)</span>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportJSON} 
            accept=".json" 
            className="hidden" 
          />

          <button 
            onClick={openNewPeriodModal}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus size={20} />
            <span>ثبت دوره‌ای مطالعات</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar: Period List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
                <History size={16} className="text-slate-400" />
                دوره‌های ثبت شده
              </h3>
              <span className="bg-slate-200 text-slate-600 text-[9px] font-black px-2 py-0.5 rounded-full">{periods.length}</span>
            </div>
            <div className="max-h-[600px] overflow-y-auto p-2 space-y-1">
              {periods.map(p => (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedPeriodId(p.id);
                    fetchPeriodLogs(p.id);
                  }}
                  className={cn(
                    "w-full p-3.5 rounded-xl text-right transition-all flex flex-col gap-1 cursor-pointer group relative",
                    selectedPeriodId === p.id 
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 scale-[1.02] z-10" 
                      : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-100"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-sm truncate">{p.title}</span>
                    <div className="flex items-center gap-1 shrink-0 relative z-20">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          openEditPeriodModal(p);
                        }}
                        className={cn(
                          "p-1.5 rounded-lg transition-all hover:scale-105 active:scale-95 cursor-pointer",
                          selectedPeriodId === p.id 
                            ? "bg-indigo-700/80 hover:bg-indigo-800 text-indigo-100" 
                            : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                        )}
                        title="ویرایش دوره"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleDeletePeriod(p.id);
                        }}
                        className={cn(
                          "p-1.5 rounded-lg transition-all hover:scale-105 active:scale-95 cursor-pointer",
                          selectedPeriodId === p.id 
                            ? "bg-rose-700/80 hover:bg-rose-800 text-rose-100" 
                            : "bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200"
                        )}
                        title="حذف دوره"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <span className={cn(
                    "text-[9px] font-medium opacity-70",
                    selectedPeriodId === p.id ? "text-white" : "text-slate-400"
                  )}>
                    {new Date(p.startDate).toLocaleDateString('fa-IR')} تا {new Date(p.endDate).toLocaleDateString('fa-IR')}
                  </span>
                </div>
              ))}

              <button
                onClick={() => setSelectedPeriodId('ALL')}
                className={cn(
                  "w-full p-4 rounded-xl text-right transition-all flex items-center justify-between font-bold text-sm mt-3 border border-dashed",
                  selectedPeriodId === 'ALL'
                    ? "bg-slate-900 text-white border-slate-900 shadow-md scale-[1.02] z-10"
                    : "bg-indigo-50/50 text-indigo-700 border-indigo-200 hover:bg-indigo-100/50"
                )}
              >
                <div className="flex items-center gap-2">
                  <Layers size={18} className={selectedPeriodId === 'ALL' ? "text-indigo-400" : "text-indigo-600"} />
                  <span>همه دوره‌ها (جدول جامع)</span>
                </div>
                <span className="text-[10px] bg-indigo-500/20 px-2 py-0.5 rounded-full font-black">
                  {periods.length} دوره
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content: Period Details & List */}
        <div className="lg:col-span-3 space-y-8">
          {selectedPeriodId === 'ALL' ? (
            /* ALL PERIODS COMPREHENSIVE VIEW */
            <div className="space-y-8">
              <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-md border border-slate-800 relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <Layers className="text-indigo-400" size={24} />
                      <h3 className="text-2xl font-black">گزارش جامع تمام دوره‌های ثبت شده</h3>
                    </div>
                    <p className="text-xs text-slate-400 font-bold">
                      تحلیل عملکرد طلاب، انحراف از میانگین و ثبات در ثبت در کل {periods.length} دوره مطالعاتی
                    </p>
                  </div>
                  <button 
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 px-5 py-3.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-900/30"
                  >
                    <FileSpreadsheet size={18} />
                    <span>خروجی Excel کل دوره‌ها</span>
                  </button>
                </div>
              </div>

              {/* Table Filters for ALL Periods View */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm p-6 space-y-6">
                <div className="relative" ref={filterRef}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <ListOrdered size={18} className="text-indigo-600" />
                        <span>جدول مقایسه جامع عملکرد طلاب در تمام دوره‌ها</span>
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">برای انتخاب و مشاهده نمودار روی هر سطر کلیک کنید</p>
                    </div>

                    <button
                      onClick={() => setIsFilterOpen(prev => !prev)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-sm shrink-0",
                        isFilterOpen || tableSearch || tableGradeFilter !== 'ALL' || Object.values(allCols).some(v => !v)
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-100"
                          : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                      )}
                    >
                      <SlidersHorizontal size={15} />
                      <span>فیلترها و مدیریت ستون‌ها</span>
                      {(tableSearch || tableGradeFilter !== 'ALL' || Object.values(allCols).some(v => !v)) && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      )}
                      <ChevronDown size={14} className={cn("transition-transform duration-200", isFilterOpen && "rotate-180")} />
                    </button>
                  </div>

                  {/* Collapsible Filter & Column Selection Drawer */}
                  <AnimatePresence>
                    {isFilterOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 right-0 z-30 mt-3 p-5 bg-white rounded-2xl border border-slate-200 shadow-xl space-y-5"
                      >
                        {/* Data Filters */}
                        <div>
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                              <Filter size={14} className="text-indigo-600" />
                              فیلترهای جدول
                            </span>
                            {(tableSearch || tableGradeFilter !== 'ALL') && (
                              <button
                                onClick={() => {
                                  setTableSearch('');
                                  setTableGradeFilter('ALL');
                                }}
                                className="text-[10px] text-rose-500 hover:text-rose-600 font-bold"
                              >
                                پاک‌کردن فیلترها
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="relative">
                              <Search size={16} className="absolute right-3 top-3 text-slate-400" />
                              <input 
                                type="text"
                                placeholder="جستجوی نام طلبه..."
                                value={tableSearch}
                                onChange={(e) => setTableSearch(e.target.value)}
                                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>

                            <div>
                              <select
                                value={tableGradeFilter}
                                onChange={(e) => setTableGradeFilter(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="ALL">همه پایه‌ها</option>
                                {Array.from(new Set(students.map(s => s.grade).filter(Boolean))).sort().map(g => (
                                  <option key={g} value={g}>پایه {g}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Column Toggle Options */}
                        <div>
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                              <Eye size={14} className="text-indigo-600" />
                              انتخاب ستون‌های قابل نمایش
                            </span>
                            <button
                              onClick={() => setAllCols({
                                grade: true,
                                totalHours: true,
                                activeCount: true,
                                avg: true,
                                avgDev: true,
                                consistency: true,
                              })}
                              className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold"
                            >
                              نمایش همه
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setAllCols(prev => ({ ...prev, grade: !prev.grade }))}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
                                allCols.grade ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                              )}
                            >
                              {allCols.grade ? <Eye size={13} /> : <EyeOff size={13} />}
                              <span>پایه تحصیلی</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setAllCols(prev => ({ ...prev, totalHours: !prev.totalHours }))}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
                                allCols.totalHours ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                              )}
                            >
                              {allCols.totalHours ? <Eye size={13} /> : <EyeOff size={13} />}
                              <span>مجموع ساعات</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setAllCols(prev => ({ ...prev, activeCount: !prev.activeCount }))}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
                                allCols.activeCount ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                              )}
                            >
                              {allCols.activeCount ? <Eye size={13} /> : <EyeOff size={13} />}
                              <span>دوره مشارکتی</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setAllCols(prev => ({ ...prev, avg: !prev.avg }))}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
                                allCols.avg ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                              )}
                            >
                              {allCols.avg ? <Eye size={13} /> : <EyeOff size={13} />}
                              <span>میانگین هر دوره</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setAllCols(prev => ({ ...prev, avgDev: !prev.avgDev }))}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
                                allCols.avgDev ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                              )}
                            >
                              {allCols.avgDev ? <Eye size={13} /> : <EyeOff size={13} />}
                              <span>میانگین انحراف از پایه</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setAllCols(prev => ({ ...prev, consistency: !prev.consistency }))}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
                                allCols.consistency ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                              )}
                            >
                              {allCols.consistency ? <Eye size={13} /> : <EyeOff size={13} />}
                              <span>ثبات ثبت (%)</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* All Periods Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse min-w-[750px]">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase">نام طلبه</th>
                        {allCols.totalHours && <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase text-center">مجموع ساعات</th>}
                        {allCols.activeCount && <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase text-center">دوره مشارکتی</th>}
                        {allCols.avg && <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase text-center">میانگین هر دوره</th>}
                        {allCols.avgDev && <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase text-center">میانگین انحراف از پایه</th>}
                        {allCols.consistency && <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase text-center">ثبات ثبت (%)</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentSummary
                        .filter(s => {
                          if (tableSearch && !s.name.includes(tableSearch.trim())) return false;
                          if (tableGradeFilter !== 'ALL' && s.grade !== tableGradeFilter) return false;
                          return true;
                        })
                        .map(s => (
                          <tr 
                            key={s.id}
                            className={cn(
                              "group hover:bg-slate-50/80 transition-colors cursor-pointer",
                              selectedStudentId === s.id && "bg-indigo-50/40 font-bold"
                            )}
                            onClick={() => setSelectedStudentId(s.id)}
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors text-xs font-black",
                                  selectedStudentId === s.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                                )}>
                                  <User size={15} />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-800">{s.name}</p>
                                  {allCols.grade && <p className="text-[9px] text-slate-400">پایه: {s.grade || '---'}</p>}
                                </div>
                              </div>
                            </td>
                            {allCols.totalHours && (
                              <td className="px-4 py-4 text-center">
                                <span className="text-sm font-black text-slate-800">{s.totalHours}</span>
                              </td>
                            )}
                            {allCols.activeCount && (
                              <td className="px-4 py-4 text-center text-xs font-bold text-slate-600">
                                {s.activeCount} از {periods.length}
                              </td>
                            )}
                            {allCols.avg && (
                              <td className="px-4 py-4 text-center">
                                <span className="text-xs font-black text-indigo-600">{s.avg.toFixed(1)} h</span>
                              </td>
                            )}
                            {allCols.avgDev && (
                              <td className="px-4 py-4 text-center">
                                <span className={cn(
                                  "inline-flex items-center gap-0.5 font-bold text-[10px]",
                                  s.avgDev >= 0 ? "text-emerald-600" : "text-rose-600"
                                )}>
                                  {s.avgDev > 0 ? '+' : ''}{s.avgDev.toFixed(1)} h
                                </span>
                              </td>
                            )}
                            {allCols.consistency && (
                              <td className="px-4 py-4 text-center">
                                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-2.5 py-1 rounded-full border border-indigo-100">
                                  {(s.consistency * 100).toFixed(0)}%
                                </span>
                              </td>
                            )}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : selectedPeriodId && currentPeriod ? (
            <>
              {/* Period Overview Card */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-50 rounded-br-full -z-0 opacity-50"></div>
                <div className="relative z-10">
                  <div className="flex flex-wrap items-center justify-between gap-6 mb-8">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <Calendar className="text-indigo-600" size={20} />
                        <h3 className="text-2xl font-black text-slate-800">{currentPeriod.title}</h3>
                      </div>
                      <p className="text-xs text-slate-400 font-bold">
                        بازه‌زمانی: {new Date(currentPeriod.startDate).toLocaleDateString('fa-IR')} تا {new Date(currentPeriod.endDate).toLocaleDateString('fa-IR')}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <button 
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all"
                      >
                        <FileSpreadsheet size={16} />
                        <span>خروجی Excel</span>
                      </button>

                      <div className="bg-slate-900 text-white px-5 py-3 rounded-2xl text-center min-w-[130px]">
                        <p className="text-[10px] opacity-60 mb-0.5 font-bold uppercase tracking-widest">موظفی دوره</p>
                        <p className="text-xl font-black">{Math.round((currentPeriod.mandatoryHours || 0) * 60)} <span className="text-xs opacity-50 font-medium">دقیقه</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Period Stats Grid including Min Hours & Student Name */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-bold mb-2 flex items-center gap-1.5">
                        <Users size={14} className="text-slate-400" />
                        تعداد شرکت‌کنندگان
                      </p>
                      <p className="text-xl font-black text-slate-800">{activeLogs.length} <span className="text-xs text-slate-400 font-bold">نفر</span></p>
                    </div>

                    <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                      <p className="text-[10px] text-indigo-400 font-bold mb-2 flex items-center gap-1.5">
                        <Activity size={14} className="text-indigo-400" />
                        میانگین کل دوره
                      </p>
                      <p className="text-xl font-black text-indigo-700">{Math.round(periodAverage * 60)} <span className="text-xs opacity-50 font-bold">دقیقه</span></p>
                    </div>

                    <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                      <p className="text-[10px] text-emerald-600 font-bold mb-1 flex items-center gap-1.5">
                        <ArrowUpRight size={14} />
                        بالاترین ثبت دوره
                      </p>
                      <p className="text-xl font-black text-emerald-700">{Math.round((maxInPeriodLog?.hours || 0) * 60)} <span className="text-xs opacity-50 font-bold">دقیقه</span></p>
                      <p className="text-[10px] text-emerald-600 font-bold truncate mt-1">
                        {maxInPeriodStudent ? maxInPeriodStudent.name : '---'}
                      </p>
                    </div>

                    <div className="p-5 bg-rose-50/50 rounded-2xl border border-rose-100">
                      <p className="text-[10px] text-rose-500 font-bold mb-1 flex items-center gap-1.5">
                        <ArrowDownRight size={14} />
                        کمترین ثبت دوره
                      </p>
                      <p className="text-xl font-black text-rose-700">{Math.round((minInPeriodLog?.hours || 0) * 60)} <span className="text-xs opacity-50 font-bold">دقیقه</span></p>
                      <p className="text-[10px] text-rose-600 font-bold truncate mt-1">
                        {minInPeriodStudent ? minInPeriodStudent.name : '---'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Logs Table with Filters, Dual Status & Follow-Up Action */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm p-6 space-y-6">
                <div className="relative" ref={filterRef}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <h4 className="text-xs font-black text-slate-800">جدول وضعیت و مقایسه طلاب</h4>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">برای انتخاب و مشاهده نمودار روی هر سطر کلیک کنید</p>
                    </div>

                    <button
                      onClick={() => setIsFilterOpen(prev => !prev)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-sm shrink-0",
                        isFilterOpen || tableSearch || tableGradeFilter !== 'ALL' || tableMandatoryFilter !== 'ALL' || tableAvgFilter !== 'ALL' || Object.values(periodCols).some(v => !v)
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-100"
                          : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                      )}
                    >
                      <SlidersHorizontal size={15} />
                      <span>فیلترها و مدیریت ستون‌ها</span>
                      {(tableSearch || tableGradeFilter !== 'ALL' || tableMandatoryFilter !== 'ALL' || tableAvgFilter !== 'ALL' || Object.values(periodCols).some(v => !v)) && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      )}
                      <ChevronDown size={14} className={cn("transition-transform duration-200", isFilterOpen && "rotate-180")} />
                    </button>
                  </div>

                  {/* Collapsible Filter & Column Selection Drawer */}
                  <AnimatePresence>
                    {isFilterOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 right-0 z-30 mt-3 p-5 bg-white rounded-2xl border border-slate-200 shadow-xl space-y-5"
                      >
                        {/* Data Filters */}
                        <div>
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                              <Filter size={14} className="text-indigo-600" />
                              فیلترهای جدول
                            </span>
                            {(tableSearch || tableGradeFilter !== 'ALL' || tableMandatoryFilter !== 'ALL' || tableAvgFilter !== 'ALL') && (
                              <button
                                onClick={() => {
                                  setTableSearch('');
                                  setTableGradeFilter('ALL');
                                  setTableMandatoryFilter('ALL');
                                  setTableAvgFilter('ALL');
                                }}
                                className="text-[10px] text-rose-500 hover:text-rose-600 font-bold"
                              >
                                پاک‌کردن فیلترها
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="relative">
                              <Search size={16} className="absolute right-3 top-3 text-slate-400" />
                              <input 
                                type="text"
                                placeholder="جستجوی نام..."
                                value={tableSearch}
                                onChange={(e) => setTableSearch(e.target.value)}
                                className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>

                            <div>
                              <select
                                value={tableGradeFilter}
                                onChange={(e) => setTableGradeFilter(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="ALL">همه پایه‌ها</option>
                                {Array.from(new Set(students.map(s => s.grade).filter(Boolean))).sort().map(g => (
                                  <option key={g} value={g}>پایه {g}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <select
                                value={tableMandatoryFilter}
                                onChange={(e) => setTableMandatoryFilter(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="ALL">همه وضعیت‌های موظفی</option>
                                <option value="SUCCESS">موفق موظفی</option>
                                <option value="DEFICIT">کسری موظفی</option>
                                <option value="NOT_SUBMITTED">ثبت نشده</option>
                              </select>
                            </div>

                            <div>
                              <select
                                value={tableAvgFilter}
                                onChange={(e) => setTableAvgFilter(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="ALL">همه وضعیت‌های میانگین</option>
                                <option value="ABOVE_AVG">بالای میانگین</option>
                                <option value="BELOW_AVG">زیر میانگین</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Column Toggle Options */}
                        <div>
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                              <Eye size={14} className="text-indigo-600" />
                              انتخاب ستون‌های قابل نمایش
                            </span>
                            <button
                              onClick={() => setPeriodCols({
                                grade: true,
                                hours: true,
                                diffMandatory: true,
                                diffAvg: true,
                                statusMandatory: true,
                                statusAvg: true,
                                action: true,
                              })}
                              className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold"
                            >
                              نمایش همه
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setPeriodCols(prev => ({ ...prev, grade: !prev.grade }))}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
                                periodCols.grade ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                              )}
                            >
                              {periodCols.grade ? <Eye size={13} /> : <EyeOff size={13} />}
                              <span>پایه تحصیلی</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPeriodCols(prev => ({ ...prev, hours: !prev.hours }))}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
                                periodCols.hours ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                              )}
                            >
                              {periodCols.hours ? <Eye size={13} /> : <EyeOff size={13} />}
                              <span>ساعت مطالعه</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPeriodCols(prev => ({ ...prev, diffMandatory: !prev.diffMandatory }))}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
                                periodCols.diffMandatory ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                              )}
                            >
                              {periodCols.diffMandatory ? <Eye size={13} /> : <EyeOff size={13} />}
                              <span>اختلاف با موظفی</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPeriodCols(prev => ({ ...prev, diffAvg: !prev.diffAvg }))}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
                                periodCols.diffAvg ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                              )}
                            >
                              {periodCols.diffAvg ? <Eye size={13} /> : <EyeOff size={13} />}
                              <span>اختلاف با میانگین</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPeriodCols(prev => ({ ...prev, statusMandatory: !prev.statusMandatory }))}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
                                periodCols.statusMandatory ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                              )}
                            >
                              {periodCols.statusMandatory ? <Eye size={13} /> : <EyeOff size={13} />}
                              <span>وضعیت موظفی</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPeriodCols(prev => ({ ...prev, statusAvg: !prev.statusAvg }))}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
                                periodCols.statusAvg ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                              )}
                            >
                              {periodCols.statusAvg ? <Eye size={13} /> : <EyeOff size={13} />}
                              <span>وضعیت میانگین</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPeriodCols(prev => ({ ...prev, action: !prev.action }))}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5",
                                periodCols.action ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                              )}
                            >
                              {periodCols.action ? <Eye size={13} /> : <EyeOff size={13} />}
                              <span>اقدام / پیگیری</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-5 py-4 text-[10px] font-black text-slate-400 uppercase">نام طلبه</th>
                        {periodCols.hours && <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase text-center">دقیقه مطالعه</th>}
                        {periodCols.diffMandatory && <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase text-center">اختلاف با موظفی (دقیقه)</th>}
                        {periodCols.diffAvg && <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase text-center">اختلاف با میانگین (دقیقه)</th>}
                        {periodCols.statusMandatory && <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase text-center">وضعیت موظفی</th>}
                        {periodCols.statusAvg && <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase text-center">وضعیت میانگین</th>}
                        {periodCols.action && <th className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase text-center">اقدام / پیگیری</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.filter(student => {
                        if (tableSearch && !student.name.includes(tableSearch.trim())) return false;
                        if (tableGradeFilter !== 'ALL' && student.grade !== tableGradeFilter) return false;

                        const log = currentLogs.find(l => l.studentId === student.id);
                        const hours = log?.hours || 0;

                        if (tableMandatoryFilter === 'SUCCESS' && hours < currentPeriod.mandatoryHours) return false;
                        if (tableMandatoryFilter === 'DEFICIT' && (hours >= currentPeriod.mandatoryHours || hours === 0)) return false;
                        if (tableMandatoryFilter === 'NOT_SUBMITTED' && hours !== 0) return false;

                        if (tableAvgFilter === 'ABOVE_AVG' && hours < periodAverage) return false;
                        if (tableAvgFilter === 'BELOW_AVG' && hours >= periodAverage) return false;

                        return true;
                      }).map(student => {
                        const log = currentLogs.find(l => l.studentId === student.id);
                        const hours = log?.hours || 0;
                        const minutes = Math.round(hours * 60);
                        const diffMandatoryMin = Math.round((hours - currentPeriod.mandatoryHours) * 60);
                        const diffAverageMin = Math.round((hours - periodAverage) * 60);
                        const isAdded = followUpAdded[student.id];

                        return (
                          <tr 
                            key={student.id} 
                            className={cn(
                              "group hover:bg-slate-50/80 transition-colors cursor-pointer",
                              selectedStudentId === student.id && "bg-indigo-50/40 font-bold"
                            )}
                            onClick={() => setSelectedStudentId(student.id)}
                          >
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors text-xs font-black",
                                  selectedStudentId === student.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                                )}>
                                  <User size={15} />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-800">{student.name}</p>
                                  {periodCols.grade && <p className="text-[9px] text-slate-400">پایه: {student.grade || '---'}</p>}
                                </div>
                              </div>
                            </td>
                            {periodCols.hours && (
                              <td className="px-4 py-4 text-center">
                                <span className="text-sm font-black text-slate-800">{minutes > 0 ? `${minutes} دقیقه` : '۰'}</span>
                              </td>
                            )}
                            {periodCols.diffMandatory && (
                              <td className="px-4 py-4 text-center">
                                <div className={cn(
                                  "inline-flex items-center gap-0.5 font-bold text-[10px]",
                                  diffMandatoryMin >= 0 ? "text-emerald-600" : "text-rose-600"
                                )}>
                                  {diffMandatoryMin > 0 ? '+' : ''}{diffMandatoryMin} دقیقه
                                  {diffMandatoryMin >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                                </div>
                              </td>
                            )}
                            {periodCols.diffAvg && (
                              <td className="px-4 py-4 text-center">
                                <div className={cn(
                                  "inline-flex items-center gap-0.5 font-bold text-[10px]",
                                  diffAverageMin >= 0 ? "text-indigo-600" : "text-amber-600"
                                )}>
                                  {diffAverageMin > 0 ? '+' : ''}{diffAverageMin} دقیقه
                                </div>
                              </td>
                            )}
                            
                            {/* Dual Status: Mandatory */}
                            {periodCols.statusMandatory && (
                              <td className="px-4 py-4 text-center">
                                {hours >= currentPeriod.mandatoryHours ? (
                                  <span className="bg-emerald-50 text-emerald-600 text-[9px] font-black px-2.5 py-1 rounded-full border border-emerald-100">
                                    موفق موظفی
                                  </span>
                                ) : hours === 0 ? (
                                  <span className="bg-slate-100 text-slate-400 text-[9px] font-black px-2.5 py-1 rounded-full">
                                    ثبت نشده
                                  </span>
                                ) : (
                                  <span className="bg-rose-50 text-rose-600 text-[9px] font-black px-2.5 py-1 rounded-full border border-rose-100">
                                    کسری موظفی
                                  </span>
                                )}
                              </td>
                            )}

                            {/* Dual Status: Average */}
                            {periodCols.statusAvg && (
                              <td className="px-4 py-4 text-center">
                                {hours >= periodAverage ? (
                                  <span className="bg-indigo-50 text-indigo-600 text-[9px] font-black px-2.5 py-1 rounded-full border border-indigo-100">
                                    بالای میانگین
                                  </span>
                                ) : (
                                  <span className="bg-amber-50 text-amber-600 text-[9px] font-black px-2.5 py-1 rounded-full border border-amber-100">
                                    زیر میانگین
                                  </span>
                                )}
                              </td>
                            )}

                            {/* Action: Add to Follow-Up */}
                            {periodCols.action && (
                              <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleAddToFollowUp(student, currentPeriod.title, hours)}
                                  disabled={isAdded}
                                  className={cn(
                                    "inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border",
                                    isAdded 
                                      ? "bg-slate-100 border-slate-200 text-slate-400 cursor-default" 
                                      : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                                  )}
                                  title="افزودن به کارهای نیازمند پیگیری در سیستم"
                                >
                                  {isAdded ? (
                                    <>
                                      <CheckCircle2 size={12} className="text-emerald-500" />
                                      <span>در پیگیری</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserPlus size={12} />
                                      <span>نیازمند پیگیری</span>
                                    </>
                                  )}
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

          {/* Statistics Dashboard Section with Period Range Filter & Ranking Modals */}
          <div className="pt-8 border-t border-slate-200 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Activity className="text-indigo-600" size={24} />
                داشبورد تحلیلی و آماری کلی سامانه
              </h3>

              {/* Range Filter Control */}
              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-bold text-slate-700">
                <span className="text-[10px] text-slate-500 mr-2">محدوده محاسبه:</span>
                <button
                  onClick={() => setDashRange(0)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl transition-all",
                    dashRange === 0 ? "bg-white text-indigo-600 shadow-sm font-black" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  همه دوره‌ها
                </button>
                <button
                  onClick={() => setDashRange(3)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl transition-all",
                    dashRange === 3 ? "bg-white text-indigo-600 shadow-sm font-black" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  ۳ دوره اخیر
                </button>
                <button
                  onClick={() => setDashRange(5)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl transition-all",
                    dashRange === 5 ? "bg-white text-indigo-600 shadow-sm font-black" : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  ۵ دوره اخیر
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Highest Total Study Hours */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-emerald-600 text-[10px] font-bold uppercase tracking-wider mb-3">
                    <Award size={16} />
                    <span>بالاترین مجموع مطالعه</span>
                  </div>
                  <p className="text-base font-black text-slate-800 mb-2">
                    آقای <span className="text-emerald-600">{highestTotalStudent?.name || '---'}</span>
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    با ثبت کل <span className="font-black text-slate-800 text-sm">{highestTotalStudent?.totalHours || 0}</span> ساعت مطالعه
                  </p>
                </div>
                <button
                  onClick={() => openRankingModal('highest')}
                  className="mt-4 w-full py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold transition-all text-center"
                >
                  مشاهده تمام نفرات و رتبه‌بندی
                </button>
              </div>

              {/* Lowest Total Study Hours */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-rose-500 text-[10px] font-bold uppercase tracking-wider mb-3">
                    <AlertTriangle size={16} />
                    <span>کمترین مجموع مطالعه</span>
                  </div>
                  <p className="text-base font-black text-slate-800 mb-2">
                    آقای <span className="text-rose-600">{lowestTotalStudent?.name || '---'}</span>
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    با ثبت مجموع <span className="font-black text-slate-800 text-sm">{lowestTotalStudent?.totalHours || 0}</span> ساعت
                  </p>
                </div>
                <button
                  onClick={() => openRankingModal('lowest')}
                  className="mt-4 w-full py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all text-center"
                >
                  مشاهده تمام نفرات و رتبه‌بندی
                </button>
              </div>

              {/* Most Improved Student with Mini Progress Chart */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                      <Sparkles size={16} />
                      بیشترین رشد مطالعه
                    </span>
                    <select 
                      className="bg-slate-50 border border-slate-200 text-[9px] font-black outline-none rounded-lg p-1 text-slate-600"
                      value={growthRange}
                      onChange={(e) => setGrowthRange(parseInt(e.target.value))}
                    >
                      <option value="3">۳ دوره اخیر</option>
                      <option value="5">۵ دوره اخیر</option>
                      <option value="0">کل دوره‌ها</option>
                    </select>
                  </div>
                  <p className="text-base font-black text-slate-800 mb-1">
                    آقای <span className="text-indigo-600">{mostImproved?.name || '---'}</span>
                  </p>
                  <p className="text-xs text-emerald-600 font-bold mb-3">
                    میزان پیشرفت: +{mostImproved?.growth.toFixed(1)}%
                  </p>
                </div>

                {/* Mini Progress Chart */}
                {mostImproved && (
                  <div className="h-16 w-full my-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={getChartData(mostImproved.id)}>
                        <defs>
                          <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="hours" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorGrowth)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <button
                  onClick={() => openRankingModal('improved')}
                  className="mt-2 w-full py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all text-center"
                >
                  مشاهده تمام نفرات و رتبه‌بندی
                </button>
              </div>

              {/* Most Consistent */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold mb-3 uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-indigo-500" />
                    منظم‌ترین طلبه
                  </p>
                  <p className="text-base font-black text-slate-800 mb-1">آقای {mostConsistent?.name || '---'}</p>
                  <p className="text-xs text-indigo-600 font-bold">{(mostConsistent?.consistency * 100 || 0).toFixed(0)}% مشارکت منظم در ثبت</p>
                </div>
                <button
                  onClick={() => openRankingModal('most_consistent')}
                  className="mt-4 w-full py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-all text-center"
                >
                  مشاهده تمام نفرات و رتبه‌بندی
                </button>
              </div>

              {/* Least Consistent */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold mb-3 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp size={16} className="text-rose-400 rotate-180" />
                    کم‌نظم‌ترین در ثبت
                  </p>
                  <p className="text-base font-black text-slate-800 mb-1">آقای {leastConsistent?.name || '---'}</p>
                  <p className="text-xs text-rose-500 font-bold">{(leastConsistent?.consistency * 100 || 0).toFixed(0)}% مشارکت در ثبت</p>
                </div>
                <button
                  onClick={() => openRankingModal('least_consistent')}
                  className="mt-4 w-full py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all text-center"
                >
                  مشاهده تمام نفرات و رتبه‌بندی
                </button>
              </div>
            </div>
          </div>

              {/* Student Trend & Adjusted Growth Charts with Mandatory Student Selector */}
              <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-6">
                  <div>
                    <h4 className="text-lg font-black text-slate-800 flex items-center gap-2">
                      <Zap className="text-indigo-600" size={22} />
                      نمودار تحلیلی روند و تراز رشد طلبه
                    </h4>
                    <p className="text-xs text-slate-400 font-bold mt-1">
                      برای مشاهده نوسانات، مقایسه با میانگین/موظفی و نمودار رشد تعدیل‌شده، ابتدا یک طلبه را انتخاب فرمایید
                    </p>
                  </div>

                  {/* Student Picker Dropdown */}
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 block">انتخاب طلبه:</label>
                      <select 
                        value={selectedStudentId || ''} 
                        onChange={(e) => setSelectedStudentId(e.target.value || null)}
                        className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-w-[200px]"
                      >
                        <option value="">-- لطفاً یک طلبه را انتخاب کنید --</option>
                        {students.map(s => (
                          <option key={s.id} value={s.id}>
                            آقای {s.name} (پایه {s.grade || '---'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedStudentId && (
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                          onClick={() => setChartMode('raw')}
                          className={cn(
                            "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                            chartMode === 'raw' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                          )}
                        >
                          ساعت مطالعه واقعی
                        </button>
                        <button
                          onClick={() => setChartMode('adjusted')}
                          className={cn(
                            "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                            chartMode === 'adjusted' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                          )}
                        >
                          تراز رشد تعدیل‌شده (%)
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {selectedStudentId ? (
                  <>
                    {/* Selected Student Specific Metrics */}
                    {selectedStudentSummary && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400">میزان وقوع ثبت زیر میانگین:</p>
                          <p className="text-base font-black text-slate-800">
                            {selectedStudentSummary.belowAvgPercentage.toFixed(0)}% <span className="text-xs font-normal text-slate-400">از دوره‌ها</span>
                          </p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400">متوسط انحراف از میانگین پایه:</p>
                          <p className={cn(
                            "text-base font-black",
                            selectedStudentSummary.avgDev >= 0 ? "text-emerald-600" : "text-rose-600"
                          )}>
                            {selectedStudentSummary.avgDev > 0 ? '+' : ''}{selectedStudentSummary.avgDev.toFixed(1)} <span className="text-xs font-normal text-slate-400">ساعت/دوره</span>
                          </p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-slate-400">میانگین ساعات مطالعه طلبه:</p>
                          <p className="text-base font-black text-indigo-600">
                            {selectedStudentSummary.avg.toFixed(1)} <span className="text-xs font-normal text-slate-400">ساعت</span>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Chart Controls */}
                    {chartMode === 'raw' && (
                      <div className="flex justify-end gap-3">
                        <button 
                          onClick={() => setShowAverageOnChart(!showAverageOnChart)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border",
                            showAverageOnChart ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-200 text-slate-400"
                          )}
                        >
                          نمایش میانگین پایه
                        </button>
                        <button 
                          onClick={() => setShowMandatoryOnChart(!showMandatoryOnChart)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border",
                            showMandatoryOnChart ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-400"
                          )}
                        >
                          نمایش خط موظفی
                        </button>
                      </div>
                    )}

                    {/* Main Chart Render */}
                    <div className="h-[380px] w-full pt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        {chartMode === 'raw' ? (
                          <LineChart data={getChartData(selectedStudentId)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                              dy={10}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                            />
                            <Tooltip 
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                              itemStyle={{ fontSize: '12px', fontWeight: 800 }}
                              labelStyle={{ fontSize: '10px', marginBottom: '4px', color: '#64748b' }}
                            />
                            <Legend 
                              verticalAlign="top" 
                              align="right" 
                              iconType="circle"
                              wrapperStyle={{ paddingBottom: '20px', fontSize: '11px', fontWeight: 700 }}
                            />
                            <Line 
                              name={`ساعت مطالعه ${students.find(s => s.id === selectedStudentId)?.name}`}
                              type="monotone" 
                              dataKey="hours" 
                              stroke="#6366f1" 
                              strokeWidth={4} 
                              dot={{ r: 6, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                              activeDot={{ r: 8, strokeWidth: 0 }}
                            />
                            {showAverageOnChart && (
                              <Line 
                                name="میانگین هم‌پایه‌ای‌ها"
                                type="monotone" 
                                dataKey="average" 
                                stroke="#10b981" 
                                strokeWidth={2} 
                                strokeDasharray="5 5"
                                dot={false}
                              />
                            )}
                            {showMandatoryOnChart && (
                              <Line 
                                name="ساعت موظفی"
                                type="stepAfter" 
                                dataKey="mandatory" 
                                stroke="#0f172a" 
                                strokeWidth={2} 
                                dot={false}
                                opacity={0.3}
                              />
                            )}
                          </LineChart>
                        ) : (
                          /* Adjusted Growth Chart */
                          <LineChart data={getChartData(selectedStudentId)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                              dy={10}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
                              unit="%"
                            />
                            <Tooltip 
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                              itemStyle={{ fontSize: '12px', fontWeight: 800 }}
                              labelStyle={{ fontSize: '10px', marginBottom: '4px', color: '#64748b' }}
                            />
                            <Legend 
                              verticalAlign="top" 
                              align="right" 
                              iconType="circle"
                              wrapperStyle={{ paddingBottom: '20px', fontSize: '11px', fontWeight: 700 }}
                            />
                            <Line 
                              name="شاخص تراز رشد تعدیل‌شده (%)"
                              type="monotone" 
                              dataKey="adjustedIndex" 
                              stroke="#ec4899" 
                              strokeWidth={4} 
                              dot={{ r: 6, fill: '#ec4899', strokeWidth: 2, stroke: '#fff' }}
                            />
                            <Line 
                              name="نسبت به موظفی (%)"
                              type="monotone" 
                              dataKey="perfRatio" 
                              stroke="#6366f1" 
                              strokeWidth={2} 
                              strokeDasharray="4 4"
                              dot={false}
                            />
                            <Line 
                              name="نسبت به میانگین پایه (%)"
                              type="monotone" 
                              dataKey="relRatio" 
                              stroke="#10b981" 
                              strokeWidth={2} 
                              strokeDasharray="4 4"
                              dot={false}
                            />
                            <ReferenceLine 
                              y={100} 
                              stroke="#94a3b8" 
                              strokeDasharray="3 3" 
                              strokeWidth={1.5}
                              label={{ value: 'خط مبنا ۱۰۰٪', fill: '#94a3b8', fontSize: 10, position: 'insideTopLeft' }} 
                            />
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </div>

                    {/* Period-by-Period Side-by-Side Detailed Breakout Table for Selected Student */}
                    <div className="pt-8 border-t border-slate-100 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <h5 className="text-sm font-black text-slate-800 flex items-center gap-2">
                            <FileSpreadsheet className="text-indigo-600" size={18} />
                            <span>جدول ریز عملکرد و آمار تک‌تک دوره‌های {selectedStudent?.name}</span>
                          </h5>
                          <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                            مقایسه دقیق و کنار هم دقایق مطالعه، موظفی، میانگین پایه و تراز عملکرد در تمام دوره‌ها
                          </p>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                            کل دوره‌ها: {periods.length} دوره
                          </span>
                          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                            مجموع مطالعه: {Math.round((selectedStudentSummary?.totalHours || 0) * 60)} دقیقه
                          </span>
                        </div>
                      </div>

                      {/* Breakout Table Column Visibility Toggle Toolbar (Collapsible Dropdown/Drawer) */}
                      <div ref={breakoutFilterRef} className="relative">
                        <button
                          type="button"
                          onClick={() => setIsBreakoutFilterOpen(prev => !prev)}
                          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold text-xs transition-colors border border-slate-200 shadow-xs"
                        >
                          <SlidersHorizontal size={14} className="text-indigo-600" />
                          <span>فیلترها و مدیریت ستون‌های ریز عملکرد</span>
                          <ChevronDown size={14} className={cn("transition-transform duration-200 text-slate-500", isBreakoutFilterOpen && "rotate-180")} />
                        </button>

                        <AnimatePresence>
                          {isBreakoutFilterOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -6, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.98 }}
                              transition={{ duration: 0.15 }}
                              className="mt-2.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 shadow-lg space-y-3 z-30 relative"
                            >
                              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                                <span className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
                                  <Eye size={13} className="text-indigo-600" />
                                  انتخاب ستون‌های قابل نمایش در جدول ریز عملکرد:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setBreakoutCols({
                                    timeRange: true,
                                    studentHours: true,
                                    mandatoryHours: true,
                                    gradeAvg: true,
                                    diffMandatory: true,
                                    diffAvg: true,
                                    perfRatio: true,
                                    relRatio: true,
                                    statusMandatory: true,
                                    statusAvg: true,
                                  })}
                                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                                >
                                  نمایش همه ستون‌ها
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setBreakoutCols(p => ({ ...p, timeRange: !p.timeRange }))}
                                  className={cn(
                                    "px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all border flex items-center gap-1",
                                    breakoutCols.timeRange ? "bg-white border-indigo-200 text-indigo-700 shadow-xs" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                                  )}
                                >
                                  {breakoutCols.timeRange ? <Eye size={11} /> : <EyeOff size={11} />}
                                  <span>بازه زمانی</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setBreakoutCols(p => ({ ...p, studentHours: !p.studentHours }))}
                                  className={cn(
                                    "px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all border flex items-center gap-1",
                                    breakoutCols.studentHours ? "bg-white border-indigo-200 text-indigo-700 shadow-xs" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                                  )}
                                >
                                  {breakoutCols.studentHours ? <Eye size={11} /> : <EyeOff size={11} />}
                                  <span>میزان دقیقه طلبه</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setBreakoutCols(p => ({ ...p, mandatoryHours: !p.mandatoryHours }))}
                                  className={cn(
                                    "px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all border flex items-center gap-1",
                                    breakoutCols.mandatoryHours ? "bg-white border-indigo-200 text-indigo-700 shadow-xs" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                                  )}
                                >
                                  {breakoutCols.mandatoryHours ? <Eye size={11} /> : <EyeOff size={11} />}
                                  <span>دقیقه موظفی</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setBreakoutCols(p => ({ ...p, gradeAvg: !p.gradeAvg }))}
                                  className={cn(
                                    "px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all border flex items-center gap-1",
                                    breakoutCols.gradeAvg ? "bg-white border-indigo-200 text-indigo-700 shadow-xs" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                                  )}
                                >
                                  {breakoutCols.gradeAvg ? <Eye size={11} /> : <EyeOff size={11} />}
                                  <span>میانگین پایه (دقیقه)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setBreakoutCols(p => ({ ...p, diffMandatory: !p.diffMandatory }))}
                                  className={cn(
                                    "px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all border flex items-center gap-1",
                                    breakoutCols.diffMandatory ? "bg-white border-indigo-200 text-indigo-700 shadow-xs" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                                  )}
                                >
                                  {breakoutCols.diffMandatory ? <Eye size={11} /> : <EyeOff size={11} />}
                                  <span>اختلاف با موظفی (دقیقه)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setBreakoutCols(p => ({ ...p, diffAvg: !p.diffAvg }))}
                                  className={cn(
                                    "px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all border flex items-center gap-1",
                                    breakoutCols.diffAvg ? "bg-white border-indigo-200 text-indigo-700 shadow-xs" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                                  )}
                                >
                                  {breakoutCols.diffAvg ? <Eye size={11} /> : <EyeOff size={11} />}
                                  <span>اختلاف با میانگین (دقیقه)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setBreakoutCols(p => ({ ...p, perfRatio: !p.perfRatio }))}
                                  className={cn(
                                    "px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all border flex items-center gap-1",
                                    breakoutCols.perfRatio ? "bg-white border-indigo-200 text-indigo-700 shadow-xs" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                                  )}
                                >
                                  {breakoutCols.perfRatio ? <Eye size={11} /> : <EyeOff size={11} />}
                                  <span>تراز موظفی (%)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setBreakoutCols(p => ({ ...p, relRatio: !p.relRatio }))}
                                  className={cn(
                                    "px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all border flex items-center gap-1",
                                    breakoutCols.relRatio ? "bg-white border-indigo-200 text-indigo-700 shadow-xs" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                                  )}
                                >
                                  {breakoutCols.relRatio ? <Eye size={11} /> : <EyeOff size={11} />}
                                  <span>تراز به پایه (%)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setBreakoutCols(p => ({ ...p, statusMandatory: !p.statusMandatory }))}
                                  className={cn(
                                    "px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all border flex items-center gap-1",
                                    breakoutCols.statusMandatory ? "bg-white border-indigo-200 text-indigo-700 shadow-xs" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                                  )}
                                >
                                  {breakoutCols.statusMandatory ? <Eye size={11} /> : <EyeOff size={11} />}
                                  <span>وضعیت موظفی</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setBreakoutCols(p => ({ ...p, statusAvg: !p.statusAvg }))}
                                  className={cn(
                                    "px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all border flex items-center gap-1",
                                    breakoutCols.statusAvg ? "bg-white border-indigo-200 text-indigo-700 shadow-xs" : "bg-slate-100 border-slate-200 text-slate-400 opacity-60"
                                  )}
                                >
                                  {breakoutCols.statusAvg ? <Eye size={11} /> : <EyeOff size={11} />}
                                  <span>وضعیت موظفی میانگین</span>
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase">
                              <th className="px-4 py-3.5">عنوان دوره</th>
                              {breakoutCols.timeRange && <th className="px-3 py-3.5 text-center">بازه زمانی</th>}
                              {breakoutCols.studentHours && <th className="px-3 py-3.5 text-center">میزان دقیقه طلبه</th>}
                              {breakoutCols.mandatoryHours && <th className="px-3 py-3.5 text-center">دقیقه موظفی</th>}
                              {breakoutCols.gradeAvg && <th className="px-3 py-3.5 text-center">میانگین پایه (دقیقه)</th>}
                              {breakoutCols.diffMandatory && <th className="px-3 py-3.5 text-center">اختلاف با موظفی (دقیقه)</th>}
                              {breakoutCols.diffAvg && <th className="px-3 py-3.5 text-center">اختلاف با میانگین (دقیقه)</th>}
                              {breakoutCols.perfRatio && <th className="px-3 py-3.5 text-center">تراز موظفی (%)</th>}
                              {breakoutCols.relRatio && <th className="px-3 py-3.5 text-center">تراز به پایه (%)</th>}
                              {breakoutCols.statusMandatory && <th className="px-3 py-3.5 text-center">وضعیت موظفی</th>}
                              {breakoutCols.statusAvg && <th className="px-3 py-3.5 text-center">وضعیت موظفی میانگین</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                            {periods.map(p => {
                              const log = allLogs.find(l => l.studentId === selectedStudentId && l.periodId === p.id);
                              const hours = log?.hours || 0;
                              const mandatoryHours = p.mandatoryHours || 0;

                              const studentMinutes = Math.round(hours * 60);
                              const mandatoryMinutes = Math.round(mandatoryHours * 60);
                              const diffMandatoryMinutes = Math.round((hours - mandatoryHours) * 60);

                              // Grade average for this period
                              const gradeLogs = allLogs.filter(l => {
                                if (l.periodId !== p.id || l.hours === 0) return false;
                                const st = students.find(s => s.id === l.studentId);
                                return st?.grade === selectedStudent?.grade;
                              });
                              const gradeAvg = gradeLogs.length > 0 
                                ? gradeLogs.reduce((acc, l) => acc + l.hours, 0) / gradeLogs.length 
                                : 0;
                              
                              const gradeAvgMinutes = Math.round(gradeAvg * 60);
                              const diffGradeAvgMinutes = Math.round((hours - gradeAvg) * 60);

                              const perfRatio = mandatoryHours > 0 ? (hours / mandatoryHours) * 100 : 0;
                              const relRatio = gradeAvg > 0 ? (hours / gradeAvg) * 100 : 0;

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

                                  {breakoutCols.studentHours && (
                                    <td className="px-3 py-3.5 text-center font-black text-indigo-600 text-sm">
                                      {studentMinutes > 0 ? `${studentMinutes} دقیقه` : <span className="text-slate-400 font-normal">۰</span>}
                                    </td>
                                  )}

                                  {breakoutCols.mandatoryHours && (
                                    <td className="px-3 py-3.5 text-center font-bold text-slate-700">
                                      {mandatoryMinutes} دقیقه
                                    </td>
                                  )}

                                  {breakoutCols.gradeAvg && (
                                    <td className="px-3 py-3.5 text-center text-slate-600 font-bold">
                                      {gradeAvgMinutes} دقیقه
                                    </td>
                                  )}

                                  {breakoutCols.diffMandatory && (
                                    <td className="px-3 py-3.5 text-center">
                                      {hours > 0 ? (
                                        <span className={cn(
                                          "inline-flex items-center gap-0.5 font-bold text-[11px]",
                                          diffMandatoryMinutes >= 0 ? "text-emerald-600" : "text-rose-600"
                                        )}>
                                          {diffMandatoryMinutes > 0 ? '+' : ''}{diffMandatoryMinutes} دقیقه
                                          {diffMandatoryMinutes >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                                        </span>
                                      ) : (
                                        <span className="text-slate-300">---</span>
                                      )}
                                    </td>
                                  )}

                                  {breakoutCols.diffAvg && (
                                    <td className="px-3 py-3.5 text-center">
                                      {hours > 0 ? (
                                        <span className={cn(
                                          "font-bold text-[11px]",
                                          diffGradeAvgMinutes >= 0 ? "text-emerald-600" : "text-amber-600"
                                        )}>
                                          {diffGradeAvgMinutes > 0 ? '+' : ''}{diffGradeAvgMinutes} دقیقه
                                        </span>
                                      ) : (
                                        <span className="text-slate-300">---</span>
                                      )}
                                    </td>
                                  )}

                                  {breakoutCols.perfRatio && (
                                    <td className="px-3 py-3.5 text-center">
                                      {hours > 0 && mandatoryHours > 0 ? (
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

                                  {breakoutCols.relRatio && (
                                    <td className="px-3 py-3.5 text-center">
                                      {hours > 0 && gradeAvg > 0 ? (
                                        <span className={cn(
                                          "px-2 py-0.5 rounded-lg text-[10px] font-black",
                                          relRatio >= 100 ? "bg-indigo-50 text-indigo-700 border border-indigo-100" : "bg-slate-100 text-slate-600"
                                        )}>
                                          {relRatio.toFixed(0)}%
                                        </span>
                                      ) : (
                                        <span className="text-slate-300">---</span>
                                      )}
                                    </td>
                                  )}

                                  {breakoutCols.statusMandatory && (
                                    <td className="px-3 py-3.5 text-center">
                                      {hours >= mandatoryHours && mandatoryHours > 0 ? (
                                        <span className="bg-emerald-50 text-emerald-600 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-100 whitespace-nowrap">
                                          موفق موظفی
                                        </span>
                                      ) : hours === 0 ? (
                                        <span className="bg-slate-100 text-slate-400 text-[10px] font-black px-2.5 py-1 rounded-full whitespace-nowrap">
                                          ثبت نشده
                                        </span>
                                      ) : (
                                        <span className="bg-rose-50 text-rose-600 text-[10px] font-black px-2.5 py-1 rounded-full border border-rose-100 whitespace-nowrap">
                                          کسری موظفی
                                        </span>
                                      )}
                                    </td>
                                  )}

                                  {breakoutCols.statusAvg && (
                                    <td className="px-3 py-3.5 text-center">
                                      {hours >= gradeAvg && gradeAvg > 0 ? (
                                        <span className="bg-indigo-50 text-indigo-600 text-[10px] font-black px-2.5 py-1 rounded-full border border-indigo-100 whitespace-nowrap">
                                          موفق میانگین
                                        </span>
                                      ) : hours === 0 ? (
                                        <span className="bg-slate-100 text-slate-400 text-[10px] font-black px-2.5 py-1 rounded-full whitespace-nowrap">
                                          ثبت نشده
                                        </span>
                                      ) : (
                                        <span className="bg-amber-50 text-amber-600 text-[10px] font-black px-2.5 py-1 rounded-full border border-amber-100 whitespace-nowrap">
                                          کسری از میانگین
                                        </span>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-100/80 font-black text-slate-800 text-xs border-t-2 border-slate-200">
                              <td className="px-4 py-3.5">خلاصه عملکرد کل دوره‌ها</td>
                              {breakoutCols.timeRange && <td className="px-3 py-3.5 text-center text-[10px] text-slate-500">{periods.length} دوره</td>}
                              {breakoutCols.studentHours && (
                                <td className="px-3 py-3.5 text-center text-indigo-700 text-sm">
                                  {Math.round((selectedStudentSummary?.totalHours || 0) * 60)} دقیقه
                                </td>
                              )}
                              {breakoutCols.mandatoryHours && (
                                <td className="px-3 py-3.5 text-center text-slate-700">
                                  {Math.round(periods.reduce((sum, p) => sum + (p.mandatoryHours || 0), 0) * 60)} دقیقه
                                </td>
                              )}
                              {breakoutCols.gradeAvg && (
                                <td className="px-3 py-3.5 text-center text-slate-600">
                                  میانگین: {Math.round((selectedStudentSummary?.avg || 0) * 60)} دقیقه
                                </td>
                              )}
                              <td className="px-3 py-3.5 text-center text-slate-600" colSpan={
                                (breakoutCols.diffMandatory ? 1 : 0) +
                                (breakoutCols.diffAvg ? 1 : 0) +
                                (breakoutCols.perfRatio ? 1 : 0) +
                                (breakoutCols.relRatio ? 1 : 0) +
                                (breakoutCols.statusMandatory ? 1 : 0) +
                                (breakoutCols.statusAvg ? 1 : 0) || 1
                              }>
                                ثبات ثبت: {((selectedStudentSummary?.consistency || 0) * 100).toFixed(0)}% | میانگین انحراف: {selectedStudentSummary?.avgDev ? (Math.round(selectedStudentSummary.avgDev * 60) > 0 ? `+${Math.round(selectedStudentSummary.avgDev * 60)}` : Math.round(selectedStudentSummary.avgDev * 60)) : '۰'} دقیقه
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-20 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <User className="mx-auto mb-3 text-slate-300" size={40} />
                    <p className="font-bold text-sm text-slate-700">هیچ طلبهای انتخاب نشده است</p>
                    <p className="text-xs text-slate-400 mt-1">
                      لطفاً از کشوی بالا یا جدول فوق، نام یک طلبه را انتخاب کنید تا نمودار روند و تراز رشد او رسم شود.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-24 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">
              <History size={48} className="mx-auto mb-4 opacity-10" />
              <p className="font-bold">هیچ دوره‌ای انتخاب نشده است.</p>
              <p className="text-xs mt-2">لطفا از لیست سمت راست یک دوره را انتخاب کنید یا دوره جدید بسازید.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Entry Modal */}
      <AnimatePresence>
        {showEntryModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 lg:p-10">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[40px] shadow-2xl w-full max-w-5xl max-h-full flex flex-col overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white">
                    <Clock size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800">
                      {editingPeriodId ? 'ویرایش دوره مطالعاتی' : 'ثبت دوره‌ای مطالعات'}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {editingPeriodId ? 'ویرایش عنوان، تاریخ‌ها، میزان موظفی و دقایق مطالعه طلاب' : 'ثبت سریع و دسته‌جمعی دقایق مطالعه طلاب'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowEntryModal(false)}
                  className="p-3 text-slate-400 hover:bg-slate-50 rounded-2xl transition-colors"
                >
                  <ChevronDown size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-8 space-y-10">
                {/* Period Settings */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 bg-slate-50 p-8 rounded-[32px] border border-slate-100">
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[11px] font-black text-slate-500 mr-2 uppercase">عنوان دوره (مثلا هفته اول آبان)</label>
                    <input 
                      type="text"
                      className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-800"
                      placeholder="عنوان دوره را وارد کنید..."
                      value={periodTitle}
                      onChange={(e) => setPeriodTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 mr-2 uppercase">تاریخ شروع</label>
                    <DatePicker
                      calendar={persian}
                      locale={persian_fa}
                      calendarPosition="bottom-right"
                      inputClass="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-800"
                      value={startDate}
                      onChange={(date) => setStartDate(date?.toDate?.().toISOString() || '')}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-500 mr-2 uppercase">تاریخ پایان</label>
                    <DatePicker
                      calendar={persian}
                      locale={persian_fa}
                      calendarPosition="bottom-right"
                      inputClass="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-800"
                      value={endDate}
                      onChange={(date) => setEndDate(date?.toDate?.().toISOString() || '')}
                    />
                  </div>
                  <div className="md:col-span-1 space-y-2">
                    <label className="text-[11px] font-black text-slate-500 mr-2 uppercase">میزان موظفی (دقیقه)</label>
                    <input 
                      type="number"
                      className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-800"
                      placeholder="مثلا 2100"
                      value={mandatoryHours || ''}
                      onChange={(e) => setMandatoryHours(parseFloat(e.target.value))}
                    />
                  </div>
                </div>

                {/* Students List (Vertical layout under each other) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">لیست طلاب فعال</h4>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                      <Info size={12} />
                      <span>با زدن اینتر به نفر بعدی بروید. تمامی مقادیر برحسب دقیقه وارد می‌شوند.</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    {students.map((student, idx) => (
                      <div key={student.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center gap-4 hover:border-indigo-100 transition-all group shadow-sm">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors text-[10px] font-black">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{student.name}</p>
                          <p className="text-[9px] text-slate-400">پایه: {student.grade || '---'}</p>
                        </div>
                        <div className="w-28">
                          <input 
                            ref={el => inputRefs.current[student.id] = el}
                            type="number"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-center font-black text-slate-800 focus:bg-indigo-50 focus:ring-1 focus:ring-indigo-500 outline-none"
                            placeholder="دقیقه"
                            value={entryValues[student.id] || ''}
                            onChange={(e) => setEntryValues({...entryValues, [student.id]: e.target.value})}
                            onKeyDown={(e) => handleKeyDown(e, idx)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-8 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-4 shrink-0">
                <button 
                  onClick={() => setShowEntryModal(false)}
                  className="px-8 py-4 bg-white text-slate-600 rounded-2xl font-bold border border-slate-200 hover:bg-slate-100 transition-all"
                >
                  انصراف
                </button>
                <button 
                  onClick={handleSavePeriod}
                  className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center gap-2"
                >
                  <span>{editingPeriodId ? 'ذخیره تغییرات دوره' : 'ثبت نهایی دوره'}</span>
                  <CheckCircle2 size={20} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ranking / Leaderboard Modal */}
      <AnimatePresence>
        {rankingModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 lg:p-10" dir="rtl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                    <ListOrdered size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">{rankingModal.title}</h3>
                    <p className="text-[10px] text-slate-400 font-bold">نمایش کامل لیست به همراه شاخص محاسباتی ({rankingModal.metricLabel})</p>
                  </div>
                </div>
                <button 
                  onClick={() => setRankingModal(null)}
                  className="p-2 text-slate-400 hover:bg-slate-200/50 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body List */}
              <div className="flex-1 overflow-y-auto p-6 space-y-2">
                {rankingModal.items.map((item) => (
                  <div 
                    key={item.studentId}
                    className={cn(
                      "p-4 rounded-2xl flex items-center justify-between transition-all border",
                      item.rank === 1 ? "bg-amber-50/60 border-amber-200" :
                      item.rank === 2 ? "bg-slate-100/80 border-slate-200" :
                      item.rank === 3 ? "bg-orange-50/50 border-orange-200" :
                      "bg-white border-slate-100 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black",
                        item.rank === 1 ? "bg-amber-500 text-white" :
                        item.rank === 2 ? "bg-slate-600 text-white" :
                        item.rank === 3 ? "bg-orange-500 text-white" :
                        "bg-slate-100 text-slate-600"
                      )}>
                        {item.rank}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{item.name}</p>
                        <p className="text-[9px] text-slate-400">پایه: {item.grade}</p>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100">
                        {item.displayValue}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end shrink-0">
                <button 
                  onClick={() => setRankingModal(null)}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
                >
                  بستن
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Period Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmPeriod && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center shrink-0">
                  <Trash2 size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">تایید حذف دوره مطالعاتی</h3>
                  <p className="text-xs text-slate-500 mt-0.5">این عملیات غیرقابل بازگشت است</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-700 space-y-1">
                <p className="font-bold text-slate-800">عنوان دوره: {deleteConfirmPeriod.title}</p>
                <p className="text-[11px] text-slate-500">
                  تاریخ: {new Date(deleteConfirmPeriod.startDate).toLocaleDateString('fa-IR')} تا {new Date(deleteConfirmPeriod.endDate).toLocaleDateString('fa-IR')}
                </p>
              </div>

              <p className="text-xs font-medium text-slate-600 leading-relaxed">
                آیا از حذف این دوره و تمامی اطلاعات و ثبت‌های مربوط به آن مطمئن هستید؟
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmPeriod(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={confirmDeletePeriodAction}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-200 flex items-center gap-1.5"
                >
                  <Trash2 size={16} />
                  <span>حذف دوره</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
