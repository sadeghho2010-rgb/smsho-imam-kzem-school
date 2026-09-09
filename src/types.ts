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
  days?: string[]; // List of specific days e.g. ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه']
  time?: string;
  teacher?: string;
  mentorId?: string;
  parentProgramId?: string; // ID of the main program if type === 'مشاوره'
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

// Presence & Hours Tracking Types
export interface PresenceHoursLog {
  id: string;
  mentorId?: string;
  date: string; // Shamsi date string, e.g. "1405/06/15"
  startTime?: string; // e.g. "08:00"
  endTime?: string; // e.g. "16:30"
  durationHours: number; // e.g. 8.5
  description?: string;
  category?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PresenceCycleSettings {
  id: string;
  mentorId?: string;
  startShamsiDate: string;
  endShamsiDate: string;
  title?: string;
}

// Academic Calendar Types
export type ThursdayMode = 'special_program' | 'main_class' | 'off';

export interface ThursdayRangeSetting {
  id: string;
  startDate: string; // Shamsi YYYY/MM/DD
  endDate: string; // Shamsi YYYY/MM/DD
  mode: ThursdayMode; // 'main_class' (کلاس درس اصلی) | 'special_program' (برنامه ویژه / حضور غیردرسی) | 'off' (تعطیل)
  title?: string;
}

export interface ThursdayOverride {
  dateStr: string; // Shamsi YYYY/MM/DD
  mode: ThursdayMode; // 'special_program' | 'main_class' | 'off'
  title?: string; // Optional custom name e.g. "برنامه ویژه اخلاق", "تدریس جبرانی اصول"
  description?: string;
}

export interface AcademicCalendarPeriod {
  id: string;
  title: string; // e.g., "سال تحصیلی ۱۴۰۵-۱۴۰۶"
  startDate: string; // Shamsi YYYY/MM/DD e.g. "1405/06/15"
  endDate: string; // Shamsi YYYY/MM/DD e.g. "1406/03/20"
  description?: string;
  defaultThursdayMode?: ThursdayMode; // Fallback mode if no range matches (default: 'off')
  thursdayRanges?: ThursdayRangeSetting[]; // Range-based rules for Thursday modes
  thursdayOverrides?: Record<string, ThursdayOverride>; // Single-day overrides (dateStr -> ThursdayOverride)
  includeThursdayAsStudyDay?: boolean; // legacy compatibility
  includeFridayAsStudyDay: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AcademicHolidayType {
  id: string;
  name: string; // e.g. "تعطیلی رسمی", "تعطیلی مناسبتی", "تعطیلی تبلیغی"
  color: string; // Hex or Tailwind color token
  isSystemDefault?: boolean;
}

export interface AcademicHolidayItem {
  id: string;
  periodId: string;
  title: string;
  typeId: string;
  typeName: string;
  startDate: string; // Shamsi YYYY/MM/DD
  endDate: string; // Shamsi YYYY/MM/DD
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AcademicSubPeriod {
  id: string;
  periodId: string;
  title: string; // e.g. "هفته پژوهش", "دوره مهارتی و کارگاه‌ها"
  startDate: string; // Shamsi YYYY/MM/DD
  endDate: string; // Shamsi YYYY/MM/DD
  isAcademicPresence: boolean; // آیا حضور تحصیلی محسوب می‌شود؟ (default: true)
  isStandardClassDay: boolean; // آیا کلاس درس اصلی سرفصل برگزار می‌شود؟ (default: false)
  description?: string;
  color?: string; // e.g. "violet", "purple", "indigo", "amber", "sky"
  createdAt: string;
  updatedAt?: string;
}

export type WeekDayName = 'شنبه' | 'یکشنبه' | 'دوشنبه' | 'سه‌شنبه' | 'چهارشنبه' | 'پنج‌شنبه' | 'جمعه';

export interface AcademicWeeklyProgram {
  id: string;
  periodId: string;
  title: string; // e.g., "برنامه کارگاه پژوهش", "جلسه اخلاق هفتگی", "همایش تخصصی"
  scheduleType?: 'recurring' | 'custom_dates'; // 'recurring' (weekly) or 'custom_dates' (irregular specific dates)
  dayOfWeek?: string; // e.g. "دوشنبه" or "شنبه، چهارشنبه" (kept for legacy/display compatibility)
  daysOfWeek?: WeekDayName[]; // Multi-day selection e.g. ['دوشنبه', 'چهارشنبه']
  specificDates?: string[]; // List of YYYY/MM/DD dates for irregular custom schedules
  startDate: string; // Shamsi YYYY/MM/DD (defaults to period startDate)
  endDate: string; // Shamsi YYYY/MM/DD (defaults to period endDate)
  time?: string; // e.g. "10:00 تا 11:30"
  locationOrTeacher?: string; // e.g. "سالن اجتماعات / استاد حسینی"
  description?: string;
  customCancelledDates?: string[]; // List of YYYY/MM/DD specific dates manually cancelled for this program
  color?: string; // 'indigo' | 'emerald' | 'amber' | 'purple' | 'rose' | 'sky' | 'violet'
  createdAt: string;
  updatedAt?: string;
}

export interface AcademicCalendarExportPackage {
  _meta: {
    system: 'TOLAB_ACADEMIC_CALENDAR';
    version: string;
    exportDate: string;
    totalPeriods: number;
    totalHolidays: number;
    totalHolidayTypes: number;
    totalSubPeriods?: number;
    totalWeeklyPrograms?: number;
  };
  periods: AcademicCalendarPeriod[];
  holidays: AcademicHolidayItem[];
  holidayTypes: AcademicHolidayType[];
  subPeriods?: AcademicSubPeriod[];
  weeklyPrograms?: AcademicWeeklyProgram[];
}

export type TeacherCategory = 
  | 'فقه'
  | 'اصول'
  | 'فلسفه'
  | 'مشاوره اصول'
  | 'مشاوره فقه'
  | 'مشاوره فلسفه'
  | 'دروس پنجشنبه'
  | 'ویژه';

export interface TeacherDetailedSpecialties {
  usul?: ('رسائل' | 'کفایه' | 'حلقات')[];
  fiqh?: ('مکاسب')[];
  falsafa?: ('بدایه' | 'نهایه' | 'آموزش فلسفه')[];
  thursdayNote?: string;
}

export interface Teacher {
  id: string;
  fullName: string;
  phoneNumber?: string;
  photoUrl?: string;
  categories: TeacherCategory[];
  detailedSpecialties?: TeacherDetailedSpecialties;
  notes?: string;
  experienceHistory?: string;
  priority: 1 | 2 | 3 | '1' | '2' | '3';
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

