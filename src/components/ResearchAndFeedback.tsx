import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  MessageSquare, 
  Plus, 
  Star, 
  Trash2, 
  CheckCircle,
  GraduationCap,
  History,
  AlertCircle,
  Search,
  Download,
  FileJson,
  Printer,
  FileText,
  Bookmark
} from 'lucide-react';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, ResearchRecord, ConversationArchive } from '../types';
import { useMentor } from '../context/MentorContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// @ts-ignore
import html2pdf from 'html2pdf.js';

interface ResearchAndFeedbackProps {
  initialStudentId?: string;
}

export default function ResearchAndFeedback({ initialStudentId }: ResearchAndFeedbackProps = {}) {
  const { filterStudents, currentMentorId, shahpooriFilter } = useMentor();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
      fetchStudentDetails(initialStudentId);
    }
  }, [initialStudentId]);
  const [research, setResearch] = useState<ResearchRecord | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamSearchTerm, setTeamSearchTerm] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [allResearchRecords, setAllResearchRecords] = useState<(ResearchRecord & { studentName?: string, studentGrade?: string })[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const fetchStudents = async () => {
      const snapshot = await getDocs(query(collection(db, 'students'), where('isActive', '==', true)));
      const raw = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student));
      setStudents(filterStudents(raw, true));
    };
    fetchStudents();
  }, [currentMentorId, shahpooriFilter]);

  const [archives, setArchives] = useState<ConversationArchive[]>([]);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [newArchive, setNewArchive] = useState('');
  const [newUsage, setNewUsage] = useState('');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const isFirstLoad = useRef(true);

  const fetchStudentDetails = async (studentId: string) => {
    setLoading(true);
    isFirstLoad.current = true;
    try {
      const [rSnap, aSnap] = await Promise.all([
        getDocs(query(collection(db, 'research_records'), where('studentId', '==', studentId))),
        getDocs(query(collection(db, 'conversation_archives'), where('studentId', '==', studentId)))
      ]);

      setArchives(aSnap.docs.map(d => ({ id: d.id, ...d.data() } as ConversationArchive)));
      
      const resData = rSnap.docs[0];
      setResearch(resData ? ({ id: resData.id, ...resData.data() } as ResearchRecord) : null);
    } catch (error) {
      console.error("Error fetching details:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllResearchData = async () => {
    setIsExporting(true);
    try {
      const snapshot = await getDocs(collection(db, 'research_records'));
      const records = snapshot.docs.map(doc => {
        const data = doc.data() as ResearchRecord;
        const student = students.find(s => s.id === data.studentId);
        return {
          id: doc.id,
          ...data,
          studentName: student?.name || 'نامشخص',
          studentGrade: student?.grade || '---'
        };
      });
      setAllResearchRecords(records);
      return records;
    } catch (error) {
      console.error("Error fetching all research:", error);
      return [];
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkExportJSON = async () => {
    const data = await fetchAllResearchData();
    if (data.length === 0) return;
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_research_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenManagerReport = async () => {
    await fetchAllResearchData();
    setShowReportModal(true);
  };

  const handleDownloadPDF = () => {
    const element = reportRef.current;
    if (!element) return;
    
    setIsExporting(true);
    const opt: any = {
      margin: 10,
      filename: `گزارش_پژوهش_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
      setIsExporting(false);
    });
  };

  const handleAddArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !newArchive.trim()) return;
    try {
      await addDoc(collection(db, 'conversation_archives'), {
        studentId: selectedStudentId,
        summary: newArchive,
        createdAt: new Date().toISOString()
      });
      setShowArchiveModal(false);
      setNewArchive('');
      fetchStudentDetails(selectedStudentId);
    } catch (error) {
      console.error("Error adding archive:", error);
    }
  };

  const handleResearchUpdate = (field: keyof ResearchRecord, value: any) => {
    if (!selectedStudentId) return;
    if (research) {
      setResearch({ ...research, [field]: value });
    } else {
      setResearch({ 
        studentId: selectedStudentId, 
        stage: 'تعیین موضوع', 
        [field]: value 
      } as ResearchRecord);
    }
  };

  const updateResearchStage = (stage: string) => {
    handleResearchUpdate('stage', stage);
  };

  const saveResearchData = async () => {
    if (!selectedStudentId || !research) return;
    setLoading(true);
    try {
      let followUpId = research.followUpTodoId;
      const currentStudent = students.find(s => s.id === selectedStudentId);
      const studentName = currentStudent?.name || '';
      const topicTitle = research.topic ? `«${research.topic}»` : 'بدون عنوان';
      const todoTitle = `پیگیری پژوهش: ${studentName} - ${topicTitle} (${research.stage || 'تعیین موضوع'})`;

      if (research.needsFollowUp) {
        if (followUpId) {
          try {
            await updateDoc(doc(db, 'todos', followUpId), {
              title: todoTitle,
              isResearchFollowUp: true,
              studentId: selectedStudentId,
              researchRecordId: research.id || ''
            });
          } catch (e) {
            const newTodo = await addDoc(collection(db, 'todos'), {
              title: todoTitle,
              completed: false,
              isResearchFollowUp: true,
              studentId: selectedStudentId,
              researchRecordId: research.id || '',
              createdAt: new Date().toISOString()
            });
            followUpId = newTodo.id;
          }
        } else {
          const newTodo = await addDoc(collection(db, 'todos'), {
            title: todoTitle,
            completed: false,
            isResearchFollowUp: true,
            studentId: selectedStudentId,
            researchRecordId: research.id || '',
            createdAt: new Date().toISOString()
          });
          followUpId = newTodo.id;
        }
      } else {
        if (followUpId) {
          try {
            await deleteDoc(doc(db, 'todos', followUpId));
          } catch (e) {
            console.error("Error removing todo:", e);
          }
          followUpId = undefined;
        }
      }

      const updatedData = {
        ...research,
        studentId: selectedStudentId,
        needsFollowUp: !!research.needsFollowUp,
        followUpTodoId: followUpId || null,
        updatedAt: new Date().toISOString()
      };

      if (research.id) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...data } = updatedData;
        await updateDoc(doc(db, 'research_records', research.id), data);
      } else {
        const docRef = await addDoc(collection(db, 'research_records'), updatedData);
        setResearch(prev => prev ? { ...prev, id: docRef.id } : null);
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (error) {
      console.error("Error saving research:", error);
      setSaveStatus('idle');
    } finally {
      setLoading(false);
    }
  };

  // Auto-save effect for research
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    if (!research || !selectedStudentId) return;

    setSaveStatus('saving');
    const timer = setTimeout(() => {
      saveResearchData();
    }, 800);

    return () => clearTimeout(timer);
  }, [research]);

  const deleteItem = async (col: string, id: string) => {
    if (!window.confirm("حذف شود؟")) return;
    await deleteDoc(doc(db, col, id));
    fetchStudentDetails(selectedStudentId);
  };

  return (
    <div className="space-y-8" dir="rtl">
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="text-indigo-600" size={24} />
            وضعیت پژوهشی و آموزشی
          </h2>
          <p className="text-[10px] text-slate-400">ثبت ارزیابی‌های کیفی و پیگیری روند مقالات</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button 
            onClick={handleBulkExportJSON}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <FileJson size={16} />
            <span>خروجی سیستمی (JSON)</span>
          </button>
          
          <button 
            onClick={handleOpenManagerReport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 text-[11px] font-bold rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            <Printer size={16} />
            <span>گزارش جامع مدیریتی</span>
          </button>

          <div className="h-8 w-px bg-slate-100 mx-1 hidden md:block"></div>

          <div className="w-full md:w-64">
            <select 
              className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:ring-1 focus:ring-indigo-500 text-sm shadow-sm font-bold text-slate-700"
              value={selectedStudentId}
              onChange={(e) => {
                setSelectedStudentId(e.target.value);
                if (e.target.value) fetchStudentDetails(e.target.value);
              }}
            >
              <option value="">انتخاب طلبه فعال...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {selectedStudentId ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Research Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit space-y-8 col-span-2">
            <div>
              {/* Selected Student Banner */}
              {(() => {
                const selStudent = students.find(s => s.id === selectedStudentId);
                if (!selStudent) return null;
                return (
                  <div className="flex items-center gap-3 mb-6 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 overflow-hidden shrink-0 border border-indigo-200 flex items-center justify-center font-black text-indigo-700">
                      {selStudent.photoUrl ? (
                        <img src={selStudent.photoUrl} alt={selStudent.name} className="w-full h-full object-cover" />
                      ) : (
                        selStudent.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-800">{selStudent.name}</h3>
                      <p className="text-[11px] text-slate-500 font-medium">پایه تحصیلی: {selStudent.grade || 'نامشخص'}</p>
                    </div>
                  </div>
                );
              })()}

              <h3 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2">
                <div className="w-1.5 h-5 bg-emerald-500 rounded-full"></div>
                جزئیات پژوهش و مقاله
              </h3>
              
              <div className="space-y-6">
                {/* Needs Follow Up Toggle */}
                <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <input 
                      type="checkbox"
                      id="needsFollowUpToggle"
                      checked={!!research?.needsFollowUp}
                      onChange={(e) => handleResearchUpdate('needsFollowUp', e.target.checked)}
                      className="w-5 h-5 mt-0.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer shrink-0"
                    />
                    <label htmlFor="needsFollowUpToggle" className="cursor-pointer">
                      <span className="text-xs font-black text-purple-950 block">نیازمند پیگیری در بخش «امور پیگیری»</span>
                      <span className="text-[10px] font-medium text-purple-700/80 block mt-0.5">با فعال‌سازی این گزینه، یک پیگیری مرتبط با این پژوهش به بخش امور پیگیری اضافه شده و متمایز نمایش داده می‌شود.</span>
                    </label>
                  </div>
                  {research?.needsFollowUp && (
                    <span className="shrink-0 px-3 py-1.5 bg-purple-600 text-white text-[10px] font-black rounded-xl flex items-center gap-1.5 shadow-md shadow-purple-200">
                      <Bookmark size={13} />
                      <span>در لیست امور پیگیری</span>
                    </span>
                  )}
                </div>

                {/* Stages */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-3">مرحله پژوهش</label>
                  <div className="flex flex-wrap gap-2">
                    {['تعیین موضوع', 'طرح پژوهش', 'نگارش اولیه', 'ارزیابی', 'تاخیر دارد', 'تکمیل شده'].map(s => (
                      <button 
                        key={s}
                        onClick={() => updateResearchStage(s)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                          research?.stage === s 
                            ? (s === 'تاخیر دارد' ? "bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-100" : "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100")
                            : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Topic */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-2">موضوع پژوهش</label>
                  <input 
                    type="text"
                    placeholder="عنوان مقاله یا پژوهش..."
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={research?.topic || ''}
                    onChange={(e) => handleResearchUpdate('topic', e.target.value)}
                  />
                </div>

                {/* Type & Team */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-2">نوع پژوهش</label>
                    <select 
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                      value={research?.type || 'individual'}
                      onChange={(e) => handleResearchUpdate('type', e.target.value)}
                    >
                      <option value="individual">فردی</option>
                      <option value="group">گروهی</option>
                    </select>
                  </div>
                  
                  {research?.type === 'group' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-2">هم‌گروهی‌ها</label>
                      <button 
                        onClick={() => setShowTeamModal(true)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-between"
                      >
                        <span>{research?.teamMemberIds?.length || 0} نفر انتخاب شده</span>
                        <Plus size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-2">توضیحات و یادداشت‌ها</label>
                  <textarea 
                    rows={3}
                    placeholder="توضیحات لازم درباره روند پژوهش..."
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={research?.description || ''}
                    onChange={(e) => handleResearchUpdate('description', e.target.value)}
                  />
                </div>

                {/* Expert Opinions */}
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-2">امتیاز پژوهش</label>
                      <input 
                        type="text"
                        placeholder="مثلا: ۹۵/۱۰۰ یا خوب"
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        value={research?.score || ''}
                        onChange={(e) => handleResearchUpdate('score', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-2">نظر استاد پژوهش</label>
                      <textarea 
                        rows={2}
                        placeholder="نکات استاد پژوهش..."
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800"
                        value={research?.professorNotes || ''}
                        onChange={(e) => handleResearchUpdate('professorNotes', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-2">نظر استاد راهنما</label>
                      <textarea 
                        rows={2}
                        placeholder="نکات استاد راهنما..."
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800"
                        value={research?.supervisorNotes || ''}
                        onChange={(e) => handleResearchUpdate('supervisorNotes', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-600 mb-2">نظر استاد ناقد</label>
                      <textarea 
                        rows={2}
                        placeholder="نکات استاد ناقد..."
                        className="w-full px-4 py-2 bg-[#eef2ff4d] border border-indigo-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-indigo-900"
                        value={research?.criticNotes || ''}
                        onChange={(e) => handleResearchUpdate('criticNotes', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Usages List */}
                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-400 mb-2">از این مقاله در موارد زیر استفاده شده است:</label>
                  <div className="flex gap-2 mb-3">
                    <input 
                      type="text"
                      placeholder="مثلا: جشنواره علامه حلی..."
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      value={newUsage}
                      onChange={(e) => setNewUsage(e.target.value)}
                    />
                    <button 
                      onClick={() => {
                        if (newUsage.trim()) {
                          const current = research?.usages || [];
                          handleResearchUpdate('usages', [...current, newUsage.trim()]);
                          setNewUsage('');
                        }
                      }}
                      className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {research?.usages?.map((usage, idx) => (
                      <div key={idx} className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md text-[10px] text-slate-600 border border-slate-200">
                        <span>{usage}</span>
                        <button 
                          onClick={() => {
                            const current = research?.usages || [];
                            handleResearchUpdate('usages', current.filter((_, i) => i !== idx));
                          }}
                          className="text-slate-400 hover:text-rose-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    {(!research?.usages || research.usages.length === 0) && (
                      <span className="text-[10px] text-slate-400 italic">موردی ثبت نشده است.</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {saveStatus === 'saving' && (
                      <span className="text-xs text-amber-600 font-bold flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        در حال ذخیره‌سازی خودکار...
                      </span>
                    )}
                    {saveStatus === 'saved' && (
                      <span className="text-xs text-emerald-600 font-bold flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                        <CheckCircle size={14} />
                        تغییرات به‌صورت خودکار ذخیره شد
                      </span>
                    )}
                    {saveStatus === 'idle' && (
                      <span className="text-[11px] text-slate-400 font-medium">
                        ✓ کلیه تغییرات به‌صورت خودکار ذخیره می‌شوند.
                      </span>
                    )}
                  </div>

                  <button 
                    type="button"
                    onClick={saveResearchData}
                    className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                  >
                    ذخیره فوری
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-100">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <div className="w-1.5 h-5 bg-purple-500 rounded-full"></div>
                  آرشیو جلسات حضوری
                </h3>
                <button 
                  onClick={() => setShowArchiveModal(true)}
                  className="p-1.5 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors border border-purple-100"
                >
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-3">
                {archives.map(arch => (
                  <div key={arch.id} className="p-4 bg-[#f8fafc80] rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[9px] text-slate-400 font-bold">{new Date(arch.createdAt).toLocaleDateString('fa-IR')}</span>
                      <button onClick={() => deleteItem('conversation_archives', arch.id)} className="text-slate-300 hover:text-rose-600 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{arch.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-24 text-center bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 text-sm">
          برای مشاهده وضعیت، لطفا ابتدا یک طلبه را انتخاب کنید
        </div>
      )}

      {/* Archive Modal */}
      <AnimatePresence>
        {showArchiveModal && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-slate-900 mb-6 text-right">ثبت آرشیو صحبت</h3>
              <form onSubmit={handleAddArchive} className="space-y-4 text-right">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">خلاصه صحبت</label>
                  <textarea rows={5} required className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={newArchive} onChange={(e) => setNewArchive(e.target.value)} />
                </div>
                <div className="flex items-center gap-3 mt-8">
                  <button type="submit" className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700">ثبت در آرشیو</button>
                  <button type="button" onClick={() => setShowArchiveModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">انصراف</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Team Selection Modal */}
      <AnimatePresence>
        {showTeamModal && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="bg-white rounded-2xl p-8 max-w-lg w-full shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-900">انتخاب هم‌گروهی‌ها</h3>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="جستجو..."
                    className="pr-8 pl-4 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 w-40"
                    value={teamSearchTerm}
                    onChange={(e) => setTeamSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                {students
                  .filter(s => s.id !== selectedStudentId)
                  .filter(s => s.name.toLowerCase().includes(teamSearchTerm.toLowerCase()))
                  .map(student => {
                    const isSelected = research?.teamMemberIds?.includes(student.id);
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
                          checked={isSelected || false}
                          onChange={(e) => {
                            const current = research?.teamMemberIds || [];
                            if (e.target.checked) {
                              handleResearchUpdate('teamMemberIds', [...current, student.id]);
                            } else {
                              handleResearchUpdate('teamMemberIds', current.filter(id => id !== student.id));
                            }
                          }}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800">{student.name}</p>
                          <p className="text-[10px] text-slate-400">پایه {student.grade}</p>
                        </div>
                      </label>
                    );
                  })}
              </div>

              <div className="mt-8 pt-4 border-t border-slate-100">
                <button 
                  onClick={() => setShowTeamModal(false)}
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                >
                  تایید و بازگشت
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Manager Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 bg-white z-[100] overflow-y-auto print:p-0" dir="rtl">
            <div className="max-w-5xl mx-auto p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12 print:hidden">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-600 p-3 rounded-2xl text-white">
                    <Printer size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-800">گزارش جامع مدیریتی پژوهش</h2>
                    <p className="text-sm text-slate-400">لیست تمامی مقالات و فعالیت‌های پژوهشی طلاب</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleDownloadPDF}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                  >
                    <Download size={18} />
                    <span>{isExporting ? 'در حال آماده‌سازی...' : 'دانلود گزارش (PDF)'}</span>
                  </button>
                  <button 
                    onClick={() => setShowReportModal(false)}
                    className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    بستن
                  </button>
                </div>
              </div>

              <div ref={reportRef} className="space-y-12 pb-20 p-4">
                {/* Print Header */}
                <div className="text-center mb-16">
                  <h1 className="text-3xl font-black text-slate-900 mb-2">گزارش وضعیت پژوهشی طلاب</h1>
                  <p className="text-slate-500">تاریخ تهیه گزارش: {new Date().toLocaleDateString('fa-IR')}</p>
                  <div className="mt-4 border-b-2 border-slate-900 w-32 mx-auto"></div>
                </div>

                {allResearchRecords.length === 0 ? (
                  <div className="text-center py-24 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-slate-400">
                    <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
                    <p>هیچ دیتایی برای نمایش وجود ندارد.</p>
                  </div>
                ) : (
                  allResearchRecords.map((rec, idx) => (
                    <div key={rec.id} className="border border-slate-200 rounded-3xl p-8 bg-white break-inside-avoid shadow-sm hover:shadow-md transition-all">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-slate-100 pb-6">
                        <div className="flex items-center gap-4">
                          <span className="w-10 h-10 flex items-center justify-center bg-slate-900 text-white rounded-2xl text-sm font-bold rotate-3">{idx + 1}</span>
                          <div>
                            <h3 className="text-xl font-black text-slate-800">{rec.studentName}</h3>
                            <p className="text-xs text-slate-400 font-bold">پایه تحصیلی: {rec.studentGrade}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-bold border border-emerald-100 uppercase tracking-tighter">
                            {rec.stage}
                          </span>
                          {rec.score && (
                            <span className="px-4 py-1.5 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-bold border border-amber-100 uppercase tracking-tighter">
                              امتیاز: {rec.score}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-8">
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold mb-2 flex items-center gap-2 uppercase">
                              <BookOpen size={12} className="text-emerald-500" />
                              موضوع پژوهش
                            </p>
                            <p className="text-base font-black text-slate-800">{rec.topic || 'ثبت نشده'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold mb-2 flex items-center gap-2 uppercase">
                              <Search size={12} className="text-blue-500" />
                              خلاصه و توضیحات
                            </p>
                            <p className="text-xs text-slate-600 leading-relaxed text-justify">{rec.description || 'توضیحاتی برای این پژوهش ثبت نشده است.'}</p>
                          </div>
                          {rec.usages && rec.usages.length > 0 && (
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold mb-3 flex items-center gap-2 uppercase">
                                <Star size={12} className="text-amber-500" />
                                موارد استفاده
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {rec.usages.map(u => (
                                  <span key={u} className="px-3 py-1 bg-slate-50 text-slate-500 rounded-lg border border-slate-100 text-[9px] font-bold">{u}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="bg-[#f8fafc80] p-8 rounded-3xl space-y-8 border border-slate-100">
                          <div>
                            <p className="text-[10px] text-indigo-600 font-black mb-3 flex items-center gap-2 uppercase">
                              <AlertCircle size={12} />
                              ارزیابی نهایی استاد ناقد
                            </p>
                            <p className="text-xs text-slate-600 italic leading-relaxed bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                              {rec.criticNotes || 'هنوز ارزیابی توسط استاد ناقد انجام نشده است.'}
                            </p>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold mb-1">نظر استاد پژوهش:</p>
                              <p className="text-[10px] text-slate-600 font-medium leading-relaxed">{rec.professorNotes || '---'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold mb-1">نظر استاد راهنما:</p>
                              <p className="text-[10px] text-slate-600 font-medium leading-relaxed">{rec.supervisorNotes || '---'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
