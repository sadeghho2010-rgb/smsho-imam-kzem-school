import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  AlertCircle, 
  Bookmark, 
  Info, 
  CheckCircle2, 
  User, 
  Calendar, 
  ArrowRight,
  UserCheck,
  X,
  ShieldCheck,
  GraduationCap,
  Award,
  BookOpen,
  RotateCcw,
  FileText
} from 'lucide-react';
import { localDb } from '../lib/localDb';
import { Student, StudentComment, CommentPriority, OralExam, OralExamSubjectType } from '../types';
import { useMentor } from '../context/MentorContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const TEACHER_PRESETS = [
  'استاد فقه',
  'استاد اصول',
  'استاد اخلاق',
  'استاد مشاوره',
  'استاد پژوهش',
  'سرپرست خوابگاه'
];

const EXAM_TITLE_PRESETS = [
  'فقه پایه ۷ (مکاسب)',
  'فقه پایه ۸ (مکاسب)',
  'فقه پایه ۹ (مکاسب)',
  'فقه پایه ۱۰ (جواهر/عروه)',
  'اصول پایه ۷ (رسائل)',
  'اصول پایه ۸ (رسائل)',
  'اصول پایه ۹ (کفایه)',
  'اصول پایه ۱۰ (کفایه)',
  'فقه پایه ۶ (شرح لمعه)',
  'اصول پایه ۶ (اصول استنباط)'
];

const EXAMINER_PRESETS = [
  'استاد ممتحن فقه',
  'استاد ممتحن اصول',
  'استاد حسینی',
  'استاد رضایی',
  'استاد محمدی'
];

interface StudentCommentsProps {
  initialStudentId?: string;
}

