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
import TodoList from './components/TodoList';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('students');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    // Open sidebar by default on large screens
    if (window.innerWidth >= 1024) {
      setIsSidebarOpen(true);
    }
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'students':
        return <StudentList />;
      case 'active-students':
        return <StudentList onlyActive />;
      case 'programs':
        return <Programs />;
      case 'research':
        return <ResearchAndFeedback />;
      case 'attendance':
        return <AttendanceAndStats />;
      case 'stats':
        return <StudyStats />;
      case 'todos':
        return <TodoList />;
      case 'summary':
        return <Summary />;
      default:
        return <StudentList />;
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
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
            >
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h2 className="text-sm font-bold text-slate-800">
              {activeTab === 'todos' ? 'پیگیری‌ها' :
               activeTab === 'students' ? 'مدیریت کل کاربران' :
               activeTab === 'active-students' ? 'لیست کاربران فعال' :
               activeTab === 'programs' ? 'برنامه‌های آموزشی' :
               activeTab === 'research' ? 'بخش پژوهش و مقالات' :
               activeTab === 'attendance' ? 'حضور و غیاب' :
               activeTab === 'stats' ? 'آمار و گزارشات' : 'جمع‌بندی نهایی'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
             <div className="text-left">
                <p className="text-[10px] text-slate-400 font-bold leading-none mb-1">پنل مدیریت</p>
                <p className="text-[11px] font-black text-slate-700 leading-none">مدرسه علمیه</p>
             </div>
             <div className="w-8 h-8 bg-slate-100 rounded-full"></div>
          </div>
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
    </div>
  );
}

