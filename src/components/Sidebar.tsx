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
  GraduationCap
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const menuItems = [
  { id: 'students', label: 'همه کاربران', icon: Users },
  { id: 'active-students', label: 'کاربران فعال', icon: UserCheck },
  { id: 'programs', label: 'برنامه‌های مدرسه', icon: Calendar },
  { id: 'research', label: 'بخش پژوهش', icon: BookOpen },
  { id: 'attendance', label: 'حضور و غیاب', icon: CheckSquare },
  { id: 'stats', label: 'آمار مطالعه', icon: BarChart2 },
  { id: 'todos', label: 'امور پیگیری', icon: GraduationCap },
  { id: 'summary', label: 'جمع‌بندی و هوش مصنوعی', icon: BrainCircuit },
];

export default function Sidebar({ activeTab, setActiveTab, isOpen }: SidebarProps) {
  return (
    <div 
      className={cn(
        "w-64 bg-white border-l border-slate-200 h-screen fixed right-0 top-0 flex flex-col flex-shrink-0 z-40 transition-all duration-300 transform",
        isOpen ? "translate-x-0" : "translate-x-full"
      )} 
      dir="rtl"
    >
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shrink-0">ت</div>
        <h1 className="text-lg font-bold text-slate-800 truncate">مدیریت طلاب</h1>
      </div>
      <nav className="flex-1 p-4 overflow-y-auto space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-right group",
              activeTab === item.id 
                ? "bg-indigo-50 text-indigo-700 font-medium" 
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            )}
          >
            <span className={cn(
              "w-2 h-2 rounded-full transition-all shrink-0",
              activeTab === item.id ? "bg-indigo-600 scale-125" : "bg-slate-300 group-hover:bg-slate-400"
            )}></span>
            <span className="text-sm">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-900 text-white rounded-xl p-3 text-[11px]">
          <p className="opacity-70 mb-1">اتصال هوشمند</p>
          <p className="font-medium flex items-center">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full ml-1.5 animate-pulse"></span>
            Gemini 2.0 Flash فعال
          </p>
        </div>
      </div>
    </div>
  );
}
