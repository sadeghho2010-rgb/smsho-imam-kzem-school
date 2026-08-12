import React, { useState, useEffect } from 'react';
import { 
  BrainCircuit, 
  Search, 
  Send, 
  Loader2,
  FileText,
  User,
  Star,
  CheckCircle,
  BarChart,
  MessageSquare,
  AlertTriangle
} from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, Attendance, StudyStat } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function Summary() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [studentDetails, setStudentDetails] = useState<any>(null);
  const [customQuery, setCustomQuery] = useState('');

  useEffect(() => {
    const fetchStudents = async () => {
      const snapshot = await getDocs(query(collection(db, 'students'), where('isActive', '==', true)));
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    };
    fetchStudents();
  }, []);

  const fetchStudentFullData = async (studentId: string) => {
    setLoading(true);
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) return;

      const [attendance, studyStats] = await Promise.all([
        getDocs(query(collection(db, 'attendance'), where('studentId', '==', studentId))),
        getDocs(query(collection(db, 'study_stats'), where('studentId', '==', studentId)))
      ]);

      const details = {
        info: student,
        attendance: attendance.docs.map(d => d.data() as Attendance),
        studyStats: studyStats.docs.map(d => d.data() as StudyStat)
      };

      setStudentDetails(details);
    } catch (error) {
      console.error("Error fetching student details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!studentDetails) return;
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentData: studentDetails,
          query: customQuery || "لطفا یک تحلیل جامع از وضعیت تحصیلی، اخلاقی و انضباطی این طلبه ارائه دهید و نقاط قوت و ضعف وی را مشخص کنید."
        })
      });
      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (error) {
      console.error("Analysis error:", error);
      alert('خطا در ارتباط با هوش مصنوعی');
    } finally {
      setAnalyzing(false);
    }
  };

  const countAbsences = () => {
    return studentDetails?.attendance?.filter((a: any) => a.status === 'absent').length || 0;
  };

  return (
    <div className="space-y-8" dir="rtl">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BrainCircuit className="text-indigo-600" size={24} />
            جمع‌بندی و هوش مصنوعی
          </h2>
          <p className="text-xs text-slate-400">تحلیل داده‌محور و مشاور هوشمند طلاب</p>
        </div>
        <div className="flex items-center gap-3">
          <select 
            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none w-64 shadow-sm"
            value={selectedStudentId}
            onChange={(e) => {
              setSelectedStudentId(e.target.value);
              if (e.target.value) fetchStudentFullData(e.target.value);
            }}
          >
            <option value="">انتخاب طلبه...</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button 
            disabled={!selectedStudentId || loading}
            onClick={() => selectedStudentId && fetchStudentFullData(selectedStudentId)}
            className="p-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
          </button>
        </div>
      </div>

      {studentDetails && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col justify-center items-center shadow-sm">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">غیبت کل</p>
                <p className={cn("text-2xl font-black", countAbsences() > 3 ? "text-rose-600" : "text-emerald-600")}>
                  {countAbsences()}
                </p>
                <p className="text-[9px] text-slate-400 font-bold mt-2">جلسات غیبت غیرموجه</p>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col justify-center items-center shadow-sm">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">ساعات مطالعه</p>
                <p className="text-2xl font-black text-slate-800">
                  {studentDetails.studyStats.reduce((acc: number, s: any) => acc + s.studyHours, 0)}
                </p>
                <p className="text-[9px] text-slate-400 font-bold mt-2">مجموع ساعت مطالعه ثبت شده</p>
              </div>
            </div>

            <div className="bg-white flex-1 rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-[400px] items-center justify-center p-8 text-center">
              <BarChart size={48} className="text-slate-100 mb-4" />
              <p className="text-slate-400 text-sm">بخش تحلیل داده‌های انضباطی و آموزشی</p>
            </div>
          </div>

          <div className="lg:col-span-4 flex flex-col space-y-6">
            <div className="bg-indigo-900 rounded-2xl p-6 flex flex-col h-[500px] shadow-xl shadow-indigo-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl -mr-16 -mt-16 rounded-full" />
              
              <div className="flex items-center justify-between mb-6 relative">
                <span className="text-white text-sm font-bold flex items-center gap-2">
                   <BrainCircuit size={18} className="text-indigo-300" />
                   تحلیل هوشمند Gemini
                </span>
                <div className="p-1.5 bg-white/10 rounded-lg">
                  <Loader2 className={cn("w-4 h-4 text-indigo-200", analyzing && "animate-spin")} />
                </div>
              </div>

              <div className="flex-1 bg-indigo-950/40 rounded-xl p-4 overflow-y-auto mb-4 border border-indigo-700/50 scrollbar-hide">
                {analyzing ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4">
                    <Loader2 className="text-indigo-400 animate-spin" size={32} />
                    <p className="text-indigo-300 text-[10px] font-bold animate-pulse">در حال تحلیل داده‌ها...</p>
                  </div>
                ) : analysis ? (
                  <div className="text-[11px] text-indigo-100 leading-relaxed space-y-3">
                    {analysis.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center text-indigo-400/50 space-y-2">
                    <BrainCircuit size={40} className="opacity-20" />
                    <p className="text-[10px]">برای دریافت مشاوره هوشمند، دکمه ارسال را بزنید</p>
                  </div>
                )}
              </div>

              <div className="relative">
                <input 
                  type="text" 
                  placeholder="سوال از هوش مصنوعی..." 
                  className="w-full bg-white/10 border border-indigo-700 rounded-xl py-3 px-4 text-xs text-white placeholder-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 transition-all"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                />
                <button 
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="absolute left-2 top-1.5 p-1.5 text-indigo-300 hover:text-white transition-colors"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col flex-1 shadow-sm overflow-hidden">
               <h3 className="text-xs font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  امور پیگیری (To-Do)
               </h3>
               <div className="space-y-2 overflow-y-auto flex-1">
                  <div className="flex items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-4 h-4 rounded border border-slate-300 bg-white ml-3"></div>
                    <span className="text-[11px] text-slate-600">بررسی وضعیت پژوهشی پایه دوم</span>
                  </div>
                  <div className="flex items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="w-4 h-4 rounded border border-indigo-500 bg-indigo-50 flex items-center justify-center ml-3">
                       <CheckCircle size={12} className="text-indigo-600" />
                    </div>
                    <span className="text-[11px] text-slate-400 line-through">تایید لیست طلاب فعال</span>
                  </div>
                  <p className="text-[9px] text-center text-slate-400 mt-4 italic">مشاهده همه پیگیری‌ها در بخش مدیریت</p>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
