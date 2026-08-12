/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import StudentList from './components/StudentList';
import Programs from './components/Programs';
import ResearchAndFeedback from './components/ResearchAndFeedback';
import AttendanceAndStats from './components/AttendanceAndStats';
import Summary from './components/Summary';
import TodoList from './components/TodoList';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState('students');

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
        return <AttendanceAndStats />; // Unified view
      case 'todos':
        return <TodoList />;
      case 'summary':
        return <Summary />;
      default:
        return <StudentList />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-vazir" dir="rtl">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 mr-64 p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="max-w-7xl mx-auto"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Global Toast or Notification system can be added here */}
    </div>
  );
}

