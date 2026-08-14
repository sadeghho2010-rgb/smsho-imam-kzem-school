import React, { useState, useEffect, useRef } from 'react';
import { 
  BrainCircuit, 
  Loader2,
  User,
  CheckCircle2,
  BarChart2,
  MessageSquare,
  AlertCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  BookOpen,
  Calendar,
  Key,
  X,
  Sparkles,
  Bot,
  RotateCcw,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  Activity,
  Briefcase,
  Home,
  MapPin,
  Heart,
  GraduationCap,
  Send,
  ChevronLeft,
  Download,
  Upload,
  FileText,
  Printer
} from 'lucide-react';
import { collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Student, 
  Attendance, 
  StudyStat, 
  PeriodicStudyLog, 
  StudyPeriod, 
  StudentComment, 
  OralExam, 
  ResearchRecord, 
  Program, 
  Enrollment 
} from '../types';
import { useMentor } from '../context/MentorContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}

interface SummaryProps {
  onNavigate?: (tab: string, studentId?: string) => void;
  initialStudentId?: string;
}

export default function Summary({ onNavigate, initialStudentId }: SummaryProps = {}) {
  const { filterStudents, currentMentorId, shahpooriFilter } = useMentor();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '');
  const [searchFilter, setSearchFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // Custom API Key state
  const [customApiKey, setCustomApiKey] = useState<string>(() => {
    return localStorage.getItem('gemini_api_key_custom') || '';
  });
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyText, setShowApiKeyText] = useState(false);

  // Full Student Data State
  const [studentDetails, setStudentDetails] = useState<{
    info: Student;
    periodicLogs: PeriodicStudyLog[];
    studyPeriods: StudyPeriod[];
    studyStats: StudyStat[];
    overallStudyAvg: number;
    comments: StudentComment[];
    oralExams: OralExam[];
    research: ResearchRecord | null;
    enrolledPrograms: Program[];
  } | null>(null);

  // AI Chat Panel State
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Export / Import & PDF Refs
  const fullImportInputRef = useRef<HTMLInputElement>(null);
  const pdfReportRef = useRef<HTMLDivElement>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [showPdfConfirmModal, setShowPdfConfirmModal] = useState(false);
  const [includeManagerComments, setIncludeManagerComments] = useState(true);

  // Fetch ACTIVE student list only
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, 'students'), where('isActive', '==', true)));
        const rawList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
        const list = filterStudents(rawList, true);
        list.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
        setStudents(list);

        if (initialStudentId && !selectedStudentId) {
          setSelectedStudentId(initialStudentId);
          fetchStudentFullDataWithStudents(initialStudentId, list);
        }
      } catch (err) {
        console.error("Error fetching students:", err);
      }
    };
    fetchStudents();
  }, [currentMentorId, shahpooriFilter]);

  // Full App Export Function
  const handleExportFullData = async () => {
    try {
      setLoading(true);
      const collectionsToExport = [
        'students',
        'study_periods',
        'periodic_study_logs',
        'study_stats',
        'student_comments',
        'oral_exams',
        'research_records',
        'conversation_archives',
        'enrollments',
        'programs',
        'todos'
      ];

      const fullData: Record<string, any[]> = {};

      for (const colName of collectionsToExport) {
        const snap = await getDocs(collection(db, colName));
        fullData[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      const backupObj = {
        exportedAt: new Date().toISOString(),
        appName: "سامانه مدیریت طلاب",
        version: "2.0",
        data: fullData
      };

      const blob = new Blob([JSON.stringify(backupObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_full_app_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting full data:", err);
      alert("خطا در دانلود دیتای کل نرم‌افزار");
    } finally {
      setLoading(false);
    }
  };

  // Full App Import Function
  const handleImportFullData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("آیا از وارد کردن دیتای پشتیبان کامل نرم‌افزار اطمینان دارید؟ داده‌های موجود بروزرسانی خواهند شد.")) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setLoading(true);
        const content = evt.target?.result as string;
        const backupObj = JSON.parse(content);
        if (!backupObj || !backupObj.data) {
          alert("فرمت فایل پشتیبان معتبر نیست.");
          return;
        }

        const dataMap = backupObj.data;
        const batch = writeBatch(db);

        for (const [colName, docsArr] of Object.entries(dataMap)) {
          if (Array.isArray(docsArr)) {
            for (const item of docsArr) {
              const { id, ...rest } = item as any;
              if (id) {
                batch.set(doc(db, colName, id), rest, { merge: true });
              } else {
                batch.set(doc(collection(db, colName)), rest);
              }
            }
          }
        }

        await batch.commit();
        alert("اطلاعات کل نرم‌افزار با موفقیت بازیابی و به‌روزرسانی شد.");
        window.location.reload();
      } catch (err) {
        console.error("Error importing full data:", err);
        alert("خطا در وارد کردن دیتای کل نرم‌افزار.");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  // Open PDF export options modal
  const handleExportPDFReport = () => {
    if (!studentDetails) return;
    setShowPdfConfirmModal(true);
  };

  // Execute PDF Report Export
  const executePdfExport = (includeManager: boolean) => {
    setIncludeManagerComments(includeManager);
    setShowPdfConfirmModal(false);
    setIsExportingPDF(true);

    setTimeout(() => {
      if (!pdfReportRef.current || !studentDetails) {
        setIsExportingPDF(false);
        return;
      }

      const opt = {
        margin: 8,
        filename: `گزارش_جامع_${studentDetails.info.name.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // @ts-ignore
      import('html2pdf.js').then((html2pdfModule) => {
        const html2pdf = html2pdfModule.default || html2pdfModule;
        (html2pdf as any)().set(opt).from(pdfReportRef.current).save().then(() => {
          setIsExportingPDF(false);
        }).catch((err: any) => {
          console.error("PDF export error:", err);
          setIsExportingPDF(false);
        });
      }).catch((err: any) => {
        console.error("html2pdf import error:", err);
        setIsExportingPDF(false);
      });
    }, 300);
  };

  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
      if (students.length > 0) {
        fetchStudentFullDataWithStudents(initialStudentId, students);
      }
    }
  }, [initialStudentId]);

  const fetchStudentFullDataWithStudents = async (studentId: string, studentList: Student[]) => {
    if (!studentId) {
      setStudentDetails(null);
      return;
    }
    setLoading(true);
    try {
      const student = studentList.find(s => s.id === studentId);
      if (!student) return;

      const [
        periodicLogsSnap,
        allPeriodicLogsSnap,
        studyPeriodsSnap,
        studyStatsSnap,
        allStudyStatsSnap,
        commentsSnap, 
        oralExamsSnap, 
        researchSnap,
        enrollmentsSnap,
        programsSnap
      ] = await Promise.all([
        getDocs(query(collection(db, 'periodic_study_logs'), where('studentId', '==', studentId))),
        getDocs(collection(db, 'periodic_study_logs')),
        getDocs(collection(db, 'study_periods')),
        getDocs(query(collection(db, 'study_stats'), where('studentId', '==', studentId))),
        getDocs(collection(db, 'study_stats')),
        getDocs(query(collection(db, 'student_comments'), where('studentId', '==', studentId))),
        getDocs(query(collection(db, 'oral_exams'), where('studentId', '==', studentId))),
        getDocs(query(collection(db, 'research_records'), where('studentId', '==', studentId))),
        getDocs(query(collection(db, 'enrollments'), where('studentId', '==', studentId))),
        getDocs(collection(db, 'programs'))
      ]);

      const periodicLogs = periodicLogsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PeriodicStudyLog));
      const allPeriodicLogs = allPeriodicLogsSnap.docs.map(d => d.data() as PeriodicStudyLog);
      const studyPeriods = studyPeriodsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StudyPeriod));
      const studyStats = studyStatsSnap.docs.map(d => d.data() as StudyStat);

      // Enrolled programs
      const userEnrollments = enrollmentsSnap.docs.map(d => d.data() as Enrollment);
      const programIds = userEnrollments.map(e => e.programId);
      const allPrograms = programsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Program));
      const enrolledPrograms = allPrograms.filter(p => programIds.includes(p.id));

      // Calculate overall average study time per period across all students (in hours)
      const totalAllPeriodicHours = allPeriodicLogs.reduce((sum, l) => sum + (Number(l.hours) || 0), 0);
      const totalAllStatsHours = allStudyStatsSnap.docs.map(d => d.data() as StudyStat)
        .reduce((sum, s) => sum + (Number(s.studyHours) || 0) + (Number(s.discussionHours) || 0), 0);
      
      const totalAllHours = totalAllPeriodicHours + totalAllStatsHours;
      const totalStudentsCount = Math.max(1, studentList.length);
      const totalPeriodsCount = Math.max(1, studyPeriods.length);
      
      const overallStudyAvg = totalAllHours / totalStudentsCount / totalPeriodsCount;

      const comments = commentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StudentComment));
      comments.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());

      const oralExams = oralExamsSnap.docs.map(d => ({ id: d.id, ...d.data() } as OralExam));
      oralExams.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());

      const researchDoc = researchSnap.docs[0];
      const research = researchDoc ? ({ id: researchDoc.id, ...researchDoc.data() } as ResearchRecord) : null;

      setStudentDetails({
        info: student,
        periodicLogs,
        studyPeriods,
        studyStats,
        overallStudyAvg,
        comments,
        oralExams,
        research,
        enrolledPrograms
      });

      setChatMessages([]);

    } catch (error) {
      console.error("Error fetching student details:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentFullData = (studentId: string) => {
    fetchStudentFullDataWithStudents(studentId, students);
  };

  // Save API Key
  const handleSaveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    setCustomApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem('gemini_api_key_custom', trimmed);
    } else {
      localStorage.removeItem('gemini_api_key_custom');
    }
    setShowApiKeyModal(false);
  };

  // Helper for Shamsi Date formatting
  const formatShamsi = (dateStr?: string) => {
    if (!dateStr) return '---';
    if (dateStr.includes('-') && dateStr.length === 10) {
      try {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('fa-IR-u-nu-latn');
        }
      } catch {
        // fallback
      }
    }
    return dateStr;
  };

  // Calculate study metrics accurately in MINUTES
  const getStudyMetrics = () => {
    if (!studentDetails) return { totalMinutes: 0, avgMinutes: 0, overallAvgMinutes: 0, diffMinutes: 0, commitmentRate: 0, count: 0 };
    
    const periodicTotalHours = studentDetails.periodicLogs.reduce((acc, l) => acc + (Number(l.hours) || 0), 0);
    const statsTotalHours = studentDetails.studyStats.reduce((acc, s) => acc + (Number(s.studyHours) || 0) + (Number(s.discussionHours) || 0), 0);
    const totalHours = periodicTotalHours + statsTotalHours;
    const totalMinutes = Math.round(totalHours * 60);

    const periodsCount = studentDetails.studyPeriods.length;
    const logsCount = studentDetails.periodicLogs.length;

    const denominator = periodsCount > 0 ? periodsCount : (logsCount > 0 ? logsCount : 1);
    const avgHours = totalHours / denominator;
    const avgMinutes = Math.round(avgHours * 60);
    
    const overallAvgMinutes = Math.round(studentDetails.overallStudyAvg * 60);
    const diffMinutes = avgMinutes - overallAvgMinutes;
    
    const periodsWithHours = studentDetails.periodicLogs.filter(l => (Number(l.hours) || 0) > 0).length;
    const commitmentDenominator = periodsCount > 0 ? periodsCount : (logsCount > 0 ? logsCount : 1);
    const commitmentRate = Math.round((periodsWithHours / commitmentDenominator) * 100);

    return { 
      totalMinutes, 
      avgMinutes, 
      overallAvgMinutes, 
      diffMinutes, 
      commitmentRate: Math.min(100, Math.max(0, commitmentRate)), 
      count: logsCount || studentDetails.studyStats.length 
    };
  };

  // Calculate comments & oral exam metrics
  const getCommentsMetrics = () => {
    if (!studentDetails) return { 
      myComments: [], 
      importantComments: [], 
      allCommentsCount: 0,
      fiqhAvg: '---', 
      usulAvg: '---', 
      entranceExamsCount: 0,
      retakeCount: 0, 
      examCount: 0, 
      latestExam: null 
    };

    const comments = studentDetails.comments;
    const exams = studentDetails.oralExams;

    const myComments = comments.filter(c => c.authorName === 'خودم (مدیر)' || c.authorName.includes('مدیر'));
    const importantComments = comments.filter(c => c.authorName !== 'خودم (مدیر)' && !c.authorName.includes('مدیر') && (c.priority === 'high' || c.priority === 'medium' || c.needsFollowUp));

    const fiqhExams = exams.filter(e => e.subjectType === 'فقه' && typeof e.score === 'number' && !isNaN(e.score));
    const fiqhAvg = fiqhExams.length > 0 ? (fiqhExams.reduce((sum, e) => sum + (e.score || 0), 0) / fiqhExams.length).toFixed(1) : '---';

    const usulExams = exams.filter(e => e.subjectType === 'اصول' && typeof e.score === 'number' && !isNaN(e.score));
    const usulAvg = usulExams.length > 0 ? (usulExams.reduce((sum, e) => sum + (e.score || 0), 0) / usulExams.length).toFixed(1) : '---';

    const entranceExamsCount = exams.filter(e => e.subjectType === 'امتحان ورودی').length;
    const retakeCount = exams.filter(e => e.isRetake).length;

    const latestExam = exams.length > 0 ? exams[0] : null;

    return {
      myComments,
      importantComments,
      allCommentsCount: comments.length,
      fiqhAvg,
      usulAvg,
      entranceExamsCount,
      retakeCount,
      examCount: exams.length,
      latestExam
    };
  };

  // Send message to Gemini
  const handleSendMessage = async (textToSend?: string) => {
    const messageText = textToSend || inputMessage.trim();
    if (!messageText || !studentDetails || chatLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setChatLoading(true);

    try {
      const historyPayload = chatMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const studyMetrics = getStudyMetrics();
      const commMetrics = getCommentsMetrics();

      const fullContext = {
        مشخصات_طلبه: {
          نام: studentDetails.info.name,
          کد_طلابی: (studentDetails.info as any).code || studentDetails.info.nationalId || 'نامشخص',
          پایه_تحصیلی: studentDetails.info.grade || (studentDetails.info as any).level || 'نامشخص',
          استاد_راهنما: (studentDetails.info as any).mentorName || 'تعیین نشده',
          نام_پدر: studentDetails.info.fatherName || 'نامشخص',
          شغل_پدر: studentDetails.info.fatherOccupation || 'ثبت نشده',
          وضعیت_تاهل: studentDetails.info.maritalStatus || 'مجرد',
          تعداد_فرزندان: studentDetails.info.childrenCount ?? 0,
          وضعیت_سکونت: studentDetails.info.livingStatus ? (studentDetails.info.livingStatus === 'سایر' && studentDetails.info.livingStatusOther ? `سایر (${studentDetails.info.livingStatusOther})` : studentDetails.info.livingStatus) : 'پدری',
          اهل_کجا_هست: studentDetails.info.birthPlace || 'ثبت نشده',
          تلفن: studentDetails.info.phoneNumber || (studentDetails.info as any).phone || 'نامشخص',
        },
        کلاس_ها_و_برنامه_درسی: studentDetails.enrolledPrograms.map(p => ({
          عنوان_کلاس: p.title,
          نوع_درس: p.type,
          روز_برگزاری: p.day || 'تعیین‌نشده',
          ساعت_کلاس: p.time || 'تعیین‌نشده',
          استاد: p.teacher || 'تعیین‌نشده'
        })),
        آمار_مطالعه_به_دقیقه: {
          مجموع_دقایق_مطالعه: studyMetrics.totalMinutes,
          میانگین_دقایق_این_طلبه: studyMetrics.avgMinutes,
          میانگین_دقایق_کل_طلاب_مدرسه: studyMetrics.overallAvgMinutes,
          تفاوت_با_میانگین_کل_دقیقه: studyMetrics.diffMinutes,
          میزان_تعهد_به_ثبت_مطالعه_درصد: `${studyMetrics.commitmentRate}%`,
          تعداد_دوره‌های_ثبت‌شده: studyMetrics.count
        },
        نظرات_و_امتحانات_شفاهی: {
          تعداد_کل_نظرات: commMetrics.allCommentsCount,
          نکات_خودم_مدیریت: commMetrics.myComments.map(c => c.content),
          ارزیابی_های_مهم_اساتید: commMetrics.importantComments.map(c => `${c.authorName}: ${c.content}`),
          امتحانات_شفاهی: {
            تعداد_امتحانات_شرکت_کرده: commMetrics.examCount,
            میانگین_نمرات_فقه: commMetrics.fiqhAvg,
            میانگین_نمرات_اصول: commMetrics.usulAvg,
            تعداد_امتحانات_ورودی: commMetrics.entranceExamsCount,
            تعداد_دفعات_امتحان_مجدد: commMetrics.retakeCount
          }
        },
        وضعیت_پژوهش: {
          مرحله_فعلی: studentDetails.research?.stage || 'ثبت‌نشده',
          عنوان_مقاله: studentDetails.research?.topic || 'ثبت‌نشده',
          ارزیابی: studentDetails.research?.score || 'ثبت‌نشده',
          استاد_راهنما_پژوهش: studentDetails.research?.supervisorNotes || 'ثبت‌نشده'
        }
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentData: fullContext,
          history: historyPayload,
          message: messageText,
          customApiKey: customApiKey || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'خطا در دریافت پاسخ هوش مصنوعی');
      }

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: data.reply || 'پاسخی دریافت نشد.',
        timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
      };

      setChatMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      console.error("Chat error:", err);
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: `⚠️ خطا: ${err.message || 'مشکلی در برقراری ارتباط با Gemini 3 Flash پیش آمد.'}`,
        timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (s.nationalId && s.nationalId.includes(searchFilter)) ||
    ((s as any).code && (s as any).code.includes(searchFilter))
  );

  const studyMetrics = getStudyMetrics();
  const commMetrics = getCommentsMetrics();

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
            <BrainCircuit size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-800">جمع‌بندی پرونده و هوش مصنوعی</h2>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-bold">
                Gemini 3 Flash
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">چکیده جامع آموزشی، پژوهشی، اخلاقی و انضباطی طلبه همراه با دستیار هوشمند</p>
          </div>
        </div>

        {/* Student Selector, Export/Import & API Key Settings */}
        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
          <div className="relative flex-1 md:w-64">
            <select
              className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all shadow-sm"
              value={selectedStudentId}
              onChange={(e) => {
                setSelectedStudentId(e.target.value);
                fetchStudentFullData(e.target.value);
              }}
            >
              <option value="">انتخاب طلبه جهت بررسی (فقط فعال)...</option>
              {filteredStudents.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.grade ? `(پایه ${s.grade})` : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedStudentId && studentDetails && (
            <button
              onClick={handleExportPDFReport}
              disabled={isExportingPDF}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 shrink-0"
              title="دانلود گزارش جامع طلبه به صورت PDF"
            >
              <FileText size={15} />
              <span>{isExportingPDF ? 'در حال تولید PDF...' : 'گزارش PDF طلبه'}</span>
            </button>
          )}

          <button
            onClick={handleExportFullData}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 shrink-0"
            title="دانلود تمام دیتای نرم‌افزار (JSON)"
          >
            <Download size={15} />
            <span className="hidden sm:inline">دانلود دیتای کل</span>
          </button>

          <button
            onClick={() => fullImportInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 shrink-0"
            title="وارد کردن تمام دیتای نرم‌افزار (JSON)"
          >
            <Upload size={15} />
            <span className="hidden sm:inline">وارد کردن دیتای کل</span>
          </button>
          <input 
            type="file" 
            ref={fullImportInputRef} 
            onChange={handleImportFullData} 
            accept=".json" 
            className="hidden" 
          />

          <button
            onClick={() => {
              setApiKeyInput(customApiKey);
              setShowApiKeyModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 shrink-0"
            title="تنظیم کلید API"
          >
            <Key size={15} className={customApiKey ? "text-amber-600" : "text-slate-400"} />
            <span className="hidden sm:inline">{customApiKey ? 'کلید API' : 'کلید API'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 flex flex-col items-center justify-center text-center space-y-4 shadow-sm">
          <Loader2 size={36} className="text-indigo-600 animate-spin" />
          <p className="text-xs font-bold text-slate-600">در حال دریافت و تحلیل تمامی داده‌های پرونده طلبه...</p>
        </div>
      ) : !selectedStudentId || !studentDetails ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-16 flex flex-col items-center justify-center text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500">
            <User size={32} />
          </div>
          <div className="max-w-md">
            <h3 className="text-base font-bold text-slate-800 mb-1">طلبه مورد نظر را انتخاب کنید</h3>
            <p className="text-xs text-slate-400 font-medium">
              جهت مشاهده خلاصه اطلاعات پایه، کلاس‌های ثبت‌نامی، آمار مطالعه، نظرات و نمرات، وضعیت پژوهش و حضور و غیاب، یک طلبه از منوی بالا انتخاب کنید.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Row: Box 1 (Base Info - Expanded) & Box 6 Trigger (AI Chat Button) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Box 1: اطلاعات پایه (Base Info Card with Click to Navigate) - 8 cols */}
            <div 
              onClick={() => onNavigate?.('active-students', selectedStudentId)}
              className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between relative overflow-hidden cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-md shadow-indigo-100 group-hover:scale-105 transition-transform overflow-hidden">
                    {studentDetails.info.photoUrl || (studentDetails.info as any).avatar ? (
                      <img src={studentDetails.info.photoUrl || (studentDetails.info as any).avatar} alt={studentDetails.info.name} className="w-full h-full rounded-2xl object-cover" />
                    ) : (
                      studentDetails.info.name.charAt(0)
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{studentDetails.info.name}</h3>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        studentDetails.info.isActive !== false
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      )}>
                        {studentDetails.info.isActive !== false ? 'فعال' : 'غیرفعال'}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                      نام پدر: {studentDetails.info.fatherName || 'ثبت نشده'}
                    </p>
                  </div>
                </div>

                <div className="text-left hidden sm:block">
                  <span className="text-[10px] font-bold text-slate-400 block">پایه تحصیلی</span>
                  <span className="text-sm font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100 inline-block mt-1">
                    {studentDetails.info.grade || (studentDetails.info as any).level || 'نامشخص'}
                  </span>
                </div>
              </div>

              {/* Comprehensive Info Pills Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mb-0.5">
                    <Briefcase size={12} className="text-indigo-500" /> شغل پدر
                  </span>
                  <span className="text-xs font-bold text-slate-700">{studentDetails.info.fatherOccupation || 'ثبت‌نشده'}</span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mb-0.5">
                    <Heart size={12} className="text-rose-500" /> وضعیت تأهل
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {studentDetails.info.maritalStatus || 'مجرد'}
                    {studentDetails.info.childrenCount !== undefined && studentDetails.info.childrenCount !== null && studentDetails.info.childrenCount > 0 ? ` (${studentDetails.info.childrenCount} فرزند)` : ''}
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mb-0.5">
                    <Home size={12} className="text-amber-500" /> وضعیت سکونت
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    {studentDetails.info.livingStatus ? (
                      studentDetails.info.livingStatus === 'سایر' && studentDetails.info.livingStatusOther 
                        ? `سایر (${studentDetails.info.livingStatusOther})` 
                        : studentDetails.info.livingStatus
                    ) : 'پدری'}
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mb-0.5">
                    <MapPin size={12} className="text-emerald-500" /> اهل کجا هست
                  </span>
                  <span className="text-xs font-bold text-slate-700">{studentDetails.info.birthPlace || 'ثبت‌نشده'}</span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">کد طلابی / کد ملی</span>
                  <span className="text-xs font-bold text-slate-700">{(studentDetails.info as any).code || studentDetails.info.nationalId || '---'}</span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">استاد راهنما</span>
                  <span className="text-xs font-bold text-slate-700">{(studentDetails.info as any).mentorName || 'تعیین‌نشده'}</span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">شماره همراه</span>
                  <span className="text-xs font-bold text-slate-700 dir-ltr text-right">{studentDetails.info.phoneNumber || (studentDetails.info as any).phone || '---'}</span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 block mb-0.5">ورود به پرونده</span>
                  <span className="text-xs font-bold text-indigo-600 flex items-center gap-1 group-hover:underline">
                    <ChevronLeft size={14} /> مشاهده کامل
                  </span>
                </div>
              </div>
            </div>

            {/* Box 6: AI Trigger Card (Smart AI Analysis Box) - 4 cols */}
            <div className="lg:col-span-4 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white flex flex-col justify-between relative overflow-hidden shadow-lg shadow-indigo-200">
              <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={20} className="text-amber-400 animate-pulse" />
                    <span className="text-xs font-black tracking-wide text-indigo-200 uppercase">تحلیل هوشمند</span>
                  </div>
                  <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded-md border border-white/10 text-indigo-200 font-mono">
                    Gemini AI
                  </span>
                </div>
                <h4 className="text-sm font-bold text-white mb-2">گفت‌وگو با دستیار هوش مصنوعی</h4>
                <p className="text-[11px] text-indigo-200/80 leading-relaxed">
                  تمامی داده‌های پرونده شامل مشخصات، آمار مطالعه (دقیقه)، نظرات، امتحانات و وضعیت پژوهش آماده تحلیل هوشمند است.
                </p>
              </div>

              <div className="pt-4 mt-2">
                <button
                  onClick={() => setShowChatPanel(true)}
                  className="w-full py-3 px-4 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <Bot size={18} />
                  <span>باز کردن پنل گفت‌وگو و تحلیل هوشمند</span>
                </button>
              </div>
            </div>
          </div>

          {/* New Box: برنامه درسی و کلاس‌های ثبت‌نامی (Enrolled Programs Box - Clickable) */}
          <div 
            onClick={() => onNavigate?.('programs')}
            className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm cursor-pointer hover:border-indigo-400 transition-all group"
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <GraduationCap size={20} className="text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">کلاس‌ها و برنامه درسی طلبه</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-xl">
                  {studentDetails.enrolledPrograms.length} کلاس ثبت‌نام شده
                </span>
                <ChevronLeft size={16} className="text-slate-400 group-hover:text-indigo-600 group-hover:-translate-x-1 transition-all" />
              </div>
            </div>

            {studentDetails.enrolledPrograms.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {studentDetails.enrolledPrograms.map((prog) => (
                  <div key={prog.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 hover:border-indigo-300 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-slate-800">{prog.title}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md">
                        {prog.type}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-slate-600 font-medium pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Calendar size={13} className="text-slate-400" />
                        <span>روز و ساعت: <b className="text-slate-700">{prog.day || 'نامشخص'} - {prog.time || 'نامشخص'}</b></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <User size={13} className="text-slate-400" />
                        <span>استاد: <b className="text-slate-700">{prog.teacher || 'نامشخص'}</b></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs font-medium">
                این طلبه هنوز در هیچ یک از برنامه‌های درسی مدرسه ثبت‌نام نشده است.
              </div>
            )}
          </div>

          {/* 3 Main Analytical Cards Grid: Always 3 columns side-by-side on laptop screens */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Column 1: خلاصه آمار مطالعه و وضعیت مقایسه‌ای (به دقیقه) */}
            <div 
              onClick={() => onNavigate?.('stats', selectedStudentId)}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between cursor-pointer hover:border-indigo-400 transition-all group h-full"
            >
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock size={18} className="text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">خلاصه مطالعه (دقیقه)</h3>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-indigo-600">
                    <span>{studyMetrics.count} دوره</span>
                    <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3 mb-4">
                  {/* Total & Average Study in Minutes */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-slate-400 block mb-1">مجموع و میانگین مطالعه</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-black text-slate-800">{studyMetrics.totalMinutes.toLocaleString('fa-IR')}</span>
                      <span className="text-[11px] font-bold text-slate-500">دقیقه کل</span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 mt-1">
                      میانگین طلبه: <b className="text-slate-800 dir-ltr inline-block">{studyMetrics.avgMinutes.toLocaleString('fa-IR')}</b> دقیقه/دوره
                    </span>
                  </div>

                  {/* Overall Comparison in Minutes */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-slate-400 block mb-1">مقایسه با میانگین کل طلاب</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {studyMetrics.diffMinutes >= 0 ? (
                        <TrendingUp size={18} className="text-emerald-600" />
                      ) : (
                        <TrendingDown size={18} className="text-rose-600" />
                      )}
                      <span className={cn(
                        "text-sm font-black dir-ltr",
                        studyMetrics.diffMinutes >= 0 ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {studyMetrics.diffMinutes >= 0 ? '+' : ''}{studyMetrics.diffMinutes.toLocaleString('fa-IR')} دقیقه
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 mt-1">
                      میانگین مدرسه: <b className="text-slate-700 dir-ltr inline-block">{studyMetrics.overallAvgMinutes.toLocaleString('fa-IR')}</b> دقیقه
                    </span>
                  </div>
                </div>
              </div>

              {/* Commitment Progress Bar */}
              <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100 mt-2">
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-700 flex items-center gap-1.5">
                    <Activity size={14} className="text-indigo-600" />
                    تعهد به ثبت مطالعه:
                  </span>
                  <span className={cn(
                    "font-black dir-ltr",
                    studyMetrics.commitmentRate >= 80 ? "text-emerald-700" :
                    studyMetrics.commitmentRate >= 50 ? "text-amber-700" : "text-rose-700"
                  )}>
                    {studyMetrics.commitmentRate}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      studyMetrics.commitmentRate >= 80 ? "bg-emerald-500" :
                      studyMetrics.commitmentRate >= 50 ? "bg-amber-500" : "bg-rose-500"
                    )}
                    style={{ width: `${Math.min(100, studyMetrics.commitmentRate)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Column 2: خلاصه بخش نظرات و صحبت‌ها و امتحانات */}
            <div 
              onClick={() => onNavigate?.('comments', selectedStudentId)}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between cursor-pointer hover:border-indigo-400 transition-all group h-full"
            >
              <div>
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <MessageSquare size={18} className="text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">نظرات و امتحانات</h3>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-bold text-indigo-600">
                    <span>{commMetrics.allCommentsCount} نظر</span>
                    <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* My Comments & Important Comments Split */}
                <div className="space-y-3 mb-3">
                  {/* Manager / My Comments */}
                  <div className="bg-indigo-50/40 p-3 rounded-xl border border-indigo-100/80">
                    <span className="text-[10px] font-black text-indigo-800 block mb-1 flex items-center gap-1">
                      <User size={12} className="text-indigo-600" /> صحبت‌های خودم (مدیریت)
                    </span>
                    {commMetrics.myComments.length > 0 ? (
                      <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed font-medium">
                        «{commMetrics.myComments[0].content}»
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">هنوز نکته‌ای از جانب شما ثبت نشده است.</p>
                    )}
                  </div>

                  {/* Important Comments from Other Teachers */}
                  <div className="bg-amber-50/40 p-3 rounded-xl border border-amber-100/80">
                    <span className="text-[10px] font-black text-amber-800 block mb-1 flex items-center gap-1">
                      <AlertCircle size={12} className="text-amber-600" /> ارزیابی‌های مهم سایر اساتید
                    </span>
                    {commMetrics.importantComments.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-0.5">
                          <span>{commMetrics.importantComments[0].authorName}</span>
                          <span className="text-amber-700">{formatShamsi(commMetrics.importantComments[0].date)}</span>
                        </div>
                        <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed font-medium">
                          «{commMetrics.importantComments[0].content}»
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">نظر مهم یا اولویت‌داری وجود ندارد.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Oral Exam Metrics */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 mt-2">
                <span className="text-[10px] font-black text-slate-700 block mb-2 border-b border-slate-200/60 pb-1">
                  آمار امتحانات شفاهی و ورودی
                </span>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                    <span className="text-[8px] font-bold text-slate-400 block">آزمون‌ها</span>
                    <span className="text-xs font-black text-slate-800">{commMetrics.examCount}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                    <span className="text-[8px] font-bold text-emerald-600 block">فقه</span>
                    <span className="text-xs font-black text-emerald-800 dir-ltr">{commMetrics.fiqhAvg}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                    <span className="text-[8px] font-bold text-indigo-600 block">اصول</span>
                    <span className="text-xs font-black text-indigo-800 dir-ltr">{commMetrics.usulAvg}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-slate-100">
                    <span className="text-[8px] font-bold text-amber-600 block">مجدد</span>
                    <span className="text-xs font-black text-amber-800">{commMetrics.retakeCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: وضعیت پژوهش و مقالات */}
            <div 
              onClick={() => onNavigate?.('research', selectedStudentId)}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between cursor-pointer hover:border-indigo-400 transition-all group h-full"
            >
              <div>
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <BookOpen size={18} className="text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">وضعیت پژوهش و مقالات</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-2.5 py-0.5 rounded-lg text-[10px] font-bold border",
                      studentDetails.research?.stage === 'تاخیر دارد'
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : studentDetails.research
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                        : "bg-slate-100 text-slate-500 border-slate-200"
                    )}>
                      مرحله: {studentDetails.research?.stage || 'ثبت‌نشده'}
                    </span>
                    <ChevronLeft size={16} className="text-slate-400 group-hover:text-indigo-600 group-hover:-translate-x-1 transition-all" />
                  </div>
                </div>

                {studentDetails.research ? (
                  <div className="space-y-3.5 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5">عنوان مقاله / پژوهش</span>
                      <p className="font-bold text-slate-800 leading-snug">
                        {studentDetails.research.topic || studentDetails.research.description || 'بدون عنوان'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 block mb-0.5">ارزیابی و نمره</span>
                        <p className="font-bold text-slate-800">
                          {studentDetails.research.score || 'در حال بررسی'}
                        </p>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 block mb-0.5">نوع پژوهش</span>
                        <p className="font-bold text-slate-800">
                          {studentDetails.research.type === 'group' ? 'گروهی' : 'فردی'}
                        </p>
                      </div>
                    </div>

                    {studentDetails.research.professorNotes && (
                      <div className="bg-indigo-50/30 p-3 rounded-xl border border-indigo-100">
                        <span className="text-[10px] font-bold text-indigo-600 block mb-0.5">ملاحظات استاد پژوهش</span>
                        <p className="text-slate-700 font-medium line-clamp-2">
                          {studentDetails.research.professorNotes}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs font-medium border border-dashed border-slate-200 rounded-xl p-4">
                    سابقه پژوهشی ثبت نشده است. برای ویرایش وضعیت کلیک کنید.
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-[11px] font-bold text-indigo-600">
                <span>ورود به بخش پژوهش و نگارش</span>
                <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* AI Chat Slide-over Drawer / Panel */}
      <AnimatePresence>
        {showChatPanel && (
          <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowChatPanel(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* Chat Panel Content */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-xl bg-slate-900 text-white h-full shadow-2xl flex flex-col z-10 border-r border-slate-800"
            >
              {/* Drawer Header */}
              <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                    <Bot size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">دستیار گفت‌وگوی هوشمند</h3>
                      <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-[9px] font-mono">
                        Gemini 3 Flash
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      تحلیل پرونده: {studentDetails?.info.name || 'طلبه انتخابی'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowChatPanel(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Context Summary Banner */}
              <div className="px-4 py-2.5 bg-indigo-950/40 border-b border-indigo-900/40 flex items-center justify-between text-[11px] text-indigo-200">
                <span className="flex items-center gap-1.5 font-medium">
                  <Sparkles size={14} className="text-amber-400" />
                  اطلاعات کامل پرونده آماده ارسال به هوش مصنوعی است
                </span>
                <button
                  onClick={() => setChatMessages([])}
                  className="text-[10px] text-slate-400 hover:text-indigo-300 flex items-center gap-1"
                  title="پاک کردن تاریخچه چت"
                >
                  <RotateCcw size={12} /> پاک کردن
                </button>
              </div>

              {/* Chat Messages Body */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 font-vazir">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 p-6">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-900/30 border border-indigo-800 flex items-center justify-center text-indigo-400">
                      <BrainCircuit size={32} />
                    </div>
                    <div className="max-w-xs space-y-1">
                      <h4 className="text-sm font-bold text-white">گفت‌وگو بر اساس پرونده طلبه</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        شما می‌توانید درباره نقاط قوت، راهکارهای بهبود مطالعه، انضباط یا ارزیابی کلی این طلبه از هوش مصنوعی سوال بپرسید.
                      </p>
                    </div>

                    {/* Preset Query Buttons */}
                    <div className="w-full space-y-2 pt-2">
                      <button
                        onClick={() => handleSendMessage('لطفا یک تحلیل جامع از وضعیت تحصیلی، اخلاقی و انضباطی این طلبه ارائه دهید.')}
                        className="w-full p-2.5 bg-slate-800/80 hover:bg-indigo-900/40 border border-slate-700 hover:border-indigo-500/50 rounded-xl text-xs text-right text-indigo-200 transition-all"
                      >
                        📊 تحلیل جامع از وضعیت تحصیلی، اخلاقی و انضباطی
                      </button>
                      <button
                        onClick={() => handleSendMessage('نقاط قوت و ضعف این طلبه در آمار مطالعه، کلاس‌های ثبت‌نامی و حضور و غیاب چیست؟')}
                        className="w-full p-2.5 bg-slate-800/80 hover:bg-indigo-900/40 border border-slate-700 hover:border-indigo-500/50 rounded-xl text-xs text-right text-indigo-200 transition-all"
                      >
                        ⏱️ بررسی میزان تعهد به مطالعه و حضور در کلاس‌ها
                      </button>
                      <button
                        onClick={() => handleSendMessage('بر اساس نظرات اساتید و نمرات شفاهی، چه پیشنهادهایی برای رشد علمی او دارید؟')}
                        className="w-full p-2.5 bg-slate-800/80 hover:bg-indigo-900/40 border border-slate-700 hover:border-indigo-500/50 rounded-xl text-xs text-right text-indigo-200 transition-all"
                      >
                        💡 پیشنهادات بهبود بر اساس ارزیابی اساتید
                      </button>
                    </div>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex flex-col max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed",
                        msg.role === 'user'
                          ? "mr-auto bg-indigo-600 text-white rounded-tl-none"
                          : "ml-auto bg-slate-800 text-slate-100 border border-slate-700/80 rounded-tr-none"
                      )}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1 border-b border-white/10 pb-1 text-[10px] opacity-75">
                        <span className="font-bold">
                          {msg.role === 'user' ? 'شما' : 'هوش مصنوعی Gemini 3 Flash'}
                        </span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <div className="whitespace-pre-wrap font-medium">
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}

                {chatLoading && (
                  <div className="ml-auto bg-slate-800/80 border border-slate-700 text-indigo-300 p-3.5 rounded-2xl rounded-tr-none text-xs flex items-center gap-3">
                    <Loader2 size={16} className="animate-spin text-indigo-400" />
                    <span>در حال تحلیل و نگارش پاسخ توسط Gemini 3 Flash...</span>
                  </div>
                )}
              </div>

              {/* Chat Input Footer */}
              <div className="p-3 bg-slate-950 border-t border-slate-800">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder="سوال یا درخواست از هوش مصنوعی..."
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    disabled={chatLoading}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !inputMessage.trim()}
                    className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-all shadow-md"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* API Key Modal */}
      <AnimatePresence>
        {showApiKeyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowApiKeyModal(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 z-10 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-indigo-600">
                  <Key size={20} />
                  <h3 className="text-sm font-bold text-slate-800">تنظیم کلید Gemini API</h3>
                </div>
                <button
                  onClick={() => setShowApiKeyModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                شما می‌توانید کلید API اختصاصی گوگل جمینای خود را وارد کنید. این کلید در مرورگر شما ذخیره شده و برای تمام درخواست‌ها به مدل <b>Gemini 3 Flash</b> استفاده خواهد شد.
              </p>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700">Gemini API Key</label>
                <div className="relative">
                  <input
                    type={showApiKeyText ? "text" : "password"}
                    placeholder="AIzaSy..."
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKeyText(!showApiKeyText)}
                    className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showApiKeyText ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 block pt-1">
                  در صورت خالی گذاشتن، کلید پیش‌فرض سیستم استفاده خواهد شد.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleSaveApiKey}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  <Check size={16} />
                  <span>ذخیره کلید</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* PDF Export Confirmation Modal */}
      <AnimatePresence>
        {showPdfConfirmModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-slate-100"
              dir="rtl"
            >
              <div className="flex items-center gap-3 text-indigo-600">
                <div className="p-2.5 bg-indigo-50 rounded-xl">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">تنظیمات خروجی گزارش PDF</h3>
                  <p className="text-[11px] text-slate-500">طلبه: {studentDetails?.info.name}</p>
                </div>
              </div>

              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-2">
                <p className="text-xs font-bold text-slate-800 leading-relaxed">
                  آیا نظرات ثبت‌شده توسط خود شما (مدیریت) نیز در گزارش PDF ذکر شود؟
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  با انتخاب هر گزینه، فایل PDF شامل آمار کامل مطالعه دوره به دوره، نمرات تک تک امتحانات شفاهی و نظرات استاد تولید خواهد شد.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => executePdfExport(true)}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
                >
                  <span>بله، نظرات من (مدیریت) همراه نظرات اساتید درج شود</span>
                </button>

                <button
                  type="button"
                  onClick={() => executePdfExport(false)}
                  className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 flex items-center justify-center gap-2"
                >
                  <span>خیر، فقط نظرات اساتید درج شود</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowPdfConfirmModal(false)}
                  className="w-full py-2 text-slate-400 hover:text-slate-600 text-xs font-medium transition-colors mt-1"
                >
                  انصراف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Printable PDF Container */}
      {studentDetails && (
        <div className="hidden">
          <div ref={pdfReportRef} className="p-8 bg-white text-slate-800 space-y-6 dir-rtl text-xs" style={{ fontFamily: 'Tahoma, Arial, sans-serif' }}>
            
            {/* Report Header */}
            <div className="border-b-2 border-indigo-600 pb-4 flex justify-between items-center">
              <div className="flex items-center gap-4">
                {studentDetails.info.photoUrl && (
                  <img 
                    src={studentDetails.info.photoUrl} 
                    alt={studentDetails.info.name} 
                    className="w-16 h-16 rounded-xl object-cover border-2 border-indigo-200 shadow-sm shrink-0" 
                  />
                )}
                <div>
                  <h1 className="text-xl font-bold text-slate-900">پرونده و گزارش جامع وضعیت طلبه</h1>
                  <p className="text-xs text-slate-500 mt-1">سامانه جامع مدیریت آموزشی، پژوهشی و تربیتی مدرسه علمیه</p>
                </div>
              </div>
              <div className="text-left text-xs text-slate-500">
                <div><b>تاریخ صدور گزارش:</b> {new Date().toLocaleDateString('fa-IR')}</div>
                <div><b>نام طلبه:</b> <b className="text-indigo-900 text-sm">{studentDetails.info.name}</b></div>
              </div>
            </div>

            {/* 1. Base Info */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200" style={{ pageBreakInside: 'avoid' }}>
              <h2 className="text-sm font-bold text-indigo-900 mb-3 border-b border-slate-200 pb-1 flex justify-between items-center">
                <span>مشخصات فردی و شناسنامه‌ای</span>
                <span className="text-[11px] text-slate-500 font-normal">پایه تحصیلی: {studentDetails.info.grade || '---'}</span>
              </h2>
              <div className="grid grid-cols-3 gap-3 text-xs leading-relaxed">
                <div><b>نام و نام خانوادگی:</b> {studentDetails.info.name}</div>
                <div><b>پایه تحصیلی:</b> {studentDetails.info.grade || '---'}</div>
                <div><b>کد طلابی / کد ملی:</b> {(studentDetails.info as any).code || studentDetails.info.nationalId || '---'}</div>
                <div><b>نام پدر:</b> {studentDetails.info.fatherName || '---'}</div>
                <div><b>شغل پدر:</b> {studentDetails.info.fatherJob || '---'}</div>
                <div><b>محل تولد / صادره:</b> {studentDetails.info.birthPlace || '---'}</div>
                <div><b>وضعیت تأهل:</b> {studentDetails.info.maritalStatus || 'مجرد'}{studentDetails.info.childrenCount ? ` (${studentDetails.info.childrenCount} فرزند)` : ''}</div>
                <div><b>وضعیت سکونت:</b> {studentDetails.info.livingStatus || 'پدری'}</div>
                <div><b>شماره تماس:</b> {studentDetails.info.phoneNumber || '---'}</div>
                <div><b>استاد راهنما:</b> {(studentDetails.info as any).mentorName || '---'}</div>
              </div>
            </div>

            {/* 2. Study Stats & Individual Period Breakdown */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200" style={{ pageBreakInside: 'avoid' }}>
              <h2 className="text-sm font-bold text-indigo-900 mb-2 border-b border-slate-200 pb-1">
                خلاصه و آمار تفکیکی مطالعه (دوره به دوره)
              </h2>
              
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3 text-xs mb-4 bg-white p-3 rounded border border-slate-200">
                <div><b>مجموع کل مطالعه:</b> {studyMetrics.totalMinutes.toLocaleString('fa-IR')} دقیقه</div>
                <div><b>میانگین هر دوره:</b> {studyMetrics.avgMinutes.toLocaleString('fa-IR')} دقیقه</div>
                <div><b>میزان تعهد به ثبت:</b> {studyMetrics.commitmentRate}%</div>
              </div>

              {/* Period Breakdown Table */}
              <h3 className="text-xs font-bold text-slate-700 mb-2">جدول آمار تک تک دوره‌های مطالعه:</h3>
              {studentDetails.studyPeriods.length > 0 ? (
                <table className="w-full text-right text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-200 text-slate-800 font-bold">
                      <th className="border border-slate-300 px-2 py-1.5 w-8 text-center">#</th>
                      <th className="border border-slate-300 px-2 py-1.5">عنوان دوره</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-center">بازه زمانی</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-center">مطالعه ثبت‌شده</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-center">الزام قانونی دوره</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentDetails.studyPeriods.map((period, index) => {
                      const log = studentDetails.periodicLogs.find(l => l.periodId === period.id);
                      const loggedHours = log ? Number(log.hours) || 0 : 0;
                      const loggedMinutes = Math.round(loggedHours * 60);
                      const mandatoryHours = Number(period.mandatoryHours) || 0;
                      const mandatoryMinutes = Math.round(mandatoryHours * 60);

                      return (
                        <tr key={period.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                          <td className="border border-slate-300 px-2 py-1 text-center font-bold">{index + 1}</td>
                          <td className="border border-slate-300 px-2 py-1 font-bold">{period.title}</td>
                          <td className="border border-slate-300 px-2 py-1 text-center text-[11px] dir-ltr">
                            {formatShamsi(period.startDate)} تا {formatShamsi(period.endDate)}
                          </td>
                          <td className="border border-slate-300 px-2 py-1 text-center font-bold text-indigo-900">
                            {loggedMinutes.toLocaleString('fa-IR')} دقیقه
                          </td>
                          <td className="border border-slate-300 px-2 py-1 text-center text-slate-600">
                            {mandatoryMinutes > 0 ? `${mandatoryMinutes.toLocaleString('fa-IR')} دقیقه` : '---'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-slate-500 italic bg-white p-2 rounded border border-slate-200">
                  دوره‌‌ای ثبت نشده است.
                </p>
              )}
            </div>

            {/* 3. Oral Exams & Individual Scores */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200" style={{ pageBreakInside: 'avoid' }}>
              <h2 className="text-sm font-bold text-indigo-900 mb-2 border-b border-slate-200 pb-1">
                گزارش و نمرات تک تک امتحانات شفاهی
              </h2>

              {/* Summary stats */}
              <div className="grid grid-cols-4 gap-2 text-xs mb-4 bg-white p-3 rounded border border-slate-200 text-center">
                <div><b>کل آزمون‌ها:</b> {commMetrics.examCount}</div>
                <div><b>میانگین فقه:</b> {commMetrics.fiqhAvg}</div>
                <div><b>میانگین اصول:</b> {commMetrics.usulAvg}</div>
                <div><b>امتحانات مجدد:</b> {commMetrics.retakeCount}</div>
              </div>

              {/* Detailed Oral Exams Table */}
              <h3 className="text-xs font-bold text-slate-700 mb-2">جدول نمرات تک تک امتحانات شفاهی و ورودی:</h3>
              {studentDetails.oralExams.length > 0 ? (
                <table className="w-full text-right text-xs border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-200 text-slate-800 font-bold">
                      <th className="border border-slate-300 px-2 py-1.5 w-8 text-center">#</th>
                      <th className="border border-slate-300 px-2 py-1.5">عنوان آزمون / مادة درسی</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-center">نوع درس</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-center">نمره (از ۲۰)</th>
                      <th className="border border-slate-300 px-2 py-1.5">استاد ممتحن</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-center">تاریخ</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-center">نوع آزمون</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentDetails.oralExams.map((exam, index) => (
                      <tr key={exam.id} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="border border-slate-300 px-2 py-1 text-center font-bold">{index + 1}</td>
                        <td className="border border-slate-300 px-2 py-1 font-bold">
                          {exam.title}
                          {exam.notes && <div className="text-[10px] text-slate-500 font-normal mt-0.5">ملاحظات: {exam.notes}</div>}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-center">{exam.subjectType}</td>
                        <td className="border border-slate-300 px-2 py-1 text-center font-black text-indigo-900 dir-ltr">
                          {exam.score}
                        </td>
                        <td className="border border-slate-300 px-2 py-1">{exam.examinerName || '---'}</td>
                        <td className="border border-slate-300 px-2 py-1 text-center dir-ltr">{formatShamsi(exam.date)}</td>
                        <td className="border border-slate-300 px-2 py-1 text-center">
                          {exam.isRetake ? (
                            <span className="text-amber-800 font-bold">امتحان مجدد</span>
                          ) : (
                            <span className="text-emerald-800">اصلی</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-xs text-slate-500 italic bg-white p-2 rounded border border-slate-200">
                  هیچ امتحان شفاهی برای این طلبه ثبت نشده است.
                </p>
              )}
            </div>

            {/* 4. Complete Teacher & Manager Comments */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200" style={{ pageBreakInside: 'avoid' }}>
              <h2 className="text-sm font-bold text-indigo-900 mb-2 border-b border-slate-200 pb-1 flex justify-between items-center">
                <span>تمامی نظرات و ارزیابی‌های اساتید {includeManagerComments ? 'و مدیریت' : ''}</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  ({includeManagerComments ? 'شامل نظرات مدیریت' : 'بدون نظرات مدیریت'})
                </span>
              </h2>

              {(() => {
                const commentsToDisplay = includeManagerComments 
                  ? studentDetails.comments 
                  : studentDetails.comments.filter(c => c.authorName !== 'خودم (مدیر)' && !c.authorName.includes('مدیر'));

                if (commentsToDisplay.length === 0) {
                  return (
                    <p className="text-xs text-slate-500 italic bg-white p-2 rounded border border-slate-200">
                      نظری ثبت نشده است.
                    </p>
                  );
                }

                return (
                  <div className="space-y-2.5 mt-3">
                    {commentsToDisplay.map((comment, index) => (
                      <div key={comment.id || index} className="bg-white p-3 rounded-lg border border-slate-200 text-xs">
                        <div className="flex justify-between items-center mb-1.5 pb-1 border-b border-slate-100 font-bold text-slate-800">
                          <span className="text-indigo-900">
                            {comment.authorName} {comment.category ? `(${comment.category})` : ''}
                          </span>
                          <span className="text-[10px] text-slate-500 dir-ltr">{formatShamsi(comment.date)}</span>
                        </div>
                        <p className="text-slate-800 leading-relaxed font-medium">
                          «{comment.content}»
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* 5. Research Section */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200" style={{ pageBreakInside: 'avoid' }}>
              <h2 className="text-sm font-bold text-indigo-900 mb-2 border-b border-slate-200 pb-1">
                وضعیت پژوهش و نگارش مقاله
              </h2>
              {studentDetails.research ? (
                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded border border-slate-200">
                    <div><b>عنوان مقاله / پژوهش:</b> {studentDetails.research.topic || studentDetails.research.description || 'بدون عنوان'}</div>
                    <div><b>مرحله پژوهش:</b> {studentDetails.research.stage || 'ثبت‌نشده'}</div>
                    <div><b>نمره / ارزیابی:</b> {studentDetails.research.score || 'در حال بررسی'}</div>
                    <div><b>نوع پژوهش:</b> {studentDetails.research.type === 'group' ? 'گروهی' : 'فردی'}</div>
                  </div>
                  {studentDetails.research.professorNotes && (
                    <div className="bg-white p-2.5 rounded border border-slate-200">
                      <b>ملاحظات استاد راهنمای پژوهش:</b>
                      <p className="mt-1 text-slate-700 leading-relaxed">«{studentDetails.research.professorNotes}»</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic bg-white p-2 rounded border border-slate-200">
                  سابقه پژوهشی ثبت نشده است.
                </p>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
