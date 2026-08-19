import React from 'react';
import { 
  Award, 
  TrendingUp, 
  TrendingDown, 
  BookOpen, 
  MessageSquare, 
  Calculator,
  CalendarCheck,
  Percent,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight
} from 'lucide-react';
import { Student, StudyPeriod, PeriodicStudyLog } from '../../types';
import { getLogMetrics } from './studyUtils';
import { RankingModalData } from './RankingModal';
import { cn } from '../../lib/utils';

interface DashboardAnalyticsProps {
  students: Student[];
  periods: StudyPeriod[];
  allLogs: PeriodicStudyLog[];
  onOpenRankingModal: (data: RankingModalData) => void;
}

export default function DashboardAnalytics({
  students,
  periods,
  allLogs,
  onOpenRankingModal
}: DashboardAnalyticsProps) {
  const totalPeriodsCount = periods.length;

  // Student metrics map across ALL periods
  const studentMetricsMap = new Map<string, { 
    totalMin: number; 
    studyMin: number; 
    discMin: number; 
    participatedCount: number;
    commitmentRate: number;
  }>();

  students.forEach(s => {
    studentMetricsMap.set(s.id, { 
      totalMin: 0, 
      studyMin: 0, 
      discMin: 0, 
      participatedCount: 0,
      commitmentRate: 0
    });
  });

  allLogs.forEach(l => {
    const entry = studentMetricsMap.get(l.studentId);
    if (entry) {
      const m = getLogMetrics(l);
      entry.totalMin += m.totalMinutes;
      entry.studyMin += m.studyMinutes;
      entry.discMin += m.discussionMinutes;
      if (m.totalMinutes > 0) {
        entry.participatedCount += 1;
      }
    }
  });

  // Calculate commitment % for each student
  students.forEach(s => {
    const entry = studentMetricsMap.get(s.id)!;
    entry.commitmentRate = totalPeriodsCount > 0 
      ? Math.round((entry.participatedCount / totalPeriodsCount) * 100) 
      : 0;
  });

  // 1. Sorted by Total (High to Low)
  const sortedByTotalHigh = [...students]
    .map(s => ({ student: s, metrics: studentMetricsMap.get(s.id)! }))
    .filter(x => x.metrics.totalMin > 0)
    .sort((a, b) => b.metrics.totalMin - a.metrics.totalMin);

  // 2. Sorted by Total (Low to High)
  const sortedByTotalLow = [...students]
    .map(s => ({ student: s, metrics: studentMetricsMap.get(s.id)! }))
    .sort((a, b) => a.metrics.totalMin - b.metrics.totalMin);

  // 3. Sorted by Study (High to Low)
  const sortedByStudy = [...students]
    .map(s => ({ student: s, metrics: studentMetricsMap.get(s.id)! }))
    .filter(x => x.metrics.studyMin > 0)
    .sort((a, b) => b.metrics.studyMin - a.metrics.studyMin);

  // 4. Sorted by Discussion (High to Low)
  const sortedByDisc = [...students]
    .map(s => ({ student: s, metrics: studentMetricsMap.get(s.id)! }))
    .filter(x => x.metrics.discMin > 0)
    .sort((a, b) => b.metrics.discMin - a.metrics.discMin);

  // 5. Sorted by Commitment (High to Low)
  const sortedByCommitmentHigh = [...students]
    .map(s => ({ student: s, metrics: studentMetricsMap.get(s.id)! }))
    .sort((a, b) => {
      if (b.metrics.commitmentRate !== a.metrics.commitmentRate) {
        return b.metrics.commitmentRate - a.metrics.commitmentRate;
      }
      return b.metrics.totalMin - a.metrics.totalMin;
    });

  // 6. Sorted by Commitment (Low to High)
  const sortedByCommitmentLow = [...students]
    .map(s => ({ student: s, metrics: studentMetricsMap.get(s.id)! }))
    .sort((a, b) => {
      if (a.metrics.commitmentRate !== b.metrics.commitmentRate) {
        return a.metrics.commitmentRate - b.metrics.commitmentRate;
      }
      return a.metrics.totalMin - b.metrics.totalMin;
    });

  const topTotalStudent = sortedByTotalHigh[0];
  const lowestTotalStudent = sortedByTotalLow[0];
  const topStudyStudent = sortedByStudy[0];
  const topDiscStudent = sortedByDisc[0];
  const topCommitmentStudent = sortedByCommitmentHigh[0];
  const lowestCommitmentStudent = sortedByCommitmentLow[0];

  // Ranking handlers
  const handleOpenTotalHighRanking = () => {
    onOpenRankingModal({
      title: 'رتبه‌بندی بیشترین مجموع کل در تمام دوره‌ها',
      metricLabel: 'مجموع کل دقایق (مطالعه + مباحثه)',
      items: sortedByTotalHigh.map((item, idx) => ({
        rank: idx + 1,
        studentId: item.student.id,
        name: item.student.name,
        grade: item.student.grade || '---',
        displayValue: `${item.metrics.totalMin.toLocaleString('fa-IR')} دقیقه`,
        studyValue: `${item.metrics.studyMin.toLocaleString('fa-IR')} د`,
        discussionValue: `${item.metrics.discMin.toLocaleString('fa-IR')} د`
      }))
    });
  };

  const handleOpenTotalLowRanking = () => {
    onOpenRankingModal({
      title: 'رتبه‌بندی کمترین مجموع کل در تمام دوره‌ها',
      metricLabel: 'کمترین مجموع کل دقایق',
      items: sortedByTotalLow.map((item, idx) => ({
        rank: idx + 1,
        studentId: item.student.id,
        name: item.student.name,
        grade: item.student.grade || '---',
        displayValue: `${item.metrics.totalMin.toLocaleString('fa-IR')} دقیقه`,
        studyValue: `${item.metrics.studyMin.toLocaleString('fa-IR')} د`,
        discussionValue: `${item.metrics.discMin.toLocaleString('fa-IR')} د`
      }))
    });
  };

  const handleOpenStudyRanking = () => {
    onOpenRankingModal({
      title: 'رتبه‌بندی بیشترین مطالعه فردی در تمام دوره‌ها',
      metricLabel: 'دقایق مطالعه فردی',
      items: sortedByStudy.map((item, idx) => ({
        rank: idx + 1,
        studentId: item.student.id,
        name: item.student.name,
        grade: item.student.grade || '---',
        displayValue: `${item.metrics.studyMin.toLocaleString('fa-IR')} دقیقه`,
        discussionValue: `${item.metrics.discMin.toLocaleString('fa-IR')} د مباحثه`
      }))
    });
  };

  const handleOpenDiscRanking = () => {
    onOpenRankingModal({
      title: 'رتبه‌بندی بیشترین مباحثه در تمام دوره‌ها',
      metricLabel: 'دقایق مباحثه',
      items: sortedByDisc.map((item, idx) => ({
        rank: idx + 1,
        studentId: item.student.id,
        name: item.student.name,
        grade: item.student.grade || '---',
        displayValue: `${item.metrics.discMin.toLocaleString('fa-IR')} دقیقه`,
        studyValue: `${item.metrics.studyMin.toLocaleString('fa-IR')} د مطالعه`
      }))
    });
  };

  const handleOpenCommitmentHighRanking = () => {
    onOpenRankingModal({
      title: 'رتبه‌بندی بیشترین تعهد به ثبت در تمام دوره‌ها',
      metricLabel: 'درصد تعهد و تعداد دوره‌های فعال',
      items: sortedByCommitmentHigh.map((item, idx) => ({
        rank: idx + 1,
        studentId: item.student.id,
        name: item.student.name,
        grade: item.student.grade || '---',
        displayValue: `${item.metrics.commitmentRate}٪ (${item.metrics.participatedCount} از ${totalPeriodsCount} دوره)`,
        studyValue: `${item.metrics.totalMin.toLocaleString('fa-IR')} د کل`
      }))
    });
  };

  const handleOpenCommitmentLowRanking = () => {
    onOpenRankingModal({
      title: 'رتبه‌بندی کمترین تعهد به ثبت در تمام دوره‌ها',
      metricLabel: 'درصد تعهد و تعداد دوره‌های فعال',
      items: sortedByCommitmentLow.map((item, idx) => ({
        rank: idx + 1,
        studentId: item.student.id,
        name: item.student.name,
        grade: item.student.grade || '---',
        displayValue: `${item.metrics.commitmentRate}٪ (${item.metrics.participatedCount} از ${totalPeriodsCount} دوره)`,
        studyValue: `${item.metrics.totalMin.toLocaleString('fa-IR')} د کل`
      }))
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-600" />
          <h3 className="text-xs font-black text-slate-800">
            شاخص‌های آماری و برترین‌های کل دوره‌های مطالعاتی ({totalPeriodsCount} دوره)
          </h3>
        </div>
        <span className="text-[10px] font-bold text-slate-400">
          برای مشاهده لیست رتبه‌بندی روی هر کارت کلیک کنید
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {/* 1. بیشترین مجموع کل */}
        <div 
          onClick={handleOpenTotalHighRanking}
          className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-amber-300 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-2 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <Award size={18} />
            </div>
            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg">
              رتبه ۱ کل
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">بیشترین مجموع کل</p>
            <h4 className="text-xs font-black text-slate-800 mt-0.5 truncate">
              {topTotalStudent ? topTotalStudent.student.name : '---'}
            </h4>
            <p className="text-[11px] font-black text-amber-600 mt-0.5">
              {topTotalStudent ? `${topTotalStudent.metrics.totalMin.toLocaleString('fa-IR')} د` : '۰'}
            </p>
          </div>
        </div>

        {/* 2. کمترین مجموع کل */}
        <div 
          onClick={handleOpenTotalLowRanking}
          className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-rose-300 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-2 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingDown size={18} />
            </div>
            <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg">
              کمترین
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">کمترین مجموع کل</p>
            <h4 className="text-xs font-black text-slate-800 mt-0.5 truncate">
              {lowestTotalStudent ? lowestTotalStudent.student.name : '---'}
            </h4>
            <p className="text-[11px] font-black text-rose-600 mt-0.5">
              {lowestTotalStudent ? `${lowestTotalStudent.metrics.totalMin.toLocaleString('fa-IR')} د` : '۰'}
            </p>
          </div>
        </div>

        {/* 3. بیشترین مطالعه فردی */}
        <div 
          onClick={handleOpenStudyRanking}
          className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-indigo-300 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-2 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookOpen size={18} />
            </div>
            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg">
              مطالعه
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">بیشترین مطالعه فردی</p>
            <h4 className="text-xs font-black text-slate-800 mt-0.5 truncate">
              {topStudyStudent ? topStudyStudent.student.name : '---'}
            </h4>
            <p className="text-[11px] font-black text-indigo-600 mt-0.5">
              {topStudyStudent ? `${topStudyStudent.metrics.studyMin.toLocaleString('fa-IR')} د` : '۰'}
            </p>
          </div>
        </div>

        {/* 4. بیشترین مباحثه */}
        <div 
          onClick={handleOpenDiscRanking}
          className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-emerald-300 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-2 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <MessageSquare size={18} />
            </div>
            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
              مباحثه
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">بیشترین مباحثه</p>
            <h4 className="text-xs font-black text-slate-800 mt-0.5 truncate">
              {topDiscStudent ? topDiscStudent.student.name : '---'}
            </h4>
            <p className="text-[11px] font-black text-emerald-600 mt-0.5">
              {topDiscStudent ? `${topDiscStudent.metrics.discMin.toLocaleString('fa-IR')} د` : '۰'}
            </p>
          </div>
        </div>

        {/* 5. بیشترین میزان تعهد به ثبت */}
        <div 
          onClick={handleOpenCommitmentHighRanking}
          className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-blue-300 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-2 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <CheckCircle2 size={18} />
            </div>
            <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg">
              بیشترین تعهد
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">بیشترین تعهد به ثبت</p>
            <h4 className="text-xs font-black text-slate-800 mt-0.5 truncate">
              {topCommitmentStudent ? topCommitmentStudent.student.name : '---'}
            </h4>
            <p className="text-[11px] font-black text-blue-600 mt-0.5">
              {topCommitmentStudent ? `${topCommitmentStudent.metrics.commitmentRate}٪ (${topCommitmentStudent.metrics.participatedCount} دوره)` : '۰٪'}
            </p>
          </div>
        </div>

        {/* 6. کمترین میزان تعهد به ثبت */}
        <div 
          onClick={handleOpenCommitmentLowRanking}
          className="bg-white p-4 rounded-2xl border border-slate-100 hover:border-purple-300 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-2 relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
              <AlertTriangle size={18} />
            </div>
            <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg">
              کمترین تعهد
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">کمترین تعهد به ثبت</p>
            <h4 className="text-xs font-black text-slate-800 mt-0.5 truncate">
              {lowestCommitmentStudent ? lowestCommitmentStudent.student.name : '---'}
            </h4>
            <p className="text-[11px] font-black text-purple-600 mt-0.5">
              {lowestCommitmentStudent ? `${lowestCommitmentStudent.metrics.commitmentRate}٪ (${lowestCommitmentStudent.metrics.participatedCount} دوره)` : '۰٪'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
