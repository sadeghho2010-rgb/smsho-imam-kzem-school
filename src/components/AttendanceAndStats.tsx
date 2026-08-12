import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, 
  BarChart2, 
  Plus, 
  Calendar, 
  Clock, 
  Trash2,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, Attendance, StudyStat } from '../types';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';

export default function AttendanceAndStats() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [stats, setStats] = useState<StudyStat[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      const snapshot = await getDocs(query(collection(db, 'students'), where('isActive', '==', true)));
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    };
    fetchStudents();
  }, []);

  const fetchDetails = async (studentId: string) => {
    setLoading(true);
    try {
      const [aSnap, sSnap] = await Promise.all([
        getDocs(query(collection(db, 'attendance'), where('studentId', '==', studentId))),
        getDocs(query(collection(db, 'study_stats'), where('studentId', '==', studentId)))
      ]);
      setAttendances(aSnap.docs.map(d => ({ id: d.id, ...d.data() } as Attendance)));
      setStats(sSnap.docs.map(d => ({ id: d.id, ...d.data() } as StudyStat)));
    } catch (error) {
      console.error("Error fetching attendance/stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAttendance = async (status: string) => {
    if (!selectedStudentId) return;
    try {
      const reason = status === 'absent' ? window.prompt("علت غیبت:") || "" : "";
      await addDoc(collection(db, 'attendance'), {
        studentId: selectedStudentId,
        date: new Date().toISOString().split('T')[0],
        status,
        reason
      });
      fetchDetails(selectedStudentId);
    } catch (error) {
      console.error("Error adding attendance:", error);
    }
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedStudentId) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      try {
        for (const row of data) {
          await addDoc(collection(db, 'study_stats'), {
            studentId: selectedStudentId,
            date: row.Date || row['تاریخ'] || new Date().toISOString().split('T')[0],
            studyHours: parseFloat(row.StudyHours || row['ساعت مطالعه'] || 0),
            discussionHours: parseFloat(row.DiscussionHours || row['ساعت مباحثه'] || 0)
          });
        }
        fetchDetails(selectedStudentId);
        alert('آمار با موفقیت وارد شد');
      } catch (error) {
        console.error("Error importing stats:", error);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-8" dir="rtl">
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CheckSquare className="text-indigo-600" size={24} />
            حضور و غیاب و آمار مطالعه
          </h2>
          <p className="text-[10px] text-slate-400">ثبت انضباطی و ساعات مطالعه روزانه طلاب</p>
        </div>
        <div className="w-full md:w-64">
          <select 
            className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:ring-1 focus:ring-indigo-500 text-sm shadow-sm"
            value={selectedStudentId}
            onChange={(e) => {
              setSelectedStudentId(e.target.value);
              if (e.target.value) fetchDetails(e.target.value);
            }}
          >
            <option value="">انتخاب طلبه...</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {selectedStudentId ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
               <div className="w-1.5 h-5 bg-indigo-500 rounded-full"></div>
               ثبت وضعیت انضباطی امروز
            </h3>
            <div className="grid grid-cols-3 gap-3 mb-8">
              <button onClick={() => handleAddAttendance('present')} className="py-3 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all border border-indigo-100">حاضر</button>
              <button onClick={() => handleAddAttendance('absent')} className="py-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all border border-rose-100">غایب</button>
              <button onClick={() => handleAddAttendance('late')} className="py-3 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 transition-all border border-amber-100">تأخیر</button>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              <h4 className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-wider">سوابق انضباطی اخیر</h4>
              {attendances.map(a => (
                <div key={a.id} className="p-3 bg-[#f8fafc80] rounded-xl flex items-center justify-between border border-slate-100">
                  <div className="flex items-center gap-4">
                    <span className="text-[11px] text-slate-500 font-bold">{new Date(a.date).toLocaleDateString('fa-IR')}</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[9px] font-bold",
                      a.status === 'present' ? "bg-emerald-50 text-emerald-600" : a.status === 'absent' ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {a.status === 'present' ? 'حاضر' : a.status === 'absent' ? 'غایب' : 'تأخیر'}
                    </span>
                  </div>
                  {a.reason && <span className="text-[9px] text-slate-400 truncate max-w-[150px]">{a.reason}</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                 <div className="w-1.5 h-5 bg-indigo-500 rounded-full"></div>
                 آمار مطالعه و مباحثه
              </h3>
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors text-[10px] font-bold">
                <FileSpreadsheet size={14} />
                وارد کردن داده
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 bg-[#eef2ff80] rounded-xl border border-indigo-100 text-center">
                <p className="text-[9px] text-indigo-500 font-bold mb-1 uppercase tracking-wider">مطالعه کل</p>
                <h4 className="text-xl font-black text-indigo-800">{stats.reduce((acc, s) => acc + s.studyHours, 0)} <span className="text-[10px] font-normal">ساعت</span></h4>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <p className="text-[9px] text-slate-400 font-bold mb-1 uppercase tracking-wider">مباحثه کل</p>
                <h4 className="text-xl font-black text-slate-800">{stats.reduce((acc, s) => acc + s.discussionHours, 0)} <span className="text-[10px] font-normal">ساعت</span></h4>
              </div>
            </div>

            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
              {stats.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10).map(s => (
                <div key={s.id} className="p-3 bg-[#f8fafc80] rounded-xl flex items-center justify-between border border-slate-100">
                  <span className="text-[11px] font-bold text-slate-500">{new Date(s.date).toLocaleDateString('fa-IR')}</span>
                  <div className="flex gap-4 text-[10px] font-bold">
                    <span className="text-indigo-600">مطالعه: {s.studyHours}h</span>
                    <span className="text-slate-400">مباحثه: {s.discussionHours}h</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-24 text-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
          لطفا ابتدا یک طلبه را انتخاب کنید
        </div>
      )}
    </div>
  );
}
