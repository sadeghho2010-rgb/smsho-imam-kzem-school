export type ProgramType = 'اصلی' | 'مشاوره' | 'پژوهش' | 'دروس 5 شنبه' | 'سایر';
export type ImportanceLevel = 'low' | 'medium' | 'high';
export type AttendanceStatus = 'present' | 'absent' | 'late';

export interface Student {
  id: string;
  name: string;
  photoUrl?: string;
  nationalId?: string;
  isActive: boolean;
  phoneNumber?: string;
  grade?: string;
  fatherOccupation?: string;
  birthPlace?: string;
  birthDate?: string;
  maritalStatus?: 'مجرد' | 'متاهل';
  childrenCount?: number;
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
  mentorId?: string;
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
  needsFollowUp?: boolean;
  followUpTodoId?: string;
  updatedAt: string;
}

export interface ResearchHistoryItem {
  id: string;
  studentId: string;
  topic: string;
  type?: 'individual' | 'group';
  stage?: string;
  academicYearOrPeriod?: string;
  description?: string;
  summary?: string;
  score?: string;
  professorNotes?: string;
  supervisorNotes?: string;
  criticNotes?: string;
  usages?: string[];
  archivedAt: string;
  originalRecordSnapshot?: Partial<ResearchRecord>;
}

export interface ResearchSkillDef {
  id: string;
  title: string;
  category?: 'روش و ابزار' | 'نگارش و ویرایش' | 'نرمافزار و دیجیتال' | 'زبان و ترجمه' | 'عمومی';
  description?: string;
  createdAt?: string;
}

export interface StudentResearchSkills {
  id: string;
  studentId: string;
  skillIds: string[];
  customSkills?: string[];
  notes?: string;
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
  isResearchFollowUp?: boolean;
  isStudyFollowUp?: boolean;
  researchRecordId?: string;
  mentorId?: string;
  createdAt?: string;
}

export interface StudyPeriod {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  mandatoryHours: number;
  mentorId?: string;
  createdAt: string;
}

export interface PeriodicStudyLog {
  id: string;
  periodId: string;
  studentId: string;
  hours: number;
  studyHours?: number;
  discussionHours?: number;
}

export type CommentPriority = 'high' | 'medium' | 'low' | 'info';

export type OralExamSubjectType = 'فقه' | 'اصول' | 'امتحان ورودی' | 'سایر';

export interface OralExam {
  id: string;
  studentId: string;
  title: string;
  subjectType: OralExamSubjectType;
  score: number;
  examinerName: string;
  date: string;
  isRetake: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface StudentComment {
  id: string;
  studentId: string;
  authorName: string;
  category?: 'علمی' | 'اخلاقی' | 'انضباطی' | 'مشاوره' | 'خانوادگی' | 'عمومی';
  content: string;
  priority: CommentPriority;
  date: string;
  needsFollowUp?: boolean;
  followUpTodoId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DiscussionGroup {
  id: string;
  title: string;
  subject?: string;
  grade?: string; // 'پایه ۷' | 'پایه ۸' | 'پایه ۹' | 'پایه ۱۰'
  mentorId?: string; // 'hayati' | 'hosseini' | 'soleimani' | 'asadi' | 'shahpoori'
  memberStudentIds: string[]; // Active students in this discussion group
  externalMembers?: string[]; // External discussion partners ("سایر" / custom names)
  description?: string;
  createdAt: string;
  updatedAt?: string;
}
