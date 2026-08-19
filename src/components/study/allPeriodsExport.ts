import * as XLSX from 'xlsx';
import { Student, StudyPeriod, PeriodicStudyLog } from '../../types';
import { getLogMetrics, calculatePeriodAverages } from './studyUtils';

export interface AggregatedStudentData {
  rank: number;
  student: Student;
  sumStudy: number;
  sumDisc: number;
  sumTotal: number;
  activeCount: number;
  totalPeriods: number;
  commitmentRate: number;
  gradeCommitmentRate: number;
  avgTotal: number;
  avgStudy: number;
  avgDisc: number;
  gradeAvg: number;
  belowAverageCount: number;
  aboveAverageCount: number;
  statusAvg: string;
}

export function prepareAggregatedData(
  students: Student[] = [],
  periods: StudyPeriod[] = [],
  allLogs: PeriodicStudyLog[] = []
): { 
  items: AggregatedStudentData[]; 
  globalAvgMinutes: number; 
  grandTotalStudy: number; 
  grandTotalDisc: number; 
  grandTotalAll: number;
  gradeAverages: Record<string, number>;
  gradeCommitmentAverages: Record<string, number>;
} {
  const safeStudents = Array.isArray(students) ? students.filter(Boolean) : [];
  const safePeriods = Array.isArray(periods) ? periods.filter(Boolean) : [];
  const safeLogs = Array.isArray(allLogs) ? allLogs.filter(Boolean) : [];

  let grandTotalStudy = 0;
  let grandTotalDisc = 0;
  let grandTotalAll = 0;
  let totalActiveEntries = 0;

  // Precalculate period averages
  const periodAveragesMap = new Map<string, number>();
  safePeriods.forEach(p => {
    if (p && p.id) {
      const avg = calculatePeriodAverages(p.id, safeLogs);
      periodAveragesMap.set(p.id, avg.totalAvgMinutes);
    }
  });

  // Calculate grade averages across all periods
  const gradeTotals: Record<string, { totalMin: number; activeEntries: number }> = {};
  const studentMap = new Map(safeStudents.map(s => [s.id, s]));

  safeLogs.forEach(l => {
    if (!l) return;
    const m = getLogMetrics(l);
    if (m.totalMinutes > 0) {
      grandTotalStudy += m.studyMinutes;
      grandTotalDisc += m.discussionMinutes;
      grandTotalAll += m.totalMinutes;
      totalActiveEntries += 1;

      const st = studentMap.get(l.studentId);
      const grade = st?.grade || 'نامشخص';
      if (!gradeTotals[grade]) {
        gradeTotals[grade] = { totalMin: 0, activeEntries: 0 };
      }
      gradeTotals[grade].totalMin += m.totalMinutes;
      gradeTotals[grade].activeEntries += 1;
    }
  });

  const globalAvgMinutes = totalActiveEntries > 0 ? Math.round(grandTotalAll / totalActiveEntries) : 0;
  const totalPeriodsCount = safePeriods.length;

  const gradeAverages: Record<string, number> = {};
  Object.keys(gradeTotals).forEach(grade => {
    const g = gradeTotals[grade];
    gradeAverages[grade] = g && g.activeEntries > 0 ? Math.round(g.totalMin / g.activeEntries) : 0;
  });

  const rawItems = safeStudents.map((student, idx) => {
    const studentLogs = safeLogs.filter(l => l && l.studentId === student.id);
    const activeLogs = studentLogs.filter(l => (l.hours || 0) > 0 || (l.studyHours || 0) > 0 || (l.discussionHours || 0) > 0);

    let sumStudy = 0;
    let sumDisc = 0;
    let sumTotal = 0;

    activeLogs.forEach(l => {
      const m = getLogMetrics(l);
      sumStudy += m.studyMinutes;
      sumDisc += m.discussionMinutes;
      sumTotal += m.totalMinutes;
    });

    const activeCount = activeLogs.length;
    const commitmentRate = totalPeriodsCount > 0 ? Math.round((activeCount / totalPeriodsCount) * 100) : 0;
    const avgTotal = activeCount > 0 ? Math.round(sumTotal / activeCount) : 0;
    const avgStudy = activeCount > 0 ? Math.round(sumStudy / activeCount) : 0;
    const avgDisc = activeCount > 0 ? Math.round(sumDisc / activeCount) : 0;

    const studentGrade = student.grade || 'نامشخص';
    const gradeAvg = gradeAverages[studentGrade] || globalAvgMinutes;

    // Count below and above average across all periods
    let belowAverageCount = 0;
    let aboveAverageCount = 0;

    safePeriods.forEach(p => {
      if (!p || !p.id) return;
      const pAvg = periodAveragesMap.get(p.id) || 0;
      const log = studentLogs.find(l => l && l.periodId === p.id);
      const metrics = log ? getLogMetrics(log) : { totalMinutes: 0 };

      if (metrics.totalMinutes < pAvg) {
        belowAverageCount += 1;
      } else {
        aboveAverageCount += 1;
      }
    });

    let statusAvg = "بدون ثبت";
    if (avgTotal > 0) {
      statusAvg = avgTotal >= globalAvgMinutes ? "بالای میانگین" : "زیر میانگین";
    }

    return {
      rank: idx + 1,
      student,
      sumStudy,
      sumDisc,
      sumTotal,
      activeCount,
      totalPeriods: totalPeriodsCount,
      commitmentRate,
      gradeCommitmentRate: 0, // placeholder, updated next
      avgTotal,
      avgStudy,
      avgDisc,
      gradeAvg,
      belowAverageCount,
      aboveAverageCount,
      statusAvg
    };
  });

  // Compute Grade Commitment Averages
  const gradeCommitmentTotals: Record<string, { sumCommitment: number; count: number }> = {};
  rawItems.forEach(item => {
    const g = item.student?.grade || 'نامشخص';
    if (!gradeCommitmentTotals[g]) {
      gradeCommitmentTotals[g] = { sumCommitment: 0, count: 0 };
    }
    gradeCommitmentTotals[g].sumCommitment += item.commitmentRate;
    gradeCommitmentTotals[g].count += 1;
  });

  const gradeCommitmentAverages: Record<string, number> = {};
  Object.keys(gradeCommitmentTotals).forEach(g => {
    const data = gradeCommitmentTotals[g];
    gradeCommitmentAverages[g] = data.count > 0 ? Math.round(data.sumCommitment / data.count) : 0;
  });

  // Attach gradeCommitmentRate to each raw item
  rawItems.forEach(item => {
    const g = item.student?.grade || 'نامشخص';
    item.gradeCommitmentRate = gradeCommitmentAverages[g] || 0;
  });

  // Sort by total descending for rank
  const sortedItems = [...rawItems].sort((a, b) => b.sumTotal - a.sumTotal);
  const items = sortedItems.map((item, index) => ({
    ...item,
    rank: index + 1
  }));

  return {
    items,
    globalAvgMinutes,
    grandTotalStudy,
    grandTotalDisc,
    grandTotalAll,
    gradeAverages,
    gradeCommitmentAverages
  };
}

