import React from 'react';
import { 
  Users, 
  Calendar, 
  BookOpen, 
  MessageSquare, 
  CheckSquare, 
  BarChart2, 
  UserCheck,
  BrainCircuit,
  GraduationCap,
  HardDrive,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useMentor } from '../context/MentorContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const menuItems = [
  { id: 'todos', label: 'پیگیری‌ها', icon: GraduationCap },
  { id: 'students', label: 'همه کاربران', icon: Users },
  { id: 'active-students', label: 'کاربران فعال', icon: UserCheck },
  { id: 'programs', label: 'برنامه‌های مدرسه', icon: Calendar },
  { id: 'stats', label: 'آمار مطالعه', icon: BarChart2 },
  { id: 'research', label: 'بخش پژوهش', icon: BookOpen },
  { id: 'attendance', label: 'حضور و غیاب', icon: CheckSquare },
  { id: 'comments', label: 'نظرات و صحبت‌ها', icon: MessageSquare },
  { id: 'summary', label: 'جمع‌بندی و هوش مصنوعی', icon: BrainCircuit },
  { id: 'backup', label: 'پشتیبان‌گیری', icon: HardDrive },
];

export default function Sidebar({ activeTab, setActiveTab, isOpen }: SidebarProps) {
  const { currentMentor, setIsMentorModalOpen } = useMentor();

  return (
    <div 
      className={cn(
        "w-64 bg-white border-l border-slate-200 h-screen fixed right-0 top-0 flex flex-col flex-shrink-0 z-40 transition-all duration-300 transform",
        isOpen ? "translate-x-0" : "translate-x-full"
      )} 
      dir="rtl"
    >
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-base shadow-sm">
            ت
          </div>
          <div>
            <h1 className="text-base font-black text-slate-800 tracking-tight">مدیریت طلاب</h1>
            <p className="text-[10px] text-slate-400 font-medium">سامانه هوشمند حوزه علمیه</p>
          </div>
        </div>
      </div>

      {/* Active User / Mentor Card in Sidebar */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/70">
        <div className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400">کاربر فعال سیستم:</span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-black border", currentMentor.badgeBg, currentMentor.badgeText, currentMentor.badgeBorder)}>
              {currentMentor.gradeLabel}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className={cn("w-9 h-9 rounded-xl text-white font-black flex items-center justify-center text-xs shrink-0 shadow-xs", currentMentor.avatarBg)}>
              {currentMentor.name.split(' ')[1]?.[0] || 'ا'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black text-slate-800 truncate flex items-center gap-1">
                <span>{currentMentor.name}</span>
                {currentMentor.isHeadManager && <ShieldCheck size={12} className="text-amber-600 shrink-0" />}
              </div>
              <p className="text-[10px] text-slate-500 font-medium truncate">{currentMentor.role}</p>
            </div>
          </div>

          <button
            onClick={() => setIsMentorModalOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 active:bg-indigo-100 border border-slate-200 hover:border-indigo-200 rounded-xl text-[11px] font-bold text-slate-600 transition-all"
          >
            <RefreshCw size={12} className="text-slate-400 group-hover:text-indigo-600" />
            <span>تغییر استاد / کاربر</span>
          </button>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-3 overflow-y-auto space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-right group",
                activeTab === item.id 
                  ? "bg-indigo-50 text-indigo-700 font-bold" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon size={18} className={cn(
                "shrink-0 transition-colors",
                activeTab === item.id ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
              )} />
              <span className="text-xs sm:text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-100">
        <div className="bg-slate-900 text-white rounded-2xl p-3 text-[11px]">
          <p className="opacity-70 mb-1">دستیار هوشمند</p>
          <p className="font-medium flex items-center">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full ml-1.5 animate-pulse"></span>
            Gemini Flash فعال
          </p>
        </div>
      </div>
    </div>
  );
}
