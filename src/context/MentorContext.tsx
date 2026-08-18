import React, { createContext, useContext, useState } from 'react';
import { Student } from '../types';
import { isStudentActive, getMentorKeyForGrade } from '../lib/localDb';

export type MentorId = 'hayati' | 'hosseini' | 'soleimani' | 'shahpoori';
export type ShahpooriFilter = 'all' | 'hayati' | 'hosseini' | 'soleimani';

export interface MentorInfo {
  id: MentorId;
  name: string;
  role: string;
  gradeLabel: string;
  avatarBg: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  isHeadManager?: boolean;
}

export const MENTORS: Record<MentorId, MentorInfo> = {
  hayati: {
    id: 'hayati',
    name: 'استاد حیاتی',
    role: 'مسئول پایه ۷',
    gradeLabel: 'پایه ۷',
    avatarBg: 'bg-emerald-600',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    dotColor: 'bg-emerald-500',
  },
  hosseini: {
    id: 'hosseini',
    name: 'استاد حسینی',
    role: 'مسئول پایه ۸',
    gradeLabel: 'پایه ۸',
    avatarBg: 'bg-sky-600',
    badgeBg: 'bg-sky-50',
    badgeText: 'text-sky-700',
    badgeBorder: 'border-sky-200',
    dotColor: 'bg-sky-500',
  },
  soleimani: {
    id: 'soleimani',
    name: 'استاد سلیمانی',
    role: 'مسئول پایه ۹',
    gradeLabel: 'پایه ۹',
    avatarBg: 'bg-purple-600',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-200',
    dotColor: 'bg-purple-500',
  },
  shahpoori: {
    id: 'shahpoori',
    name: 'استاد شاهپوری',
    role: 'مدیر اصلی',
    gradeLabel: 'کل پایه‌ها',
    avatarBg: 'bg-amber-600',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
    dotColor: 'bg-amber-500',
    isHeadManager: true,
  },
};

export function getStudentMentorKey(grade?: string): 'hayati' | 'hosseini' | 'soleimani' | 'other' {
  return getMentorKeyForGrade(grade);
}

interface MentorContextType {
  currentMentorId: MentorId;
  currentMentor: MentorInfo;
  setCurrentMentorId: (id: MentorId) => void;
  shahpooriFilter: ShahpooriFilter;
  setShahpooriFilter: (filter: ShahpooriFilter) => void;
  filterStudents: (students: Student[], onlyActive?: boolean) => Student[];
  getMentorForStudent: (grade?: string) => MentorInfo | null;
  isMentorModalOpen: boolean;
  setIsMentorModalOpen: (open: boolean) => void;
}

const MentorContext = createContext<MentorContextType | undefined>(undefined);

export const MentorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentMentorId, setCurrentMentorIdState] = useState<MentorId>(() => {
    const saved = localStorage.getItem('current_mentor_id') as MentorId;
    return (saved && MENTORS[saved]) ? saved : 'hayati';
  });

  const [shahpooriFilter, setShahpooriFilterState] = useState<ShahpooriFilter>(() => {
    const saved = localStorage.getItem('shahpoori_active_filter') as ShahpooriFilter;
    return saved || 'all';
  });

  const [isMentorModalOpen, setIsMentorModalOpen] = useState<boolean>(() => {
    return !localStorage.getItem('current_mentor_id');
  });

  const setCurrentMentorId = (id: MentorId) => {
    setCurrentMentorIdState(id);
    localStorage.setItem('current_mentor_id', id);
  };

  const setShahpooriFilter = (filter: ShahpooriFilter) => {
    setShahpooriFilterState(filter);
    localStorage.setItem('shahpoori_active_filter', filter);
  };

  const currentMentor = MENTORS[currentMentorId] || MENTORS.hayati;

  const getMentorForStudent = (grade?: string): MentorInfo | null => {
    const key = getStudentMentorKey(grade);
    if (key !== 'other') {
      return MENTORS[key];
    }
    return null;
  };

  const filterStudents = (students: Student[], onlyActive: boolean = true): Student[] => {
    return students.filter(s => {
      // In User Management ("مدیریت همه کاربران"), all students are shared across mentors!
      if (!onlyActive) return true;

      // For active students / other tabs:
      if (!isStudentActive(s)) return false;

      // If Shahpoori (Head Manager):
      if (currentMentorId === 'shahpoori') {
        if (shahpooriFilter === 'all') return true;
        const key = getStudentMentorKey(s.grade);
        return key === shahpooriFilter;
      }

      // For individual mentors (Hayati, Hosseini, Soleimani):
      const mentorKey = getStudentMentorKey(s.grade);
      return mentorKey === currentMentorId;
    });
  };

  return (
    <MentorContext.Provider
      value={{
        currentMentorId,
        currentMentor,
        setCurrentMentorId,
        shahpooriFilter,
        setShahpooriFilter,
        filterStudents,
        getMentorForStudent,
        isMentorModalOpen,
        setIsMentorModalOpen,
      }}
    >
      {children}
    </MentorContext.Provider>
  );
};

export const useMentor = () => {
  const context = useContext(MentorContext);
  if (!context) {
    throw new Error('useMentor must be used within a MentorProvider');
  }
  return context;
};
