import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Upload, 
  Search, 
  Trash2, 
  Edit2, 
  CheckCircle, 
  XCircle,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function StudentList({ onlyActive = false }: { onlyActive?: boolean }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [newStudent, setNewStudent] = useState<Partial<Student>>({ 
    name: '', 
    nationalId: '', 
    phoneNumber: '', 
    grade: '',
    fatherOccupation: '',
    birthPlace: '',
    birthDate: '',
    maritalStatus: 'مجرد',
    livingStatus: 'پدری',
    livingStatusOther: '',
    classicEducation: '',
    howzaEntryYear: '',
    levelOneSchool: '',
    tammomStatus: 'غیر معمم'
  });

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const q = onlyActive 
        ? query(collection(db, 'students'), where('isActive', '==', true))
        : collection(db, 'students');
      
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      
      // Sort by grade (numerically if possible)
      const sortedData = data.sort((a, b) => {
        const gradeA = a.grade || '99';
        const gradeB = b.grade || '99';
        return gradeA.localeCompare(gradeB, 'fa', { numeric: true });
      });
      
      setStudents(sortedData);
    } catch (error) {
      console.error("Error fetching students:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [onlyActive]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.name) {
      alert('لطفاً نام را وارد کنید');
      return;
    }
    
    try {
      if (editingStudent) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, createdAt, ...updateData } = newStudent as Student;
        
        // Clean data for Firestore
        const cleanData = Object.fromEntries(
          Object.entries(updateData).filter(([_, v]) => v !== undefined)
        );
        
        await updateDoc(doc(db, 'students', editingStudent.id), cleanData);
        alert('اطلاعات با موفقیت بروزرسانی شد');
      } else {
        await addDoc(collection(db, 'students'), {
          ...newStudent,
          isActive: false,
          createdAt: new Date().toISOString()
        });
        alert('طلبه جدید با موفقیت ثبت شد');
      }
      resetForm();
      setShowAddModal(false);
      fetchStudents();
    } catch (error: any) {
      console.error("Error adding/updating student:", error);
      alert('خطا در ثبت اطلاعات: ' + (error.message || 'خطای نامشخص'));
    }
  };

  const resetForm = () => {
    setNewStudent({ 
      name: '', 
      nationalId: '', 
      phoneNumber: '', 
      grade: '',
      fatherOccupation: '',
      birthPlace: '',
      birthDate: '',
      maritalStatus: 'مجرد',
      livingStatus: 'پدری',
      livingStatusOther: '',
      classicEducation: '',
      howzaEntryYear: '',
      levelOneSchool: '',
      tammomStatus: 'غیر معمم'
    });
    setEditingStudent(null);
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setNewStudent(student);
    setShowAddModal(true);
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'students', id), { isActive: !currentStatus });
      fetchStudents();
    } catch (error) {
      console.error("Error updating student:", error);
    }
  };

  const deleteStudent = async (id: string) => {
    if (!window.confirm("آیا از حذف این مورد اطمینان دارید؟")) return;
    try {
      await deleteDoc(doc(db, 'students', id));
      alert('مورد با موفقیت حذف شد');
      fetchStudents();
    } catch (error: any) {
      console.error("Error deleting student:", error);
      alert('خطا در حذف: ' + (error.message || 'خطای نامشخص'));
    }
  };

  const handleExcelExport = () => {
    if (students.length === 0) {
      alert('لیستی برای خروجی وجود ندارد');
      return;
    }

    const exportData = students.map((s, index) => ({
      'ردیف': index + 1,
      'پایه تحصیلی': s.grade || '',
      'نام و نام خانوادگی': s.name,
      'کد ملی': s.nationalId || '',
      'شماره تماس': s.phoneNumber || '',
      'شغل پدر': s.fatherOccupation || '',
      'اهل کجاست': s.birthPlace || '',
      'تاریخ تولد': s.birthDate || '',
      'وضعیت تاهل': s.maritalStatus || '',
      'سکونت': s.livingStatus || '',
      'تحصیلات کلاسیک': s.classicEducation || '',
      'سال ورود به حوزه': s.howzaEntryYear || '',
      'مدرسه سطح یک': s.levelOneSchool || '',
      'وضعیت تعمم': s.tammomStatus || '',
      'وضعیت': s.isActive ? 'فعال' : 'غیرفعال'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "طلاب");
    XLSX.writeFile(wb, `لیست_طلاب_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.xlsx`);
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      try {
        for (const row of data) {
          await addDoc(collection(db, 'students'), {
            name: row.Name || row['نام'] || row.name || 'نامشخص',
            nationalId: row.NationalId || row['کد ملی'] || row.nationalId || '',
            phoneNumber: row.Phone || row['تلفن'] || row.phone || '',
            grade: row.Grade || row['پایه'] || row.grade || '',
            fatherOccupation: row.FatherOccupation || row['شغل پدر'] || '',
            birthPlace: row.BirthPlace || row['اهل کجاست'] || row['محل تولد'] || '',
            birthDate: row.BirthDate || row['تاریخ تولد'] || '',
            maritalStatus: (row.MaritalStatus || row['وضعیت تاهل'] || 'مجرد') as any,
            livingStatus: (row.LivingStatus || row['سکونت'] || 'پدری') as any,
            classicEducation: row.ClassicEducation || row['تحصیلات کلاسیک'] || '',
            howzaEntryYear: row.HowzaEntryYear || row['سال ورود به حوزه'] || '',
            levelOneSchool: row.LevelOneSchool || row['مدرسه سطح یک'] || '',
            tammomStatus: (row.TammomStatus || row['وضعیت تعمم'] || 'غیر معمم') as any,
            isActive: false,
            createdAt: new Date().toISOString()
          });
        }
        fetchStudents();
        alert('اطلاعات با موفقیت وارد شد');
      } catch (error) {
        console.error("Error importing excel:", error);
        alert('خطا در وارد کردن اطلاعات');
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.nationalId?.includes(searchTerm)
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-800">
            {onlyActive ? 'کاربران فعال' : 'مدیریت کاربران'}
          </h2>
          <p className="text-xs text-slate-400">فهرست طلاب پایه به همراه وضعیت تحصیلی</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="جستجوی نام یا کد ملی..." 
              className="pr-9 pl-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none w-64 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {!onlyActive && (
            <>
              <button 
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus size={16} />
                <span>افزودن دستی</span>
              </button>
              
              <button 
                onClick={handleExcelExport}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
              >
                <FileSpreadsheet size={16} />
                <span>خروجی اکسل</span>
              </button>
              
              <label className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-colors cursor-pointer shadow-sm">
                <FileSpreadsheet size={16} />
                <span>وارد کردن اکسل</span>
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
              </label>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
              <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider">#</th>
              <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider">پایه تحصیلی</th>
              <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider">نام و نام خانوادگی</th>
              <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider">کد ملی</th>
              <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider">وضعیت</th>
              <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-left">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs">در حال بارگذاری...</td>
              </tr>
            ) : filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-xs italic">هیچ طلبی یافت نشد</td>
              </tr>
            ) : (
              filteredStudents.map((student, index) => (
                <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-xs font-bold text-slate-400">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-full border border-slate-200">
                      {student.grade || 'نامشخص'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800 text-sm">{student.name}</span>
                      <span className="text-[10px] text-slate-400">{student.phoneNumber || 'بدون شماره'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600">{student.nationalId || '---'}</td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => toggleActive(student.id, student.isActive)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all",
                        student.isActive 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                          : "bg-slate-50 text-slate-400 border border-slate-100"
                      )}
                    >
                      <div className={cn("w-1.5 h-1.5 rounded-full", student.isActive ? "bg-emerald-500" : "bg-slate-300")}></div>
                      {student.isActive ? 'فعال' : 'غیرفعال'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-left">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => handleEdit(student)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => deleteStudent(student.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-8 max-w-4xl w-full shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">
                  {editingStudent ? 'ویرایش اطلاعات طلبه' : 'افزودن طلبه جدید'}
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleAddStudent} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Basic Info */}
                  <div className="space-y-4 col-span-full">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b border-indigo-50 pb-1">اطلاعات پایه</h4>
                  </div>
                  
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">نام و نام خانوادگی</label>
                    <input 
                      type="text" 
                      required
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.name}
                      onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">کد ملی</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.nationalId}
                      onChange={(e) => setNewStudent({...newStudent, nationalId: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">شماره تماس</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.phoneNumber}
                      onChange={(e) => setNewStudent({...newStudent, phoneNumber: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">پایه تحصیلی</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.grade}
                      onChange={(e) => setNewStudent({...newStudent, grade: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">تاریخ تولد</label>
                    <input 
                      type="text" 
                      placeholder="۱۴۰۵/۰۱/۰۱"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.birthDate}
                      onChange={(e) => setNewStudent({...newStudent, birthDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">اهل کجاست</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.birthPlace}
                      onChange={(e) => setNewStudent({...newStudent, birthPlace: e.target.value})}
                    />
                  </div>

                  {/* Family & Status */}
                  <div className="space-y-4 col-span-full mt-4">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b border-indigo-50 pb-1">وضعیت خانوادگی و سکونت</h4>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">شغل پدر</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.fatherOccupation}
                      onChange={(e) => setNewStudent({...newStudent, fatherOccupation: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">وضعیت تاهل</label>
                    <select 
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.maritalStatus}
                      onChange={(e) => setNewStudent({...newStudent, maritalStatus: e.target.value as any})}
                    >
                      <option value="مجرد">مجرد</option>
                      <option value="متاهل">متاهل</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">سکونت</label>
                    <select 
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.livingStatus}
                      onChange={(e) => setNewStudent({...newStudent, livingStatus: e.target.value as any})}
                    >
                      <option value="پدری">پدری</option>
                      <option value="خوابگاه">خوابگاه</option>
                      <option value="اجاره ای">اجاره ای</option>
                      <option value="شخصی">شخصی</option>
                      <option value="سایر">سایر</option>
                    </select>
                  </div>
                  {newStudent.livingStatus === 'سایر' && (
                    <div className="col-span-full">
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">توضیحات سکونت</label>
                      <input 
                        type="text" 
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                        value={newStudent.livingStatusOther}
                        onChange={(e) => setNewStudent({...newStudent, livingStatusOther: e.target.value})}
                      />
                    </div>
                  )}

                  {/* Educational History */}
                  <div className="space-y-4 col-span-full mt-4">
                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider border-b border-indigo-50 pb-1">سوابق تحصیلی و حوزوی</h4>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">تحصیلات کلاسیک</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.classicEducation}
                      onChange={(e) => setNewStudent({...newStudent, classicEducation: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">سال ورود به حوزه</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.howzaEntryYear}
                      onChange={(e) => setNewStudent({...newStudent, howzaEntryYear: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">مدرسه سطح یک</label>
                    <input 
                      type="text" 
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.levelOneSchool}
                      onChange={(e) => setNewStudent({...newStudent, levelOneSchool: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">وضعیت تعمم</label>
                    <select 
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                      value={newStudent.tammomStatus}
                      onChange={(e) => setNewStudent({...newStudent, tammomStatus: e.target.value as any})}
                    >
                      <option value="معمم">معمم</option>
                      <option value="غیر معمم">غیر معمم</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-8 pt-4 border-t border-slate-100">
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                  >
                    {editingStudent ? 'بروزرسانی اطلاعات' : 'تایید و ثبت نهایی'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setShowAddModal(false); resetForm(); }}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
