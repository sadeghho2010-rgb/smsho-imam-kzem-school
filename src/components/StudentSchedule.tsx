import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, 
  Clock, 
  User, 
  Users, 
  Search, 
  FileSpreadsheet, 
  FileText, 
  BookOpen, 
  MessageSquare, 
  Sparkles, 
  GitFork, 
  GraduationCap, 
  CalendarDays,
  Printer,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  HelpCircle,
  Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Student, Program, Enrollment } from '../types';
import { localDb } from '../lib/localDb';
import { useMentor, getStudentMentorKey } from '../context/MentorContext';
import { cn, WEEK_DAYS, getProgramDays } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { exportElementToPdf } from '../lib/pdfExport';

interface StudentScheduleProps {
  initialStudentId?: string;
}

export default function StudentSchedule({ initialStudentId }: StudentScheduleProps) {
  const { filterStudents, currentMentorId, currentMentor, shahpooriFilter } = useMentor();
  
  const [students, setStudents] = useState<Student[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(initialStudentId || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('all');

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const studentSchedulePrintRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const rawStudents = await localDb.getDocs<Student>('students');
      const rawPrograms = await localDb.getDocs<Program>('programs');
      const rawEnrollments = await localDb.getDocs<Enrollment>('enrollments');

      setStudents(rawStudents);
      setPrograms(rawPrograms);
      setEnrollments(rawEnrollments);

      // Default select the first active student if none selected
      const activeFiltered = filterStudents(rawStudents, true);
      if (!selectedStudentId && activeFiltered.length > 0) {
        setSelectedStudentId(activeFiltered[0].id);
      }
    } catch (error) {
      console.error("Error fetching data for student schedules:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const unsub = localDb.subscribe(() => fetchData());
    return () => unsub();
  }, [currentMentorId, shahpooriFilter]);

  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
    }
  }, [initialStudentId]);

  // Filter students based on active mentor
  const availableStudents = filterStudents(students, true).filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (s.nationalId && s.nationalId.includes(searchTerm));
    const matchesGrade = gradeFilter === 'all' || s.grade === gradeFilter;
    return matchesSearch && matchesGrade;
  });

  const selectedStudent = students.find(s => s.id === selectedStudentId) || availableStudents[0];

  // Get enrolled programs for the selected student
  const studentEnrollments = enrollments.filter(e => e.studentId === selectedStudent?.id);
  const enrolledProgramIds = new Set(studentEnrollments.map(e => e.programId));
  const studentPrograms = programs.filter(p => enrolledProgramIds.has(p.id));

  // Helper to categorize programs
  const mainClasses = studentPrograms.filter(p => p.type === 'اصلی');
  const counselingClasses = studentPrograms.filter(p => p.type === 'مشاوره');
  const researchClasses = studentPrograms.filter(p => p.type === 'پژوهش');
  const thursdayClasses = studentPrograms.filter(p => p.type === 'دروس 5 شنبه');
  const otherClasses = studentPrograms.filter(p => p.type === 'سایر');

  // Helper to get programs on a specific day
  const getProgramsForDay = (dayName: string) => {
    return studentPrograms.filter(p => {
      const days = getProgramDays(p);
      return days.includes(dayName);
    });
  };

  // Helper to find parent program title for counseling classes
  const getParentProgramTitle = (parentProgramId?: string) => {
    if (!parentProgramId) return null;
    const parent = programs.find(p => p.id === parentProgramId);
    return parent ? parent.title : null;
  };

  // Export Single Student Schedule to Excel
  const exportStudentExcel = () => {
    if (!selectedStudent) return;

    const data = [
      ["برنامه هفتگی و برنامه‌های آموزشی طلبه"],
      ["نام و نام خانوادگی", selectedStudent.name],
      ["پایه تحصیلی", `پایه ${selectedStudent.grade || '---'}`],
      ["کد ملی", selectedStudent.nationalId || '---'],
      ["شماره تماس", selectedStudent.phoneNumber || '---'],
      ["تعداد کلاس‌های ثبت‌نام شده", studentPrograms.length],
      ["تاریخ گزارش", new Date().toLocaleDateString('fa-IR-u-nu-latn')],
      [],
      ["ردیف", "عنوان کلاس", "نوع برنامه", "روز برگزاری", "ساعت برگزاری", "استاد محترم", "درس اصلی مرتبط (در صورت مشاوره)"]
    ];

    studentPrograms.forEach((p, idx) => {
      const parentTitle = getParentProgramTitle(p.parentProgramId);
      data.push([
        (idx + 1).toString(),
        p.title,
        p.type,
        p.day || 'نامشخص',
        p.time || 'نامشخص',
        p.teacher || '---',
        parentTitle || '---'
      ]);
    });

    data.push([]);
    data.push(["جدول تفکیکی روزانه برنامه هفتگی"]);
    data.push(["روز هفته", "برنامه‌ها و کلاس‌های دایر"]);

    WEEK_DAYS.forEach(day => {
      const dayProgs = getProgramsForDay(day);
      const desc = dayProgs.length > 0 
        ? dayProgs.map(p => `«${p.title}» (${p.time || 'زمان نامشخص'} - استاد: ${p.teacher || '---'})`).join(' | ')
        : 'بدون کلاس ثبت شده';
      data.push([day, desc]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    const sheetName = selectedStudent.name.replace(/[\\/*?:[\]]/g, '_').slice(0, 25) || 'برنامه_طلبه';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `برنامه_هفتگی_${selectedStudent.name.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-')}.xlsx`);
  };

  // Export Master Workbook of ALL Students' Schedules to Excel
  const exportAllStudentsExcel = () => {
    if (availableStudents.length === 0) {
      alert('هیچ طلبی برای خروجی وجود ندارد.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      ["گزارش جامع برنامه هفتگی و کلاس‌های تمام طلاب"],
      ["تاریخ گزارش", new Date().toLocaleDateString('fa-IR-u-nu-latn')],
      ["تعداد طلاب", availableStudents.length],
      [],
      ["ردیف", "نام و نام خانوادگی", "پایه تحصیلی", "تعداد کلاس‌ها", "لیست کلاس‌های اصلی", "لیست کلاس‌های مشاوره"]
    ];

    availableStudents.forEach((st, idx) => {
      const stEnrollments = enrollments.filter(e => e.studentId === st.id);
      const stProgIds = new Set(stEnrollments.map(e => e.programId));
      const stProgs = programs.filter(p => stProgIds.has(p.id));

      const mains = stProgs.filter(p => p.type === 'اصلی').map(p => p.title).join(' ، ') || '---';
      const counselings = stProgs.filter(p => p.type === 'مشاوره').map(p => p.title).join(' ، ') || '---';

      summaryData.push([
        (idx + 1).toString(),
        st.name,
        `پایه ${st.grade || '---'}`,
        stProgs.length.toString(),
        mains,
        counselings
      ]);
    });

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWs['!cols'] = [{ wch: 8 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 35 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, summaryWs, 'خلاصه کل طلاب');

    XLSX.writeFile(wb, `گزارش_جامع_برنامه_هفتگی_طلاب_${new Date().toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-')}.xlsx`);
  };

  // PDF Export for Selected Student
  const handleExportPdf = async () => {
    if (!studentSchedulePrintRef.current || !selectedStudent) return;
    setIsExportingPdf(true);
    try {
      await exportElementToPdf({
        element: studentSchedulePrintRef.current,
        filename: `برنامه_هفتگی_${selectedStudent.name.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('fa-IR-u-nu-latn').replace(/\//g, '-')}.pdf`,
        orientation: 'portrait',
        marginMM: 8
      });
    } catch (err) {
      console.error('PDF Export error:', err);
      alert('خطا در تولید فایل PDF برنامه طلبه');
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]" dir="rtl">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-500 font-bold">در حال بارگذاری برنامه‌های طلاب...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8" dir="rtl">
      {/* Top Bar Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <CalendarDays className="text-indigo-600" size={28} />
            <span>برنامه هفتگی و درسی طلاب</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            مشاهده کامل برنامه کلاس‌های اصلی، مشاوره، پژوهش و ۵شنبه‌های هر طلبه به تفکیک زمان و روز
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={exportAllStudentsExcel}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl font-bold text-xs transition-all shadow-sm"
            title="خروجی اکسل خلاصه برنامه‌های تمام طلاب"
          >
            <FileSpreadsheet size={16} />
            <span>خروجی اکسل همه طلاب</span>
          </button>

          {selectedStudent && (
            <>
              <button 
                onClick={exportStudentExcel}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 rounded-xl font-black text-xs transition-all shadow-sm"
                title="دانلود اکسل برنامه این طلبه"
              >
                <FileSpreadsheet size={16} />
                <span>اکسل برنامه طلبه</span>
              </button>

              <button 
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-black text-xs transition-all shadow-md disabled:opacity-50"
                title="دانلود PDF برنامه هفتگی این طلبه"
              >
                <FileText size={16} />
                <span>{isExportingPdf ? 'در حال خروجی...' : 'خروجی PDF برنامه'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Grid: Left Sidebar Selector + Right Schedule View */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Student Selector Sidebar (1 col) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4 shadow-xs lg:sticky lg:top-20">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-black text-sm text-slate-800 flex items-center gap-2">
              <Users size={18} className="text-indigo-600" />
              <span>انتخاب طلبه ({availableStudents.length} نفر)</span>
            </h3>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="جستجوی نام یا کد ملی..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* Grade Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
            <button 
              onClick={() => setGradeFilter('all')}
              className={cn("flex-1 py-1 rounded-lg transition-all", gradeFilter === 'all' ? "bg-white text-indigo-900 shadow-2xs font-black" : "text-slate-500 hover:text-slate-800")}
            >
              همه
            </button>
            {['۷', '۸', '۹', '۱۰'].map(g => (
              <button 
                key={g}
                onClick={() => setGradeFilter(g)}
                className={cn("flex-1 py-1 rounded-lg transition-all", gradeFilter === g ? "bg-white text-indigo-900 shadow-2xs font-black" : "text-slate-500 hover:text-slate-800")}
              >
                پایه {g}
              </button>
            ))}
          </div>

          {/* Students Scrollable List */}
          <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-1">
            {availableStudents.map(student => {
              const isSelected = selectedStudent?.id === student.id;
              const stEnrollmentsCount = enrollments.filter(e => e.studentId === student.id).length;

              return (
                <button
                  key={student.id}
                  onClick={() => setSelectedStudentId(student.id)}
                  className={cn(
                    "w-full text-right p-3 rounded-xl border transition-all flex items-center justify-between group",
                    isSelected 
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm" 
                      : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-indigo-200"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shrink-0",
                      isSelected ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-700"
                    )}>
                      {student.name.split(' ')[0]?.[0] || 'ط'}
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-black truncate">{student.name}</p>
                      <p className={cn("text-[10px] font-medium", isSelected ? "text-indigo-100" : "text-slate-400")}>
                        پایه {student.grade || '---'}
                      </p>
                    </div>
                  </div>

                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border",
                    isSelected ? "bg-white/20 text-white border-white/30" : "bg-slate-100 text-slate-600 border-slate-200"
                  )}>
                    {stEnrollmentsCount} کلاس
                  </span>
                </button>
              );
            })}

            {availableStudents.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                طلبه‌ای با این مشخصات یافت نشد.
              </div>
            )}
          </div>
        </div>

        {/* Selected Student Schedule Area (3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          {selectedStudent ? (
            <>
              {/* Selected Student Profile Banner */}
              <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-sm border border-indigo-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-800/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-700/80 rounded-2xl border border-indigo-500 flex items-center justify-center text-white font-black text-lg shadow-sm">
                      <GraduationCap size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-white">{selectedStudent.name}</h3>
                        <span className="text-xs font-bold px-2.5 py-0.5 bg-indigo-800 text-indigo-100 rounded-lg border border-indigo-600">
                          پایه {selectedStudent.grade || '---'}
                        </span>
                        {selectedStudent.tammomStatus === 'معمم' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-md border border-emerald-500/40">
                            معمم
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-indigo-200/80 font-medium mt-1">
                        کد ملی: <span className="font-bold text-white">{selectedStudent.nationalId || '---'}</span> | شماره تماس: <span className="font-bold text-white">{selectedStudent.phoneNumber || '---'}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-indigo-900/60 p-3 rounded-2xl border border-indigo-700/60 self-start sm:self-auto text-xs">
                    <BookOpen size={18} className="text-indigo-300" />
                    <div>
                      <p className="text-[10px] text-indigo-300 font-bold">تعداد کلاس‌های ثبت‌نامی:</p>
                      <p className="text-base font-black text-white">{studentPrograms.length} کلاس</p>
                    </div>
                  </div>
                </div>

                {/* Quick Summary Badges */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="px-3 py-1 bg-indigo-800/60 text-indigo-100 rounded-xl border border-indigo-700/60 font-bold">
                    دروس اصلی: <b className="text-white">{mainClasses.length}</b>
                  </span>
                  <span className="px-3 py-1 bg-amber-500/20 text-amber-200 rounded-xl border border-amber-500/40 font-bold">
                    مشاوره‌ها: <b className="text-white">{counselingClasses.length}</b>
                  </span>
                  <span className="px-3 py-1 bg-emerald-500/20 text-emerald-200 rounded-xl border border-emerald-500/40 font-bold">
                    پژوهش: <b className="text-white">{researchClasses.length}</b>
                  </span>
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-200 rounded-xl border border-purple-500/40 font-bold">
                    ۵ شنبه‌ها: <b className="text-white">{thursdayClasses.length}</b>
                  </span>
                </div>
              </div>

              {/* WEEKLY TIMETABLE MATRIX GRID */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-indigo-100 text-indigo-800 rounded-xl">
                      <Calendar size={20} />
                    </span>
                    <h3 className="text-lg font-black text-slate-900">جدول زمان‌بندی هفته (Weekly Timetable)</h3>
                  </div>
                  <span className="text-xs text-slate-500 font-bold">برنامه کلاس‌ها در طول روزهای هفته</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {WEEK_DAYS.map(dayName => {
                    const dayProgs = getProgramsForDay(dayName);

                    return (
                      <div key={dayName} className="bg-slate-50/80 rounded-2xl border border-slate-200 p-4 space-y-3 flex flex-col">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <h4 className="font-black text-sm text-slate-800 flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                            <span>{dayName}</span>
                          </h4>
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                            dayProgs.length > 0 ? "bg-indigo-50 text-indigo-800 border-indigo-200" : "bg-slate-200/60 text-slate-500 border-slate-200"
                          )}>
                            {dayProgs.length} کلاس
                          </span>
                        </div>

                        <div className="space-y-2 flex-1">
                          {dayProgs.map(prog => {
                            const parentTitle = getParentProgramTitle(prog.parentProgramId);

                            return (
                              <div 
                                key={prog.id} 
                                className={cn(
                                  "p-3 rounded-xl border text-xs space-y-1.5 shadow-2xs transition-all",
                                  prog.type === 'اصلی' ? "bg-indigo-950 text-white border-indigo-900" :
                                  prog.type === 'مشاوره' ? "bg-amber-50 text-amber-950 border-amber-300" :
                                  prog.type === 'پژوهش' ? "bg-emerald-50 text-emerald-950 border-emerald-300" :
                                  prog.type === 'دروس 5 شنبه' ? "bg-purple-50 text-purple-950 border-purple-300" :
                                  "bg-white text-slate-800 border-slate-200"
                                )}
                              >
                                <div className="flex items-center justify-between font-black">
                                  <span className="text-xs truncate">{prog.title}</span>
                                  <span className={cn(
                                    "text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0",
                                    prog.type === 'اصلی' ? "bg-indigo-800 text-indigo-100 border-indigo-700" :
                                    prog.type === 'مشاوره' ? "bg-amber-200 text-amber-950 border-amber-300" :
                                    prog.type === 'پژوهش' ? "bg-emerald-200 text-emerald-950 border-emerald-300" :
                                    prog.type === 'دروس 5 شنبه' ? "bg-purple-200 text-purple-950 border-purple-300" :
                                    "bg-slate-100 text-slate-700 border-slate-300"
                                  )}>
                                    {prog.type}
                                  </span>
                                </div>

                                <div className={cn(
                                  "flex items-center justify-between text-[10px] font-bold",
                                  prog.type === 'اصلی' ? "text-indigo-200" : "text-slate-600"
                                )}>
                                  <span className="flex items-center gap-1">
                                    <Clock size={11} /> {prog.time || 'زمان مشخص‌نشده'}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <User size={11} /> {prog.teacher || 'استاد ثبت‌نشده'}
                                  </span>
                                </div>

                                {prog.type === 'مشاوره' && parentTitle && (
                                  <div className="pt-1 border-t border-amber-200/80 text-[10px] font-bold text-amber-900 flex items-center gap-1">
                                    <GitFork size={11} className="text-amber-700" />
                                    <span>درس اصلی مرتبط: «{parentTitle}»</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {dayProgs.length === 0 && (
                            <div className="py-6 text-center text-slate-400 text-xs italic">
                              کلاسی برای {dayName} ثبت نشده است.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DETAILED CATEGORIZED CLASSES BREAKDOWN */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <Layers size={20} className="text-indigo-600" />
                    <span>دسته‌بندی برنامه‌ها و دروس ثبت‌نام شده</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-bold">تفکیک کامل تمام برنامه‌ها</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Main Classes Section */}
                  <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                    <div className="flex items-center justify-between font-black text-indigo-950 text-sm border-b border-indigo-200 pb-2">
                      <span className="flex items-center gap-2">
                        <BookOpen size={16} className="text-indigo-700" />
                        <span>دروس اصلی ({mainClasses.length} درس)</span>
                      </span>
                    </div>

                    <div className="space-y-2">
                      {mainClasses.map(p => (
                        <div key={p.id} className="bg-white p-3 rounded-xl border border-indigo-200 space-y-1 text-xs shadow-2xs">
                          <div className="font-black text-indigo-950 text-sm">{p.title}</div>
                          <div className="flex justify-between text-slate-600 font-bold text-[11px]">
                            <span>استاد: {p.teacher || '---'}</span>
                            <span>زمان: {p.day || ''} {p.time || ''}</span>
                          </div>
                        </div>
                      ))}
                      {mainClasses.length === 0 && (
                        <p className="text-xs text-indigo-400 italic text-center py-2">هیچ درس اصلی ثبت‌نام نشده است.</p>
                      )}
                    </div>
                  </div>

                  {/* Counseling Classes Section */}
                  <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-3">
                    <div className="flex items-center justify-between font-black text-amber-950 text-sm border-b border-amber-200 pb-2">
                      <span className="flex items-center gap-2">
                        <MessageSquare size={16} className="text-amber-700" />
                        <span>کلاس‌های مشاوره ({counselingClasses.length} کلاس)</span>
                      </span>
                    </div>

                    <div className="space-y-2">
                      {counselingClasses.map(p => {
                        const parentTitle = getParentProgramTitle(p.parentProgramId);
                        return (
                          <div key={p.id} className="bg-white p-3 rounded-xl border border-amber-200 space-y-1 text-xs shadow-2xs">
                            <div className="font-black text-amber-950 text-sm">{p.title}</div>
                            <div className="flex justify-between text-slate-600 font-bold text-[11px]">
                              <span>استاد: {p.teacher || '---'}</span>
                              <span>زمان: {p.day || ''} {p.time || ''}</span>
                            </div>
                            {parentTitle && (
                              <div className="text-[10px] font-bold text-amber-800 pt-1 border-t border-amber-100 flex items-center gap-1">
                                <GitFork size={10} />
                                <span>مرتبط با درس اصلی: «{parentTitle}»</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {counselingClasses.length === 0 && (
                        <p className="text-xs text-amber-500 italic text-center py-2">کلاس مشاوره‌ای ثبت‌نام نشده است.</p>
                      )}
                    </div>
                  </div>

                  {/* Research & Thursday Classes Section */}
                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-3">
                    <div className="flex items-center justify-between font-black text-emerald-950 text-sm border-b border-emerald-200 pb-2">
                      <span className="flex items-center gap-2">
                        <Sparkles size={16} className="text-emerald-700" />
                        <span>واحد پژوهش و برنامه‌های ۵ شنبه ({researchClasses.length + thursdayClasses.length} مورد)</span>
                      </span>
                    </div>

                    <div className="space-y-2">
                      {[...researchClasses, ...thursdayClasses].map(p => (
                        <div key={p.id} className="bg-white p-3 rounded-xl border border-emerald-200 space-y-1 text-xs shadow-2xs">
                          <div className="font-black text-emerald-950 text-sm flex items-center justify-between">
                            <span>{p.title}</span>
                            <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded font-bold">{p.type}</span>
                          </div>
                          <div className="flex justify-between text-slate-600 font-bold text-[11px]">
                            <span>استاد/مسئول: {p.teacher || '---'}</span>
                            <span>زمان: {p.day || ''} {p.time || ''}</span>
                          </div>
                        </div>
                      ))}
                      {researchClasses.length === 0 && thursdayClasses.length === 0 && (
                        <p className="text-xs text-emerald-500 italic text-center py-2">برنامه‌ای در این بخش ثبت نشده است.</p>
                      )}
                    </div>
                  </div>

                  {/* Other Classes Section */}
                  <div className="p-4 bg-slate-100/60 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between font-black text-slate-800 text-sm border-b border-slate-200 pb-2">
                      <span className="flex items-center gap-2">
                        <HelpCircle size={16} className="text-slate-600" />
                        <span>سایر برنامه‌ها ({otherClasses.length} مورد)</span>
                      </span>
                    </div>

                    <div className="space-y-2">
                      {otherClasses.map(p => (
                        <div key={p.id} className="bg-white p-3 rounded-xl border border-slate-200 space-y-1 text-xs shadow-2xs">
                          <div className="font-black text-slate-900 text-sm">{p.title}</div>
                          <div className="flex justify-between text-slate-600 font-bold text-[11px]">
                            <span>استاد: {p.teacher || '---'}</span>
                            <span>زمان: {p.day || ''} {p.time || ''}</span>
                          </div>
                        </div>
                      ))}
                      {otherClasses.length === 0 && (
                        <p className="text-xs text-slate-400 italic text-center py-2">برنامه دیگری ثبت‌نام نشده است.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
              <Users size={36} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-600">لطفا یک طلبه را از منوی سمت راست انتخاب کنید.</p>
            </div>
          )}
        </div>
      </div>

      {/* HIDDEN PRINTABLE CONTAINER FOR PDF EXPORT */}
      <div style={{ position: 'fixed', left: '-9999px', top: '0px', width: '850px', zIndex: -1000, pointerEvents: 'none', opacity: 0 }}>
        {selectedStudent && (
          <div ref={studentSchedulePrintRef} className="p-8 bg-white font-vazir text-slate-900 space-y-6" dir="rtl">
            <div className="text-center border-b-2 border-indigo-600 pb-4 space-y-2">
              <h1 className="text-2xl font-black text-indigo-950">گزارش رسمی برنامه هفتگی و کلاس‌های درسی طلبه</h1>
              <p className="text-xs text-slate-600">
                استاد/مسئول: <span className="font-bold text-slate-800">{currentMentor.name}</span> | تاریخ تنظیم: <span className="font-bold text-slate-800">{new Date().toLocaleDateString('fa-IR-u-nu-latn')}</span>
              </p>
            </div>

            {/* Student Specifications Table */}
            <div className="bg-indigo-50/80 p-4 rounded-xl border border-indigo-200 space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div><b>نام و نام خانوادگی طلبه:</b> <span className="text-indigo-950 font-black">{selectedStudent.name}</span></div>
                <div><b>پایه تحصیلی:</b> <span className="text-indigo-900 font-bold">پایه {selectedStudent.grade || '---'}</span></div>
                <div><b>کد ملی:</b> <span>{selectedStudent.nationalId || '---'}</span></div>
                <div><b>شماره تماس:</b> <span>{selectedStudent.phoneNumber || '---'}</span></div>
                <div><b>وضعیت معممی:</b> <span>{selectedStudent.tammomStatus || '---'}</span></div>
                <div><b>تعداد کلاس‌های ثبت‌نامی:</b> <span className="font-black text-indigo-900">{studentPrograms.length} کلاس</span></div>
              </div>
            </div>

            {/* Weekly Timetable Table */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-indigo-900 border-b border-indigo-200 pb-1">جدول برنامه هفتگی:</h3>
              <table className="w-full text-right text-xs border-collapse border border-slate-300 bg-white">
                <thead>
                  <tr className="bg-slate-100 font-black text-slate-800">
                    <th className="p-2.5 border border-slate-300 w-24 text-center">روز هفته</th>
                    <th className="p-2.5 border border-slate-300">برنامه‌ها و کلاس‌های دایر</th>
                  </tr>
                </thead>
                <tbody>
                  {WEEK_DAYS.map(day => {
                    const dayProgs = getProgramsForDay(day);
                    return (
                      <tr key={day} className="border-b border-slate-200">
                        <td className="p-2.5 border border-slate-300 font-black text-slate-900 text-center bg-slate-50">{day}</td>
                        <td className="p-2.5 border border-slate-300">
                          {dayProgs.length > 0 ? (
                            <div className="space-y-1.5">
                              {dayProgs.map(p => {
                                const parentTitle = getParentProgramTitle(p.parentProgramId);
                                return (
                                  <div key={p.id} className="text-xs font-medium border-b border-slate-100 last:border-0 pb-1">
                                    <span className="font-black text-slate-900">«{p.title}»</span>{' '}
                                    <span className="text-indigo-800 font-bold">({p.type})</span> -{' '}
                                    <span>ساعت: <b>{p.time || '---'}</b></span> | {' '}
                                    <span>استاد: <b>{p.teacher || '---'}</b></span>
                                    {parentTitle && <span className="text-amber-900 font-bold"> (مرتبط با {parentTitle})</span>}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">بدون کلاس ثبت‌شده</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Complete Classes Table */}
            <div className="space-y-3">
              <h3 className="text-sm font-black text-indigo-900 border-b border-indigo-200 pb-1">لیست تفکیکی کلیه برنامه‌های آموزشی:</h3>
              <table className="w-full text-right text-xs border-collapse border border-slate-300 bg-white">
                <thead>
                  <tr className="bg-slate-100 font-black text-slate-800">
                    <th className="p-2 border border-slate-300 w-10 text-center">ردیف</th>
                    <th className="p-2 border border-slate-300">عنوان کلاس</th>
                    <th className="p-2 border border-slate-300">نوع برنامه</th>
                    <th className="p-2 border border-slate-300">استاد مربوطه</th>
                    <th className="p-2 border border-slate-300">روز و زمان</th>
                    <th className="p-2 border border-slate-300">توضیحات / ارتباط</th>
                  </tr>
                </thead>
                <tbody>
                  {studentPrograms.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center italic text-slate-400">کلاسی برای این طلبه ثبت نشده است.</td>
                    </tr>
                  ) : (
                    studentPrograms.map((p, idx) => {
                      const parentTitle = getParentProgramTitle(p.parentProgramId);
                      return (
                        <tr key={p.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                          <td className="p-2 border border-slate-300 text-center font-bold">{idx + 1}</td>
                          <td className="p-2 border border-slate-300 font-black text-slate-900">{p.title}</td>
                          <td className="p-2 border border-slate-300 font-bold text-indigo-900">{p.type}</td>
                          <td className="p-2 border border-slate-300">{p.teacher || '---'}</td>
                          <td className="p-2 border border-slate-300">{p.day || ''} - {p.time || ''}</td>
                          <td className="p-2 border border-slate-300 text-slate-600">
                            {parentTitle ? `مرتبط با درس اصلی: ${parentTitle}` : '---'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
