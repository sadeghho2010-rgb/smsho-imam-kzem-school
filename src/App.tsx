/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import StudentList from './components/StudentList';
import Programs from './components/Programs';
import ResearchAndFeedback from './components/ResearchAndFeedback';
import AttendanceAndStats from './components/AttendanceAndStats';
import StudyStats from './components/StudyStats';
import Summary from './components/Summary';
import BackupAndRestore from './components/BackupAndRestore';
import ManagerFiles from './components/ManagerFiles';
import TodoList from './components/TodoList';
import StudentComments from './components/StudentComments';
import StudyDiscussion from './components/StudyDiscussion';
import MentorSelectorModal from './components/MentorSelectorModal';
import { MentorProvider, useMentor } from './context/MentorContext';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, ShieldCheck, Layers, ChevronDown, UserCheck } from 'lucide-react';
import { cn } from './lib/utils';

function AppContent() {
  const [activeTab, setActiveTab] = useState('todos');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedStudentIdForTab, setSelectedStudentIdForTab] = useState<string | undefined>(undefined);

  const { 
    currentMentor, 
    currentMentorId, 
    shahpooriFilter, 
    setShahpooriFilter,
    setIsMentorModalOpen 
  } = useMentor();

  useEffect(() => {
    // Open sidebar by default on large screens
    if (window.innerWidth >= 1024) {
      setIsSidebarOpen(true);
    }
  }, []);

  const handleNavigate = (tab: string, studentId?: string) => {
    if (studentId) {
      setSelectedStudentIdForTab(studentId);
    }
    setActiveTab(tab);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'students':
        return <StudentList initialStudentId={selectedStudentIdForTab} />;
      case 'active-students':
        return <StudentList onlyActive initialStudentId={selectedStudentIdForTab} />;
      case 'discussion':
        return <StudyDiscussion initialStudentId={selectedStudentIdForTab} />;
      case 'programs':
        return <Programs />;
      case 'research':
        return <ResearchAndFeedback initialStudentId={selectedStudentIdForTab} />;
      case 'attendance':
        return <AttendanceAndStats />;
      case 'comments':
        return <StudentComments initialStudentId={selectedStudentIdForTab} />;
      case 'stats':
        return <StudyStats initialStudentId={selectedStudentIdForTab} />;
      case 'todos':
        return <TodoList />;
      case 'summary':
        return <Summary onNavigate={handleNavigate} initialStudentId={selectedStudentIdForTab} />;
      case 'backup':
        return <BackupAndRestore />;
      case 'manager-files':
        return <ManagerFiles />;
      default:
        return <TodoList />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-vazir relative overflow-x-hidden" dir="rtl">
      {/* Sidebar Overlay (Drawer Backdrop) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-[#00000033] backdrop-blur-sm z-30"
          />
        )}
      </AnimatePresence>

      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setIsSidebarOpen(false); // Close sidebar on selection for all screens
        }} 
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
        <header className="bg-white border-b border-slate-200/80 sticky top-0 z-20 shadow-sm">
          <div className="h-16 px-4 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
              >
                {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
              <div className="flex flex-col">
                <h2 className="text-sm font-bold text-slate-800">
                  {activeTab === 'todos' ? 'پیگیری‌ها' :
                   activeTab === 'students' ? 'مدیریت کل کاربران (مشترک)' :
                   activeTab === 'active-students' ? 'لیست کاربران فعال' :
                   activeTab === 'manager-files' ? (currentMentor.isHeadManager ? 'ارسال فایل برای کاربران' : 'فایل‌های ارسالی مدیر') :
                   activeTab === 'programs' ? 'برنامه‌های آموزشی' :
                   activeTab === 'research' ? 'بخش پژوهش و مقالات' :
                   activeTab === 'attendance' ? 'حضور و غیاب' :
                   activeTab === 'comments' ? 'نظرات و صحبت‌ها' :
                   activeTab === 'stats' ? 'آمار و گزارشات' :
                   activeTab === 'summary' ? 'جمع‌بندی نهایی' : 'پشتیبان‌گیری'}
                </h2>
                {activeTab !== 'students' && (
                  <span className="text-[10px] text-slate-400 font-medium">
                    {currentMentor.isHeadManager 
                      ? (shahpooriFilter === 'all' ? 'نمایش کل کاربران فعال' : `نمایش کاربران: ${shahpooriFilter === 'hayati' ? 'استاد حیاتی (پایه ۷)' : shahpooriFilter === 'hosseini' ? 'استاد حسینی (پایه ۸)' : shahpooriFilter === 'soleimani' ? 'استاد سلیمانی (پایه ۹)' : 'استاد اسدی (پایه ۱۰)'}`)
                      : `محیط اختصاصی: ${currentMentor.name} (${currentMentor.gradeLabel})`
                    }
                  </span>
                )}
              </div>
            </div>

            {/* Top Right Header Space - Active Mentor Switcher */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMentorModalOpen(true)}
                className="flex items-center gap-2.5 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 hover:border-slate-300 rounded-2xl transition-all shadow-xs group"
                title="کلیک جهت مشاهده و تغییر کاربر / استاد"
              >
                <div className={cn("w-8 h-8 rounded-xl text-white font-black flex items-center justify-center text-xs shadow-xs shrink-0", currentMentor.avatarBg)}>
                  {currentMentor.name.split(' ')[1]?.[0] || 'ا'}
                </div>
                <div className="flex flex-col text-right">
                  <div className="text-xs font-black text-slate-800 leading-tight flex items-center gap-1">
                    <span>{currentMentor.name}</span>
                    {currentMentor.isHeadManager && <ShieldCheck size={13} className="text-amber-600 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                    <span>{currentMentor.role}</span>
                    <span className="text-slate-300">•</span>
                    <span className="text-indigo-600 font-bold">{currentMentor.gradeLabel}</span>
                  </div>
                </div>
                <ChevronDown size={15} className="text-slate-400 group-hover:text-slate-700 transition-transform group-hover:translate-y-0.5 mr-1" />
              </button>
            </div>
          </div>

          {/* Shahpoori Filter Bar (Only visible when current user is Shahpoori and not on shared "مدیریت کل کاربران") */}
          {currentMentorId === 'shahpoori' && activeTab !== 'students' && (
            <div className="bg-amber-50/60 border-t border-amber-100/80 px-4 sm:px-6 py-2 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <ShieldCheck size={16} className="text-amber-600 shrink-0" />
                <span>مدیریت ارشد (استاد شاهپوری):</span>
                <span className="text-slate-500 font-normal hidden md:inline">انتخاب دسته طلاب فعال برای بررسی:</span>
              </div>
              
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-amber-200 shadow-sm font-bold">
                <button
                  onClick={() => setShahpooriFilter('all')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all text-[11px] flex items-center gap-1",
                    shahpooriFilter === 'all'
                      ? "bg-amber-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-amber-50"
                  )}
                >
                  <Layers size={12} />
                  <span>همه کاربران فعال</span>
                </button>
                
                <button
                  onClick={() => setShahpooriFilter('hayati')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all text-[11px] flex items-center gap-1",
                    shahpooriFilter === 'hayati'
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-emerald-700 hover:bg-emerald-50"
                  )}
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
                  <span>استاد حیاتی (پایه ۷)</span>
                </button>

                <button
                  onClick={() => setShahpooriFilter('hosseini')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all text-[11px] flex items-center gap-1",
                    shahpooriFilter === 'hosseini'
                      ? "bg-sky-600 text-white shadow-sm"
                      : "text-sky-700 hover:bg-sky-50"
                  )}
                >
                  <div className="w-2 h-2 rounded-full bg-sky-400 shrink-0"></div>
                  <span>استاد حسینی (پایه ۸)</span>
                </button>

                <button
                  onClick={() => setShahpooriFilter('soleimani')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all text-[11px] flex items-center gap-1",
                    shahpooriFilter === 'soleimani'
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-purple-700 hover:bg-purple-50"
                  )}
                >
                  <div className="w-2 h-2 rounded-full bg-purple-400 shrink-0"></div>
                  <span>استاد سلیمانی (پایه ۹)</span>
                </button>

                <button
                  onClick={() => setShahpooriFilter('asadi')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all text-[11px] flex items-center gap-1",
                    shahpooriFilter === 'asadi'
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-rose-700 hover:bg-rose-50"
                  )}
                >
                  <div className="w-2 h-2 rounded-full bg-rose-400 shrink-0"></div>
                  <span>استاد اسدی (پایه ۱۰)</span>
                </button>
              </div>
            </div>
          )}
        </header>

        <main className="p-4 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mentor/User Selector Modal */}
      <MentorSelectorModal />
    </div>
  );
}

export default function App() {
  return (
    <MentorProvider>
      <AppContent />
    </MentorProvider>
  );
}
