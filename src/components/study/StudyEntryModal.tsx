import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, ChevronDown, CheckCircle2, Info, BookOpen, MessageSquare, Calculator, FileSpreadsheet, Upload, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import * as XLSX from 'xlsx';
import { Student, StudyPeriod, PeriodicStudyLog } from '../../types';
import { localDb } from '../../lib/localDb';
import { cn } from '../../lib/utils';

interface StudyEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingPeriod: StudyPeriod | null;
  students: Student[];
  allLogs: PeriodicStudyLog[];
  currentMentorId: string;
  onSaveSuccess: () => void;
}

export default function StudyEntryModal({
  isOpen,
  onClose,
  editingPeriod,
  students,
  allLogs,
  currentMentorId,
  onSaveSuccess
}: StudyEntryModalProps) {
  const [periodTitle, setPeriodTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [mandatoryHours, setMandatoryHours] = useState<number>(0);
  
  // Store study and discussion minutes per studentId
  const [entryStudyValues, setEntryStudyValues] = useState<Record<string, string>>({});
  const [entryDiscussionValues, setEntryDiscussionValues] = useState<Record<string, string>>({});
  const [excelImportResult, setExcelImportResult] = useState<{ matchedCount: number; totalRows: number } | null>(null);
  
  // All active students fetched from DB for matching
  const [allActiveStudents, setAllActiveStudents] = useState<Student[]>(students);

  // Excel Preview Modal States
  const [excelRows, setExcelRows] = useState<any[][] | null>(null);
  const [showExcelPreviewModal, setShowExcelPreviewModal] = useState(false);
  const [selectedNameCol, setSelectedNameCol] = useState<number>(0);
  const [selectedPhoneCol, setSelectedPhoneCol] = useState<number>(1);
  const [selectedGradeCol, setSelectedGradeCol] = useState<number>(2);
  const [selectedStudyCol, setSelectedStudyCol] = useState<number>(3);
  const [selectedDiscCol, setSelectedDiscCol] = useState<number>(4);
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [maxColsCount, setMaxColsCount] = useState<number>(6);
  const [manualStudentOverrides, setManualStudentOverrides] = useState<Record<number, string>>({}); // rowIndex -> studentId

  const studyInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const discussionInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (isOpen) {
      setExcelImportResult(null);
      setShowExcelPreviewModal(false);
      setExcelRows(null);
      setManualStudentOverrides({});
      setSelectedGradeFilter('all');

      // Fetch all active students from localDb to ensure no active student is missed regardless of UI filters
      localDb.getDocs<Student>('students').then(list => {
        const active = list.filter(s => s.isActive !== false);
        const mergedMap = new Map<string, Student>();
        students.forEach(s => mergedMap.set(s.id, s));
        active.forEach(s => mergedMap.set(s.id, s));
        setAllActiveStudents(Array.from(mergedMap.values()));
      }).catch(err => {
        console.error("Error fetching all active students:", err);
        setAllActiveStudents(students);
      });

      if (editingPeriod) {
        setPeriodTitle(editingPeriod.title || '');
        setStartDate(editingPeriod.startDate || '');
        setEndDate(editingPeriod.endDate || '');
        setMandatoryHours(Math.round((editingPeriod.mandatoryHours || 0) * 60));

        const pLogs = allLogs.filter(l => l.periodId === editingPeriod.id);
        const studyMap: Record<string, string> = {};
        const discMap: Record<string, string> = {};

        pLogs.forEach(l => {
          const sMin = l.studyHours !== undefined ? Math.round(l.studyHours * 60) : Math.round((l.hours || 0) * 60);
          const dMin = l.discussionHours !== undefined ? Math.round(l.discussionHours * 60) : 0;
          if (sMin > 0) studyMap[l.studentId] = sMin.toString();
          if (dMin > 0) discMap[l.studentId] = dMin.toString();
        });

        setEntryStudyValues(studyMap);
        setEntryDiscussionValues(discMap);
      } else {
        setPeriodTitle('');
        setStartDate('');
        setEndDate('');
        setMandatoryHours(0);
        setEntryStudyValues({});
        setEntryDiscussionValues({});
      }
    }
  }, [isOpen, editingPeriod, allLogs, students]);

  const normalizePhone = (val: any): string => {
    if (val === null || val === undefined) return '';
    let str = String(val).trim()
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .replace(/[٠-٩]/g, d => '٠١٢٣۴٥٦٧۸٩'.indexOf(d).toString())
      .replace(/\D/g, '');

    if (str.startsWith('98') && str.length === 12) {
      str = '0' + str.slice(2);
    } else if (str.length === 10 && str.startsWith('9')) {
      str = '0' + str;
    }
    return str;
  };

  const normalizePersian = (val: any): string => {
    if (val === null || val === undefined) return '';
    return String(val)
      .trim()
      .replace(/[يى]/g, 'ی')
      .replace(/ك/g, 'ک')
      .replace(/[آأإ]/g, 'ا')
      .replace(/[\u200c\u200b]/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase();
  };

  const getPhoneLast9 = (val: any): string => {
    const norm = normalizePhone(val);
    if (norm.length >= 9) {
      return norm.slice(-9);
    }
    return norm;
  };

  const isNameMatch = (excelName: string, studentName: string): boolean => {
    const normExcel = normalizePersian(excelName);
    const normStudent = normalizePersian(studentName);

    if (!normExcel || !normStudent) return false;

    // Exact match
    if (normExcel === normStudent) return true;

    // Substring match
    if (normExcel.includes(normStudent) || normStudent.includes(normExcel)) {
      return true;
    }

    // Token set overlap
    const filterStop = (t: string) => t.length > 1 && !['سید', 'میر', 'شیخ', 'حجت', 'الاسلام'].includes(t);
    const excelTokens = normExcel.split(' ').filter(filterStop);
    const studentTokens = normStudent.split(' ').filter(filterStop);

    if (excelTokens.length === 0 || studentTokens.length === 0) return false;

    let matches = 0;
    studentTokens.forEach(st => {
      if (excelTokens.some(et => et === st || et.includes(st) || st.includes(et))) {
        matches++;
      }
    });

    if (studentTokens.length >= 2 && matches >= 2) return true;
    if (studentTokens.length === 1 && matches === 1 && normExcel.length < 25) return true;

    return false;
  };

  const availableGradesList = useMemo(() => {
    const setG = new Set<string>();

    allActiveStudents.forEach(s => {
      if (s.grade && s.grade.trim()) {
        setG.add(s.grade.trim());
      }
    });

    if (excelRows) {
      excelRows.forEach((row, rIdx) => {
        if (!row || !Array.isArray(row) || rIdx < 1) return;
        const cell = row[selectedGradeCol];
        if (cell !== null && cell !== undefined) {
          const str = String(cell).trim();
          const norm = normalizePersian(str);
          if (str.length > 0 && str.length < 20 && !norm.includes('نام') && !norm.includes('تلفن') && !norm.includes('ساعت')) {
            setG.add(str);
          }
        }
      });
    }

    return Array.from(setG).sort((a, b) => a.localeCompare(b, 'fa'));
  }, [allActiveStudents, excelRows, selectedGradeCol]);

  const isGradeMatchFilter = (excelGradeVal: any, studentGradeVal: string, filter: string): boolean => {
    if (!filter || filter === 'all') return true;

    const normFilter = normalizePersian(filter).replace(/پایه\s*/g, '').trim();
    if (!normFilter) return true;

    const normExcel = normalizePersian(excelGradeVal).replace(/پایه\s*/g, '').trim();
    const normStudent = normalizePersian(studentGradeVal).replace(/پایه\s*/g, '').trim();

    if (normExcel && (normExcel === normFilter || normExcel.includes(normFilter) || normFilter.includes(normExcel))) {
      return true;
    }
    if (normStudent && (normStudent === normFilter || normStudent.includes(normFilter) || normFilter.includes(normStudent))) {
      return true;
    }

    return false;
  };

  const parseHoursOrMinutes = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    let str = String(val).trim()
      .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
      .replace(/[٠-٩]/g, d => '٠١٢٣۴٥٦٧۸٩'.indexOf(d).toString());

    const num = parseFloat(str);
    if (isNaN(num) || num <= 0) return 0;

    // If <= 24 (e.g. 1.5 hours, 2 hours, 0.5 hours), convert hours to minutes (* 60)
    // If > 24 (e.g. 90 minutes, 120 minutes), treat directly as minutes
    if (num <= 24) {
      return Math.round(num * 60);
    }
    return Math.round(num);
  };

  const autoDetectColumns = (rows: any[][]) => {
    let nameCol = -1;
    let phoneCol = -1;
    let gradeCol = -1;
    let studyCol = -1;
    let discCol = -1;
    let totalCol = -1;
    let maxCols = 0;

    rows.forEach((row, rIdx) => {
      if (!row || !Array.isArray(row)) return;
      if (row.length > maxCols) maxCols = row.length;

      if (rIdx < 12) {
        row.forEach((cell, cIdx) => {
          if (cell === null || cell === undefined) return;
          const txt = normalizePersian(cell);

          // Name column
          if (nameCol === -1 && (txt.includes('نام') || txt.includes('طالب') || txt.includes('دانشجو') || txt.includes('فامیلی') || txt.includes('نام و خانوادگی'))) {
            if (!txt.includes('پدر') && !txt.includes('استاد') && !txt.includes('مدرسه')) {
              nameCol = cIdx;
            }
          }

          // Phone column
          if (phoneCol === -1 && (txt.includes('موبایل') || txt.includes('همراه') || txt.includes('تلفن') || txt.includes('تماس') || txt.includes('phone') || txt.includes('mobile'))) {
            phoneCol = cIdx;
          }

          // Grade column
          if (gradeCol === -1 && (txt.includes('پایه') || txt.includes('کلاس') || txt.includes('پايه') || txt.includes('grade'))) {
            gradeCol = cIdx;
          }

          // Total column
          if (totalCol === -1 && (txt.includes('مجموع') || txt.includes('جمع') || txt.includes('کل') || txt.includes('total'))) {
            totalCol = cIdx;
          }

          // Discussion column (must not contain total/sum)
          if (discCol === -1 && (txt.includes('مباحثه') || txt.includes('مباحثات') || txt.includes('discussion')) && !txt.includes('مجموع') && !txt.includes('جمع') && !txt.includes('کل')) {
            discCol = cIdx;
          }

          // Study column (must not contain total/sum)
          if (studyCol === -1 && (txt.includes('مطالعه') || txt.includes('مطالعات') || txt.includes('درس') || txt.includes('study')) && !txt.includes('مجموع') && !txt.includes('جمع') && !txt.includes('کل')) {
            studyCol = cIdx;
          }
        });
      }
    });

    if (nameCol === -1) nameCol = 0; // Default Column A
    if (phoneCol === -1) phoneCol = 1; // Default Column B
    if (gradeCol === -1) gradeCol = 2; // Default Column C

    if (studyCol === -1 || discCol === -1) {
      if (totalCol === phoneCol + 2) {
        if (studyCol === -1) studyCol = phoneCol + 3;
        if (discCol === -1) discCol = phoneCol + 4;
      } else {
        if (studyCol === -1) studyCol = phoneCol + 2;
        if (discCol === -1) discCol = phoneCol + 3;
      }
    }

    return {
      nameCol,
      phoneCol,
      gradeCol,
      studyCol,
      discCol,
      maxCols: Math.max(maxCols, 8)
    };
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        if (!buffer) return;

        const wb = XLSX.read(buffer, { type: 'array' });
        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          alert('فایل اکسل خالی یا نامعتبر است.');
          return;
        }

        // Combine all sheets in workbook
        let allCombinedRows: any[][] = [];
        wb.SheetNames.forEach(sheetName => {
          const worksheet = wb.Sheets[sheetName];
          if (worksheet) {
            const sheetRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
            if (sheetRows && sheetRows.length > 0) {
              allCombinedRows = allCombinedRows.concat(sheetRows);
            }
          }
        });

        if (!allCombinedRows || allCombinedRows.length === 0) {
          alert('هیچ داده‌ای در فایل اکسل یافت نشد.');
          return;
        }

        const { nameCol, phoneCol, gradeCol, studyCol, discCol, maxCols } = autoDetectColumns(allCombinedRows);

        setExcelRows(allCombinedRows);
        setSelectedNameCol(nameCol);
        setSelectedPhoneCol(phoneCol);
        setSelectedGradeCol(gradeCol);
        setSelectedStudyCol(studyCol);
        setSelectedDiscCol(discCol);
        setMaxColsCount(maxCols);
        setManualStudentOverrides({});
        setSelectedGradeFilter('all');
        setShowExcelPreviewModal(true);
      } catch (err) {
        console.error("Excel import error:", err);
        alert("خطا در پردازش فایل اکسل.");
      } finally {
        e.target.value = '';
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const getMatchedAndUnmatchedRows = () => {
    if (!excelRows) return { matchedList: [], unmatchedRows: [] };

    const matchedList: {
      studentId: string;
      studentName: string;
      grade: string;
      phone: string;
      studyMin: number;
      discMin: number;
      totalMin: number;
      rowIndex: number;
      matchMethod: 'تلفن' | 'نام' | 'دستی' | 'کد ملی';
    }[] = [];

    const unmatchedRows: {
      rowIndex: number;
      rowText: string;
      phoneCandidate: string;
      studyMin: number;
      discMin: number;
      totalMin: number;
    }[] = [];

    const matchedStudentIds = new Set<string>();

    excelRows.forEach((row, rIdx) => {
      if (!row || !Array.isArray(row) || row.length === 0) return;

      const nameCell = row[selectedNameCol];
      const phoneCell = row[selectedPhoneCol];
      const gradeCell = row[selectedGradeCol];
      const studyCell = row[selectedStudyCol];
      const discCell = row[selectedDiscCol];

      const studyMin = parseHoursOrMinutes(studyCell);
      const discMin = parseHoursOrMinutes(discCell);
      const totalMin = studyMin + discMin;

      // Skip row if completely empty or header-like with 0 values
      if (studyMin === 0 && discMin === 0 && rIdx < 5) {
        return;
      }

      let matchedStudent: Student | null = null;
      let matchMethod: 'تلفن' | 'نام' | 'دستی' | 'کد ملی' = 'تلفن';

      // 0. Check Manual Override
      if (manualStudentOverrides[rIdx]) {
        matchedStudent = allActiveStudents.find(s => s.id === manualStudentOverrides[rIdx]) || null;
        if (matchedStudent) matchMethod = 'دستی';
      }

      // 1. Phone Match
      if (!matchedStudent) {
        const phoneStr = normalizePhone(phoneCell);
        const rowLast9 = getPhoneLast9(phoneStr);
        if (rowLast9 && rowLast9.length >= 7) {
          matchedStudent = allActiveStudents.find(s => {
            const sp = getPhoneLast9(s.phoneNumber || (s as any).phone || (s as any).mobile || '');
            return sp && sp === rowLast9;
          }) || null;
          if (matchedStudent) matchMethod = 'تلفن';
        }
      }

      // 2. Name Match
      if (!matchedStudent && nameCell !== undefined) {
        const textVal = String(nameCell).trim();
        if (textVal.length >= 2) {
          matchedStudent = allActiveStudents.find(s => isNameMatch(textVal, s.name)) || null;
          if (matchedStudent) matchMethod = 'نام';
        }
      }

      // 3. Scan all cells in row for Phone or Name
      if (!matchedStudent) {
        for (let c = 0; c < row.length; c++) {
          const cellVal = row[c];
          if (cellVal === null || cellVal === undefined) continue;

          // Check Phone in cell
          const cellLast9 = getPhoneLast9(cellVal);
          if (cellLast9 && cellLast9.length >= 7) {
            matchedStudent = allActiveStudents.find(s => {
              const sp = getPhoneLast9(s.phoneNumber || (s as any).phone || (s as any).mobile || '');
              return sp && sp === cellLast9;
            }) || null;
            if (matchedStudent) {
              matchMethod = 'تلفن';
              break;
            }
          }

          // Check Name in cell
          const cellTxt = String(cellVal).trim();
          if (cellTxt.length >= 3) {
            matchedStudent = allActiveStudents.find(s => isNameMatch(cellTxt, s.name)) || null;
            if (matchedStudent) {
              matchMethod = 'نام';
              break;
            }
          }
        }
      }

      // 4. Check Grade Filter
      if (selectedGradeFilter !== 'all') {
        const isMatchG = isGradeMatchFilter(gradeCell, matchedStudent ? matchedStudent.grade || '' : '', selectedGradeFilter);
        if (!isMatchG) {
          return;
        }
      }

      if (matchedStudent && !matchedStudentIds.has(matchedStudent.id)) {
        matchedStudentIds.add(matchedStudent.id);
        matchedList.push({
          studentId: matchedStudent.id,
          studentName: matchedStudent.name,
          grade: matchedStudent.grade || '---',
          phone: matchedStudent.phoneNumber || normalizePhone(phoneCell) || '---',
          studyMin,
          discMin,
          totalMin,
          rowIndex: rIdx,
          matchMethod
        });
      } else if (!matchedStudent && (studyMin > 0 || discMin > 0 || (nameCell && String(nameCell).trim().length > 1))) {
        const rowTextParts = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '').map(c => String(c).trim());
        unmatchedRows.push({
          rowIndex: rIdx,
          rowText: rowTextParts.slice(0, 4).join(' | '),
          phoneCandidate: normalizePhone(phoneCell) || '---',
          studyMin,
          discMin,
          totalMin
        });
      }
    });

    return { matchedList, unmatchedRows };
  };

  const handleConfirmExcelImport = () => {
    const { matchedList } = getMatchedAndUnmatchedRows();
    if (matchedList.length === 0) {
      alert('هیچ یک از طلاب تطابق داده نشدند. لطفاً ستون‌های نام یا شماره همراه را تنظیم کرده یا طلاب را دستی انتخاب کنید.');
      return;
    }

    const newStudyMap: Record<string, string> = { ...entryStudyValues };
    const newDiscMap: Record<string, string> = { ...entryDiscussionValues };

    matchedList.forEach(row => {
      if (row.studyMin > 0) {
        newStudyMap[row.studentId] = row.studyMin.toString();
      }
      if (row.discMin > 0) {
        newDiscMap[row.studentId] = row.discMin.toString();
      }
    });

    setEntryStudyValues(newStudyMap);
    setEntryDiscussionValues(newDiscMap);
    setExcelImportResult({ matchedCount: matchedList.length, totalRows: excelRows ? excelRows.length : 0 });
    setShowExcelPreviewModal(false);
  };

  const handleKeyDownStudy = (e: React.KeyboardEvent, index: number, studentId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Move to discussion input of the same student
      discussionInputRefs.current[studentId]?.focus();
    }
  };

  const handleKeyDownDiscussion = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Move to study input of the next student
      const nextIndex = index + 1;
      const nextStudentId = students[nextIndex]?.id;
      if (nextStudentId) {
        studyInputRefs.current[nextStudentId]?.focus();
      }
    }
  };

  const handleSavePeriod = async () => {
    if (!periodTitle.trim() || !startDate || !endDate || mandatoryHours <= 0) {
      alert('لطفاً تمامی مشخصات دوره را به دقت وارد کنید (میزان موظفی به دقیقه باید بزرگتر از صفر باشد).');
      return;
    }

    try {
      const mandatoryInHours = mandatoryHours / 60;

      if (editingPeriod) {
        // Update existing period
        await localDb.updateDoc('study_periods', editingPeriod.id, {
          title: periodTitle.trim(),
          startDate,
          endDate,
          mandatoryHours: mandatoryInHours,
          updatedAt: new Date().toISOString()
        });

        const existingPeriodLogs = allLogs.filter(l => l.periodId === editingPeriod.id);

        for (const student of students) {
          const sMin = parseFloat(entryStudyValues[student.id] || '0') || 0;
          const dMin = parseFloat(entryDiscussionValues[student.id] || '0') || 0;
          const totMin = sMin + dMin;
          const sHours = sMin / 60;
          const dHours = dMin / 60;
          const totHours = totMin / 60;

          const existingLog = existingPeriodLogs.find(l => l.studentId === student.id);

          if (existingLog) {
            if (totMin > 0) {
              await localDb.updateDoc('periodic_study_logs', existingLog.id, {
                hours: totHours,
                studyHours: sHours,
                discussionHours: dHours
              });
            } else {
              await localDb.deleteDoc('periodic_study_logs', existingLog.id);
            }
          } else if (totMin > 0) {
            await localDb.addDoc('periodic_study_logs', {
              periodId: editingPeriod.id,
              studentId: student.id,
              hours: totHours,
              studyHours: sHours,
              discussionHours: dHours
            });
          }
        }
      } else {
        // Create new period
        const periodId = await localDb.addDoc('study_periods', {
          title: periodTitle.trim(),
          startDate,
          endDate,
          mandatoryHours: mandatoryInHours,
          mentorId: currentMentorId,
          createdAt: new Date().toISOString()
        });

        for (const student of students) {
          const sMin = parseFloat(entryStudyValues[student.id] || '0') || 0;
          const dMin = parseFloat(entryDiscussionValues[student.id] || '0') || 0;
          const totMin = sMin + dMin;
          const sHours = sMin / 60;
          const dHours = dMin / 60;
          const totHours = totMin / 60;

          if (totMin > 0) {
            await localDb.addDoc('periodic_study_logs', {
              periodId,
              studentId: student.id,
              hours: totHours,
              studyHours: sHours,
              discussionHours: dHours
            });
          }
        }
      }

      onSaveSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving period:", error);
      alert("خطا در ذخیره‌سازی اطلاعات دوره");
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 lg:p-10" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-[36px] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Modal Header */}
          <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-indigo-200">
                <Clock size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800">
                  {editingPeriod ? 'ویرایش دوره مطالعاتی' : 'ثبت دوره‌ای مطالعات و مباحثات'}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  ثبت مستقل دقایق مطالعه و مباحثه طلاب به همراه محاسبه هوشمند مجموع و مقایسه با موظفی
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-3 text-slate-400 hover:bg-slate-100 rounded-2xl transition-colors"
            >
              <ChevronDown size={24} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
            {/* Period Settings */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-black text-slate-600">عنوان دوره (مثلاً هفته اول آبان)</label>
                <input 
                  type="text"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-800 text-sm"
                  placeholder="عنوان دوره را وارد کنید..."
                  value={periodTitle}
                  onChange={(e) => setPeriodTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600">تاریخ شروع</label>
                <DatePicker
                  calendar={persian}
                  locale={persian_fa}
                  calendarPosition="bottom-right"
                  inputClass="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-800 text-sm"
                  value={startDate}
                  onChange={(date) => setStartDate(date?.toDate?.().toISOString() || '')}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-600">تاریخ پایان</label>
                <DatePicker
                  calendar={persian}
                  locale={persian_fa}
                  calendarPosition="bottom-right"
                  inputClass="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-800 text-sm"
                  value={endDate}
                  onChange={(date) => setEndDate(date?.toDate?.().toISOString() || '')}
                />
              </div>
              <div className="md:col-span-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-600">میزان موظفی دوره (برحسب دقیقه - ملاک مقایسه با مجموع مطالعه + مباحثه)</label>
                  <span className="text-[11px] font-bold text-indigo-600">
                    {mandatoryHours > 0 ? `معادل ${(mandatoryHours / 60).toFixed(1)} ساعت` : ''}
                  </span>
                </div>
                <input 
                  type="number"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-800 text-sm"
                  placeholder="مثلاً 2100 دقیقه"
                  value={mandatoryHours || ''}
                  onChange={(e) => setMandatoryHours(parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Excel Auto Import Section */}
              <div className="md:col-span-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-sm shadow-emerald-200">
                    <FileSpreadsheet size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800">ورود خودکار ساعت/دقایق مطالعه و مباحثه از فایل اکسل</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                      بر بر پایه شماره همراه (ستون B)، مطالعه (ستون D) و مباحثه (ستون E) برای طلاب فعال
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                  <label className="cursor-pointer px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-emerald-200 flex items-center gap-2">
                    <Upload size={16} />
                    <span>بارگذاری فایل اکسل</span>
                    <input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      className="hidden" 
                      onChange={handleExcelUpload}
                    />
                  </label>
                </div>
              </div>

              {/* Excel Import Result Banner */}
              {excelImportResult && (
                <div className="md:col-span-4 p-3.5 bg-indigo-50 border border-indigo-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs font-bold text-indigo-900 shadow-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    <span>
                      ساعات مطالعه و مباحثه برای <b>{excelImportResult.matchedCount.toLocaleString('fa-IR')}</b> طلبه فعال بر اساس شماره همراه با موفقیت از اکسل جایگذاری گردید.
                    </span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setExcelImportResult(null)}
                    className="w-6 h-6 rounded-full hover:bg-indigo-100 flex items-center justify-center text-slate-400 hover:text-slate-600 text-sm font-black shrink-0 transition-colors"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* Students List Entry with Side-by-Side Study & Discussion Inputs */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <BookOpen size={16} className="text-indigo-600" />
                  <span>ثبت دقایق مطالعه و مباحثه طلاب فعال ({students.length} نفر)</span>
                </h4>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                  <Info size={14} className="text-indigo-500" />
                  <span>با زدن اینتر به فیلد بعدی / طلبه بعدی بروید.</span>
                </div>
              </div>

              {/* Table Header Labels */}
              <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 bg-slate-100 rounded-xl text-xs font-black text-slate-600">
                <div className="col-span-4">نام و پایه طلبه</div>
                <div className="col-span-3 text-center flex items-center justify-center gap-1">
                  <BookOpen size={13} className="text-indigo-600" />
                  <span>دقایق مطالعه</span>
                </div>
                <div className="col-span-3 text-center flex items-center justify-center gap-1">
                  <MessageSquare size={13} className="text-emerald-600" />
                  <span>دقایق مباحثه</span>
                </div>
                <div className="col-span-2 text-center flex items-center justify-center gap-1">
                  <Calculator size={13} className="text-slate-600" />
                  <span>مجموع کل</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 max-h-[450px] overflow-y-auto pr-1">
                {students.map((student, idx) => {
                  const sVal = parseFloat(entryStudyValues[student.id] || '0') || 0;
                  const dVal = parseFloat(entryDiscussionValues[student.id] || '0') || 0;
                  const totVal = sVal + dVal;

                  return (
                    <div 
                      key={student.id} 
                      className="p-3.5 bg-white border border-slate-200 hover:border-indigo-200 rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-3 items-center transition-all shadow-xs"
                    >
                      {/* Student Info */}
                      <div className="col-span-1 md:col-span-4 flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 text-xs font-black shrink-0">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{student.name}</p>
                          <p className="text-[10px] text-slate-400">پایه: {student.grade || '---'}</p>
                        </div>
                      </div>

                      {/* Study Input */}
                      <div className="col-span-1 md:col-span-3">
                        <div className="relative">
                          <input 
                            ref={el => studyInputRefs.current[student.id] = el}
                            type="number"
                            className="w-full pr-3 pl-8 py-2 bg-indigo-50/40 border border-indigo-100 focus:border-indigo-500 focus:bg-white rounded-xl text-center font-black text-xs text-slate-800 outline-none transition-all"
                            placeholder="مطالعه (دقیقه)"
                            value={entryStudyValues[student.id] || ''}
                            onChange={(e) => setEntryStudyValues({ ...entryStudyValues, [student.id]: e.target.value })}
                            onKeyDown={(e) => handleKeyDownStudy(e, idx, student.id)}
                          />
                          <span className="absolute left-2.5 top-2.5 text-[9px] font-bold text-indigo-400">دقیقه</span>
                        </div>
                      </div>

                      {/* Discussion Input */}
                      <div className="col-span-1 md:col-span-3">
                        <div className="relative">
                          <input 
                            ref={el => discussionInputRefs.current[student.id] = el}
                            type="number"
                            className="w-full pr-3 pl-8 py-2 bg-emerald-50/40 border border-emerald-100 focus:border-emerald-500 focus:bg-white rounded-xl text-center font-black text-xs text-slate-800 outline-none transition-all"
                            placeholder="مباحثه (دقیقه)"
                            value={entryDiscussionValues[student.id] || ''}
                            onChange={(e) => setEntryDiscussionValues({ ...entryDiscussionValues, [student.id]: e.target.value })}
                            onKeyDown={(e) => handleKeyDownDiscussion(e, idx)}
                          />
                          <span className="absolute left-2.5 top-2.5 text-[9px] font-bold text-emerald-500">دقیقه</span>
                        </div>
                      </div>

                      {/* Total Sum Badge */}
                      <div className="col-span-1 md:col-span-2 flex items-center justify-center">
                        <span className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-black border transition-all text-center w-full block",
                          totVal > 0 
                            ? (mandatoryHours > 0 && totVal >= mandatoryHours 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                : "bg-indigo-50 text-indigo-700 border-indigo-200")
                            : "bg-slate-50 text-slate-400 border-slate-100"
                        )}>
                          {totVal > 0 ? `${totVal.toLocaleString('fa-IR')} د` : '۰'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-6 md:p-8 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-white text-slate-700 rounded-2xl font-bold text-xs border border-slate-200 hover:bg-slate-100 transition-all"
            >
              انصراف
            </button>
            <button 
              type="button"
              onClick={handleSavePeriod}
              className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold text-xs hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 flex items-center gap-2"
            >
              <CheckCircle2 size={18} />
              <span>{editingPeriod ? 'ذخیره تغییرات دوره' : 'ثبت نهایی دوره'}</span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Excel Column Mapping & Live Preview Modal */}
      {showExcelPreviewModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[70] flex items-center justify-center p-4 lg:p-8" dir="rtl">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-100"
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-emerald-200">
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800">تایید ستون‌ها و پیش‌نمایش بارگذاری اکسل</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    ستون‌های اطلاعات را بررسی و در صورت نیاز تنظیم کنید تا ساعات دقیقا درج شوند
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowExcelPreviewModal(false)}
                className="p-2.5 text-slate-400 hover:bg-slate-200/60 rounded-xl transition-colors"
              >
                <ChevronDown size={22} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {(() => {
                const { matchedList, unmatchedRows } = getMatchedAndUnmatchedRows();

                return (
                  <>
                    {/* Grade Filter Bar */}
                    <div className="p-4 bg-indigo-50/80 border border-indigo-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs">
                          <Filter size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-indigo-950">فیلتر پایه تحصیلی جهت وارد کردن آمار:</p>
                          <p className="text-[11px] text-indigo-700 font-bold mt-0.5">
                            {selectedGradeFilter === 'all' 
                              ? 'در حال حاضر آمار تمامی پایه‌ها استخراج و در فرم قرار می‌گیرد' 
                              : `فقط آمار مربوط به ${selectedGradeFilter.startsWith('پایه') ? selectedGradeFilter : `پایه ${selectedGradeFilter}`} استخراج خواهد شد`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          value={selectedGradeFilter}
                          onChange={(e) => setSelectedGradeFilter(e.target.value)}
                          className="px-4 py-2 bg-white border border-indigo-300 rounded-xl font-black text-xs text-indigo-900 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer"
                        >
                          <option value="all">🌟 تمامی پایه‌ها (بدون فیلتر)</option>
                          {availableGradesList.map(g => (
                            <option key={g} value={g}>
                              🎓 {g.startsWith('پایه') ? g : `پایه ${g}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Stats Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-black text-emerald-800">
                            {selectedGradeFilter === 'all' ? 'طلاب شناسایی‌شده' : `طلاب ${selectedGradeFilter.startsWith('پایه') ? selectedGradeFilter : `پایه ${selectedGradeFilter}`}`}
                          </p>
                          <p className="text-xl font-black text-emerald-700 mt-1">
                            {matchedList.length.toLocaleString('fa-IR')} نفر
                          </p>
                        </div>
                        <CheckCircle2 size={26} className="text-emerald-600" />
                      </div>

                      <div className={cn(
                        "p-4 border rounded-2xl flex items-center justify-between transition-all",
                        unmatchedRows.length > 0
                          ? "bg-amber-50/80 border-amber-200/80"
                          : "bg-slate-50 border-slate-200/80"
                      )}>
                        <div>
                          <p className="text-[11px] font-black text-amber-900">ردیف‌های نیاز به انطباق</p>
                          <p className="text-xl font-black text-amber-800 mt-1">
                            {unmatchedRows.length.toLocaleString('fa-IR')} ردیف
                          </p>
                        </div>
                        <Info size={26} className={unmatchedRows.length > 0 ? "text-amber-500" : "text-slate-400"} />
                      </div>

                      <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-black text-slate-600">کل ردیف‌های فایل اکسل</p>
                          <p className="text-xl font-black text-slate-700 mt-1">
                            {(excelRows ? excelRows.length : 0).toLocaleString('fa-IR')} ردیف
                          </p>
                        </div>
                        <FileSpreadsheet size={26} className="text-slate-400" />
                      </div>
                    </div>

                    {/* Column Mapping Selectors */}
                    <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-4">
                      <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                        <Calculator size={16} className="text-indigo-600" />
                        <span>تنظیم ستون‌های متناظر فایل اکسل:</span>
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {/* Name Column Selector */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-slate-700 block truncate">
                            👤 ستون نام و فامیلی
                          </label>
                          <select
                            value={selectedNameCol}
                            onChange={(e) => setSelectedNameCol(parseInt(e.target.value, 10))}
                            className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {Array.from({ length: maxColsCount }).map((_, idx) => {
                              const letter = String.fromCharCode(65 + idx);
                              return (
                                <option key={idx} value={idx}>
                                  ستون {letter} {idx === 0 ? '(نام)' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Phone Column Selector */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-slate-700 block truncate">
                            📱 ستون شماره همراه
                          </label>
                          <select
                            value={selectedPhoneCol}
                            onChange={(e) => setSelectedPhoneCol(parseInt(e.target.value, 10))}
                            className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {Array.from({ length: maxColsCount }).map((_, idx) => {
                              const letter = String.fromCharCode(65 + idx);
                              return (
                                <option key={idx} value={idx}>
                                  ستون {letter} {idx === 1 ? '(همراه)' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Grade Column Selector */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-slate-700 block truncate">
                            🎓 ستون پایه تحصیلی
                          </label>
                          <select
                            value={selectedGradeCol}
                            onChange={(e) => setSelectedGradeCol(parseInt(e.target.value, 10))}
                            className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {Array.from({ length: maxColsCount }).map((_, idx) => {
                              const letter = String.fromCharCode(65 + idx);
                              return (
                                <option key={idx} value={idx}>
                                  ستون {letter} {idx === 2 ? '(پایه)' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Study Column Selector */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-slate-700 block truncate">
                            📖 ستون مطالعه
                          </label>
                          <select
                            value={selectedStudyCol}
                            onChange={(e) => setSelectedStudyCol(parseInt(e.target.value, 10))}
                            className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {Array.from({ length: maxColsCount }).map((_, idx) => {
                              const letter = String.fromCharCode(65 + idx);
                              return (
                                <option key={idx} value={idx}>
                                  ستون {letter} {idx === 3 ? '(پیش‌فرض D)' : (idx === 4 ? '(ستون E)' : '')}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* Discussion Column Selector */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-slate-700 block truncate">
                            🗣️ ستون مباحثه
                          </label>
                          <select
                            value={selectedDiscCol}
                            onChange={(e) => setSelectedDiscCol(parseInt(e.target.value, 10))}
                            className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {Array.from({ length: maxColsCount }).map((_, idx) => {
                              const letter = String.fromCharCode(65 + idx);
                              return (
                                <option key={idx} value={idx}>
                                  ستون {letter} {idx === 4 ? '(پیش‌فرض E)' : (idx === 5 ? '(ستون F)' : '')}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Matched Students Table */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                          <BookOpen size={15} className="text-indigo-600" />
                          <span>طلاب انطباق داده‌شده ({matchedList.length} نفر)</span>
                        </h4>
                      </div>

                      <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                        <table className="w-full text-right border-collapse text-xs">
                          <thead className="bg-slate-100 text-slate-700 font-black sticky top-0 z-10">
                            <tr>
                              <th className="p-3">#</th>
                              <th className="p-3">نام طلبه</th>
                              <th className="p-3">پایه</th>
                              <th className="p-3">روش انطباق</th>
                              <th className="p-3 text-center">مطالعه (دقیقه)</th>
                              <th className="p-3 text-center">مباحثه (دقیقه)</th>
                              <th className="p-3 text-center">مجموع (دقیقه)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white font-bold text-slate-800">
                            {matchedList.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="p-6 text-center text-slate-400 font-medium">
                                  هیچ طلبی با ستون‌های فعلی تطابق نیافت. از منوی بالا ستون نام یا شماره همراه را تغییر دهید یا از جدول پایین تخصیص دستی انجام دهید.
                                </td>
                              </tr>
                            ) : (
                              matchedList.map((row, idx) => (
                                <tr key={row.studentId} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-3 text-slate-400 font-medium">{idx + 1}</td>
                                  <td className="p-3 font-black text-slate-900">{row.studentName}</td>
                                  <td className="p-3 text-slate-500">{row.grade}</td>
                                  <td className="p-3">
                                    <span className={cn(
                                      "px-2 py-0.5 rounded-md text-[10px] font-black inline-block",
                                      row.matchMethod === 'تلفن' && "bg-blue-50 text-blue-700 border border-blue-200",
                                      row.matchMethod === 'نام' && "bg-purple-50 text-purple-700 border border-purple-200",
                                      row.matchMethod === 'دستی' && "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    )}>
                                      انطباق با {row.matchMethod}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center text-indigo-700 bg-indigo-50/40 font-black">
                                    {row.studyMin > 0 ? `${row.studyMin.toLocaleString('fa-IR')} د` : '۰'}
                                  </td>
                                  <td className="p-3 text-center text-emerald-700 bg-emerald-50/40 font-black">
                                    {row.discMin > 0 ? `${row.discMin.toLocaleString('fa-IR')} د` : '۰'}
                                  </td>
                                  <td className="p-3 text-center font-black text-slate-900 bg-slate-50">
                                    {row.totalMin > 0 ? `${row.totalMin.toLocaleString('fa-IR')} د` : '۰'}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Unmatched Rows Section (Interactive manual assignment) */}
                    {unmatchedRows.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-amber-800 flex items-center gap-1.5">
                            <Info size={15} className="text-amber-600" />
                            <span>ردیف‌های بدون انطباق ({unmatchedRows.length} ردیف) - تخصیص دستی سریع</span>
                          </h4>
                        </div>

                        <div className="border border-amber-200 bg-amber-50/30 rounded-2xl overflow-hidden max-h-52 overflow-y-auto">
                          <table className="w-full text-right border-collapse text-xs">
                            <thead className="bg-amber-100/70 text-amber-900 font-black sticky top-0 z-10">
                              <tr>
                                <th className="p-2.5">ردیف اکسل</th>
                                <th className="p-2.5">نمونه متن ردیف</th>
                                <th className="p-2.5 text-center">مطالعه/مباحثه</th>
                                <th className="p-2.5 text-left">تخصیص به طلبه</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-100/60 bg-white font-medium text-slate-800">
                              {unmatchedRows.map((uRow) => (
                                <tr key={uRow.rowIndex} className="hover:bg-amber-50/50 transition-colors">
                                  <td className="p-2.5 font-bold text-slate-500">#{uRow.rowIndex + 1}</td>
                                  <td className="p-2.5 text-slate-700 font-bold max-w-xs truncate dir-rtl" title={uRow.rowText}>
                                    {uRow.rowText}
                                  </td>
                                  <td className="p-2.5 text-center font-bold text-slate-800">
                                    {uRow.studyMin > 0 && <span className="text-indigo-600 ml-1">{uRow.studyMin}د مطالعه</span>}
                                    {uRow.discMin > 0 && <span className="text-emerald-600">{uRow.discMin}د مباحثه</span>}
                                    {uRow.studyMin === 0 && uRow.discMin === 0 && '---'}
                                  </td>
                                  <td className="p-2.5 text-left">
                                    <select
                                      value={manualStudentOverrides[uRow.rowIndex] || ''}
                                      onChange={(e) => {
                                        const stuId = e.target.value;
                                        setManualStudentOverrides(prev => ({
                                          ...prev,
                                          [uRow.rowIndex]: stuId
                                        }));
                                      }}
                                      className="px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                      <option value="">-- انتخاب طلبه مرتبط --</option>
                                      {allActiveStudents.map(s => (
                                        <option key={s.id} value={s.id}>
                                          {s.name} ({s.grade || '---'})
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 shrink-0">
              <button 
                type="button"
                onClick={() => setShowExcelPreviewModal(false)}
                className="px-5 py-2.5 bg-white text-slate-700 rounded-xl font-bold text-xs border border-slate-200 hover:bg-slate-100 transition-all"
              >
                انصراف
              </button>
              <button 
                type="button"
                onClick={handleConfirmExcelImport}
                disabled={getMatchedAndUnmatchedRows().matchedList.length === 0}
                className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-black text-xs hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-md shadow-emerald-200 flex items-center gap-2"
              >
                <CheckCircle2 size={16} />
                <span>تایید و اِعمال در فرم ({getMatchedAndUnmatchedRows().matchedList.length} نفر)</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
