export type ProgramType = 'اصلی' | 'مشاوره' | 'پژوهش' | 'دروس 5 شنبه' | 'سایر';
export type ImportanceLevel = 'low' | 'medium' | 'high';
export type AttendanceStatus = 'present' | 'absent' | 'late';

export interface Student {
  id: string;
  name: string;
  nationalId?: string;
  isActive: boolean;
  phoneNumber?: string;
  grade?: string;
  fatherOccupation?: string;
  birthPlace?: string;
  birthDate?: string;
  maritalStatus?: 'مجرد' | 'متاهل';
  livingStatus?: 'پدری' | 'خوابگاه' | 'اجاره ای' | 'شخصی' | 'سایر';
  livingStatusOther?: string;
  classicEducation?: string;
  howzaEntryYear?: string;
  levelOneSchool?: string;
  tammomStatus?: 'معمم' | 'غیر معمم';
  createdAt: string;
}

export interface Program {
  id: string;
  title: string;
  type: ProgramType;
  day?: string;
  time?: string;
  teacher?: string;
}

export interface Enrollment {
  id: string;
  studentId: string;
  programId: string;
}

export interface ResearchRecord {
  id: string;
  studentId: string;
  topic?: string;
  type?: 'individual' | 'group';
  teamMemberIds?: string[];
  stage: string;
  description?: string;
  professorNotes?: string;
  supervisorNotes?: string;
  criticNotes?: string;
  score?: string;
  usages?: string[];
  updatedAt: string;
}

export interface ConversationArchive {
  id: string;
  studentId: string;
  summary: string;
  createdAt: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  date: string;
  status: AttendanceStatus;
  reason?: string;
}

export interface StudyStat {
  id: string;
  studentId: string;
  date: string;
  studyHours: number;
  discussionHours: number;
}

export interface Todo {
  id: string;
  studentId?: string;
  title: string;
  completed: boolean;
  dueDate?: string;
}
