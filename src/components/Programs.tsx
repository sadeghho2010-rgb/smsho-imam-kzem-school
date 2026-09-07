import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Calendar, 
  Clock, 
  User, 
  Trash2, 
  Users,
  Search,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  GitFork,
  Edit3,
  BookOpen,
  MessageSquare,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Printer,
  Download,
  CheckCircle2,
  Layers,
  HelpCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Program, Student, Enrollment } from '../types';
import { localDb } from '../lib/localDb';
import { useMentor, getStudentMentorKey } from '../context/MentorContext';
import { cn, WEEK_DAYS, getProgramDays } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { exportElementToPdf } from '../lib/pdfExport';
import { exportElementToImage } from '../lib/imageExport';

export default function Programs() {
  const { filterStudents, currentMentorId, currentMentor, shahpooriFilter } = useMentor();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const DEFAULT_MAIN_DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه'];

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  const [addModalDays, setAddModalDays] = useState<string[]>(DEFAULT_MAIN_DAYS);
  const [editModalDays, setEditModalDays] = useState<string[]>([]);
  
  const [newProgram, setNewProgram] = useState<Partial<Program>>({ 
    title: '', 
    type: 'اصلی', 
    day: '', 
    time: '', 
    teacher: '',
    parentProgramId: ''
  });

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedEnrollments, setSelectedEnrollments] = useState<string[]>([]);
  const [enrollSearchTerm, setEnrollSearchTerm] = useState('');

  // Hierarchy Display Toggles
  const [showMainStudents, setShowMainStudents] = useState<boolean>(true);
  const [showCounselingStudents, setShowCounselingStudents] = useState<boolean>(true);

  // Export states & refs
  const [isExportingImage, setIsExportingImage] = useState(false);
  const [isExportingClassPdf, setIsExportingClassPdf] = useState(false);
  const [isExportingHierarchyPdf, setIsExportingHierarchyPdf] = useState(false);
  const [activePrintClass, setActivePrintClass] = useState<{ program: Program; students: Student[] } | null>(null);

  const hierarchyChartRef = useRef<HTMLDivElement>(null);
  const classPdfPrintRef = useRef<HTMLDivElement>(null);
  const hierarchyPdfPrintRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const rawPrograms = await localDb.getDocs<Program>('programs');
      const rawStudents = await localDb.getDocs<Student>('students');
      const rawEnrollments = await localDb.getDocs<Enrollment>('enrollments');

      setStudents(rawStudents);
      setEnrollments(rawEnrollments);

      // Filter programs based on mentor
      const filteredP = rawPrograms.filter(p => {
        if (currentMentorId === 'shahpoori') {
          if (shahpooriFilter === 'all') return true;
          if (p.mentorId) return p.mentorId === shahpooriFilter;
          const enrolledIds = rawEnrollments.filter(e => e.programId === p.id).map(e => e.studentId);
          const targetStudents = rawStudents.filter(s => s.isActive && getStudentMentorKey(s.grade) === shahpooriFilter);
          return enrolledIds.some(id => targetStudents.some(ts => ts.id === id));
        }

        if (p.mentorId) {
          return p.mentorId === currentMentorId;
        }

        const enrolledIds = rawEnrollments.filter(e => e.programId === p.id).map(e => e.studentId);
        const myStudents = filterStudents(rawStudents, true);
        if (enrolledIds.length > 0) {
          return enrolledIds.some(id => myStudents.some(ms => ms.id === id));
        }
        return false;
      });

      setPrograms(filteredP);
    } catch (error) {
      console.error("Error fetching programs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsub = localDb.subscribe(() => {
      fetchData();
    });
    return () => unsub();
  }, [currentMentorId, shahpooriFilter]);

  const handleEnrollClick = (programId: string) => {
    const currentEnrollments = enrollments
      .filter(e => e.programId === programId)
      .map(e => e.studentId);
    setSelectedEnrollments(currentEnrollments);
    setSelectedProgramId(programId);
    setShowEnrollModal(true);
  };

  const handleSaveEnrollments = async () => {
    if (!selectedProgramId) return;
    setLoading(true);
    try {
      const currentEnrollments = enrollments.filter(e => e.programId === selectedProgramId);
      const currentStudentIds = currentEnrollments.map(e => e.studentId);

      // Add new ones
      const toAdd = selectedEnrollments.filter(id => !currentStudentIds.includes(id));
      for (const studentId of toAdd) {
        await localDb.addDoc('enrollments', {
          studentId,
          programId: selectedProgramId
        });
      }

      // Remove deselected
      const toRemove = currentEnrollments.filter(e => !selectedEnrollments.includes(e.studentId));
      for (const enrollment of toRemove) {
        await localDb.deleteDoc('enrollments', enrollment.id);
      }

      await fetchData();
      setShowEnrollModal(false);
      alert('لیست طلاب با موفقیت بروزرسانی شد');
    } catch (error) {
      console.error("Error saving enrollments:", error);
      alert('خطا در بروزرسانی لیست');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dayStr = addModalDays.join(' ، ');
      await localDb.addDoc('programs', {
        ...newProgram,
        days: addModalDays,
        day: dayStr,
        mentorId: currentMentorId
      });
      setShowAddModal(false);
      setNewProgram({ title: '', type: 'اصلی', day: '', time: '', teacher: '', parentProgramId: '' });
      setAddModalDays(DEFAULT_MAIN_DAYS);
      fetchData();
    } catch (error) {
      console.error("Error adding program:", error);
    }
  };

  const handleEditProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProgram) return;
    try {
      const dayStr = editModalDays.join(' ، ');
      await localDb.updateDoc('programs', editingProgram.id, {
        title: editingProgram.title,
        type: editingProgram.type,
        days: editModalDays,
        day: dayStr,
        time: editingProgram.time,
        teacher: editingProgram.teacher,
        parentProgramId: editingProgram.type === 'مشاوره' ? (editingProgram.parentProgramId || '') : ''
      });
      setEditingProgram(null);
      fetchData();
    } catch (error) {
      console.error("Error editing program:", error);
      alert('خطا در بروزرسانی برنامه');
    }
  };

  const deleteProgram = async (id: string) => {
    if (!confirm('آیا از حذف این برنامه اطمینان دارید؟')) return;
    try {
      await localDb.deleteDoc('programs', id);
      fetchData();
    } catch (error) {
      console.error("Error deleting program:", error);
    }
  };

  const getProgramStudents = (programId: string) => {
    const studentIds = enrollments
      .filter(e => e.programId === programId)
      .map(e => e.studentId);
    return students.filter(s => studentIds.includes(s.id));
  };

  const mainPrograms = programs.filter(p => p.type === 'اصلی');
  const counselingPrograms = programs.filter(p => p.type === 'مشاوره');

  // Excel Export for a single program
  const exportProgramToExcel = (program: Program) => {
    const pStudents = getProgramStudents(program.id);
    const parentProg = program.parentProgramId ? programs.find(p => p.id === program.parentProgramId) : null;

    const data = [
      ["گزارش طلاب کلاس / برنامه آموزشی"],
      ["عنوان کلاس", program.title],
      ["نوع برنامه", program.type],
      ...(parentProg ? [["درس اصلی مرتبط", parentProg.title]] : []),
      ["استاد مربوطه", program.teacher || '---'],
      ["زمان برگزاری", `${program.day || ''} - ${program.time || ''}`],
      ["تعداد طلاب ثبت‌نام شده", pStudents.length],
      [],
      ["ردیف", "نام و نام خانوادگی", "پایه تحصیلی", "کد ملی", "شماره تماس", "وضعیت معممی"]
    ];

    pStudents.forEach((st, idx) => {
      data.push([
        (idx + 1).toString(),
        st.name,
        st.grade || '---',
        st.nationalId || '---',
        st.phoneNumber || '---',
        st.tammomStatus || '---'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    const sheetName = program.title.replace(/[\\/*?:[\]]/g, '_').slice(0, 28) || 'کلاس';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `کلاس_${program.title.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-')}.xlsx`);
  };

  // Excel Export for ALL programs in a single workbook
  const exportAllProgramsToExcel = () => {
    const wb = XLSX.utils.book_new();

    if (programs.length === 0) {
      alert('هیچ برنامه‌ای برای خروجی وجود ندارد.');
      return;
    }

    // Sheet 1: Summary of all classes
    const summaryData = [
      ["لیست و مشخصات کلی تمام برنامه‌های آموزشی مدرسه"],
      ["تاریخ گزارش", new Date().toLocaleDateString('fa-IR-u-nu-latn')],
      ["تعداد کل کلاس‌ها", programs.length],
      [],
      ["ردیف", "عنوان کلاس", "نوع برنامه", "درس اصلی مرتبط (در صورت مشاوره)", "استاد", "زمان", "تعداد طلاب"]
    ];

    programs.forEach((p, idx) => {
      const pStudents = getProgramStudents(p.id);
      const parentProg = p.parentProgramId ? programs.find(parent => parent.id === p.parentProgramId) : null;
      summaryData.push([
        (idx + 1).toString(),
        p.title,
        p.type,
        parentProg ? parentProg.title : '---',
        p.teacher || '---',
        `${p.day || ''} ${p.time || ''}`.trim() || '---',
        pStudents.length.toString()
      ]);
    });

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 15 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'خلاصه همه کلاس‌ها');

    // Individual Sheets
    programs.forEach(program => {
      const pStudents = getProgramStudents(program.id);
      const parentProg = program.parentProgramId ? programs.find(p => p.id === program.parentProgramId) : null;

      const data = [
        ["مشخصات کلاس", program.title],
        ["نوع برنامه", program.type],
        ...(parentProg ? [["درس اصلی مرتبط", parentProg.title]] : []),
        ["استاد", program.teacher || '---'],
        ["زمان", `${program.day || ''} - ${program.time || ''}`],
        ["تعداد طلاب", pStudents.length],
        [],
        ["ردیف", "نام و نام خانوادگی", "پایه تحصیلی", "کد ملی", "شماره تماس"]
      ];

      pStudents.forEach((st, idx) => {
        data.push([
          (idx + 1).toString(),
          st.name,
          st.grade || '---',
          st.nationalId || '---',
          st.phoneNumber || '---'
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 15 }];
      const sheetName = program.title.replace(/[\\/*?:[\]]/g, '_').slice(0, 25) || `کلاس ${program.id}`;
      
      // Ensure unique sheet name
      let uniqueName = sheetName;
      let counter = 1;
      while (wb.SheetNames.includes(uniqueName)) {
        uniqueName = `${sheetName.slice(0, 20)}_${counter}`;
        counter++;
      }

      XLSX.utils.book_append_sheet(wb, ws, uniqueName);
    });

    XLSX.writeFile(wb, `لیست_جامع_کلاس_ها_و_طلاب_${new Date().toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-')}.xlsx`);
  };

  // PDF Export for an individual program
  const handleExportProgramPdf = async (program: Program) => {
    const pStudents = getProgramStudents(program.id);
    setActivePrintClass({ program, students: pStudents });
    setIsExportingClassPdf(true);

    setTimeout(async () => {
      if (classPdfPrintRef.current) {
        try {
          await exportElementToPdf({
            element: classPdfPrintRef.current,
            filename: `گزارش_کلاس_${program.title.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-')}.pdf`,
            orientation: 'portrait',
            marginMM: 8
          });
        } catch (err) {
          console.error('PDF Export error:', err);
          alert('خطا در تولید فایل PDF کلاس');
        } finally {
          setIsExportingClassPdf(false);
        }
      } else {
        setIsExportingClassPdf(false);
      }
    }, 150);
  };

  // Image Export for the Hierarchy Chart
  const handleExportHierarchyImage = async () => {
    if (!hierarchyChartRef.current) return;
    setIsExportingImage(true);
    try {
      await exportElementToImage({
        element: hierarchyChartRef.current,
        filename: `نمودار_سلسله_مراتبی_دروس_و_مشاوره‌ها_${new Date().toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-')}.png`,
        backgroundColor: '#ffffff',
        scale: 2
      });
    } catch (err) {
      console.error('Image Export Error:', err);
      alert('خطا در گرفتن خروجی تصویر از نمودار');
    } finally {
      setIsExportingImage(false);
    }
  };

  // PDF Export for the Hierarchy Chart
  const handleExportHierarchyPdf = async () => {
    if (!hierarchyPdfPrintRef.current) return;
    setIsExportingHierarchyPdf(true);
    try {
      await exportElementToPdf({
        element: hierarchyPdfPrintRef.current,
        filename: `گزارش_نمودار_سلسله_مراتبی_کلاس‌ها_${new Date().toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-')}.pdf`,
        orientation: 'landscape',
        marginMM: 8
      });
    } catch (err) {
      console.error('Hierarchy PDF Export Error:', err);
      alert('خطا در تولید PDF نمودار');
    } finally {
      setIsExportingHierarchyPdf(false);
    }
  };

  const typesMap: Record<string, string> = {
    'اصلی': 'کلاس‌های اصلی',
    'مشاوره': 'کلاس‌های مشاوره',
    'پژوهش': 'واحد پژوهش',
    'دروس 5 شنبه': 'برنامه‌های ۵ شنبه',
    'سایر': 'سایر برنامه‌ها'
  };

  return (
    <div className="space-y-10" dir="rtl">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <BookOpen className="text-indigo-600" size={28} />
            <span>برنامه‌های مدرسه و مشاوره درسی</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            مدیریت کلاس‌های اصلی، برنامه‌های مشاوره مرتبط، ثبت‌نام طلاب و رسم نمودار سلسله‌مراتبی
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={exportAllProgramsToExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-xs transition-all shadow-sm hover:shadow-md"
            title="خروجی فایل اکسل از لیست تمام برنامه‌ها و طلاب"
          >
            <FileSpreadsheet size={16} />
            <span>خروجی اکسل همه کلاس‌ها</span>
          </button>

          <button 
            onClick={() => {
              setEditingProgram(null);
              setNewProgram({ title: '', type: 'اصلی', day: '', time: '', teacher: '', parentProgramId: '' });
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-black text-xs transition-all shadow-md hover:shadow-lg"
          >
            <Plus size={18} />
            <span>افزودن برنامه جدید</span>
          </button>
        </div>
      </div>

      {/* Programs Lists Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(typesMap).map(([type, label]) => {
          const groupPrograms = programs.filter(p => p.type === type);

          return (
            <div key={type} className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
              <div className="bg-slate-50/90 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-6 rounded-full",
                    type === 'اصلی' ? "bg-indigo-600" :
                    type === 'مشاوره' ? "bg-amber-500" :
                    type === 'پژوهش' ? "bg-emerald-500" :
                    type === 'دروس 5 شنبه' ? "bg-purple-500" : "bg-slate-500"
                  )}></div>
                  {label}
                </h3>
                <span className="text-xs font-bold bg-white border border-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full shadow-2xs">
                  {groupPrograms.length} کلاس
                </span>
              </div>

              <div className="divide-y divide-slate-100 flex-1">
                {groupPrograms.map(program => {
                  const programStudents = getProgramStudents(program.id);
                  const parentProg = program.parentProgramId ? programs.find(p => p.id === program.parentProgramId) : null;
                  const attachedCounselings = type === 'اصلی' 
                    ? counselingPrograms.filter(cp => cp.parentProgramId === program.id)
                    : [];

                  return (
                    <div key={program.id} className="p-5 hover:bg-slate-50/60 transition-colors border-b last:border-0 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 cursor-pointer" onClick={() => setSelectedProgramId(selectedProgramId === program.id ? null : program.id)}>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h4 className="font-black text-slate-900 text-sm">{program.title}</h4>
                            
                            {/* If Counseling Class with linked Main Class */}
                            {type === 'مشاوره' && parentProg && (
                              <span className="text-[10px] font-black px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md border border-amber-200 flex items-center gap-1">
                                <GitFork size={10} className="text-amber-700" />
                                <span>درس اصلی مرتبط: {parentProg.title}</span>
                              </span>
                            )}

                            {/* If Main Class with attached Counseling classes */}
                            {type === 'اصلی' && attachedCounselings.length > 0 && (
                              <span className="text-[10px] font-black px-2 py-0.5 bg-indigo-50 text-indigo-800 rounded-md border border-indigo-200 flex items-center gap-1">
                                <MessageSquare size={10} className="text-indigo-600" />
                                <span>{attachedCounselings.length} کلاس مشاوره مرتبط</span>
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-4 text-xs text-slate-500 font-medium">
                            <span className="flex items-center gap-1">
                              <Clock size={13} className="text-indigo-500" /> {program.day || 'نامشخص'} - {program.time || 'نامشخص'}
                            </span>
                            <span className="flex items-center gap-1">
                              <User size={13} className="text-indigo-500" /> {program.teacher || 'استاد تعیین نشده'}
                            </span>
                            <span className="flex items-center gap-1 text-indigo-700 font-bold">
                              <Users size={13} /> {programStudents.length} نفر عضو
                            </span>
                          </div>
                        </div>

                        {/* Program Card Action Buttons */}
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => exportProgramToExcel(program)}
                            className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all"
                            title="خروجی اکسل این کلاس"
                          >
                            <FileSpreadsheet size={16} />
                          </button>

                          <button 
                            onClick={() => handleExportProgramPdf(program)}
                            disabled={isExportingClassPdf}
                            className="p-1.5 text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all"
                            title="خروجی PDF این کلاس"
                          >
                            <FileText size={16} />
                          </button>

                          <button 
                            onClick={() => {
                              setEditingProgram(program);
                              setEditModalDays(getProgramDays(program));
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-all"
                            title="ویرایش مشخصات برنامه"
                          >
                            <Edit3 size={16} />
                          </button>

                          <button 
                            onClick={() => deleteProgram(program.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                            title="حذف برنامه"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Display attached counseling list preview for Main Class */}
                      {type === 'اصلی' && attachedCounselings.length > 0 && (
                        <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100/80 text-xs text-indigo-950 flex flex-col gap-1">
                          <span className="font-bold text-[11px] text-indigo-900 flex items-center gap-1">
                            <Sparkles size={12} className="text-indigo-600" />
                            <span>کلاس‌های مشاوره متصل به این درس اصلی:</span>
                          </span>
                          <div className="flex flex-wrap gap-2 mt-0.5">
                            {attachedCounselings.map(c => (
                              <span key={c.id} className="bg-white px-2.5 py-1 rounded-lg border border-indigo-200 font-bold text-[11px] flex items-center gap-1 shadow-2xs">
                                <span>{c.title}</span>
                                <span className="text-slate-400 font-normal">({c.teacher || 'بدون استاد'})</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Expandable Enrolled Students List */}
                      {selectedProgramId === program.id && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-3 pt-3 border-t border-slate-100 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-bold text-slate-700">طلاب ثبت‌نام شده در این کلاس:</h5>
                            <button 
                              onClick={() => handleEnrollClick(program.id)}
                              className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors border border-indigo-200/80"
                            >
                              <Plus size={14} />
                              <span>مدیریت و افزودن طالبان</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {programStudents.map(student => (
                              <div key={student.id} className="bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-xl text-xs text-slate-800 flex items-center justify-between">
                                <span className="font-bold">{student.name}</span>
                                <span className="text-[10px] text-slate-500 font-medium bg-white px-2 py-0.5 rounded-md border border-slate-200">پایه {student.grade}</span>
                              </div>
                            ))}
                            {programStudents.length === 0 && (
                              <p className="text-xs text-slate-400 col-span-2 py-3 text-center italic">هنوز طلبی برای این کلاس ثبت نشده است.</p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}

                {groupPrograms.length === 0 && (
                  <div className="p-10 text-center text-slate-400 text-xs italic">
                    هنوز برنامه‌ای در این بخش ثبت نشده است.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* HIERARCHY CHART SECTION */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-100 text-indigo-800 rounded-xl">
                <GitFork size={20} />
              </span>
              <h3 className="text-xl font-black text-slate-900">
                نمودار سلسله‌مراتبی دروس اصلی و کلاس‌های مشاوره مرتبط (Hierarchy Chart)
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              ساختار درختی ارتباط درس‌های اصلی با کلاس‌های مشاوره درسی و لیست طلاب شرکت‌کننده
            </p>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={handleExportHierarchyImage}
              disabled={isExportingImage || programs.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 font-black text-xs rounded-xl transition-all shadow-sm disabled:opacity-50"
              title="دانلود فایل تصویری کیفیت بالا PNG از نمودار (با اعمال فیلترهای نمایش)"
            >
              <ImageIcon size={16} />
              <span>{isExportingImage ? 'در حال خروجی...' : 'خروجی عکس (PNG)'}</span>
            </button>

            <button
              onClick={handleExportHierarchyPdf}
              disabled={isExportingHierarchyPdf || programs.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl transition-all shadow-sm disabled:opacity-50"
              title="خروجی فایل PDF افقی از نمودار (با اعمال فیلترهای نمایش)"
            >
              <FileText size={16} />
              <span>{isExportingHierarchyPdf ? 'در حال خروجی...' : 'خروجی PDF نمودار'}</span>
            </button>
          </div>
        </div>

        {/* Display Filter Toggles Panel */}
        <div className="bg-slate-100/90 p-4 rounded-2xl border border-slate-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 font-black text-slate-800">
            <Eye size={18} className="text-indigo-600" />
            <span>تنظیم فیلتر نمایش اسامی طلاب در نمودار و خروجی‌های تصویر و PDF:</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <label className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer select-none",
              showMainStudents ? "bg-indigo-50 border-indigo-300 text-indigo-950 shadow-2xs" : "bg-white border-slate-200 text-slate-400"
            )}>
              <input 
                type="checkbox"
                checked={showMainStudents}
                onChange={(e) => setShowMainStudents(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <span>نمایش اسامی طلاب «درس اصلی»</span>
            </label>

            <label className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer select-none",
              showCounselingStudents ? "bg-amber-50 border-amber-300 text-amber-950 shadow-2xs" : "bg-white border-slate-200 text-slate-400"
            )}>
              <input 
                type="checkbox"
                checked={showCounselingStudents}
                onChange={(e) => setShowCounselingStudents(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
              />
              <span>نمایش اسامی طلاب «درس مشاوره»</span>
            </label>
          </div>
        </div>

        {/* HIERARCHY GRAPH CONTAINER */}
        <div className="bg-slate-50/70 rounded-2xl p-6 border border-slate-200 overflow-x-auto min-w-[750px]" dir="rtl">
          <div ref={hierarchyChartRef} className="p-6 bg-white rounded-2xl border border-slate-200/90 space-y-10 min-w-[700px]">
            {/* School Header Banner inside the graph export */}
            <div className="text-center border-b-2 border-indigo-600 pb-4 space-y-1">
              <h4 className="text-lg font-black text-indigo-950">نمودار ساختاری دروس اصلی و کلاس‌های مشاوره مدرسه</h4>
              <p className="text-xs text-slate-500">
                استاد/مسئول: <span className="font-bold text-slate-800">{currentMentor.name}</span> | تاریخ تنظیم: <span className="font-bold text-slate-800">{new Date().toLocaleDateString('fa-IR-u-nu-latn')}</span> | کل کلاس‌ها: <span className="font-bold text-slate-800">{programs.length}</span>
              </p>
            </div>

            {/* Tree Nodes: Main Classes and their attached Counseling Classes */}
            {mainPrograms.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs italic">
                هنوز درس اصلی ثبت نشده است. پس از افزودن درس اصلی، ساختار درختی نمایش داده خواهد شد.
              </div>
            ) : (
              <div className="space-y-12">
                {mainPrograms.map((mainProg, idx) => {
                  const mainStudents = getProgramStudents(mainProg.id);
                  const linkedCounselings = counselingPrograms.filter(cp => cp.parentProgramId === mainProg.id);

                  return (
                    <div key={mainProg.id} className="relative bg-slate-50/90 rounded-2xl p-5 border border-slate-300/80 space-y-6">
                      {/* Main Class Node Card (Parent Node) */}
                      <div className="bg-gradient-to-r from-indigo-800 to-indigo-950 text-white rounded-2xl p-4 shadow-md space-y-3 relative">
                        <div className="flex items-center justify-between border-b border-indigo-700/60 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-white text-indigo-900 font-black text-xs flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <h5 className="font-black text-base text-white">{mainProg.title}</h5>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-700/80 text-indigo-100 rounded-md border border-indigo-500">
                              درس اصلی
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-indigo-200">
                            <span className="font-bold flex items-center gap-1">
                              <User size={13} className="text-indigo-300" /> {mainProg.teacher || 'بدون استاد'}
                            </span>
                            <span className="font-bold flex items-center gap-1">
                              <Clock size={13} className="text-indigo-300" /> {mainProg.day || ''} - {mainProg.time || ''}
                            </span>
                            <span className="font-black px-2.5 py-0.5 bg-white text-indigo-950 rounded-full text-xs shadow-2xs">
                              {mainStudents.length} طالب
                            </span>
                          </div>
                        </div>

                        {/* Main Class Enrolled Students (Filtered by Toggle) */}
                        {showMainStudents ? (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-bold text-indigo-200 block">
                              طلاب شرکت‌کننده در این درس اصلی ({mainStudents.length} نفر):
                            </span>
                            {mainStudents.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {mainStudents.map(st => (
                                  <span key={st.id} className="px-2.5 py-1 bg-indigo-900/90 text-indigo-100 rounded-lg text-xs font-bold border border-indigo-700">
                                    {st.name} <span className="text-indigo-300 text-[10px]">(پایه {st.grade})</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-indigo-300 italic">هنوز طلبی برای این درس ثبت نشده است.</span>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] font-bold text-indigo-200 bg-indigo-900/50 p-2 rounded-xl border border-indigo-800 flex items-center justify-between">
                            <span>تعداد طلاب شرکت‌کننده در درس اصلی: <b className="text-white font-black">{mainStudents.length} نفر</b></span>
                            <span className="text-[10px] text-indigo-300 italic">(نمایش اسامی طلاب درس اصلی فیلتر/مخفی شده است)</span>
                          </div>
                        )}
                      </div>

                      {/* Tree Branch Connectors & Child Counseling Nodes */}
                      <div className="pr-6 sm:pr-10 relative space-y-4">
                        {/* Connecting Vertical Line */}
                        <div className="absolute right-3 sm:right-5 top-0 bottom-4 w-0.5 bg-indigo-300"></div>

                        <div className="flex items-center gap-2 pr-4 pt-1">
                          <GitFork size={16} className="text-indigo-600 rotate-180" />
                          <span className="text-xs font-black text-indigo-950">
                            کلاس‌های مشاوره مرتبط با «{mainProg.title}»:
                          </span>
                        </div>

                        {linkedCounselings.length === 0 ? (
                          <div className="relative pr-6">
                            <div className="absolute right-0 top-1/2 w-4 h-0.5 bg-indigo-300"></div>
                            <div className="p-3 bg-white rounded-xl border border-dashed border-amber-300 text-amber-800 text-xs flex items-center justify-between">
                              <span className="italic font-medium">هیچ کلاس مشاوره‌ای به این درس متصل نشده است.</span>
                              <button 
                                onClick={() => {
                                  setEditingProgram(null);
                                  setNewProgram({ title: `مشاوره ${mainProg.title}`, type: 'مشاوره', parentProgramId: mainProg.id, day: '', time: '', teacher: '' });
                                  setShowAddModal(true);
                                }}
                                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-[11px] font-bold transition-all shadow-2xs"
                              >
                                + اتصال مشاوره جدید
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-2">
                            {linkedCounselings.map((counselingProg) => {
                              const counselingStudents = getProgramStudents(counselingProg.id);

                              return (
                                <div key={counselingProg.id} className="relative pr-5">
                                  {/* Horizontal Connector Line */}
                                  <div className="absolute right-0 top-6 w-5 h-0.5 bg-indigo-300"></div>

                                  <div className="bg-white rounded-xl p-4 border-2 border-amber-400 shadow-sm space-y-2.5">
                                    <div className="flex items-center justify-between border-b border-amber-100 pb-2">
                                      <div className="flex items-center gap-1.5">
                                        <MessageSquare size={16} className="text-amber-600" />
                                        <h6 className="font-black text-sm text-slate-900">{counselingProg.title}</h6>
                                      </div>
                                      <span className="text-[10px] font-black px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md border border-amber-200">
                                        مشاوره درس
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-slate-600 font-bold">
                                      <span>استاد: {counselingProg.teacher || 'مشخص‌نشده'}</span>
                                      <span>زمان: {counselingProg.day || ''} - {counselingProg.time || ''}</span>
                                    </div>

                                    {/* Enrolled Students in this Counseling Class (Filtered by Toggle) */}
                                    {showCounselingStudents ? (
                                      <div className="pt-1 space-y-1">
                                        <span className="text-[10px] font-bold text-slate-500 block">
                                          طلاب شرکت‌کننده ({counselingStudents.length} نفر):
                                        </span>
                                        {counselingStudents.length > 0 ? (
                                          <div className="flex flex-wrap gap-1">
                                            {counselingStudents.map(st => (
                                              <span key={st.id} className="px-2 py-0.5 bg-amber-50 text-amber-950 rounded-md text-[11px] font-bold border border-amber-200">
                                                {st.name}
                                              </span>
                                            ))}
                                          </div>
                                        ) : (
                                          <span className="text-[11px] text-slate-400 italic">طلبه‌ای ثبت‌نام نشده است</span>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-[11px] font-bold text-amber-900 pt-1 bg-amber-50/60 p-2 rounded-lg border border-amber-100 flex items-center justify-between">
                                        <span>تعداد طلاب مشاوره: <b className="text-slate-900 font-black">{counselingStudents.length} نفر</b></span>
                                        <span className="text-[10px] text-amber-700 italic">(اسامی مخفی)</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Unlinked Counseling Classes Section */}
            {counselingPrograms.filter(cp => !cp.parentProgramId).length > 0 && (
              <div className="pt-6 border-t-2 border-slate-200 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                    <HelpCircle size={16} />
                  </span>
                  <h5 className="font-black text-sm text-slate-800">
                    کلاس‌های مشاوره عمومی / بدون درس اصلی مرتبط ({counselingPrograms.filter(cp => !cp.parentProgramId).length} کلاس)
                  </h5>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {counselingPrograms.filter(cp => !cp.parentProgramId).map(cp => {
                    const cpStudents = getProgramStudents(cp.id);
                    return (
                      <div key={cp.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                        <div className="flex items-center justify-between font-black text-slate-900 border-b border-slate-200 pb-1.5">
                          <span>{cp.title}</span>
                          <button 
                            onClick={() => setEditingProgram(cp)}
                            className="text-[10px] font-bold text-indigo-600 underline"
                          >
                            اتصال به درس اصلی
                          </button>
                        </div>
                        <div className="text-slate-600 flex justify-between font-bold">
                          <span>استاد: {cp.teacher || '---'}</span>
                          <span>زمان: {cp.day} {cp.time}</span>
                        </div>
                        <div className="text-slate-500 font-bold text-[10px]">
                          تعداد طلاب: {cpStudents.length} نفر {showCounselingStudents && cpStudents.length > 0 ? `(${cpStudents.map(s => s.name).join(' ، ')})` : ''}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden Printable PDF Container for Individual Class PDF Export */}
      <div style={{ position: 'fixed', left: '-9999px', top: '0px', width: '850px', zIndex: -1000, pointerEvents: 'none', opacity: 0 }}>
        {activePrintClass && (
          <div ref={classPdfPrintRef} className="p-8 bg-white font-vazir text-slate-900 space-y-6" dir="rtl">
            <div className="text-center border-b-2 border-indigo-600 pb-4 space-y-2">
              <h1 className="text-2xl font-black text-indigo-950">گزارش رسمی کلاس و لیست طلاب شرکت‌کننده</h1>
              <p className="text-xs text-slate-600">
                استاد/مسئول پایه: <span className="font-bold text-slate-800">{currentMentor.name}</span> | تاریخ تنظیم: <span className="font-bold text-slate-800">{new Date().toLocaleDateString('fa-IR-u-nu-latn')}</span>
              </p>
            </div>

            {/* Class Specifications */}
            <div className="bg-indigo-50/80 p-4 rounded-xl border border-indigo-200 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div><b>عنوان کلاس:</b> <span className="text-indigo-950 font-black">{activePrintClass.program.title}</span></div>
                <div><b>نوع برنامه:</b> <span className="text-indigo-900 font-bold">{activePrintClass.program.type}</span></div>
                <div><b>استاد محترم:</b> <span>{activePrintClass.program.teacher || '---'}</span></div>
                <div><b>زمان برگزاری:</b> <span>{activePrintClass.program.day || ''} - {activePrintClass.program.time || ''}</span></div>
                {activePrintClass.program.parentProgramId && (
                  <div className="col-span-2">
                    <b>درس اصلی مرتبط:</b>{' '}
                    <span className="text-amber-900 font-bold">
                      {programs.find(p => p.id === activePrintClass.program.parentProgramId)?.title || '---'}
                    </span>
                  </div>
                )}
                <div><b>تعداد طلاب ثبت‌نام شده:</b> <span className="font-black text-indigo-900">{activePrintClass.students.length} نفر</span></div>
              </div>
            </div>

            {/* Students Table */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-indigo-900 border-b border-indigo-200 pb-1">اسامی طلاب ثبت‌نام شده در کلاس:</h3>
              <table className="w-full text-right text-xs border-collapse border border-slate-300 bg-white">
                <thead>
                  <tr className="bg-slate-100 font-black text-slate-800">
                    <th className="p-2 border border-slate-300 w-10 text-center">ردیف</th>
                    <th className="p-2 border border-slate-300">نام و نام خانوادگی</th>
                    <th className="p-2 border border-slate-300">پایه تحصیلی</th>
                    <th className="p-2 border border-slate-300">کد ملی</th>
                    <th className="p-2 border border-slate-300">شماره تماس</th>
                  </tr>
                </thead>
                <tbody>
                  {activePrintClass.students.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center italic text-slate-400">طلبه‌ای برای این کلاس ثبت نشده است.</td>
                    </tr>
                  ) : (
                    activePrintClass.students.map((st, idx) => (
                      <tr key={st.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                        <td className="p-2 border border-slate-300 text-center font-bold">{idx + 1}</td>
                        <td className="p-2 border border-slate-300 font-black text-slate-900">{st.name}</td>
                        <td className="p-2 border border-slate-300">پایه {st.grade || '---'}</td>
                        <td className="p-2 border border-slate-300">{st.nationalId || '---'}</td>
                        <td className="p-2 border border-slate-300">{st.phoneNumber || '---'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Hidden Container for Hierarchy PDF Export (Landscape) */}
      <div style={{ position: 'fixed', left: '-9999px', top: '0px', width: '1100px', zIndex: -1000, pointerEvents: 'none', opacity: 0 }}>
        <div ref={hierarchyPdfPrintRef} className="p-8 bg-white font-vazir text-slate-900 space-y-6" dir="rtl">
          <div className="text-center border-b-2 border-indigo-600 pb-4 space-y-2">
            <h1 className="text-2xl font-black text-indigo-950">گزارش جامع نمودار سلسله‌مراتبی برنامه‌های مدرسه و مشاوره</h1>
            <p className="text-xs text-slate-600">
              استاد/مسئول: <span className="font-bold text-slate-800">{currentMentor.name}</span> | تاریخ تنظیم: <span className="font-bold text-slate-800">{new Date().toLocaleDateString('fa-IR-u-nu-latn')}</span>
            </p>
          </div>

          <div className="space-y-6">
            {mainPrograms.map((mainProg, idx) => {
              const mainStudents = getProgramStudents(mainProg.id);
              const linkedCounselings = counselingPrograms.filter(cp => cp.parentProgramId === mainProg.id);

              return (
                <div key={mainProg.id} className="border border-slate-300 rounded-xl p-4 space-y-3 bg-slate-50/50">
                  <div className="bg-indigo-900 text-white p-3 rounded-lg flex justify-between items-center text-xs font-bold">
                    <span className="text-sm font-black">{idx + 1}. درس اصلی: «{mainProg.title}» ({mainProg.teacher || 'استاد تعیین‌نشده'})</span>
                    <span>زمان: {mainProg.day} - {mainProg.time} | طلاب: {mainStudents.length} نفر</span>
                  </div>

                  <div className="text-xs text-slate-700">
                    <b>طلاب شرکت‌کننده در درس اصلی ({mainStudents.length} نفر): </b>
                    {showMainStudents
                      ? (mainStudents.map(s => s.name).join(' ، ') || 'طلبه‌ای ثبت نشده')
                      : <span className="text-slate-500 font-bold">(نمایش اسامی فیلتر گردیده است)</span>
                    }
                  </div>

                  {linkedCounselings.length > 0 && (
                    <div className="pr-4 border-r-2 border-amber-500 space-y-2">
                      <h5 className="font-black text-xs text-amber-900">کلاس‌های مشاوره مرتبط با این درس:</h5>
                      {linkedCounselings.map(cp => {
                        const cpStudents = getProgramStudents(cp.id);
                        return (
                          <div key={cp.id} className="bg-white p-2.5 rounded border border-amber-200 text-xs space-y-1">
                            <div className="font-bold text-slate-900">
                              مشاوره: «{cp.title}» (استاد: {cp.teacher || '---'}) - زمان: {cp.day} {cp.time}
                            </div>
                            <div className="text-slate-600">
                              <b>طلاب مشاوره ({cpStudents.length} نفر): </b>
                              {showCounselingStudents
                                ? (cpStudents.map(s => s.name).join(' ، ') || 'طلبه‌ای ثبت نشده')
                                : <span className="text-slate-500 font-bold">(نمایش اسامی فیلتر گردیده است)</span>
                              }
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add Program Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-5"
            >
              <h3 className="text-xl font-black text-slate-900 text-right border-b border-slate-100 pb-3">افزودن برنامه جدید</h3>
              <form onSubmit={handleAddProgram} className="space-y-4 text-right">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عنوان کلاس / برنامه</label>
                  <input 
                    type="text" 
                    required
                    placeholder="مثلاً: فقه (مکاسب) یا مشاوره فقه"
                    className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newProgram.title}
                    onChange={(e) => setNewProgram({...newProgram, title: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نوع برنامه</label>
                  <select 
                    className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                    value={newProgram.type}
                    onChange={(e) => {
                      const selType = e.target.value as any;
                      setNewProgram({...newProgram, type: selType});
                      if (selType === 'اصلی') {
                        setAddModalDays(DEFAULT_MAIN_DAYS);
                      } else if (selType === 'دروس 5 شنبه') {
                        setAddModalDays(['پنج‌شنبه']);
                      } else if (selType === 'پژوهش' || selType === 'سایر') {
                        setAddModalDays([]);
                      }
                    }}
                  >
                    <option value="اصلی">درس اصلی</option>
                    <option value="مشاوره">مشاوره</option>
                    <option value="پژوهش">واحد پژوهش</option>
                    <option value="دروس 5 شنبه">برنامه ۵ شنبه</option>
                    <option value="سایر">سایر</option>
                  </select>
                </div>

                {/* If Type === 'مشاوره', show parent program select */}
                {newProgram.type === 'مشاوره' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <label className="block text-xs font-bold text-amber-900 mb-1 flex items-center gap-1">
                      <GitFork size={14} className="text-amber-600" />
                      <span>این کلاس مشاوره، مربوط به کدام درس اصلی است؟</span>
                    </label>
                    <select
                      className="w-full px-4 py-2 text-xs border border-amber-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50/60 font-bold text-slate-800"
                      value={newProgram.parentProgramId || ''}
                      onChange={(e) => setNewProgram({...newProgram, parentProgramId: e.target.value})}
                    >
                      <option value="">-- انتخاب کنید (یا مستقل بدون درس اصلی) --</option>
                      {mainPrograms.map(mp => (
                        <option key={mp.id} value={mp.id}>
                          درس اصلی: {mp.title} ({mp.teacher || 'استاد ثبت‌نشده'})
                        </option>
                      ))}
                    </select>
                  </motion.div>
                )}

                {/* Day Checkboxes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    روزهای برگزاری کلاس در هفته:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {WEEK_DAYS.map(day => {
                      const isChecked = addModalDays.includes(day);
                      return (
                        <label 
                          key={day} 
                          className={cn(
                            "flex items-center gap-1.5 p-2 rounded-lg border text-xs font-bold cursor-pointer select-none transition-all",
                            isChecked 
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs" 
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAddModalDays([...addModalDays, day]);
                              } else {
                                setAddModalDays(addModalDays.filter(d => d !== day));
                              }
                            }}
                            className="w-3.5 h-3.5 rounded border-slate-300 focus:ring-indigo-500 accent-indigo-600"
                          />
                          <span className="text-[11px]">{day}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">
                    {newProgram.type === 'اصلی' 
                      ? 'دروس اصلی به‌صورت پیش‌فرض شنبه تا چهارشنبه هستند، می‌توانید روزهای دلخواه را تیک بزنید.' 
                      : newProgram.type === 'دروس 5 شنبه'
                      ? 'برنامه‌های پنج‌شنبه به‌صورت پیش‌فرض در روز پنج‌شنبه برگزار می‌شوند.'
                      : 'روزهای برگزاری این کلاس را با تیک مشخص نمایید.'
                    }
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">زمان برگزاری</label>
                  <input 
                    type="text" 
                    placeholder="مثلا: ۰۸:۰۰"
                    className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newProgram.time}
                    onChange={(e) => setNewProgram({...newProgram, time: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نام استاد</label>
                  <input 
                    type="text" 
                    placeholder="نام استاد محترم..."
                    className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newProgram.teacher}
                    onChange={(e) => setNewProgram({...newProgram, teacher: e.target.value})}
                  />
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <button 
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100"
                  >
                    ثبت برنامه
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-colors"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Program Modal */}
      <AnimatePresence>
        {editingProgram && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl space-y-5"
            >
              <h3 className="text-xl font-black text-slate-900 text-right border-b border-slate-100 pb-3">ویرایش مشخصات برنامه</h3>
              <form onSubmit={handleEditProgram} className="space-y-4 text-right">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عنوان کلاس / برنامه</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    value={editingProgram.title}
                    onChange={(e) => setEditingProgram({...editingProgram, title: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نوع برنامه</label>
                  <select 
                    className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                    value={editingProgram.type}
                    onChange={(e) => {
                      const selType = e.target.value as any;
                      setEditingProgram({...editingProgram, type: selType});
                      if (selType === 'اصلی' && editModalDays.length === 0) {
                        setEditModalDays(DEFAULT_MAIN_DAYS);
                      } else if (selType === 'دروس 5 شنبه' && editModalDays.length === 0) {
                        setEditModalDays(['پنج‌شنبه']);
                      }
                    }}
                  >
                    <option value="اصلی">درس اصلی</option>
                    <option value="مشاوره">مشاوره</option>
                    <option value="پژوهش">واحد پژوهش</option>
                    <option value="دروس 5 شنبه">برنامه ۵ شنبه</option>
                    <option value="سایر">سایر</option>
                  </select>
                </div>

                {/* If Type === 'مشاوره', show parent program select */}
                {editingProgram.type === 'مشاوره' && (
                  <div>
                    <label className="block text-xs font-bold text-amber-900 mb-1 flex items-center gap-1">
                      <GitFork size={14} className="text-amber-600" />
                      <span>این کلاس مشاوره، مربوط به کدام درس اصلی است؟</span>
                    </label>
                    <select
                      className="w-full px-4 py-2 text-xs border border-amber-300 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 bg-amber-50/60 font-bold text-slate-800"
                      value={editingProgram.parentProgramId || ''}
                      onChange={(e) => setEditingProgram({...editingProgram, parentProgramId: e.target.value})}
                    >
                      <option value="">-- انتخاب کنید (یا مستقل بدون درس اصلی) --</option>
                      {mainPrograms.filter(mp => mp.id !== editingProgram.id).map(mp => (
                        <option key={mp.id} value={mp.id}>
                          درس اصلی: {mp.title} ({mp.teacher || 'استاد ثبت‌نشده'})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Day Checkboxes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    روزهای برگزاری کلاس در هفته:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    {WEEK_DAYS.map(day => {
                      const isChecked = editModalDays.includes(day);
                      return (
                        <label 
                          key={day} 
                          className={cn(
                            "flex items-center gap-1.5 p-2 rounded-lg border text-xs font-bold cursor-pointer select-none transition-all",
                            isChecked 
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-2xs" 
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                          )}
                        >
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditModalDays([...editModalDays, day]);
                              } else {
                                setEditModalDays(editModalDays.filter(d => d !== day));
                              }
                            }}
                            className="w-3.5 h-3.5 rounded border-slate-300 focus:ring-indigo-500 accent-indigo-600"
                          />
                          <span className="text-[11px]">{day}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">زمان برگزاری</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editingProgram.time || ''}
                    onChange={(e) => setEditingProgram({...editingProgram, time: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نام استاد</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    value={editingProgram.teacher || ''}
                    onChange={(e) => setEditingProgram({...editingProgram, teacher: e.target.value})}
                  />
                </div>

                <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                  <button 
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100"
                  >
                    ذخیره تغییرات
                  </button>
                  <button 
                    type="button"
                    onClick={() => setEditingProgram(null)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-colors"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Enroll Students Modal */}
      <AnimatePresence>
        {showEnrollModal && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh] space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900">مدیریت طلاب کلاس</h3>
                  <p className="text-xs text-slate-500 font-medium">انتخاب طلاب شرکت‌کننده در برنامه</p>
                </div>
                <div className="relative">
                  <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="جستجوی نام طالب..."
                    className="pr-10 pl-4 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 w-full sm:w-60"
                    value={enrollSearchTerm}
                    onChange={(e) => setEnrollSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filterStudents(students, true)
                    .filter(s => s.name.toLowerCase().includes(enrollSearchTerm.toLowerCase()))
                    .map(student => {
                      const isSelected = selectedEnrollments.includes(student.id);
                      return (
                        <label 
                          key={student.id} 
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none",
                            isSelected ? "bg-indigo-50/80 border-indigo-300 text-indigo-950 shadow-2xs" : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                          )}
                        >
                          <input 
                            type="checkbox"
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEnrollments([...selectedEnrollments, student.id]);
                              } else {
                                setSelectedEnrollments(selectedEnrollments.filter(id => id !== student.id));
                              }
                            }}
                          />
                          <div className="flex-1">
                            <p className="text-xs font-black leading-tight">{student.name}</p>
                            <p className="text-[10px] text-slate-500 font-medium">پایه {student.grade || '---'}</p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 size={16} className="text-indigo-600" />
                          )}
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button 
                  onClick={handleSaveEnrollments}
                  disabled={loading}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100 disabled:opacity-50"
                >
                  {loading ? 'در حال ثبت...' : 'ثبت و بروزرسانی لیست طلاب'}
                </button>
                <button 
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-colors"
                >
                  انصراف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
