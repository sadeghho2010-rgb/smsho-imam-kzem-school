import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Trash2, 
  CheckCircle, 
  GraduationCap,
  History,
  AlertCircle,
  Printer,
  FileJson,
  Archive,
  RotateCcw,
  Edit3,
  Check,
  CheckSquare,
  Sparkles,
  Plus,
  X,
  Award,
  Settings,
  FolderEdit,
  FolderMinus,
  Edit2,
  Bookmark,
  Download
} from 'lucide-react';
import { localDb } from '../lib/localDb';
import { 
  Student, 
  ResearchRecord, 
  ConversationArchive,
  ResearchHistoryItem,
  ResearchSkillDef,
  StudentResearchSkills
} from '../types';
import { useMentor } from '../context/MentorContext';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { exportElementToPdf } from '../lib/pdfExport';

interface ResearchAndFeedbackProps {
  initialStudentId?: string;
}

export default function ResearchAndFeedback({ initialStudentId }: ResearchAndFeedbackProps = {}) {
  const { filterStudents, currentMentorId, shahpooriFilter } = useMentor();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(initialStudentId || '');
  const [loading, setLoading] = useState(false);

  // Active Tab: 'active_research' | 'history' | 'skills'
  const [activeTab, setActiveTab] = useState<'active_research' | 'history' | 'skills'>('active_research');

  // Main research record for active year
  const [research, setResearch] = useState<ResearchRecord | null>(null);

  // Research history items
  const [historyItems, setHistoryItems] = useState<ResearchHistoryItem[]>([]);

  // Research skills for selected student & Master Skill Definitions from DB
  const [studentSkills, setStudentSkills] = useState<StudentResearchSkills | null>(null);
  const [skillDefs, setSkillDefs] = useState<ResearchSkillDef[]>([]);

  // Skill Bank Settings Modal States
  const [showSkillSettingsModal, setShowSkillSettingsModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<ResearchSkillDef | null>(null);
  const [skillForm, setSkillForm] = useState<{ title: string; category: string; description: string }>({
    title: '',
    category: 'روش و ابزار',
    description: ''
  });
  const [customCategoryInput, setCustomCategoryInput] = useState('');

  // Category Editing State
  const [showCategoryEditModal, setShowCategoryEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ oldName: string; newName: string } | null>(null);

  // Modals & Forms
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [teamSearchTerm, setTeamSearchTerm] = useState('');

  // Manager Report Modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [allResearchRecords, setAllResearchRecords] = useState<(ResearchRecord & { studentName?: string, studentGrade?: string })[]>([]);
  
  // Student Specific PDF Report Modal
  const [showStudentPdfModal, setShowStudentPdfModal] = useState(false);
  const [pdfIncludeActive, setPdfIncludeActive] = useState(true);
  const [pdfIncludeHistory, setPdfIncludeHistory] = useState(true);
  const [pdfIncludeSkills, setPdfIncludeSkills] = useState(true);

  // Archive Active Research Modal
  const [showArchiveConfirmModal, setShowArchiveConfirmModal] = useState(false);
  const [archiveYearPeriod, setArchiveYearPeriod] = useState('سال ۱۴۰۴-۱۴۰۳');
  const [archiveSummary, setArchiveSummary] = useState('');

  // Add/Edit History Item Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingHistoryItem, setEditingHistoryItem] = useState<ResearchHistoryItem | null>(null);
  const [historyForm, setHistoryForm] = useState<Partial<ResearchHistoryItem>>({
    topic: '',
    academicYearOrPeriod: 'سال ۱۴۰۳-۱۴۰۲',
    stage: 'تکمیل شده',
    score: '',
    description: '',
    summary: '',
    professorNotes: '',
    supervisorNotes: '',
    criticNotes: ''
  });

  // Custom Student Skill Input
  const [customSkillInput, setCustomSkillInput] = useState('');

  // Conversation Archives (Internal Meeting Notes)
  const [archives, setArchives] = useState<ConversationArchive[]>([]);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [newArchive, setNewArchive] = useState('');
  const [newUsage, setNewUsage] = useState('');

  // Statuses
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [skillSaveStatus, setSkillSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isExporting, setIsExporting] = useState(false);
  
  const reportRef = useRef<HTMLDivElement>(null);
  const studentReportRef = useRef<HTMLDivElement>(null);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (initialStudentId) {
      setSelectedStudentId(initialStudentId);
      fetchStudentDetails(initialStudentId);
    }
  }, [initialStudentId]);

  useEffect(() => {
    const fetchStudents = async () => {
      const all = await localDb.getDocs<Student>('students');
      const active = all.filter(s => s.isActive);
      setStudents(filterStudents(active, true));
    };
    fetchStudents();
    loadSkillDefinitions();

    const unsub = localDb.subscribe(() => {
      fetchStudents();
      loadSkillDefinitions();
    });
    return () => unsub();
  }, [currentMentorId, shahpooriFilter]);

  // Load master list of skill definitions from localDb without hardcoded seeds
  const loadSkillDefinitions = async () => {
    try {
      const defs = await localDb.getDocs<ResearchSkillDef>('research_skills_def');
      setSkillDefs(defs || []);
    } catch (err) {
      console.error("Error loading skill defs:", err);
      setSkillDefs([]);
    }
  };

  const fetchStudentDetails = async (studentId: string) => {
    setLoading(true);
    isFirstLoad.current = true;
    try {
      const [allResearch, allArchives, allHistory, allStudentSkills] = await Promise.all([
        localDb.getDocs<ResearchRecord>('research_records'),
        localDb.getDocs<ConversationArchive>('conversation_archives'),
        localDb.getDocs<ResearchHistoryItem>('research_history'),
        localDb.getDocs<StudentResearchSkills>('student_research_skills')
      ]);

      const studentArchives = allArchives.filter(a => a.studentId === studentId);
      setArchives(studentArchives);
      
      const studentResearch = allResearch.find(r => r.studentId === studentId);
      setResearch(studentResearch || null);

      const studentHist = allHistory.filter(h => h.studentId === studentId);
      setHistoryItems(studentHist.sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime()));

      const skillsRec = allStudentSkills.find(s => s.studentId === studentId);
      if (skillsRec) {
        setStudentSkills(skillsRec);
      } else {
        setStudentSkills({
          id: '',
          studentId,
          skillIds: [],
          customSkills: [],
          notes: '',
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Error fetching details:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllResearchData = async () => {
    setIsExporting(true);
    try {
      const allRecords = await localDb.getDocs<ResearchRecord>('research_records');
      const records = allRecords.map(data => {
        const student = students.find(s => s.id === data.studentId);
        return {
          ...data,
          studentName: student?.name || 'نامشخص',
          studentGrade: student?.grade || '---'
        };
      });
      setAllResearchRecords(records);
      return records;
    } catch (error) {
      console.error("Error fetching all research:", error);
      return [];
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkExportJSON = async () => {
    const data = await fetchAllResearchData();
    if (data.length === 0) return;
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_research_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOpenManagerReport = async () => {
    await fetchAllResearchData();
    setShowReportModal(true);
  };

  const handleDownloadManagerPDF = async () => {
    const element = reportRef.current;
    if (!element) return;
    
    setIsExporting(true);
    try {
      const fileName = `گزارش_جامع_پژوهش_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.pdf`;
      await exportElementToPdf({
        element,
        filename: fileName,
        orientation: 'portrait',
        marginMM: 8
      });
    } catch (err) {
      console.error("PDF export error:", err);
      alert("خطا در دانلود فایل PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadStudentPDF = async () => {
    const element = studentReportRef.current;
    if (!element) return;

    const selStudent = students.find(s => s.id === selectedStudentId);
    const studentName = selStudent ? selStudent.name.replace(/\s+/g, '_') : 'طلبه';
    
    setIsExporting(true);
    try {
      const fileName = `پرونده_پژوهشی_${studentName}_${new Date().toLocaleDateString('fa-IR').replace(/\//g, '-')}.pdf`;
      await exportElementToPdf({
        element,
        filename: fileName,
        orientation: 'portrait',
        marginMM: 8
      });
      setShowStudentPdfModal(false);
    } catch (err) {
      console.error("Student PDF export error:", err);
      alert("خطا در دانلود گزارش PDF طلبه.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleAddArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !newArchive.trim()) return;
    try {
      await localDb.addDoc('conversation_archives', {
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
      let followUpId = research.followUpTodoId;
      const currentStudent = students.find(s => s.id === selectedStudentId);
      const studentName = currentStudent?.name || '';
      const topicTitle = research.topic ? `«${research.topic}»` : 'بدون عنوان';
      const todoTitle = `پیگیری پژوهش: ${studentName} - ${topicTitle} (${research.stage || 'تعیین موضوع'})`;

      if (research.needsFollowUp) {
        if (followUpId) {
          try {
            await localDb.updateDoc('todos', followUpId, {
              title: todoTitle,
              isResearchFollowUp: true,
              studentId: selectedStudentId,
              researchRecordId: research.id || ''
            });
          } catch (e) {
            const newTodoId = await localDb.addDoc('todos', {
              title: todoTitle,
              completed: false,
              isResearchFollowUp: true,
              studentId: selectedStudentId,
              researchRecordId: research.id || '',
              createdAt: new Date().toISOString()
            });
            followUpId = newTodoId;
          }
        } else {
          const newTodoId = await localDb.addDoc('todos', {
            title: todoTitle,
            completed: false,
            isResearchFollowUp: true,
            studentId: selectedStudentId,
            researchRecordId: research.id || '',
            createdAt: new Date().toISOString()
          });
          followUpId = newTodoId;
        }
      } else {
        if (followUpId) {
          try {
            await localDb.deleteDoc('todos', followUpId);
          } catch (e) {
            console.error("Error removing todo:", e);
          }
          followUpId = undefined;
        }
      }

      const updatedData = {
        ...research,
        studentId: selectedStudentId,
        needsFollowUp: !!research.needsFollowUp,
        followUpTodoId: followUpId || null,
        updatedAt: new Date().toISOString()
      };

      if (research.id) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...data } = updatedData;
        await localDb.updateDoc('research_records', research.id, data);
      } else {
        const newId = await localDb.addDoc('research_records', updatedData);
        setResearch(prev => prev ? { ...prev, id: newId } : null);
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (error) {
      console.error("Error saving research:", error);
      setSaveStatus('idle');
    } finally {
      setLoading(false);
    }
  };

  // Auto-save effect for active research
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    if (!research || !selectedStudentId) return;

    setSaveStatus('saving');
    const timer = setTimeout(() => {
      saveResearchData();
    }, 800);

    return () => clearTimeout(timer);
  }, [research]);

  // Handle Archive Active Research
  const handleConfirmArchiveActive = async () => {
    if (!selectedStudentId || !research) return;
    try {
      const historyItem: Omit<ResearchHistoryItem, 'id'> = {
        studentId: selectedStudentId,
        topic: research.topic || 'پژوهش آرشیو شده',
        type: research.type,
        stage: research.stage || 'آرشیو شده',
        academicYearOrPeriod: archiveYearPeriod || 'سال جاری',
        description: research.description || '',
        summary: archiveSummary || `خلاصه پژوهش سال ${archiveYearPeriod}: موضوع ${research.topic || 'نامشخص'} - امتیاز: ${research.score || '---'}`,
        score: research.score || '',
        professorNotes: research.professorNotes || '',
        supervisorNotes: research.supervisorNotes || '',
        criticNotes: research.criticNotes || '',
        usages: research.usages || [],
        archivedAt: new Date().toISOString(),
        originalRecordSnapshot: { ...research }
      };

      await localDb.addDoc('research_history', historyItem);

      // Clear active research record
      if (research.id) {
        await localDb.deleteDoc('research_records', research.id);
      }

      setResearch(null);
      setShowArchiveConfirmModal(false);
      setArchiveSummary('');
      fetchStudentDetails(selectedStudentId);
      setActiveTab('history');
    } catch (err) {
      console.error("Error archiving active research:", err);
      alert("خطا در انتقال به سوابق پژوهشی.");
    }
  };

  // Restore history item to active research
  const handleRestoreHistoryItem = async (item: ResearchHistoryItem) => {
    if (!selectedStudentId) return;

    try {
      const restoredRecord: Omit<ResearchRecord, 'id'> = {
        studentId: selectedStudentId,
        topic: item.topic || '',
        type: item.type || 'individual',
        stage: item.stage || 'تعیین موضوع',
        description: item.description || '',
        professorNotes: item.professorNotes || '',
        supervisorNotes: item.supervisorNotes || '',
        criticNotes: item.criticNotes || '',
        score: item.score || '',
        usages: item.usages || [],
        needsFollowUp: false,
        updatedAt: new Date().toISOString()
      };

      if (research && research.id) {
        await localDb.updateDoc('research_records', research.id, restoredRecord);
      } else {
        const newId = await localDb.addDoc('research_records', restoredRecord);
        setResearch({ ...restoredRecord, id: newId });
      }

      fetchStudentDetails(selectedStudentId);
      setActiveTab('active_research');
    } catch (err) {
      console.error("Error restoring history item:", err);
    }
  };

  // Add or Edit History item directly
  const handleSaveHistoryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !historyForm.topic?.trim()) return;

    try {
      if (editingHistoryItem) {
        await localDb.updateDoc('research_history', editingHistoryItem.id, {
          ...historyForm,
          studentId: selectedStudentId,
          archivedAt: editingHistoryItem.archivedAt
        });
      } else {
        await localDb.addDoc('research_history', {
          ...historyForm,
          studentId: selectedStudentId,
          archivedAt: new Date().toISOString()
        });
      }

      setShowHistoryModal(false);
      setEditingHistoryItem(null);
      setHistoryForm({
        topic: '',
        academicYearOrPeriod: 'سال ۱۴۰۳-۱۴۰۲',
        stage: 'تکمیل شده',
        score: '',
        description: '',
        summary: '',
        professorNotes: '',
        supervisorNotes: '',
        criticNotes: ''
      });
      fetchStudentDetails(selectedStudentId);
    } catch (err) {
      console.error("Error saving history item:", err);
    }
  };

  // Delete history item
  const handleDeleteHistoryItem = async (id: string) => {
    await localDb.deleteDoc('research_history', id);
    fetchStudentDetails(selectedStudentId);
  };

  // Student Skills checklist handler
  const handleToggleSkill = async (skillId: string) => {
    if (!selectedStudentId) return;
    const currentList = studentSkills?.skillIds || [];
    const updatedList = currentList.includes(skillId)
      ? currentList.filter(id => id !== skillId)
      : [...currentList, skillId];

    const updatedStudentSkills: StudentResearchSkills = {
      id: studentSkills?.id || '',
      studentId: selectedStudentId,
      skillIds: updatedList,
      customSkills: studentSkills?.customSkills || [],
      notes: studentSkills?.notes || '',
      updatedAt: new Date().toISOString()
    };

    setStudentSkills(updatedStudentSkills);
    saveStudentSkills(updatedStudentSkills);
  };

  const handleAddCustomSkill = async () => {
    if (!selectedStudentId || !customSkillInput.trim()) return;
    const currentCustom = studentSkills?.customSkills || [];
    if (currentCustom.includes(customSkillInput.trim())) return;

    const updatedStudentSkills: StudentResearchSkills = {
      id: studentSkills?.id || '',
      studentId: selectedStudentId,
      skillIds: studentSkills?.skillIds || [],
      customSkills: [...currentCustom, customSkillInput.trim()],
      notes: studentSkills?.notes || '',
      updatedAt: new Date().toISOString()
    };

    setStudentSkills(updatedStudentSkills);
    setCustomSkillInput('');
    saveStudentSkills(updatedStudentSkills);
  };

  const handleRemoveCustomSkill = async (skillName: string) => {
    if (!selectedStudentId) return;
    const currentCustom = studentSkills?.customSkills || [];
    const updatedCustom = currentCustom.filter(s => s !== skillName);

    const updatedStudentSkills: StudentResearchSkills = {
      id: studentSkills?.id || '',
      studentId: selectedStudentId,
      skillIds: studentSkills?.skillIds || [],
      customSkills: updatedCustom,
      notes: studentSkills?.notes || '',
      updatedAt: new Date().toISOString()
    };

    setStudentSkills(updatedStudentSkills);
    saveStudentSkills(updatedStudentSkills);
  };

  const handleUpdateSkillNotes = (notesText: string) => {
    if (!selectedStudentId) return;
    const updatedStudentSkills: StudentResearchSkills = {
      id: studentSkills?.id || '',
      studentId: selectedStudentId,
      skillIds: studentSkills?.skillIds || [],
      customSkills: studentSkills?.customSkills || [],
      notes: notesText,
      updatedAt: new Date().toISOString()
    };

    setStudentSkills(updatedStudentSkills);
  };

  const saveStudentSkills = async (dataToSave: StudentResearchSkills) => {
    if (!selectedStudentId) return;
    setSkillSaveStatus('saving');
    try {
      if (dataToSave.id) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...rest } = dataToSave;
        await localDb.updateDoc('student_research_skills', id, rest);
      } else {
        const newId = await localDb.addDoc('student_research_skills', dataToSave);
        setStudentSkills(prev => prev ? { ...prev, id: newId } : null);
      }
      setSkillSaveStatus('saved');
      setTimeout(() => setSkillSaveStatus('idle'), 2000);
    } catch (err) {
      console.error("Error saving student skills:", err);
      setSkillSaveStatus('idle');
    }
  };

  // --- SKILL BANK MANAGEMENT HANDLERS ---
  const handleSaveSkillDef = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillForm.title.trim()) return;

    const categoryToUse = (skillForm.category === '__NEW__' ? customCategoryInput.trim() : skillForm.category.trim()) || 'عمومی';

    try {
      if (editingSkill?.id) {
        await localDb.updateDoc('research_skills_def', editingSkill.id, {
          title: skillForm.title.trim(),
          category: categoryToUse,
          description: skillForm.description.trim()
        });
      } else {
        await localDb.addDoc('research_skills_def', {
          title: skillForm.title.trim(),
          category: categoryToUse,
          description: skillForm.description.trim(),
          createdAt: new Date().toISOString()
        });
      }

      setEditingSkill(null);
      setSkillForm({ title: '', category: 'روش و ابزار', description: '' });
      setCustomCategoryInput('');
      loadSkillDefinitions();
    } catch (err) {
      console.error("Error saving skill def:", err);
    }
  };

  const handleDeleteSkillDef = async (id: string) => {
    try {
      await localDb.deleteDoc('research_skills_def', id);
      loadSkillDefinitions();
    } catch (err) {
      console.error("Error deleting skill def:", err);
    }
  };

  const handleStartRenameCategory = (categoryName: string) => {
    setEditingCategory({ oldName: categoryName, newName: categoryName });
    setShowCategoryEditModal(true);
  };

  const handleConfirmRenameCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory || !editingCategory.newName.trim() || editingCategory.oldName === editingCategory.newName.trim()) return;

    try {
      const skillsInCat = skillDefs.filter(s => (s.category || 'عمومی') === editingCategory.oldName);
      for (const sk of skillsInCat) {
        await localDb.updateDoc('research_skills_def', sk.id, { category: editingCategory.newName.trim() });
      }
      setShowCategoryEditModal(false);
      setEditingCategory(null);
      loadSkillDefinitions();
    } catch (err) {
      console.error("Error renaming category:", err);
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    const skillsInCat = skillDefs.filter(s => (s.category || 'عمومی') === categoryName);

    try {
      for (const sk of skillsInCat) {
        await localDb.deleteDoc('research_skills_def', sk.id);
      }
      loadSkillDefinitions();
    } catch (err) {
      console.error("Error deleting category:", err);
    }
  };

  const deleteItem = async (col: string, id: string) => {
    await localDb.deleteDoc(col, id);
    fetchStudentDetails(selectedStudentId);
  };

  const selStudentObj = students.find(s => s.id === selectedStudentId);

  // Group skillDefs by category
  const categoriesList: string[] = Array.from(new Set(skillDefs.map(s => (s.category || 'عمومی') as string)));

  return (
    <div className="space-y-8" dir="rtl">
      {/* Top Header & Actions */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="text-indigo-600" size={24} />
            مدیریت پژوهش، سوابق و مهارت‌های علمی
          </h2>
          <p className="text-[11px] text-slate-500">ارزیابی پژوهشی سالانه، سوابق مقالات و پایش مهارت‌های تخصصی طلاب</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {selectedStudentId && (
            <button 
              onClick={() => setShowStudentPdfModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 text-white text-[11px] font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100"
            >
              <Printer size={15} />
              <span>گزارش PDF طلبه</span>
            </button>
          )}

          <button 
            onClick={handleOpenManagerReport}
            disabled={isExporting}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 text-indigo-700 text-[11px] font-bold rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-100 disabled:opacity-50"
          >
            <Printer size={15} />
            <span>گزارش کل طلاب</span>
          </button>

          <button 
            onClick={handleBulkExportJSON}
            disabled={isExporting}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            <FileJson size={15} />
            <span>خروجی JSON</span>
          </button>

          <div className="h-8 w-px bg-slate-200 mx-1 hidden md:block"></div>

          <div className="w-full md:w-60">
            <select 
              className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none bg-slate-50 focus:ring-2 focus:ring-indigo-500 text-xs shadow-sm font-bold text-slate-700"
              value={selectedStudentId}
              onChange={(e) => {
                setSelectedStudentId(e.target.value);
                if (e.target.value) fetchStudentDetails(e.target.value);
              }}
            >
              <option value="">انتخاب طلبه فعال...</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.grade || 'نامشخص'})</option>)}
            </select>
          </div>
        </div>
      </div>

      {selectedStudentId ? (
        <div className="space-y-6">
          {/* Selected Student Banner & Internal Tab Bar */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-13 h-13 rounded-2xl bg-indigo-100 overflow-hidden shrink-0 border-2 border-indigo-200 flex items-center justify-center font-black text-indigo-700 text-lg shadow-sm">
                  {selStudentObj?.photoUrl ? (
                    <img src={selStudentObj.photoUrl} alt={selStudentObj.name} className="w-full h-full object-cover" />
                  ) : (
                    selStudentObj?.name.charAt(0)
                  )}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">{selStudentObj?.name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 font-medium">
                    <span>پایه تحصیلی: <strong className="text-slate-800">{selStudentObj?.grade || 'نامشخص'}</strong></span>
                    {selStudentObj?.nationalId && <span>کد ملی: <strong className="text-slate-800">{selStudentObj.nationalId}</strong></span>}
                  </div>
                </div>
              </div>

              {/* Status Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] font-black border border-indigo-100 flex items-center gap-1">
                  <BookOpen size={12} />
                  <span>پژوهش فعال: {research?.topic ? 'دارد' : 'ثبت نشده'}</span>
                </span>
                <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-xl text-[10px] font-black border border-amber-100 flex items-center gap-1">
                  <History size={12} />
                  <span>سوابق: {historyItems.length} مورد</span>
                </span>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black border border-emerald-100 flex items-center gap-1">
                  <Award size={12} />
                  <span>مهارت‌ها: {studentSkills?.skillIds?.length || 0} مورد</span>
                </span>
              </div>
            </div>

            {/* 3 Main Tabs Navigation */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={() => setActiveTab('active_research')}
                className={cn(
                  "flex-1 min-w-[160px] py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border",
                  activeTab === 'active_research'
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                )}
              >
                <BookOpen size={16} />
                <span>پرونده پژوهشی فعال (امسال)</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className={cn(
                  "flex-1 min-w-[160px] py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border",
                  activeTab === 'history'
                    ? "bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-100"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                )}
              >
                <History size={16} />
                <span>سابقه پژوهش و آرشیو</span>
                {historyItems.length > 0 && (
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px]", activeTab === 'history' ? "bg-amber-700 text-white" : "bg-amber-100 text-amber-800")}>
                    {historyItems.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('skills')}
                className={cn(
                  "flex-1 min-w-[160px] py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border",
                  activeTab === 'skills'
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-100"
                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                )}
              >
                <Award size={16} />
                <span>مهارت‌های پژوهشی</span>
                {(studentSkills?.skillIds?.length || 0) > 0 && (
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px]", activeTab === 'skills' ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-800")}>
                    {studentSkills?.skillIds?.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* TAB 1: ACTIVE RESEARCH */}
          {activeTab === 'active_research' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-8">
              {/* Archive Action Bar */}
              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5">
                    <Archive size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-amber-950">انتقال مقاله/فعالیت پژوهشی جاری به بخش سوابق پژوهشی</h4>
                    <p className="text-[11px] text-amber-800/80 mt-0.5 leading-relaxed">
                      با پایان یا تکمیل پرونده پژوهشی امسال، می‌توانید اطلاعات فعلی مقاله را همراه با خلاصه کلی به بخش «سابقه پژوهش» منتقل کنید.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowArchiveConfirmModal(true)}
                  disabled={!research?.topic}
                  className="shrink-0 px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-all shadow-md shadow-amber-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Archive size={16} />
                  <span>انتقال به سوابق و آرشیو</span>
                </button>
              </div>

              {/* Research Details Form */}
              <div className="space-y-6">
                {/* Needs Follow Up Toggle */}
                <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <input 
                      type="checkbox"
                      id="needsFollowUpToggle"
                      checked={!!research?.needsFollowUp}
                      onChange={(e) => handleResearchUpdate('needsFollowUp', e.target.checked)}
                      className="w-5 h-5 mt-0.5 rounded border-purple-300 text-purple-600 focus:ring-purple-500 cursor-pointer shrink-0"
                    />
                    <label htmlFor="needsFollowUpToggle" className="cursor-pointer">
                      <span className="text-xs font-black text-purple-950 block">نیازمند پیگیری در بخش «امور پیگیری»</span>
                      <span className="text-[10px] font-medium text-purple-700/80 block mt-0.5">با فعال‌سازی این گزینه، یک پیگیری مرتبط با این پژوهش به بخش امور پیگیری اضافه شده و متمایز نمایش داده می‌شود.</span>
                    </label>
                  </div>
                  {research?.needsFollowUp && (
                    <span className="shrink-0 px-3 py-1.5 bg-purple-600 text-white text-[10px] font-black rounded-xl flex items-center gap-1.5 shadow-md shadow-purple-200">
                      <Bookmark size={13} />
                      <span>در لیست امور پیگیری</span>
                    </span>
                  )}
                </div>

                {/* Stages */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-3">مرحله پژوهش</label>
                  <div className="flex flex-wrap gap-2">
                    {['تعیین موضوع', 'طرح پژوهش', 'نگارش اولیه', 'ارزیابی', 'تاخیر دارد', 'تکمیل شده'].map(s => (
                      <button 
                        key={s}
                        type="button"
                        onClick={() => updateResearchStage(s)}
                        className={cn(
                          "px-3.5 py-1.5 rounded-xl text-[11px] font-bold transition-all border",
                          research?.stage === s 
                            ? (s === 'تاخیر دارد' ? "bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-100" : "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100")
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Topic */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-2">موضوع پژوهش</label>
                  <input 
                    type="text"
                    placeholder="عنوان مقاله یا پژوهش..."
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                    value={research?.topic || ''}
                    onChange={(e) => handleResearchUpdate('topic', e.target.value)}
                  />
                </div>

                {/* Type & Team */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-2">نوع پژوهش</label>
                    <select 
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium bg-white"
                      value={research?.type || 'individual'}
                      onChange={(e) => handleResearchUpdate('type', e.target.value)}
                    >
                      <option value="individual">فردی</option>
                      <option value="group">گروهی</option>
                    </select>
                  </div>
                  
                  {research?.type === 'group' && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-2">هم‌گروهی‌ها</label>
                      <button 
                        type="button"
                        onClick={() => setShowTeamModal(true)}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between"
                      >
                        <span>{research?.teamMemberIds?.length || 0} نفر انتخاب شده</span>
                        <Plus size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-2">توضیحات و خلاصه روند پژوهش</label>
                  <textarea 
                    rows={3}
                    placeholder="توضیحات لازم درباره روند پژوهش، پیشرفت‌ها و چالش‌ها..."
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm leading-relaxed"
                    value={research?.description || ''}
                    onChange={(e) => handleResearchUpdate('description', e.target.value)}
                  />
                </div>

                {/* Expert Opinions */}
                <div className="pt-4 border-t border-slate-100 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-2">امتیاز پژوهش</label>
                      <input 
                        type="text"
                        placeholder="مثلا: ۹۵/۱۰۰ یا عالی"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
                        value={research?.score || ''}
                        onChange={(e) => handleResearchUpdate('score', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-2">نظر استاد پژوهش</label>
                      <textarea 
                        rows={2}
                        placeholder="نکات استاد پژوهش..."
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800"
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
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800"
                        value={research?.supervisorNotes || ''}
                        onChange={(e) => handleResearchUpdate('supervisorNotes', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-700 mb-2">نظر استاد ناقد</label>
                      <textarea 
                        rows={2}
                        placeholder="نکات استاد ناقد..."
                        className="w-full px-4 py-2 bg-indigo-50/50 border border-indigo-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-indigo-950 font-medium"
                        value={research?.criticNotes || ''}
                        onChange={(e) => handleResearchUpdate('criticNotes', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Usages List */}
                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-500 mb-2">از این مقاله در موارد زیر استفاده شده است:</label>
                  <div className="flex gap-2 mb-3">
                    <input 
                      type="text"
                      placeholder="مثلا: جشنواره علامه حلی، نشریه مدرسه..."
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      value={newUsage}
                      onChange={(e) => setNewUsage(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        if (newUsage.trim()) {
                          const current = research?.usages || [];
                          handleResearchUpdate('usages', [...current, newUsage.trim()]);
                          setNewUsage('');
                        }
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-bold text-xs"
                    >
                      افزودن
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {research?.usages?.map((usage, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 border border-slate-200">
                        <span>{usage}</span>
                        <button 
                          type="button"
                          onClick={() => {
                            const current = research?.usages || [];
                            handleResearchUpdate('usages', current.filter((_, i) => i !== idx));
                          }}
                          className="text-slate-400 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                    {(!research?.usages || research.usages.length === 0) && (
                      <span className="text-[11px] text-slate-400 italic">موردی ثبت نشده است.</span>
                    )}
                  </div>
                </div>

                {/* Save Bar */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    {saveStatus === 'saving' && (
                      <span className="text-xs text-amber-600 font-bold flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        در حال ذخیره‌سازی خودکار...
                      </span>
                    )}
                    {saveStatus === 'saved' && (
                      <span className="text-xs text-emerald-600 font-bold flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                        <CheckCircle size={14} />
                        تغییرات به‌صورت خودکار ذخیره شد
                      </span>
                    )}
                    {saveStatus === 'idle' && (
                      <span className="text-[11px] text-slate-400 font-medium">
                        ✓ کلیه تغییرات به‌صورت خودکار ذخیره می‌شوند.
                      </span>
                    )}
                  </div>

                  <button 
                    type="button"
                    onClick={saveResearchData}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
                  >
                    ذخیره فوری
                  </button>
                </div>
              </div>

              {/* Internal Meeting Archives Section */}
              <div className="pt-8 border-t border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <div className="w-1.5 h-5 bg-purple-500 rounded-full"></div>
                    آرشیو نشست‌ها و پیگیری‌های حضوری
                  </h3>
                  <button 
                    type="button"
                    onClick={() => setShowArchiveModal(true)}
                    className="px-3 py-1.5 bg-purple-50 text-purple-700 text-xs font-bold rounded-xl hover:bg-purple-100 transition-colors border border-purple-100 flex items-center gap-1"
                  >
                    <Plus size={14} />
                    <span>ثبت جلسه/پیگیری</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {archives.map(arch => (
                    <div key={arch.id} className="p-4 bg-slate-50/70 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] text-slate-400 font-bold">{new Date(arch.createdAt).toLocaleDateString('fa-IR')}</span>
                        <button onClick={() => deleteItem('conversation_archives', arch.id)} className="text-slate-300 hover:text-rose-600 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed text-justify">{arch.summary}</p>
                    </div>
                  ))}

                  {archives.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic text-center py-4 bg-slate-50/50 rounded-xl">
                      هنوز نشست حضوری ثبت نشده است.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RESEARCH HISTORY */}
          {activeTab === 'history' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <History size={18} className="text-amber-600" />
                    سوابق پژوهشی و آرشیو مقالات گذشته
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    لیست کامل فعالیت‌ها و مقالات پژوهشی ثبت یا آرشیو شده طلبه در سال‌های مختلف
                  </p>
                </div>

                <button
                  onClick={() => {
                    setEditingHistoryItem(null);
                    setHistoryForm({
                      topic: '',
                      academicYearOrPeriod: 'سال ۱۴۰۳-۱۴۰۲',
                      stage: 'تکمیل شده',
                      score: '',
                      description: '',
                      summary: '',
                      professorNotes: '',
                      supervisorNotes: '',
                      criticNotes: ''
                    });
                    setShowHistoryModal(true);
                  }}
                  className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-all shadow-md shadow-amber-100 flex items-center gap-1.5"
                >
                  <Plus size={16} />
                  <span>ثبت مستقیم سابقه جدید</span>
                </button>
              </div>

              {historyItems.length === 0 ? (
                <div className="py-16 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 space-y-3">
                  <Archive size={40} className="mx-auto text-slate-300" />
                  <p className="text-xs text-slate-500 font-bold">هیچ سابقه پژوهشی برای این طلبه ثبت نشده است.</p>
                  <p className="text-[11px] text-slate-400">
                    می‌توانید مقاله جاری را از تب اول به آرشیو منتقل کنید یا یک سابقه جدید ثبت نمایید.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {historyItems.map((item) => (
                    <div key={item.id} className="p-5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-4 hover:border-amber-200 transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg text-[10px] font-black border border-amber-200">
                            {item.academicYearOrPeriod || 'سال گذشته'}
                          </span>
                          <h4 className="text-sm font-black text-slate-900">«{item.topic}»</h4>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.score && (
                            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold border border-emerald-200">
                              امتیاز: {item.score}
                            </span>
                          )}
                          <span className="px-2.5 py-0.5 bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold">
                            {item.stage || 'آرشیو شده'}
                          </span>

                          <div className="h-4 w-px bg-slate-300 mx-1"></div>

                          {/* Action Buttons */}
                          <button
                            onClick={() => handleRestoreHistoryItem(item)}
                            title="بازگردانی به مقاله فعال جاری"
                            className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-[11px] font-bold border border-indigo-200 flex items-center gap-1 transition-colors"
                          >
                            <RotateCcw size={13} />
                            <span>بازگردانی</span>
                          </button>

                          <button
                            onClick={() => {
                              setEditingHistoryItem(item);
                              setHistoryForm({ ...item });
                              setShowHistoryModal(true);
                            }}
                            title="ویرایش سابقه"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors"
                          >
                            <Edit3 size={15} />
                          </button>

                          <button
                            onClick={() => handleDeleteHistoryItem(item.id)}
                            title="حذف سابقه"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {/* Summary & Description */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed text-slate-700">
                        {item.summary && (
                          <div className="p-3 bg-white rounded-xl border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 mb-1">خلاصه کلی عملکرد:</span>
                            <p className="text-slate-800 text-justify">{item.summary}</p>
                          </div>
                        )}

                        {item.description && (
                          <div className="p-3 bg-white rounded-xl border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-400 mb-1">توضیحات تکمیلی:</span>
                            <p className="text-slate-700 text-justify">{item.description}</p>
                          </div>
                        )}
                      </div>

                      {/* Expert Notes if present */}
                      {(item.professorNotes || item.supervisorNotes || item.criticNotes) && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px]">
                          {item.professorNotes && (
                            <div className="p-2.5 bg-slate-100/70 rounded-xl border border-slate-200">
                              <span className="font-bold text-slate-600 block text-[10px]">استاد پژوهش:</span>
                              <p className="text-slate-700 mt-0.5">{item.professorNotes}</p>
                            </div>
                          )}
                          {item.supervisorNotes && (
                            <div className="p-2.5 bg-slate-100/70 rounded-xl border border-slate-200">
                              <span className="font-bold text-slate-600 block text-[10px]">استاد راهنما:</span>
                              <p className="text-slate-700 mt-0.5">{item.supervisorNotes}</p>
                            </div>
                          )}
                          {item.criticNotes && (
                            <div className="p-2.5 bg-indigo-50/70 rounded-xl border border-indigo-100">
                              <span className="font-bold text-indigo-800 block text-[10px]">استاد ناقد:</span>
                              <p className="text-indigo-950 mt-0.5">{item.criticNotes}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="text-[10px] text-slate-400 font-medium text-left">
                        تاریخ آرشیو: {new Date(item.archivedAt).toLocaleDateString('fa-IR')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RESEARCH SKILLS FOR STUDENT */}
          {activeTab === 'skills' && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Award size={18} className="text-emerald-600" />
                    پایش و ارزیابی مهارت‌های پژوهشی {selStudentObj?.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    علامت‌گذاری مهارت‌های احراز شده از بانک مهارت‌های تعریف‌شده در سیستم
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSkillSettingsModal(true)}
                  className="px-3.5 py-2 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-200 flex items-center gap-1.5"
                >
                  <Settings size={15} className="text-emerald-600" />
                  <span>مدیریت بانک مهارت‌های پژوهشی</span>
                </button>
              </div>

              {/* If no skill defs exist in the bank */}
              {skillDefs.length === 0 ? (
                <div className="py-12 px-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                  <Award size={40} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">هنوز هیچ مهارتی در بانک مهارت‌های پژوهشی تعریف نشده است.</p>
                  <p className="text-[11px] text-slate-400">
                    جهت تعریف مهارت‌های پژوهشی که برای همه طلاب قابل انتخاب باشد، وارد بخش تنظیمات بانک مهارت‌ها شوید.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowSkillSettingsModal(true)}
                    className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 inline-flex items-center gap-1.5"
                  >
                    <Plus size={15} />
                    <span>تعریف مهارت در بانک مهارت‌ها</span>
                  </button>
                </div>
              ) : (
                /* Skill Checklist Grouped by Category */
                <div className="space-y-6">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <CheckSquare size={16} className="text-emerald-600" />
                    تیک زدن مهارت‌های احراز شده برای این طلبه:
                  </h4>

                  {categoriesList.map((cat) => {
                    const catSkills = skillDefs.filter(s => (s.category || 'عمومی') === cat);
                    if (catSkills.length === 0) return null;

                    return (
                      <div key={cat} className="space-y-3 bg-slate-50/60 p-4 rounded-2xl border border-slate-200/80">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            {cat}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            {catSkills.filter(sk => studentSkills?.skillIds?.includes(sk.id)).length} از {catSkills.length} مهارت
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {catSkills.map((sk) => {
                            const isAcquired = studentSkills?.skillIds?.includes(sk.id);
                            return (
                              <button
                                key={sk.id}
                                type="button"
                                onClick={() => handleToggleSkill(sk.id)}
                                className={cn(
                                  "p-3 rounded-xl border text-right transition-all flex items-start gap-3 cursor-pointer group",
                                  isAcquired
                                    ? "bg-emerald-50 border-emerald-300 shadow-sm text-emerald-950 font-bold"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                                )}
                              >
                                <div className={cn(
                                  "w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                                  isAcquired ? "bg-emerald-600 border-emerald-600 text-white" : "border-slate-300 bg-white group-hover:border-slate-400"
                                )}>
                                  {isAcquired && <Check size={13} strokeWidth={3} />}
                                </div>
                                <div className="space-y-0.5 min-w-0">
                                  <span className="text-xs leading-snug block">{sk.title}</span>
                                  {sk.description && (
                                    <span className="text-[10px] text-slate-400 font-normal block truncate">{sk.description}</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Custom Student Skills Tags */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <label className="block text-xs font-bold text-slate-700">
                  مهارت‌های متفرقه / ویژه این طلبه:
                </label>
                <div className="flex gap-2 max-w-md">
                  <input 
                    type="text"
                    placeholder="مثلا: تسلط بر درایه نور، فیش‌برداری موضوعی..."
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    value={customSkillInput}
                    onChange={(e) => setCustomSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomSkill();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomSkill}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
                  >
                    افزودن
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {studentSkills?.customSkills?.map((cs) => (
                    <span key={cs} className="px-3 py-1.5 bg-emerald-100 text-emerald-900 rounded-xl text-xs font-bold border border-emerald-200 flex items-center gap-1.5">
                      <span>{cs}</span>
                      <button onClick={() => handleRemoveCustomSkill(cs)} className="text-emerald-700 hover:text-rose-600 transition-colors">
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                  {(!studentSkills?.customSkills || studentSkills.customSkills.length === 0) && (
                    <span className="text-[11px] text-slate-400 italic">مهارت متفرقه‌ای ثبت نشده است.</span>
                  )}
                </div>
              </div>

              {/* Notes and Explanations Textarea */}
              <div className="pt-6 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles size={16} className="text-amber-500" />
                    توضیحات و ارزیابی تفصیلی درباره مهارت‌های پژوهشی طلبه:
                  </label>
                  {skillSaveStatus === 'saved' && (
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      ✓ ذخیره شد
                    </span>
                  )}
                </div>

                <textarea
                  rows={4}
                  placeholder="ملاحظات، استعدادها، علایق موضوعی، نقاط قوت در نگارش یا روش تحقیق و توصیه‌های آموزشی استاد درباره این طلبه..."
                  className="w-full p-4 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 text-xs leading-relaxed text-slate-800 bg-slate-50/50"
                  value={studentSkills?.notes || ''}
                  onChange={(e) => handleUpdateSkillNotes(e.target.value)}
                  onBlur={() => studentSkills && saveStudentSkills(studentSkills)}
                />
                <p className="text-[10px] text-slate-400">
                  نکته: این توضیحات پس از ویرایش به‌صورت خودکار ذخیره می‌شوند و در گزارش PDF پژوهشی قابل مشاهده هستند.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="py-24 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 text-sm space-y-2">
          <GraduationCap size={48} className="mx-auto text-slate-300" />
          <p className="font-bold text-slate-600">برای مشاهده، ثبت و مدیریت وضعیت پژوهشی، لطفا ابتدا یک طلبه را انتخاب کنید.</p>
        </div>
      )}

      {/* --- MODAL SKILL BANK SETTINGS --- */}
      <AnimatePresence>
        {showSkillSettingsModal && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto" 
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">تنظیمات و مدیریت بانک مهارت‌های پژوهشی</h3>
                    <p className="text-[11px] text-slate-500">مهارت‌های تعریف‌شده در این بانک برای تمام طلاب در بخش پژوهش نمایش داده می‌شوند.</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setShowSkillSettingsModal(false);
                    setEditingSkill(null);
                    setSkillForm({ title: '', category: 'روش و ابزار', description: '' });
                  }} 
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form to Add or Edit a Skill */}
              <form onSubmit={handleSaveSkillDef} className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-4 text-xs">
                <h4 className="font-bold text-emerald-950 flex items-center gap-1.5">
                  {editingSkill ? <Edit2 size={15} /> : <Plus size={15} />}
                  <span>{editingSkill ? 'ویرایش مهارت' : 'افزودن مهارت جدید به بانک'}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">عنوان مهارت *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="عنوان مهارت (مثال: فیش‌برداری موضوعی)"
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold bg-white"
                      value={skillForm.title} 
                      onChange={(e) => setSkillForm({ ...skillForm, title: e.target.value })} 
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">دسته‌بندی</label>
                    <select 
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-medium"
                      value={skillForm.category}
                      onChange={(e) => setSkillForm({ ...skillForm, category: e.target.value })}
                    >
                      <option value="روش و ابزار">روش و ابزار</option>
                      <option value="نگارش و ویرایش">نگارش و ویرایش</option>
                      <option value="نرمافزار و دیجیتال">نرمافزار و دیجیتال</option>
                      <option value="زبان و ترجمه">زبان و ترجمه</option>
                      <option value="عمومی">عمومی</option>
                      {categoriesList
                        .filter(c => !['روش و ابزار', 'نگارش و ویرایش', 'نرمافزار و دیجیتال', 'زبان و ترجمه', 'عمومی'].includes(c))
                        .map(c => <option key={c} value={c}>{c}</option>)
                      }
                      <option value="__NEW__">+ تعریف دسته‌بندی جدید...</option>
                    </select>
                  </div>
                </div>

                {skillForm.category === '__NEW__' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">نام دسته‌بندی جدید *</label>
                    <input 
                      type="text"
                      required
                      placeholder="مثال: کار با هوش مصنوعی"
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-bold"
                      value={customCategoryInput}
                      onChange={(e) => setCustomCategoryInput(e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">توضیح کوتاه (اختیاری)</label>
                  <input 
                    type="text" 
                    placeholder="توضیح مختصر درباره این مهارت..."
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    value={skillForm.description} 
                    onChange={(e) => setSkillForm({ ...skillForm, description: e.target.value })} 
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button type="submit" className="px-5 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-md shadow-emerald-100 transition-all">
                    {editingSkill ? 'ذخیره تغییرات مهارت' : 'افزودن به بانک'}
                  </button>
                  {editingSkill && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingSkill(null);
                        setSkillForm({ title: '', category: 'روش و ابزار', description: '' });
                      }} 
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300"
                    >
                      انصراف از ویرایش
                    </button>
                  )}
                </div>
              </form>

              {/* List of Skill Definitions in Bank grouped by category */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-800">لیست مهارت‌های ثبت شده در بانک ({skillDefs.length} مهارت):</h4>

                {skillDefs.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    هنوز مهارتی ثبت نشده است. از فرم بالا مهارت جدید اضافه کنید.
                  </p>
                ) : (
                  categoriesList.map((catName) => {
                    const catSkills = skillDefs.filter(s => (s.category || 'عمومی') === catName);
                    if (catSkills.length === 0) return null;

                    return (
                      <div key={catName} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <span className="text-xs font-black text-slate-800 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                            {catName}
                            <span className="text-[10px] font-normal text-slate-400">({catSkills.length} مهارت)</span>
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleStartRenameCategory(catName)}
                              className="px-2 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg flex items-center gap-1 transition-colors border border-indigo-200"
                              title="ویرایش نام دسته‌بندی"
                            >
                              <FolderEdit size={13} />
                              <span>تغییر نام دسته</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(catName)}
                              className="px-2 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center gap-1 transition-colors border border-rose-200"
                              title="حذف دسته‌بندی و مهارت‌های آن"
                            >
                              <FolderMinus size={13} />
                              <span>حذف دسته</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {catSkills.map((sk) => (
                            <div key={sk.id} className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-sm">
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate">{sk.title}</p>
                                {sk.description && (
                                  <p className="text-[10px] text-slate-400 truncate">{sk.description}</p>
                                )}
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSkill(sk);
                                    setSkillForm({
                                      title: sk.title,
                                      category: sk.category || 'روش و ابزار',
                                      description: sk.description || ''
                                    });
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="ویرایش مهارت"
                                >
                                  <Edit3 size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSkillDef(sk.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="حذف مهارت"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 text-left">
                <button
                  type="button"
                  onClick={() => setShowSkillSettingsModal(false)}
                  className="px-6 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800"
                >
                  بستن
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL EDIT CATEGORY RENAME --- */}
      <AnimatePresence>
        {showCategoryEditModal && editingCategory && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-[60] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4" 
              dir="rtl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900">ویرایش نام دسته‌بندی</h3>
                <button onClick={() => setShowCategoryEditModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleConfirmRenameCategory} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">نام دسته‌بندی جدید *</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    value={editingCategory.newName} 
                    onChange={(e) => setEditingCategory({ ...editingCategory, newName: e.target.value })} 
                  />
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                  <button type="submit" className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700">
                    ذخیره نام جدید
                  </button>
                  <button type="button" onClick={() => setShowCategoryEditModal(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold">
                    انصراف
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 1: Archive Active Research Confirmation */}
      <AnimatePresence>
        {showArchiveConfirmModal && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5" dir="rtl">
              <div className="flex items-center gap-3 text-amber-600 border-b border-slate-100 pb-3">
                <Archive size={24} />
                <h3 className="text-lg font-black text-slate-900">انتقال مقاله فعلی به سوابق و آرشیو</h3>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                با تایید این فرم، اطلاعات مقاله «<strong className="text-slate-900">{research?.topic}</strong>» به سوابق پژوهش طلبه اضافه شده و پرونده مقاله فعلی جهت ثبت فعالیت جدید خالی می‌شود.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">دوره / سال تحصیلی مقاله:</label>
                  <input 
                    type="text"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                    placeholder="مثلا: سال ۱۴۰۴-۱۴۰۳ یا پایه ۹"
                    value={archiveYearPeriod}
                    onChange={(e) => setArchiveYearPeriod(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">خلاصه کلی جهت درج در سوابق (اختیاری):</label>
                  <textarea 
                    rows={3}
                    className="w-full p-3 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="خلاصه ای از دستاورد، رتبه یا کیفیت علمی این مقاله..."
                    value={archiveSummary}
                    onChange={(e) => setArchiveSummary(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={handleConfirmArchiveActive} 
                  className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl font-bold text-xs hover:bg-amber-700 shadow-md shadow-amber-100"
                >
                  تأیید و انتقال به سوابق
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowArchiveConfirmModal(false)} 
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200"
                >
                  انصراف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: Add or Edit History Item */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto" dir="rtl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900">
                  {editingHistoryItem ? 'ویرایش سابقه پژوهشی' : 'ثبت مستقیم سابقه پژوهشی جدید'}
                </h3>
                <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveHistoryItem} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">موضوع مقاله / سابقه پژوهشی *</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                    value={historyForm.topic || ''} 
                    onChange={(e) => setHistoryForm({ ...historyForm, topic: e.target.value })} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">سال / دوره تحصیلی</label>
                    <input 
                      type="text" 
                      placeholder="مثال: سال ۱۴۰۳-۱۴۰۲"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                      value={historyForm.academicYearOrPeriod || ''} 
                      onChange={(e) => setHistoryForm({ ...historyForm, academicYearOrPeriod: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">امتیاز / رتبه</label>
                    <input 
                      type="text" 
                      placeholder="مثلا: ۹۰ یا برگزیده جشنواره"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                      value={historyForm.score || ''} 
                      onChange={(e) => setHistoryForm({ ...historyForm, score: e.target.value })} 
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">خلاصه دستاورد و سوابق</label>
                  <textarea 
                    rows={2} 
                    placeholder="خلاصه ای درباره مقاله یا فعالیت پژوهشی..."
                    className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500" 
                    value={historyForm.summary || ''} 
                    onChange={(e) => setHistoryForm({ ...historyForm, summary: e.target.value })} 
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">توضیحات تفصیلی</label>
                  <textarea 
                    rows={3} 
                    className="w-full p-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500" 
                    value={historyForm.description || ''} 
                    onChange={(e) => setHistoryForm({ ...historyForm, description: e.target.value })} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">نظر استاد پژوهش</label>
                    <textarea 
                      rows={2} 
                      className="w-full p-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500" 
                      value={historyForm.professorNotes || ''} 
                      onChange={(e) => setHistoryForm({ ...historyForm, professorNotes: e.target.value })} 
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">نظر استاد ناقد</label>
                    <textarea 
                      rows={2} 
                      className="w-full p-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500" 
                      value={historyForm.criticNotes || ''} 
                      onChange={(e) => setHistoryForm({ ...historyForm, criticNotes: e.target.value })} 
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                  <button type="submit" className="flex-1 py-2.5 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700">
                    {editingHistoryItem ? 'ذخیره تغییرات' : 'ثبت سابقه'}
                  </button>
                  <button type="button" onClick={() => setShowHistoryModal(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold">
                    انصراف
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: Student PDF Report Options Modal */}
      <AnimatePresence>
        {showStudentPdfModal && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5" dir="rtl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Printer size={18} className="text-emerald-600" />
                  گزارش‌گیری PDF تخصصی برای {selStudentObj?.name}
                </h3>
                <button onClick={() => setShowStudentPdfModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <p className="text-xs text-slate-600">
                مشخص کنید کدام بخش‌ها در فایل PDF گزارش درج شوند:
              </p>

              <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-slate-800">
                  <input 
                    type="checkbox"
                    checked={pdfIncludeActive}
                    onChange={(e) => setPdfIncludeActive(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>۱. پرونده پژوهشی فعال (مقاله امسال)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-slate-800">
                  <input 
                    type="checkbox"
                    checked={pdfIncludeHistory}
                    onChange={(e) => setPdfIncludeHistory(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>۲. سوابق و آرشیو پژوهش ({historyItems.length} مورد)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-slate-800">
                  <input 
                    type="checkbox"
                    checked={pdfIncludeSkills}
                    onChange={(e) => setPdfIncludeSkills(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>۳. مهارت‌های پژوهشی و ملاحظات</span>
                </label>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadStudentPDF}
                  disabled={isExporting || (!pdfIncludeActive && !pdfIncludeHistory && !pdfIncludeSkills)}
                  className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-100 disabled:opacity-50"
                >
                  {isExporting ? 'در حال آماده‌سازی...' : 'دانلود فایل PDF'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowStudentPdfModal(false)}
                  className="py-3 px-4 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200"
                >
                  انصراف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HIDDEN PRINT PREVIEW FOR INDIVIDUAL STUDENT PDF REPORT */}
      <div style={{ position: 'fixed', left: '-9999px', top: '0px', width: '850px', zIndex: -1000, pointerEvents: 'none', opacity: 0 }}>
        <div ref={studentReportRef} className="p-8 space-y-8 bg-white font-sans" dir="rtl">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-6 text-center space-y-2">
            <h1 className="text-2xl font-black text-slate-900">پرونده تخصصی پژوهش و مهارت‌های علمی</h1>
            <div className="flex items-center justify-center gap-6 text-xs text-slate-600 font-bold pt-2">
              <span>نام طلبه: <strong className="text-slate-900">{selStudentObj?.name}</strong></span>
              <span>پایه تحصیلی: <strong className="text-slate-900">{selStudentObj?.grade || 'نامشخص'}</strong></span>
              <span>تاریخ گزارش: <strong className="text-slate-900">{new Date().toLocaleDateString('fa-IR')}</strong></span>
            </div>
          </div>

          {/* Section 1: Active Research */}
          {pdfIncludeActive && research && (
            <div className="space-y-4 border border-slate-200 rounded-2xl p-5 bg-slate-50/50 break-inside-avoid">
              <h2 className="text-sm font-black text-indigo-900 border-b border-slate-200 pb-2">
                ۱. وضعیت و مقاله پژوهشی فعال (سال جاری)
              </h2>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-bold text-slate-500">موضوع پژوهش:</span>
                  <p className="font-black text-slate-900 text-sm mt-0.5">{research.topic || 'ثبت نشده'}</p>
                </div>
                <div>
                  <span className="font-bold text-slate-500">مرحله و امتیاز:</span>
                  <p className="font-bold text-slate-800 mt-0.5">{research.stage || '---'} {research.score ? `(امتیاز: ${research.score})` : ''}</p>
                </div>
              </div>

              {research.description && (
                <div className="text-xs">
                  <span className="font-bold text-slate-500">توضیحات روند پژوهش:</span>
                  <p className="text-slate-800 leading-relaxed mt-0.5">{research.description}</p>
                </div>
              )}

              {(research.professorNotes || research.supervisorNotes || research.criticNotes) && (
                <div className="grid grid-cols-3 gap-3 text-xs pt-2 border-t border-slate-200">
                  {research.professorNotes && (
                    <div>
                      <span className="font-bold text-slate-500">استاد پژوهش:</span>
                      <p className="text-slate-800 mt-0.5">{research.professorNotes}</p>
                    </div>
                  )}
                  {research.supervisorNotes && (
                    <div>
                      <span className="font-bold text-slate-500">استاد راهنما:</span>
                      <p className="text-slate-800 mt-0.5">{research.supervisorNotes}</p>
                    </div>
                  )}
                  {research.criticNotes && (
                    <div>
                      <span className="font-bold text-slate-500">استاد ناقد:</span>
                      <p className="text-slate-800 mt-0.5">{research.criticNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Section 2: Research History */}
          {pdfIncludeHistory && historyItems.length > 0 && (
            <div className="space-y-4 border border-slate-200 rounded-2xl p-5 bg-slate-50/50 break-inside-avoid">
              <h2 className="text-sm font-black text-amber-900 border-b border-slate-200 pb-2">
                ۲. سوابق و آرشیو پژوهش‌های گذشته ({historyItems.length} مورد)
              </h2>

              <div className="space-y-3">
                {historyItems.map((h, i) => (
                  <div key={h.id} className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-slate-900">{i + 1}. «{h.topic}»</span>
                      <span className="text-amber-800">{h.academicYearOrPeriod || '---'}</span>
                    </div>
                    {h.summary && <p className="text-slate-700 text-justify">{h.summary}</p>}
                    {h.score && <span className="text-[10px] text-emerald-700 font-bold">امتیاز: {h.score}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Research Skills */}
          {pdfIncludeSkills && (
            <div className="space-y-4 border border-slate-200 rounded-2xl p-5 bg-slate-50/50 break-inside-avoid">
              <h2 className="text-sm font-black text-emerald-900 border-b border-slate-200 pb-2">
                ۳. مهارت‌های پژوهشی و ملاحظات اساتید
              </h2>

              <div className="space-y-3">
                <div>
                  <span className="text-xs font-bold text-slate-600 block mb-2">مهارت‌های احراز شده:</span>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {studentSkills?.skillIds?.map(skId => {
                      const def = skillDefs.find(s => s.id === skId);
                      return (
                        <span key={skId} className="px-2.5 py-1 bg-emerald-100 text-emerald-950 font-bold rounded-lg border border-emerald-300">
                          ✓ {def?.title || skId}
                        </span>
                      );
                    })}
                    {studentSkills?.customSkills?.map(cs => (
                      <span key={cs} className="px-2.5 py-1 bg-emerald-100 text-emerald-950 font-bold rounded-lg border border-emerald-300">
                        ✓ {cs}
                      </span>
                    ))}
                  </div>
                </div>

                {studentSkills?.notes && (
                  <div className="pt-2 text-xs">
                    <span className="font-bold text-slate-600 block mb-1">توضیحات و ارزیابی تفصیلی اساتید:</span>
                    <p className="p-3 bg-white rounded-xl border border-slate-200 text-slate-800 leading-relaxed text-justify">
                      {studentSkills.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 5: Add Conversation Archive */}
      <AnimatePresence>
        {showArchiveModal && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-lg font-bold text-slate-900 mb-4 text-right">ثبت آرشیو نشست/پیگیری حضوری</h3>
              <form onSubmit={handleAddArchive} className="space-y-4 text-right text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">خلاصه گفتگو و توافقات</label>
                  <textarea rows={5} required className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500" value={newArchive} onChange={(e) => setNewArchive(e.target.value)} />
                </div>
                <div className="flex items-center gap-3 mt-6">
                  <button type="submit" className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700">ثبت در آرشیو</button>
                  <button type="button" onClick={() => setShowArchiveModal(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold">انصراف</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 6: Team Selection Modal */}
      <AnimatePresence>
        {showTeamModal && (
          <div className="fixed inset-0 bg-[#00000080] flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-slate-900">انتخاب هم‌گروهی‌ها</h3>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="جستجو..."
                    className="pr-8 pl-4 py-1.5 text-xs border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 w-40"
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
                          <p className="text-xs font-bold text-slate-800">{student.name}</p>
                          <p className="text-[10px] text-slate-400">پایه {student.grade}</p>
                        </div>
                      </label>
                    );
                  })}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <button 
                  onClick={() => setShowTeamModal(false)}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100"
                >
                  تایید و بازگشت
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 7: Manager Comprehensive Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 bg-white z-[100] overflow-y-auto print:p-0" dir="rtl">
            <div className="max-w-5xl mx-auto p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12 print:hidden">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-600 p-3 rounded-2xl text-white">
                    <Printer size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">گزارش جامع مدیریتی پژوهش طلاب</h2>
                    <p className="text-xs text-slate-400">لیست تمامی مقالات و فعالیت‌های پژوهشی فعال کل طلاب</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleDownloadManagerPDF}
                    disabled={isExporting}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                  >
                    <Download size={16} />
                    <span>{isExporting ? 'در حال آماده‌سازی...' : 'دانلود گزارش (PDF)'}</span>
                  </button>
                  <button 
                    onClick={() => setShowReportModal(false)}
                    className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-200 transition-all"
                  >
                    بستن
                  </button>
                </div>
              </div>

              <div ref={reportRef} className="space-y-8 pb-20 p-4">
                {/* Print Header */}
                <div className="text-center mb-10">
                  <h1 className="text-2xl font-black text-slate-900 mb-2">گزارش وضعیت پژوهشی طلاب</h1>
                  <p className="text-xs text-slate-500">تاریخ تهیه گزارش: {new Date().toLocaleDateString('fa-IR')}</p>
                  <div className="mt-4 border-b-2 border-slate-900 w-32 mx-auto"></div>
                </div>

                {allResearchRecords.length === 0 ? (
                  <div className="text-center py-24 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-slate-400">
                    <AlertCircle size={48} className="mx-auto mb-4 opacity-20" />
                    <p>هیچ دیتایی برای نمایش وجود ندارد.</p>
                  </div>
                ) : (
                  allResearchRecords.map((rec, idx) => (
                    <div key={rec.id} className="border border-slate-200 rounded-2xl p-6 bg-white break-inside-avoid shadow-sm hover:shadow-md transition-all">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 flex items-center justify-center bg-slate-900 text-white rounded-xl text-xs font-bold">{idx + 1}</span>
                          <div>
                            <h3 className="text-base font-black text-slate-800">{rec.studentName}</h3>
                            <p className="text-[11px] text-slate-400 font-bold">پایه تحصیلی: {rec.studentGrade}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-bold border border-emerald-100">
                            {rec.stage}
                          </span>
                          {rec.score && (
                            <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-bold border border-amber-100">
                              امتیاز: {rec.score}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4 text-xs">
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold mb-1 uppercase">موضوع پژوهش</p>
                            <p className="font-black text-slate-800">{rec.topic || 'ثبت نشده'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400 font-bold mb-1 uppercase">خلاصه و توضیحات</p>
                            <p className="text-slate-600 leading-relaxed text-justify">{rec.description || 'توضیحاتی برای این پژوهش ثبت نشده است.'}</p>
                          </div>
                          {rec.usages && rec.usages.length > 0 && (
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold mb-2 uppercase">موارد استفاده</p>
                              <div className="flex flex-wrap gap-1.5">
                                {rec.usages.map(u => (
                                  <span key={u} className="px-2.5 py-0.5 bg-slate-50 text-slate-600 rounded-lg border border-slate-100 text-[10px] font-bold">{u}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-100 text-xs">
                          <div>
                            <p className="text-[10px] text-indigo-600 font-black mb-2 uppercase">ارزیابی نهایی استاد ناقد</p>
                            <p className="text-slate-600 italic leading-relaxed bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                              {rec.criticNotes || 'هنوز ارزیابی توسط استاد ناقد انجام نشده است.'}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold mb-0.5">نظر استاد پژوهش:</p>
                              <p className="text-[10px] text-slate-600">{rec.professorNotes || '---'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold mb-0.5">نظر استاد راهنما:</p>
                              <p className="text-[10px] text-slate-600">{rec.supervisorNotes || '---'}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