export default function StudentComments({ initialStudentId }: StudentCommentsProps = {}) {
  const { filterStudents, currentMentorId, shahpooriFilter } = useMentor();
  const [students, setStudents] = useState<Student[]>([]);
  const [comments, setComments] = useState<StudentComment[]>([]);
  const [oralExams, setOralExams] = useState<OralExam[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Student view
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchStudentQuery, setSearchStudentQuery] = useState<string>('');

  // Helper functions for Shamsi date
  const getShamsiToday = (): string => {
    try {
      const today = new Date();
      const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(today);

      const year = parts.find(p => p.type === 'year')?.value;
      const month = parts.find(p => p.type === 'month')?.value;
      const day = parts.find(p => p.type === 'day')?.value;

      if (year && month && day) {
        return `${year}/${month}/${day}`;
      }
      return today.toLocaleDateString('fa-IR-u-nu-latn');
    } catch {
      return new Date().toLocaleDateString('fa-IR');
    }
  };

  const formatToShamsi = (dateStr?: string): string => {
    if (!dateStr) return 'تاریخ نامشخص';
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

  // Comment Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingComment, setEditingComment] = useState<StudentComment | null>(null);

  // Comment Form State
  const [formIsManager, setFormIsManager] = useState<boolean>(true);
  const [formTeacherName, setFormTeacherName] = useState<string>('');
  const [formPriority, setFormPriority] = useState<CommentPriority>('medium');
  const [formContent, setFormContent] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(getShamsiToday());
  const [formNeedsFollowUp, setFormNeedsFollowUp] = useState<boolean>(false);

  // Comment Delete Confirm Modal
  const [deleteConfirmComment, setDeleteConfirmComment] = useState<StudentComment | null>(null);

  // Oral Exam Modal State
  const [showOralExamModal, setShowOralExamModal] = useState(false);
  const [editingOralExam, setEditingOralExam] = useState<OralExam | null>(null);

  // Oral Exam Form State
  const [examTitle, setExamTitle] = useState<string>('');
  const [examSubjectType, setExamSubjectType] = useState<OralExamSubjectType>('فقه');
  const [examScore, setExamScore] = useState<string>('');
  const [examExaminerName, setExamExaminerName] = useState<string>('');
  const [examDate, setExamDate] = useState<string>(getShamsiToday());
  const [examIsRetake, setExamIsRetake] = useState<boolean>(false);
  const [examNotes, setExamNotes] = useState<string>('');

  // Oral Exam Delete Confirm Modal
  const [deleteConfirmOralExam, setDeleteConfirmOralExam] = useState<OralExam | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch students
      const studentsListRaw = await localDb.getDocs<Student>('students');
      const studentsList = filterStudents(studentsListRaw, true);
      studentsList.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
      setStudents(studentsList);

      if (initialStudentId) {
        const found = studentsList.find(s => s.id === initialStudentId);
        if (found) setSelectedStudent(found);
      }

      // Fetch comments
      const commentsList = await localDb.getDocs<StudentComment>('student_comments');
      commentsList.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
      setComments(commentsList);

      // Fetch oral exams
      const oralExamsList = await localDb.getDocs<OralExam>('oral_exams');
      oralExamsList.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
      setOralExams(oralExamsList);
    } catch (err) {
      console.error("Error fetching comments/students/exams:", err);
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

  useEffect(() => {
    if (initialStudentId && students.length > 0) {
      const found = students.find(s => s.id === initialStudentId);
      if (found) setSelectedStudent(found);
    }
  }, [initialStudentId, students]);

  const activeStudents = students.filter(s => s.isActive !== false);

  const filteredActiveStudents = activeStudents.filter(s => {
    if (!searchStudentQuery.trim()) return true;
    const q = searchStudentQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.grade && s.grade.toLowerCase().includes(q));
  });

  // Comment Handlers
  const handleOpenAddModal = (isManagerDefault: boolean = true) => {
    if (!selectedStudent) return;
    setEditingComment(null);
    setFormIsManager(isManagerDefault);
    setFormTeacherName(isManagerDefault ? 'خودم (مدیر)' : 'استاد فقه');
    setFormPriority('medium');
    setFormContent('');
    setFormDate(getShamsiToday());
    setFormNeedsFollowUp(false);
    setShowModal(true);
  };

  const handleOpenEditModal = (comment: StudentComment) => {
    setEditingComment(comment);
    const isMgr = comment.authorName === 'خودم (مدیر)' || comment.authorName.includes('مدیر');
    setFormIsManager(isMgr);
    setFormTeacherName(comment.authorName);
    setFormPriority(comment.priority);
    setFormContent(comment.content);
    setFormDate(comment.date ? formatToShamsi(comment.date) : getShamsiToday());
    setFormNeedsFollowUp(!!comment.needsFollowUp);
    setShowModal(true);
  };

  const handleSaveComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !formContent.trim()) {
      alert("لطفاً متن صحبت را وارد کنید.");
      return;
    }

    const finalAuthorName = formIsManager 
      ? 'خودم (مدیر)' 
      : (formTeacherName.trim() || 'استاد محترم');

    setLoading(true);
    try {
      const studentName = selectedStudent.name;
      let followUpId = editingComment?.followUpTodoId;

      const priorityLabel = 
        formPriority === 'high' ? 'ضروری' :
        formPriority === 'medium' ? 'مهم' :
        formPriority === 'low' ? 'معمولی' : 'اطلاع';

      const todoTitle = `[پیگیری صحبت - ${priorityLabel}] ${studentName}: ${formContent.trim().substring(0, 60)}${formContent.length > 60 ? '...' : ''} (${finalAuthorName})`;

      if (formNeedsFollowUp) {
        if (followUpId) {
          try {
            await localDb.updateDoc('todos', followUpId, {
              title: todoTitle,
              studentId: selectedStudent.id,
            });
          } catch {
            const newTodoId = await localDb.addDoc('todos', {
              title: todoTitle,
              completed: false,
              studentId: selectedStudent.id,
              createdAt: new Date().toISOString()
            });
            followUpId = newTodoId;
          }
        } else {
          const newTodoId = await localDb.addDoc('todos', {
            title: todoTitle,
            completed: false,
            studentId: selectedStudent.id,
            createdAt: new Date().toISOString()
          });
          followUpId = newTodoId;
        }
      } else {
        if (followUpId) {
          try {
            await localDb.deleteDoc('todos', followUpId);
          } catch (e) {
            console.error("Error deleting old todo:", e);
          }
          followUpId = undefined;
        }
      }

      const commentData = {
        studentId: selectedStudent.id,
        authorName: finalAuthorName,
        priority: formPriority,
        content: formContent.trim(),
        date: formDate,
        needsFollowUp: formNeedsFollowUp,
        followUpTodoId: followUpId || null,
        updatedAt: new Date().toISOString()
      };

      if (editingComment) {
        await localDb.updateDoc('student_comments', editingComment.id, commentData);
      } else {
        await localDb.addDoc('student_comments', {
          ...commentData,
          createdAt: new Date().toISOString()
        });
      }

      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error("Error saving comment:", err);
      alert("خطا در ثبت نظر: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCommentAction = async () => {
    if (!deleteConfirmComment) return;
    try {
      setLoading(true);
      if (deleteConfirmComment.followUpTodoId) {
        try {
          await localDb.deleteDoc('todos', deleteConfirmComment.followUpTodoId);
        } catch (e) {
          console.error("Error deleting associated todo:", e);
        }
      }
      await localDb.deleteDoc('student_comments', deleteConfirmComment.id);
      setDeleteConfirmComment(null);
      fetchData();
    } catch (err) {
      console.error("Error deleting comment:", err);
      alert("خطا در حذف نظر");
    } finally {
      setLoading(false);
    }
  };

  // Oral Exam Handlers
  const handleOpenAddOralExam = () => {
    if (!selectedStudent) return;
    setEditingOralExam(null);
    setExamTitle('');
    setExamSubjectType('فقه');
    setExamScore('');
    setExamExaminerName('استاد ممتحن فقه');
    setExamDate(getShamsiToday());
    setExamIsRetake(false);
    setExamNotes('');
    setShowOralExamModal(true);
  };

  const handleOpenEditOralExam = (exam: OralExam) => {
    setEditingOralExam(exam);
    setExamTitle(exam.title);
    setExamSubjectType(exam.subjectType || 'فقه');
    setExamScore(String(exam.score ?? ''));
    setExamExaminerName(exam.examinerName || '');
    setExamDate(exam.date ? formatToShamsi(exam.date) : getShamsiToday());
    setExamIsRetake(!!exam.isRetake);
    setExamNotes(exam.notes || '');
    setShowOralExamModal(true);
  };

  const handleSaveOralExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !examTitle.trim()) {
      alert("لطفاً عنوان امتحان شفاهی را وارد کنید.");
      return;
    }

    const numericScore = parseFloat(examScore);
    if (isNaN(numericScore) || numericScore < 0 || numericScore > 20) {
      alert("لطفاً نمره معتبر بین ۰ تا ۲۰ وارد کنید.");
      return;
    }

    setLoading(true);
    try {
      const examData = {
        studentId: selectedStudent.id,
        title: examTitle.trim(),
        subjectType: examSubjectType,
        score: numericScore,
        examinerName: examExaminerName.trim() || 'استاد ممتحن',
        date: examDate,
        isRetake: examIsRetake,
        notes: examNotes.trim(),
        updatedAt: new Date().toISOString()
      };

      if (editingOralExam) {
        await localDb.updateDoc('oral_exams', editingOralExam.id, examData);
      } else {
        await localDb.addDoc('oral_exams', {
          ...examData,
          createdAt: new Date().toISOString()
        });
      }

      setShowOralExamModal(false);
      fetchData();
    } catch (err) {
      console.error("Error saving oral exam:", err);
      alert("خطا در ثبت نمره امتحان شفاهی: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOralExamAction = async () => {
    if (!deleteConfirmOralExam) return;
    try {
      setLoading(true);
      await localDb.deleteDoc('oral_exams', deleteConfirmOralExam.id);
      setDeleteConfirmOralExam(null);
      fetchData();
    } catch (err) {
      console.error("Error deleting oral exam:", err);
      alert("خطا در حذف نمره امتحان شفاهی");
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadge = (priority: CommentPriority) => {
    switch (priority) {
      case 'high':
        return {
          label: 'ضروری / خیلی مهم',
          bgColor: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: AlertCircle
        };
      case 'medium':
        return {
          label: 'مهم',
          bgColor: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: Bookmark
        };
      case 'low':
        return {
          label: 'معمولی',
          bgColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          icon: MessageSquare
        };
      case 'info':
        return {
          label: 'جهت اطلاع',
          bgColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: Info
        };
    }
  };

  // Student specific data
  const studentComments = selectedStudent ? comments.filter(c => c.studentId === selectedStudent.id) : [];
  const managerComments = studentComments.filter(c => c.authorName === 'خودم (مدیر)' || c.authorName.includes('مدیر'));
  const teacherComments = studentComments.filter(c => c.authorName !== 'خودم (مدیر)' && !c.authorName.includes('مدیر'));

  const studentOralExams = selectedStudent ? oralExams.filter(o => o.studentId === selectedStudent.id) : [];
  
  // Oral exam statistics for selected student
  const totalOralExams = studentOralExams.length;
  const fiqhExams = studentOralExams.filter(o => o.subjectType === 'فقه');
  const fiqhAvgScore = fiqhExams.length > 0 
    ? (fiqhExams.reduce((sum, item) => sum + Number(item.score || 0), 0) / fiqhExams.length).toFixed(2)
    : '-';

  const usulExams = studentOralExams.filter(o => o.subjectType === 'اصول');
  const usulAvgScore = usulExams.length > 0 
    ? (usulExams.reduce((sum, item) => sum + Number(item.score || 0), 0) / usulExams.length).toFixed(2)
    : '-';

  const retakesCount = studentOralExams.filter(o => o.isRetake).length;

  return (
    <div className="max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* CASE 1: Student List View */}
      {!selectedStudent ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
                <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-2xl flex items-center justify-center shrink-0">
                  <MessageSquare size={22} />
                </div>
                <span>نظرات و صحبت‌ها</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                مشاهده پرونده گفتگوها، ارزیابی‌های اساتید و نمرات امتحانات شفاهی هر طلبه
              </p>
            </div>

            <div className="px-4 py-2 bg-indigo-50 text-indigo-800 rounded-2xl text-xs font-bold border border-indigo-100 flex items-center gap-2 shrink-0">
              <UserCheck size={16} />
              <span>{activeStudents.length} کاربر فعال</span>
            </div>
          </div>

          {/* Search Box */}
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200">
            <div className="relative">
              <Search className="absolute right-3.5 top-3.5 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="جستجوی نام طلبه یا پایه در کاربران فعال..."
                value={searchStudentQuery}
                onChange={(e) => setSearchStudentQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
              />
              {searchStudentQuery && (
                <button 
                  onClick={() => setSearchStudentQuery('')}
                  className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Students Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredActiveStudents.map(student => {
              const allStudentComms = comments.filter(c => c.studentId === student.id);
              const mgrCount = allStudentComms.filter(c => c.authorName === 'خودم (مدیر)' || c.authorName.includes('مدیر')).length;
              const tchCount = allStudentComms.filter(c => c.authorName !== 'خودم (مدیر)' && !c.authorName.includes('مدیر')).length;
              const examsCount = oralExams.filter(o => o.studentId === student.id).length;

              return (
                <motion.div
                  key={student.id}
                  onClick={() => setSelectedStudent(student)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between gap-4 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-50 group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white rounded-2xl flex items-center justify-center font-black text-lg transition-all shrink-0 overflow-hidden">
                      {student.photoUrl ? (
                        <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover" />
                      ) : (
                        student.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-800 group-hover:text-indigo-600 transition-colors">
                        {student.name}
                      </h3>
                      <p className="text-xs text-slate-400 font-bold mt-0.5">
                        پایه {student.grade || 'نامشخص'}
                      </p>
                    </div>
                  </div>

                  {/* 3 Badges */}
                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-slate-100">
                    <div className="bg-slate-50 group-hover:bg-indigo-50/50 p-2 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] font-bold text-slate-400">صحبت مدیریت</span>
                      <span className="text-xs font-black text-indigo-900 mt-0.5">{mgrCount}</span>
                    </div>

                    <div className="bg-slate-50 group-hover:bg-purple-50/50 p-2 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] font-bold text-slate-400">ارزیابی اساتید</span>
                      <span className="text-xs font-black text-purple-900 mt-0.5">{tchCount}</span>
                    </div>

                    <div className="bg-slate-50 group-hover:bg-amber-50/50 p-2 rounded-xl border border-slate-100 flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] font-bold text-slate-400">امتحان شفاهی</span>
                      <span className="text-xs font-black text-amber-900 mt-0.5">{examsCount}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold text-indigo-600 pt-1">
                    <span>ورود به پرونده طلبه</span>
                    <ArrowRight size={16} className="rotate-180 group-hover:-translate-x-1 transition-transform" />
                  </div>
                </motion.div>
              );
            })}
          </div>

          {!loading && filteredActiveStudents.length === 0 && (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                <UserCheck size={32} />
              </div>
              <h3 className="text-base font-bold text-slate-700">هیچ کاربر فعالی یافت نشد</h3>
              <p className="text-xs text-slate-400">لطفاً از بخش کاربران، وضعیت طلاب را بررسی فرمایید.</p>
            </div>
          )}
        </div>
      ) : (
        /* CASE 2: Single Student Detailed View (3 BOXES) */
        <div className="space-y-6">
          {/* Back Button and Student Profile Banner */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all flex items-center gap-1.5 text-xs font-bold shrink-0"
              >
                <ArrowRight size={18} />
                <span>بازگشت به لیست طلاب</span>
              </button>

              <div className="h-8 w-px bg-slate-200 hidden sm:block" />

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-lg shrink-0 overflow-hidden">
                  {selectedStudent.photoUrl ? (
                    <img src={selectedStudent.photoUrl} alt={selectedStudent.name} className="w-full h-full object-cover" />
                  ) : (
                    selectedStudent.name.charAt(0)
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900">{selectedStudent.name}</h2>
                  <p className="text-xs text-slate-500 mt-0.5 font-bold">
                    پایه {selectedStudent.grade || 'نامشخص'} • {studentComments.length} صحبت/ارزیابی • {studentOralExams.length} امتحان شفاهی
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleOpenAddModal(true)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-indigo-100 flex items-center gap-1.5 shrink-0"
              >
                <Plus size={16} />
                <span>ثبت صحبت / ارزیابی</span>
              </button>

              <button
                onClick={handleOpenAddOralExam}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md shadow-amber-100 flex items-center gap-1.5 shrink-0"
              >
                <Award size={16} />
                <span>ثبت نمره شفاهی</span>
              </button>
            </div>
          </div>

          {/* THREE MAIN BOXES / COLUMNS */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* BOX 1: MANAGER'S COMMENTS */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center font-bold shrink-0">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">صحبت‌ها و نکات خودم (مدیر)</h3>
                      <p className="text-[11px] text-slate-400 font-medium">گفتگوها و توصیه‌های مدیریت</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenAddModal(true)}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <Plus size={14} />
                    <span>افزودن</span>
                  </button>
                </div>

                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {managerComments.map(comment => {
                      const priorityBadge = getPriorityBadge(comment.priority);
                      const PriorityIcon = priorityBadge.icon;

                      return (
                        <motion.div
                          key={comment.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={cn(
                            "p-4 rounded-2xl border space-y-3 transition-all relative",
                            comment.priority === 'high' 
                              ? "border-rose-200 bg-rose-50/20" 
                              : comment.priority === 'medium'
                                ? "border-amber-200 bg-amber-50/20"
                                : "border-slate-200 bg-slate-50/50"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border",
                                priorityBadge.bgColor
                              )}>
                                <PriorityIcon size={12} />
                                <span>{priorityBadge.label}</span>
                              </span>

                              {comment.needsFollowUp && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 border border-purple-200 rounded-full text-[10px] font-black inline-flex items-center gap-1">
                                  <Bookmark size={10} className="text-purple-600" />
                                  <span>پیگیری</span>
                                </span>
                              )}
                            </div>

                            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                              <Calendar size={12} />
                              <span>{formatToShamsi(comment.date)}</span>
                            </span>
                          </div>

                          <p className="text-xs font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                            {comment.content}
                          </p>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100/80">
                            <button
                              onClick={() => handleOpenEditModal(comment)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                              title="ویرایش"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmComment(comment)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                              title="حذف"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {managerComments.length === 0 && (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 space-y-2">
                      <ShieldCheck size={28} className="mx-auto opacity-30 text-indigo-600" />
                      <p className="text-xs font-bold">هنوز هیچ صحبتی از مدیریت ثبت نشده است</p>
                      <button
                        onClick={() => handleOpenAddModal(true)}
                        className="text-xs font-bold text-indigo-600 hover:underline"
                      >
                        + ثبت اولین صحبت خودم
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* BOX 2: OTHER TEACHERS' COMMENTS */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-purple-50 text-purple-700 rounded-xl flex items-center justify-center font-bold shrink-0">
                      <GraduationCap size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">صحبت‌ها و ارزیابی‌های سایر اساتید</h3>
                      <p className="text-[11px] text-slate-400 font-medium">نظرات اساتید فقه، اصول، اخلاق و ...</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenAddModal(false)}
                    className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <Plus size={14} />
                    <span>افزودن</span>
                  </button>
                </div>

                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {teacherComments.map(comment => {
                      const priorityBadge = getPriorityBadge(comment.priority);
                      const PriorityIcon = priorityBadge.icon;

                      return (
                        <motion.div
                          key={comment.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={cn(
                            "p-4 rounded-2xl border space-y-3 transition-all relative",
                            comment.priority === 'high' 
                              ? "border-rose-200 bg-rose-50/20" 
                              : comment.priority === 'medium'
                                ? "border-amber-200 bg-amber-50/20"
                                : "border-purple-100 bg-purple-50/30"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-800 text-xs flex items-center gap-1">
                                <User size={13} className="text-purple-600" />
                                <span>{comment.authorName}</span>
                              </span>

                              <span className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                                priorityBadge.bgColor
                              )}>
                                <PriorityIcon size={11} />
                                <span>{priorityBadge.label}</span>
                              </span>

                              {comment.needsFollowUp && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 border border-purple-200 rounded-full text-[10px] font-black inline-flex items-center gap-1">
                                  <Bookmark size={10} className="text-purple-600" />
                                  <span>پیگیری</span>
                                </span>
                              )}
                            </div>

                            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                              <Calendar size={12} />
                              <span>{formatToShamsi(comment.date)}</span>
                            </span>
                          </div>

                          <p className="text-xs font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">
                            {comment.content}
                          </p>

                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100/80">
                            <button
                              onClick={() => handleOpenEditModal(comment)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                              title="ویرایش"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirmComment(comment)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                              title="حذف"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {teacherComments.length === 0 && (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 space-y-2">
                      <GraduationCap size={28} className="mx-auto opacity-30 text-purple-600" />
                      <p className="text-xs font-bold">ارزیابی دیگری از اساتید ثبت نشده است</p>
                      <button
                        onClick={() => handleOpenAddModal(false)}
                        className="text-xs font-bold text-purple-600 hover:underline"
                      >
                        + ثبت ارزیابی استاد
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* BOX 3: ORAL EXAM GRADES */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4 flex flex-col justify-between">
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-amber-50 text-amber-700 rounded-xl flex items-center justify-center font-bold shrink-0">
                      <Award size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-slate-900">نمرات امتحانات شفاهی</h3>
                      <p className="text-[11px] text-slate-400 font-medium">سوابق و نمرات امتحانات شفاهی فقه و اصول</p>
                    </div>
                  </div>

                  <button
                    onClick={handleOpenAddOralExam}
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <Plus size={14} />
                    <span>ثبت نمره</span>
                  </button>
                </div>

                {/* Stats Header Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 text-center">
                    <span className="text-[10px] font-bold text-slate-400 block">تعداد شرکت</span>
                    <span className="text-xs font-black text-slate-800 block mt-0.5">{totalOralExams} مورد</span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 text-center">
                    <span className="text-[10px] font-bold text-slate-400 block">میانگین فقه</span>
                    <span className="text-xs font-black text-emerald-700 block mt-0.5">{fiqhAvgScore}</span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 text-center">
                    <span className="text-[10px] font-bold text-slate-400 block">میانگین اصول</span>
                    <span className="text-xs font-black text-indigo-700 block mt-0.5">{usulAvgScore}</span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 text-center">
                    <span className="text-[10px] font-bold text-slate-400 block">امتحان مجدد</span>
                    <span className="text-xs font-black text-amber-700 block mt-0.5">{retakesCount} بار</span>
                  </div>
                </div>

                {/* Oral Exam Cards List */}
                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {studentOralExams.map(exam => (
                      <motion.div
                        key={exam.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={cn(
                          "p-4 rounded-2xl border space-y-3 transition-all relative",
                          exam.isRetake 
                            ? "border-amber-200 bg-amber-50/20" 
                            : exam.subjectType === 'فقه'
                              ? "border-emerald-200 bg-emerald-50/20"
                              : exam.subjectType === 'اصول'
                                ? "border-indigo-200 bg-indigo-50/20"
                                : "border-slate-200 bg-slate-50/50"
                        )}
                      >
                        {/* Top row */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-[10px] font-black border",
                              exam.subjectType === 'فقه'
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : exam.subjectType === 'اصول'
                                  ? "bg-indigo-100 text-indigo-800 border-indigo-300"
                                  : "bg-slate-100 text-slate-700 border-slate-300"
                            )}>
                              {exam.subjectType}
                            </span>

                            {exam.isRetake && (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-full text-[10px] font-black inline-flex items-center gap-1">
                                <RotateCcw size={10} className="text-amber-600" />
                                <span>امتحان مجدد</span>
                              </span>
                            )}

                            <h4 className="text-xs font-black text-slate-800">
                              {exam.title}
                            </h4>
                          </div>

                          <div className="px-3 py-1 bg-white text-slate-900 border border-slate-200 rounded-xl font-black text-xs shadow-sm flex items-center gap-1">
                            <span className="text-[10px] text-slate-400 font-bold">نمره:</span>
                            <span className={cn(
                              "text-sm font-black",
                              exam.score >= 16 ? "text-emerald-700" : exam.score >= 12 ? "text-amber-700" : "text-rose-700"
                            )}>
                              {exam.score}
                            </span>
                          </div>
                        </div>

                        {/* Examiner & Date */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                          <span className="flex items-center gap-1">
                            <User size={12} className="text-slate-400" />
                            <span>استاد ممتحن: <strong className="text-slate-700">{exam.examinerName || 'نامشخص'}</strong></span>
                          </span>

                          <span className="flex items-center gap-1">
                            <Calendar size={12} className="text-slate-400" />
                            <span>{formatToShamsi(exam.date)}</span>
                          </span>
                        </div>

                        {/* Notes if present */}
                        {exam.notes && (
                          <div className="p-2.5 bg-white/80 border border-slate-100 rounded-xl text-xs text-slate-700 leading-relaxed space-y-0.5">
                            <span className="text-[10px] font-bold text-slate-400 block">نظر و ملاحظات استاد ممتحن:</span>
                            <p className="whitespace-pre-wrap">{exam.notes}</p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100/80">
                          <button
                            onClick={() => handleOpenEditOralExam(exam)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"
                            title="ویرایش"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmOralExam(exam)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                            title="حذف"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {studentOralExams.length === 0 && (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 space-y-2">
                      <Award size={28} className="mx-auto opacity-30 text-amber-600" />
                      <p className="text-xs font-bold">هنوز هیچ نمره امتحان شفاهی ثبت نشده است</p>
                      <button
                        onClick={handleOpenAddOralExam}
                        className="text-xs font-bold text-amber-600 hover:underline"
                      >
                        + ثبت اولی نمره امتحان شفاهی
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Add / Edit Comment Modal */}
      <AnimatePresence>
        {showModal && selectedStudent && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden my-8"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center text-white shrink-0">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      {editingComment ? 'ویرایش صحبت' : `ثبت صحبت برای ${selectedStudent.name}`}
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">
                      درجه اهمیت و متن صحبت یا ارزیابی را مشخص کنید
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveComment} className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    نویسنده / گوینده صحبت
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setFormIsManager(true);
                        setFormTeacherName('خودم (مدیر)');
                      }}
                      className={cn(
                        "py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                        formIsManager ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <ShieldCheck size={16} />
                      <span>خودم (مدیر)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFormIsManager(false);
                        if (formTeacherName === 'خودم (مدیر)') setFormTeacherName('استاد فقه');
                      }}
                      className={cn(
                        "py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                        !formIsManager ? "bg-white text-purple-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <GraduationCap size={16} />
                      <span>استاد دیگر</span>
                    </button>
                  </div>
                </div>

                {!formIsManager && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700">
                      عنوان یا نام استاد <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formTeacherName}
                      onChange={(e) => setFormTeacherName(e.target.value)}
                      placeholder="مثلا: استاد فقه، استاد اخلاق..."
                      required
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {TEACHER_PRESETS.map(preset => (
                        <button
                          type="button"
                          key={preset}
                          onClick={() => setFormTeacherName(preset)}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border",
                            formTeacherName === preset 
                              ? "bg-purple-600 text-white border-purple-600" 
                              : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
                          )}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاریخ صحبت / ارزیابی (شمسی)</label>
                  <input
                    type="text"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    placeholder="۱۴۰۳/۰۵/۲۴"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    درجه اهمیت
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormPriority('high')}
                      className={cn(
                        "p-2.5 rounded-2xl text-[11px] font-bold border transition-all flex flex-col items-center gap-1",
                        formPriority === 'high'
                          ? "bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-200"
                          : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                      )}
                    >
                      <AlertCircle size={15} />
                      <span>ضروری / خیلی مهم</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormPriority('medium')}
                      className={cn(
                        "p-2.5 rounded-2xl text-[11px] font-bold border transition-all flex flex-col items-center gap-1",
                        formPriority === 'medium'
                          ? "bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-200"
                          : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                      )}
                    >
                      <Bookmark size={15} />
                      <span>مهم</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormPriority('low')}
                      className={cn(
                        "p-2.5 rounded-2xl text-[11px] font-bold border transition-all flex flex-col items-center gap-1",
                        formPriority === 'low'
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200"
                          : "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
                      )}
                    >
                      <MessageSquare size={15} />
                      <span>معمولی</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormPriority('info')}
                      className={cn(
                        "p-2.5 rounded-2xl text-[11px] font-bold border transition-all flex flex-col items-center gap-1",
                        formPriority === 'info'
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                      )}
                    >
                      <Info size={15} />
                      <span>جهت اطلاع</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    متن صحبت‌ها / ارزیابی <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={5}
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="شرح صحبت‌ها، توصیه‌های مطرح شده، تذکرات استاد یا ملاحظات مدیریت..."
                    required
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none leading-relaxed"
                  />
                </div>

                <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="formNeedsFollowUpToggle"
                      checked={formNeedsFollowUp}
                      onChange={(e) => setFormNeedsFollowUp(e.target.checked)}
                      className="w-5 h-5 mt-0.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer shrink-0"
                    />
                    <label htmlFor="formNeedsFollowUpToggle" className="cursor-pointer">
                      <span className="text-xs font-black text-purple-950 block">افزودن خودکار به بخش «پیگیری‌ها»</span>
                      <span className="text-[10px] font-medium text-purple-700/80 block mt-0.5">
                        یک یادداشت پیگیری جدید در بخش «پیگیری‌ها» ایجاد خواهد شد.
                      </span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                  >
                    انصراف
                  </button>

                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-200 flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={16} />
                    <span>{editingComment ? 'ذخیره تغییرات' : 'ثبت صحبت'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Comment Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmComment && (
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
                  <h3 className="text-base font-black text-slate-800">تایید حذف صحبت</h3>
                  <p className="text-xs text-slate-500 mt-0.5">این عملیات غیرقابل بازگشت است</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-700 space-y-1">
                <p className="font-bold text-slate-800">گوینده: {deleteConfirmComment.authorName}</p>
                <p className="text-[11px] text-slate-600 line-clamp-2 mt-1">«{deleteConfirmComment.content}»</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmComment(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCommentAction}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-200 flex items-center gap-1.5"
                >
                  <Trash2 size={16} />
                  <span>حذف</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit Oral Exam Modal */}
      <AnimatePresence>
        {showOralExamModal && selectedStudent && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden my-8"
            >
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400 shrink-0">
                    <Award size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      {editingOralExam ? 'ویرایش نمره امتحان شفاهی' : `ثبت نمره امتحان شفاهی برای ${selectedStudent.name}`}
                    </h3>
                    <p className="text-xs text-amber-200/80 mt-0.5">
                      اطلاعات ماده درسی، نمره و نظرات استاد ممتحن را وارد نمایید
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowOralExamModal(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveOralExam} className="p-6 space-y-5">
                {/* Exam Subject Type (فقه / اصول / امتحان ورودی / سایر) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    ماده درسی / دسته امتحان
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 bg-slate-100 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setExamSubjectType('فقه')}
                      className={cn(
                        "py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                        examSubjectType === 'فقه' ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <BookOpen size={15} />
                      <span>فقه</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExamSubjectType('اصول')}
                      className={cn(
                        "py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                        examSubjectType === 'اصول' ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <BookOpen size={15} />
                      <span>اصول</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExamSubjectType('امتحان ورودی')}
                      className={cn(
                        "py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                        examSubjectType === 'امتحان ورودی' ? "bg-white text-amber-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <GraduationCap size={15} />
                      <span>امتحان ورودی</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExamSubjectType('سایر')}
                      className={cn(
                        "py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                        examSubjectType === 'سایر' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <span>سایر</span>
                    </button>
                  </div>
                </div>

                {/* Exam Title */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    عنوان امتحان / کتاب <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={examTitle}
                    onChange={(e) => setExamTitle(e.target.value)}
                    placeholder="مثلا: فقه پایه ۷ - مکاسب محرمه"
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {/* Score & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      نمره (از ۲۰) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      max="20"
                      value={examScore}
                      onChange={(e) => setExamScore(e.target.value)}
                      placeholder="مثلا: 18.5"
                      required
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">تاریخ برگزاری (شمسی)</label>
                    <input
                      type="text"
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      placeholder="۱۴۰۳/۰۵/۲۴"
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Examiner Name */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">
                    نام استاد ممتحن
                  </label>
                  <input
                    type="text"
                    value={examExaminerName}
                    onChange={(e) => setExamExaminerName(e.target.value)}
                    placeholder="نام استاد ممتحن..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {/* Is Retake Checkbox */}
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="examIsRetakeToggle"
                      checked={examIsRetake}
                      onChange={(e) => setExamIsRetake(e.target.checked)}
                      className="w-5 h-5 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
                    />
                    <label htmlFor="examIsRetakeToggle" className="cursor-pointer">
                      <span className="text-xs font-black text-amber-950 block">امتحان مجدد (تکراری)</span>
                      <span className="text-[10px] font-medium text-amber-800/80 block mt-0.5">
                        در صورت فعال بودن، در آمار تعداد «امتحان مجدد» محاسبه می‌گردد.
                      </span>
                    </label>
                  </div>
                </div>

                {/* Examiner Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    نظر و ارزیابی استاد ممتحن
                  </label>
                  <textarea
                    rows={4}
                    value={examNotes}
                    onChange={(e) => setExamNotes(e.target.value)}
                    placeholder="نقاط قوت و ضعف علمی، میزان تسلط بر عبارت، اشکالات یا توصیه‌های استاد ممتحن..."
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 focus:bg-white focus:border-amber-500 focus:outline-none leading-relaxed"
                  />
                </div>

                {/* Modal Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowOralExamModal(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                  >
                    انصراف
                  </button>

                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-amber-200 flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={16} />
                    <span>{editingOralExam ? 'ذخیره تغییرات' : 'ثبت نمره شفاهی'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Oral Exam Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmOralExam && (
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
                  <h3 className="text-base font-black text-slate-800">تایید حذف نمره امتحان شفاهی</h3>
                  <p className="text-xs text-slate-500 mt-0.5">این عملیات غیرقابل بازگشت است</p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-700 space-y-1">
                <p className="font-bold text-slate-800">عنوان: {deleteConfirmOralExam.title}</p>
                <p className="text-[11px] text-slate-600">نمره: {deleteConfirmOralExam.score} | استاد: {deleteConfirmOralExam.examinerName}</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmOralExam(null)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleDeleteOralExamAction}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-200 flex items-center gap-1.5"
                >
                  <Trash2 size={16} />
                  <span>حذف</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
