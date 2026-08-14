import React from 'react';
import { useMentor, MENTORS, MentorId } from '../context/MentorContext';
import { UserCheck, ShieldCheck, Check, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function MentorSelectorModal() {
  const { currentMentorId, setCurrentMentorId, isMentorModalOpen, setIsMentorModalOpen } = useMentor();

  if (!isMentorModalOpen) return null;

  const mentorList = Object.values(MENTORS);

  const handleSelect = (id: MentorId) => {
    setCurrentMentorId(id);
    setIsMentorModalOpen(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-100 text-right space-y-6 relative overflow-hidden"
          dir="rtl"
        >
          {/* Top Decorative Header */}
          <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-emerald-500 via-sky-500 via-purple-500 to-amber-500" />
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-inner">
                <UserCheck size={24} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900">انتخاب استاد / کاربر جاری</h2>
                <p className="text-xs text-slate-500 mt-0.5">لطفاً مشخص فرمایید چه کسی در حال استفاده از سیستم است:</p>
              </div>
            </div>
            {localStorage.getItem('current_mentor_id') && (
              <button
                onClick={() => setIsMentorModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {mentorList.map((m) => {
              const isSelected = currentMentorId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => handleSelect(m.id)}
                  className={cn(
                    "p-4 rounded-2xl border-2 text-right transition-all flex flex-col justify-between space-y-3 relative group hover:shadow-md",
                    isSelected
                      ? `${m.badgeBorder} bg-slate-50 shadow-md ring-2 ring-offset-2 ring-indigo-500/20`
                      : "border-slate-100 bg-white hover:border-slate-300"
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl text-white font-black flex items-center justify-center text-sm shadow-sm", m.avatarBg)}>
                        {m.name.split(' ')[1]?.[0] || 'ا'}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-sm">{m.name}</h3>
                        <span className={cn("inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full border mt-0.5", m.badgeBg, m.badgeText, m.badgeBorder)}>
                          {m.role}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <Check size={14} />
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                    {m.isHeadManager ? (
                      <span className="text-amber-800 font-bold flex items-center gap-1">
                        <ShieldCheck size={13} className="text-amber-600" />
                        مدیریت کل طلاب و دسترسی به فیلتر تمام پایه‌ها
                      </span>
                    ) : (
                      <span>
                        بررسی و مدیریت اختصاصی طلاب <strong className="text-slate-800">{m.gradeLabel}</strong>
                      </span>
                    )}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-xs text-slate-600 flex items-start gap-2.5 leading-relaxed">
            <Sparkles size={18} className="text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800 font-bold block mb-0.5">توجه:</strong>
              بخش «مدیریت کاربران» بین تمامی اساتید مشترک می‌باشد، اما بررسی وضعیت مطالعه، برنامه‌ها، حضور و غیاب و نظرات طلاب، به صورت اختصاصی بر اساس پایه تحصیلی و استاد مربوطه فیلتر می‌گردد.
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
