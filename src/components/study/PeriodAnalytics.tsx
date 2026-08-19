import React from 'react';
import { 
  Award, 
  TrendingUp, 
  TrendingDown, 
  BookOpen, 
  MessageSquare, 
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Target,
  Sparkles
} from 'lucide-react';
import { Student, StudyPeriod, PeriodicStudyLog } from '../../types';
import { getLogMetrics, calculatePeriodAverages } from './studyUtils';
import { RankingModalData } from './RankingModal';
import { cn } from '../../lib/utils';

interface PeriodAnalyticsProps {
  period: StudyPeriod;
  students: Student[];
  allLogs: PeriodicStudyLog[];
  onOpenRankingModal: (data: RankingModalData) => void;
}

export default function PeriodAnalytics({
  period,
  students,
  allLogs,
  onOpenRankingModal
}: PeriodAnalyticsProps) {
  const periodLogs = allLogs.filter(l => l.periodId === period.id);
  const mandatoryMin = Math.round((period.mandatoryHours || 0) * 60);

  // Student metrics map for this period
  const studentMetricsMap = new Map<string, { 
    totalMin: number; 
    studyMin: number; 
    discMin: number;
    perfRatio: number;
    hasEntry: boolean;
  }>();

  students.forEach(s => {
    studentMetricsMap.set(s.id, { 
      totalMin: 0, 
      studyMin: 0, 
      discMin: 0,
      perfRatio: 0,
      hasEntry: false
    });
  });

  periodLogs.forEach(l => {
    const entry = studentMetricsMap.get(l.studentId);
    if (entry) {
      const m = getLogMetrics(l);
      entry.totalMin = m.totalMinutes;
      entry.studyMin = m.studyMinutes;
      entry.discMin = m.discussionMinutes;
      entry.hasEntry = m.totalMinutes > 0;
      entry.perfRatio = mandatoryMin > 0 ? (m.totalMinutes / mandatoryMin) * 100 : 0;
    }
  });

  // 1. Sorted by Total (High to Low)
  const sortedByTotalHigh = [...students]
    .map(s => ({ student: s, metrics: studentMetricsMap.get(s.id)! }))
    .filter(x => x.metrics.totalMin > 0)
    .sort((a, b) => b.metrics.totalMin - a.metrics.totalMin);

  // 2. Sorted by Total (Low to High - among participating or all)
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

  // 5. Sorted by Performance Ratio (High to Low)
  const sortedByPerf = [...students]
    .map(s => ({ student: s, metrics: studentMetricsMap.get(s.id)! }))
    .filter(x => x.metrics.perfRatio > 0)
    .sort((a, b) => b.metrics.perfRatio - a.metrics.perfRatio);

  const topTotal = sortedByTotalHigh[0];
  const lowestTotal = sortedByTotalLow[0];
  const topStudy = sortedByStudy[0];
  const topDisc = sortedByDisc[0];
  const topPerf = sortedByPerf[0];

  const periodAvg = calculatePeriodAverages(period.id, allLogs);

  const handleOpenTotalRanking = () => {
    onOpenRankingModal({
      title: `رتبه‌بندی بیشترین مجموع کل در «${period.title}»`,
      metricLabel: 'مجموع دقایق دوره (مطالعه + مباحثه)',
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

  const handleOpenLowestTotalRanking = () => {
    onOpenRankingModal({
      title: `رتبه‌بندی کمترین مجموع در «${period.title}»`,
      metricLabel: 'کمترین مجموع دقایق دوره',
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
      title: `رتبه‌بندی برترین‌های مطالعه فردی در «${period.title}»`,
      metricLabel: 'دقایق مطالعه فردی دوره',
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
      title: `رتبه‌بندی برترین‌های مباحثه در «${period.title}»`,
      metricLabel: 'دقایق مباحثه دوره',
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

  const handleOpenPerfRanking = () => {
    onOpenRankingModal({
      title: `رتبه‌بندی برترین‌های تراز موظفی در «${period.title}»`,
      metricLabel: 'درصد تحقق موظفی دوره',
      items: sortedByPerf.map((item, idx) => ({
        rank: idx + 1,
        studentId: item.student.id,
        name: item.student.name,
        grade: item.student.grade || '---',
        displayValue: `${item.metrics.perfRatio.toFixed(0)}٪ موظفی`,
        studyValue: `${item.metrics.totalMin.toLocaleString('fa-IR')} د از ${mandatoryMin.toLocaleString('fa-IR')} د`
      }))
    });
  };

  return (
    <div className="bg-slate-50/70 p-5 md:p-6 rounded-3xl border border-slate-200/80 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-xs">
            <Sparkles size={16} />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-800">
              شاخص‌ها و برترین‌های دوره انتخابی: {period.title}
            </h4>
            <p className="text-[10px] font-bold text-slate-400">
              ارزیابی برترین‌ها و ترازهای ثبت‌شده در این دوره
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
          <span>میانگین دوره: {periodAvg.totalAvgMinutes.toLocaleString('fa-IR')} د</span>
          <span>•</span>
          <span>{periodAvg.activeCount} طلبه فعال</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* 1. بیشترین مجموع این دوره */}
        <div 
          onClick={handleOpenTotalRanking}
          className="bg-white p-4 rounded-2xl border border-slate-200/90 hover:border-amber-300 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <Award size={16} />
            </div>
            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
              بیشترین دوره
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">بیشترین مجموع دوره</p>
            <h5 className="text-xs font-black text-slate-800 mt-0.5 truncate">
              {topTotal ? topTotal.student.name : '---'}
            </h5>
            <p className="text-[11px] font-black text-amber-600 mt-0.5">
              {topTotal ? `${topTotal.metrics.totalMin.toLocaleString('fa-IR')} د` : '۰'}
            </p>
          </div>
        </div>

        {/* 2. کمترین مجموع این دوره */}
        <div 
          onClick={handleOpenLowestTotalRanking}
          className="bg-white p-4 rounded-2xl border border-slate-200/90 hover:border-rose-300 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 bg-rose-50 text-rose-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <TrendingDown size={16} />
            </div>
            <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
              کمترین دوره
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">کمترین مجموع دوره</p>
            <h5 className="text-xs font-black text-slate-800 mt-0.5 truncate">
              {lowestTotal ? lowestTotal.student.name : '---'}
            </h5>
            <p className="text-[11px] font-black text-rose-600 mt-0.5">
              {lowestTotal ? `${lowestTotal.metrics.totalMin.toLocaleString('fa-IR')} د` : '۰'}
            </p>
          </div>
        </div>

        {/* 3. بیشترین مطالعه این دوره */}
        <div 
          onClick={handleOpenStudyRanking}
          className="bg-white p-4 rounded-2xl border border-slate-200/90 hover:border-indigo-300 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookOpen size={16} />
            </div>
            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
              مطالعه
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">بیشترین مطالعه دوره</p>
            <h5 className="text-xs font-black text-slate-800 mt-0.5 truncate">
              {topStudy ? topStudy.student.name : '---'}
            </h5>
            <p className="text-[11px] font-black text-indigo-600 mt-0.5">
              {topStudy ? `${topStudy.metrics.studyMin.toLocaleString('fa-IR')} د` : '۰'}
            </p>
          </div>
        </div>

        {/* 4. بیشترین مباحثه این دوره */}
        <div 
          onClick={handleOpenDiscRanking}
          className="bg-white p-4 rounded-2xl border border-slate-200/90 hover:border-emerald-300 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <MessageSquare size={16} />
            </div>
            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              مباحثه
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">بیشترین مباحثه دوره</p>
            <h5 className="text-xs font-black text-slate-800 mt-0.5 truncate">
              {topDisc ? topDisc.student.name : '---'}
            </h5>
            <p className="text-[11px] font-black text-emerald-600 mt-0.5">
              {topDisc ? `${topDisc.metrics.discMin.toLocaleString('fa-IR')} د` : '۰'}
            </p>
          </div>
        </div>

        {/* 5. برترین تراز موظفی این دوره */}
        <div 
          onClick={handleOpenPerfRanking}
          className="bg-white p-4 rounded-2xl border border-slate-200/90 hover:border-blue-300 shadow-xs hover:shadow-md transition-all cursor-pointer group space-y-2"
        >
          <div className="flex items-center justify-between">
            <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <Target size={16} />
            </div>
            <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
              تراز موظفی
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400">برترین تراز موظفی</p>
            <h5 className="text-xs font-black text-slate-800 mt-0.5 truncate">
              {topPerf ? topPerf.student.name : '---'}
            </h5>
            <p className="text-[11px] font-black text-blue-600 mt-0.5">
              {topPerf ? `${topPerf.metrics.perfRatio.toFixed(0)}٪ (${topPerf.metrics.totalMin} د)` : '۰٪'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