export function exportAllPeriodsToExcel(
  students: Student[],
  periods: StudyPeriod[],
  allLogs: PeriodicStudyLog[],
  mentorName?: string
) {
  if (!students || students.length === 0) {
    alert("هیچ داده‌ای برای خروجی اکسل وجود ندارد.");
    return;
  }

  const { items, globalAvgMinutes, grandTotalStudy, grandTotalDisc, grandTotalAll } = prepareAggregatedData(students, periods, allLogs);

  const formatHoursMinutes = (min: number) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m} د`;
    if (m === 0) return `${h} س`;
    return `${h}س ${m}د`;
  };

  const excelRows = items.map(item => ({
    'رتبه': item.rank,
    'نام و نام خانوادگی': item.student?.name || '---',
    'پایه تحصیلی': item.student?.grade || '---',
    'شماره تماس': item.student?.phoneNumber || '---',
    'مجموع مطالعه (دقیقه)': item.sumStudy,
    'مجموع مطالعه (ساعت و دقیقه)': formatHoursMinutes(item.sumStudy),
    'مجموع مباحثه (دقیقه)': item.sumDisc,
    'مجموع مباحثه (ساعت و دقیقه)': formatHoursMinutes(item.sumDisc),
    'مجموع کل کارکرد (دقیقه)': item.sumTotal,
    'مجموع کل (ساعت و دقیقه)': formatHoursMinutes(item.sumTotal),
    'تعداد دوره‌های فعال': item.activeCount,
    'کل دوره‌های برگزارشده': item.totalPeriods,
    'میزان تعهد به ثبت (درصد)': `${item.commitmentRate}%`,
    'میانگین تعهد به ثبت پایه (درصد)': `${item.gradeCommitmentRate}%`,
    'میانگین کل دوره (دقیقه)': item.avgTotal,
    'میانگین کل دوره (ساعت)': formatHoursMinutes(item.avgTotal),
    'میانگین کل پایه (دقیقه)': item.gradeAvg,
    'میانگین کل پایه (ساعت)': formatHoursMinutes(item.gradeAvg),
    'تعداد دفعات زیر میانگین': item.belowAverageCount,
    'تعداد دفعات بالای میانگین': item.aboveAverageCount,
    'میانگین مطالعه دوره (دقیقه)': item.avgStudy,
    'میانگین مباحثه دوره (دقیقه)': item.avgDisc,
    'وضعیت نسبت به میانگین کل': item.statusAvg
  }));

  // Summary row
  excelRows.push({
    'رتبه': 0,
    'نام و نام خانوادگی': `جمع کل مدرسه (${students.length} طلبه)`,
    'پایه تحصیلی': '-',
    'شماره تماس': '-',
    'مجموع مطالعه (دقیقه)': grandTotalStudy,
    'مجموع مطالعه (ساعت و دقیقه)': formatHoursMinutes(grandTotalStudy),
    'مجموع مباحثه (دقیقه)': grandTotalDisc,
    'مجموع مباحثه (ساعت و دقیقه)': formatHoursMinutes(grandTotalDisc),
    'مجموع کل کارکرد (دقیقه)': grandTotalAll,
    'مجموع کل (ساعت و دقیقه)': formatHoursMinutes(grandTotalAll),
    'تعداد دوره‌های فعال': items.reduce((acc, it) => acc + it.activeCount, 0),
    'کل دوره‌های برگزارشده': periods.length,
    'میزان تعهد به ثبت (درصد)': `${Math.round((items.reduce((acc, it) => acc + it.activeCount, 0) / (students.length * (periods.length || 1))) * 100)}%`,
    'میانگین تعهد به ثبت پایه (درصد)': '-',
    'میانگین کل دوره (دقیقه)': globalAvgMinutes,
    'میانگین کل دوره (ساعت)': formatHoursMinutes(globalAvgMinutes),
    'میانگین کل پایه (دقیقه)': 0,
    'میانگین کل پایه (ساعت)': '-',
    'تعداد دفعات زیر میانگین': 0,
    'تعداد دفعات بالای میانگین': 0,
    'میانگین مطالعه دوره (دقیقه)': 0,
    'میانگین مباحثه دوره (دقیقه)': 0,
    'وضعیت نسبت به میانگین کل': '-'
  });

  const worksheet = XLSX.utils.json_to_sheet(excelRows);
  worksheet['!cols'] = [
    { wch: 6 },  // رتبه
    { wch: 25 }, // نام
    { wch: 10 }, // پایه
    { wch: 15 }, // تماس
    { wch: 20 }, // مجموع مطالعه
    { wch: 22 },
    { wch: 20 }, // مجموع مباحثه
    { wch: 22 },
    { wch: 22 }, // مجموع کل
    { wch: 24 },
    { wch: 18 }, // فعال
    { wch: 20 }, // کل دوره‌ها
    { wch: 22 }, // تعهد
    { wch: 20 }, // میانگین کل
    { wch: 20 },
    { wch: 20 }, // میانگین پایه
    { wch: 20 },
    { wch: 22 }, // زیر میانگین
    { wch: 22 }, // بالای میانگین
    { wch: 20 }, // میانگین مطالعه
    { wch: 20 }, // میانگین مباحثه
    { wch: 22 }  // وضعیت
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'آمار تجمیعی تمامی دوره‌ها');

  const todayStr = new Date().toLocaleDateString('fa-IR').replace(/\//g, '-');
  XLSX.writeFile(workbook, `آمار_تجمیعی_مطالعه_و_مباحثه_تمام_دوره_ها_${todayStr}.xlsx`);
}
