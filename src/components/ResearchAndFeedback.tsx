import React, { useState, useEffect } from 'react';
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
  Search
} from 'lucide-react';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Student, ResearchRecord, ConversationArchive } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function ResearchAndFeedback() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [research, setResearch] = useState<ResearchRecord | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamSearchTerm, setTeamSearchTerm] = useState('');
  
  useEffect(() => {
    const fetchStudents = async () => {
      const snapshot = await getDocs(query(collection(db, 'students'), where('isActive', '==', true)));
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    };
    fetchStudents();
  }, []);

  const [archives, setArchives] = useState<ConversationArchive[]>([]);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [newArchive, setNewArchive] = useState('');
  const [newUsage, setNewUsage] = useState('');

  const fetchStudentDetails = async (studentId: string) => {
    setLoading(true);
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
      if (research.id) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...data } = research;
        await updateDoc(doc(db, 'research_records', research.id), {
          ...data,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'research_records'), {
          ...research,
          studentId: selectedStudentId,
          updatedAt: new Date().toISOString()
        });
      }
      alert('اطلاعات پژوهش با موفقیت ذخیره شد');
      fetchStudentDetails(selectedStudentId);
    } catch (error) {
      console.error("Error saving research:", error);
      alert('خطا در ذخیره اطلاعات');
    } finally {
      setLoading(false);
    }
  };

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
        <div className="w-full md:w-72">
          <select 
            className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:ring-1 focus:ring-indigo-500 text-sm shadow-sm"
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

      {selectedStudentId ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Research Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit space-y-8 col-span-2">
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-5 flex items-center gap-2">
                <div className="w-1.5 h-5 bg-emerald-500 rounded-full"></div>
                جزئیات پژوهش و مقاله
              </h3>
              
              <div className="space-y-6">
                {/* Stages */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-3">مرحله پژوهش</label>
                  <div className="flex flex-wrap gap-2">
                    {['تعیین موضوع', 'طرح پژوهش', 'نگارش اولیه', 'ارزیابی', 'تکمیل شده'].map(s => (
                      <button 
                        key={s}
                        onClick={() => updateResearchStage(s)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                          research?.stage === s 
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100" 
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
                        className="w-full px-4 py-2 bg-indigo-50/30 border border-indigo-100 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-indigo-900"
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

                <div className="flex justify-end">
                  <button 
                    onClick={saveResearchData}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    ذخیره تغییرات پژوهش
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
                  <div key={arch.id} className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
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
    </div>
  );
}
