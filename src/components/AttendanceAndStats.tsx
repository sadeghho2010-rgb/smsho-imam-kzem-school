import React from 'react';
import { CheckSquare, Clock } from 'lucide-react';

export default function AttendanceAndStats() {
  return (
    <div className="max-w-2xl mx-auto space-y-8" dir="rtl">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-slate-900 flex items-center justify-center gap-2">
          <CheckSquare className="text-indigo-600" size={28} />
          <span>حضور و غیاب</span>
        </h2>
        <p className="text-xs text-slate-400">مدیریت حضور و غیاب طلاب</p>
      </div>

      <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-200 text-center flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
          <Clock size={32} />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-800">بخش حضور و غیاب در دست طراحی می‌باشد</h3>
          <p className="text-xs text-slate-400">این بخش به زودی با امکانات کامل و پیشرفته ارائه خواهد شد.</p>
        </div>
      </div>
    </div>
  );
}
