import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Calendar, 
  Clock, 
  User, 
  Trash2, 
  Users,
  Search
} from 'lucide-react';
import { Program, Student, Enrollment } from '../types';
import { localDb } from '../lib/localDb';
import { useMentor, getStudentMentorKey } from '../context/MentorContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function Programs() {
  const { filterStudents, currentMentorId, currentMentor, shahpooriFilter } = useMentor();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [newProgram, setNewProgram] = useState<Partial<Program>>({ 
    title: '', 
    type: 'اصلی', 
    day: '', 
    time: '', 
    teacher: '' 
  });

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedEnrollments, setSelectedEnrollments] = useState<string[]>([]);
  const [enrollSearchTerm, setEnrollSearchTerm] = useState('');

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
          // Legacy check for Shahpoori
          const enrolledIds = rawEnrollments.filter(e => e.programId === p.id).map(e => e.studentId);
          const targetStudents = rawStudents.filter(s => s.isActive && getStudentMentorKey(s.grade) === shahpooriFilter);
          return enrolledIds.some(id => targetStudents.some(ts => ts.id === id));
        }

        if (p.mentorId) {
          return p.mentorId === currentMentorId;
        }

        // Legacy program without mentorId:
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
      await localDb.addDoc('programs', {
        ...newProgram,
        mentorId: currentMentorId
      });
      setShowAddModal(false);
      setNewProgram({ title: '', type: 'اصلی', day: '', time: '', teacher: '' });
      fetchData();
    } catch (error) {
      console.error("Error adding program:", error);
    }
  };

  const deleteProgram = async (id: string) => {
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

  const typesMap: Record<string, string> = {
    'اصلی': 'کلاس‌های اصلی',
    'مشاوره': 'بخش مشاوره',
    'پژوهش': 'واحد پژوهش',
    'دروس 5 شنبه': 'برنامه‌های ۵ شنبه',
    'سایر': 'سایر برنامه‌ها'
  };

  return (
    <div className="space-y-8" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800">برنامه‌های مدرسه</h2>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          <span>افزودن برنامه جدید</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(typesMap).map(([type, label]) => (
          <div key={type} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-[#f8fafc80] px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                {label}
              </h3>
              <span className="text-[10px] font-bold bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
                {programs.filter(p => p.type === type).length} کلاس
              </span>
            </div>
            <div className="divide-y divide-slate-100 flex-1">
              {programs.filter(p => p.type === type).map(program => (
                <div key={program.id} className="p-5 hover:bg-[#f8fafc80] transition-colors border-b last:border-0">
                  <div className="flex items-start justify-between cursor-pointer" onClick={() => setSelectedProgramId(selectedProgramId === program.id ? null : program.id)}>
                    <div className="flex-1">
                      <h4 className="font-bold text-slate-900 text-sm mb-1">{program.title}</h4>
                      <div className="flex flex-wrap gap-4 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1"><Clock size={12} className="text-indigo-400" /> {program.day} - {program.time}</span>
                        <span className="flex items-center gap-1"><User size={12} className="text-indigo-400" /> {program.teacher}</span>
                        <span className="flex items-center gap-1 text-indigo-600 font-bold"><Users size={12} /> {getProgramStudents(program.id).length} نفر</span>
                      </div>
                    </div>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => deleteProgram(program.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-600 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  {selectedProgramId === program.id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="mt-4 pt-4 border-t border-slate-100"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="text-sm font-bold text-slate-700">لیست طلاب این کلاس:</h5>
                        <button 
                          onClick={() => handleEnrollClick(program.id)}
                          className="flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
                        >
                          <Plus size={14} />
                          <span>مدیریت طلاب کلاس</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {getProgramStudents(program.id).map(student => (
                          <div key={student.id} className="bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg text-sm text-slate-700 flex items-center justify-between">
                            <span className="font-medium">{student.name}</span>
                            <span className="text-[10px] text-slate-400">{student.grade}</span>
                          </div>
                        ))}
                        {getProgramStudents(program.id).length === 0 && (
                          <p className="text-xs text-slate-400 col-span-2 py-4 text-center italic">هنوز طلبی برای این کلاس ثبت نشده است.</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              ))}
              {programs.filter(p => p.type === type).length === 0 && (
                <div className="p-12 text-center text-slate-400 text-sm italic">
                  هنوز برنامه‌ای در این بخش ثبت نشده است.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-6 text-right">افزودن برنامه جدید</h3>
              <form onSubmit={handleAddProgram} className="space-y-4 text-right">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">عنوان کلاس</label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newProgram.title}
                    onChange={(e) => setNewProgram({...newProgram, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">نوع برنامه</label>
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    value={newProgram.type}
                    onChange={(e) => setNewProgram({...newProgram, type: e.target.value as any})}
                  >
                    <option value="اصلی">اصلی</option>
                    <option value="مشاوره">مشاوره</option>
                    <option value="پژوهش">پژوهش</option>
                    <option value="دروس 5 شنبه">دروس ۵ شنبه</option>
                    <option value="سایر">سایر</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">روز</label>
                    <input 
                      type="text" 
                      placeholder="مثلا: شنبه"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newProgram.day}
                      onChange={(e) => setNewProgram({...newProgram, day: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">زمان</label>
                    <input 
                      type="text" 
                      placeholder="مثلا: ۰۸:۰۰"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newProgram.time}
                      onChange={(e) => setNewProgram({...newProgram, time: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">نام استاد</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newProgram.teacher}
                    onChange={(e) => setNewProgram({...newProgram, teacher: e.target.value})}
                  />
                </div>
                <div className="flex items-center gap-3 mt-8">
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                  >
                    ثبت برنامه
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showEnrollModal && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">مدیریت طلاب کلاس</h3>
                <div className="relative">
                  <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="جستجوی نام..."
                    className="pr-10 pl-4 py-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 w-64"
                    value={enrollSearchTerm}
                    onChange={(e) => setEnrollSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto mb-6 pr-2">
                <div className="grid grid-cols-2 gap-3">
                  {filterStudents(students, true)
                    .filter(s => s.name.toLowerCase().includes(enrollSearchTerm.toLowerCase()))
                    .map(student => {
                      const isSelected = selectedEnrollments.includes(student.id);
                      return (
                        <label 
                          key={student.id} 
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                            isSelected ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-100 hover:border-slate-200"
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
                            <p className="text-sm font-bold text-slate-800 leading-tight">{student.name}</p>
                            <p className="text-[10px] text-slate-500">پایه {student.grade}</p>
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-6 border-t border-slate-100">
                <button 
                  onClick={handleSaveEnrollments}
                  disabled={loading}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 disabled:opacity-50"
                >
                  {loading ? 'در حال ثبت...' : 'ثبت و بروزرسانی لیست'}
                </button>
                <button 
                  type="button"
                  onClick={() => setShowEnrollModal(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
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
