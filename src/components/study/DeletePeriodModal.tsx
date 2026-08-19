import React from 'react';
import { Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StudyPeriod } from '../../types';

interface DeletePeriodModalProps {
  period: StudyPeriod | null;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeletePeriodModal({ period, onClose, onConfirm }: DeletePeriodModalProps) {
  if (!period) return null;

  return (
    <AnimatePresence>
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
              <h3 className="text-base font-black text-slate-800">تایید حذف دوره مطالعاتی</h3>
              <p className="text-xs text-slate-500 mt-0.5">این عملیات غیرقابل بازگشت است</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs text-slate-700 space-y-1">
            <p className="font-bold text-slate-800">عنوان دوره: {period.title}</p>
            <p className="text-[11px] text-slate-500">
              تاریخ: {new Date(period.startDate).toLocaleDateString('fa-IR')} تا {new Date(period.endDate).toLocaleDateString('fa-IR')}
            </p>
          </div>

          <p className="text-xs font-medium text-slate-600 leading-relaxed">
            آیا از حذف این دوره و تمامی اطلاعات مطالعه و مباحثه ثبت‌شده در آن مطمئن هستید؟
          </p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-200 flex items-center gap-1.5"
            >
              <Trash2 size={16} />
              <span>حذف دوره</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
