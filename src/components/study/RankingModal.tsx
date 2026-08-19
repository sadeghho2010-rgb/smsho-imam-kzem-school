import React from 'react';
import { ListOrdered, X, Trophy, BookOpen, MessageSquare, Calculator, Sparkles, CheckCircle2, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export interface RankingItem {
  rank: number;
  studentId: string;
  name: string;
  grade: string;
  displayValue: string;
  studyValue?: string;
  discussionValue?: string;
}

export interface RankingModalData {
  title: string;
  metricLabel: string;
  items: RankingItem[];
}

interface RankingModalProps {
  data: RankingModalData | null;
  onClose: () => void;
}

export default function RankingModal({ data, onClose }: RankingModalProps) {
  if (!data) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 lg:p-10" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-200">
                <ListOrdered size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">{data.title}</h3>
                <p className="text-[10px] text-slate-400 font-bold">شاخص ارزیابی: {data.metricLabel}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:bg-slate-200/50 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-2">
            {data.items.map((item) => (
              <div 
                key={item.studentId}
                className={cn(
                  "p-4 rounded-2xl flex items-center justify-between transition-all border",
                  item.rank === 1 ? "bg-amber-50/70 border-amber-200 shadow-xs" :
                  item.rank === 2 ? "bg-slate-100/80 border-slate-200" :
                  item.rank === 3 ? "bg-orange-50/60 border-orange-200" :
                  "bg-white border-slate-100 hover:bg-slate-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0",
                    item.rank === 1 ? "bg-amber-500 text-white shadow-xs" :
                    item.rank === 2 ? "bg-slate-600 text-white" :
                    item.rank === 3 ? "bg-orange-500 text-white" :
                    "bg-slate-100 text-slate-600"
                  )}>
                    {item.rank}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-800">{item.name}</p>
                    <p className="text-[9px] text-slate-400">پایه: {item.grade || '---'}</p>
                  </div>
                </div>

                <div className="text-left flex flex-col items-end gap-0.5">
                  <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100">
                    {item.displayValue}
                  </span>
                  {(item.studyValue || item.discussionValue) && (
                    <div className="flex items-center gap-2 text-[9px] text-slate-500 font-bold mt-0.5">
                      {item.studyValue && (
                        <span className="flex items-center gap-0.5 text-indigo-600">
                          <span>مطالعه:</span>
                          <span>{item.studyValue}</span>
                        </span>
                      )}
                      {item.discussionValue && (
                        <span className="flex items-center gap-0.5 text-emerald-600">
                          <span>مباحثه:</span>
                          <span>{item.discussionValue}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end shrink-0">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all"
            >
              بستن
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
