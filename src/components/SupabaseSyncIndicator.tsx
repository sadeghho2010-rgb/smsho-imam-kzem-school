import React, { useState, useEffect } from 'react';
import { performFullSync, SyncResult } from '../lib/syncEngine';
import { Database, RefreshCw, CheckCircle2, Wifi, WifiOff, CloudUpload, HardDrive } from 'lucide-react';
import { cn } from '../lib/utils';

export default function SupabaseSyncIndicator() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [showStatusTooltip, setShowStatusTooltip] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Automatically sync when internet connects
      handleManualSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync on mount if online
    if (navigator.onLine) {
      handleManualSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await performFullSync();
      setLastSyncResult(res);
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="relative inline-block text-right">
      <button
        type="button"
        onClick={handleManualSync}
        disabled={isSyncing}
        onMouseEnter={() => setShowStatusTooltip(true)}
        onMouseLeave={() => setShowStatusTooltip(false)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm",
          isOnline
            ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
            : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
        )}
        title="کلیک جهت همگام‌سازی مستقیم لپ‌تاپ و Supabase"
      >
        <div className="relative flex items-center justify-center">
          <Database size={15} className={cn(isSyncing ? "animate-spin text-indigo-600" : isOnline ? "text-emerald-600" : "text-amber-600")} />
          <span className={cn("absolute -top-1 -right-1 w-2 h-2 rounded-full", isOnline ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
        </div>

        <span className="hidden md:inline">
          {isSyncing ? "در حال همگام‌سازی..." : isOnline ? "ذخیره لپ‌تاپ + Supabase" : "ذخیره روی لپ‌تاپ (آفلاین)"}
        </span>

        <RefreshCw size={13} className={cn("mr-0.5", isSyncing && "animate-spin")} />
      </button>

      {/* Tooltip detail */}
      {showStatusTooltip && (
        <div className="absolute left-0 mt-2 w-72 bg-slate-900 text-white rounded-2xl p-3.5 shadow-2xl text-[11px] z-50 border border-slate-700 leading-relaxed font-sans" dir="rtl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 font-bold">
            <span className="flex items-center gap-1.5 text-indigo-300">
              <HardDrive size={14} />
              <span>وضعیت ذخیره‌سازی دوگانه</span>
            </span>
            <span className={cn("flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-bold", isOnline ? "bg-emerald-950 text-emerald-400" : "bg-amber-950 text-amber-400")}>
              {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
              {isOnline ? "آنلاین" : "آفلاین"}
            </span>
          </div>

          <p className="text-slate-300 mb-2">
            تمامی اطلاعات به طور کامل روی <strong>حافظه لپ‌تاپ</strong> ذخیره می‌شوند. پس از اتصال به اینترنت، دیتای جدید به دیتابیس Supabase اضافه شده و دیتای قبلی لپ‌تاپ هرگز حذف نمی‌شود.
          </p>

          <div className="bg-slate-800/80 p-2 rounded-xl text-slate-300 space-y-1">
            <div className="flex justify-between items-center text-[10px]">
              <span>پروژه Supabase:</span>
              <strong className="text-indigo-300 dir-ltr font-mono">imam kazem school</strong>
            </div>
            <div className="flex justify-between items-center text-[10px]">
              <span>باکت تصویر:</span>
              <strong className="text-emerald-300 dir-ltr font-mono">picture (Public)</strong>
            </div>
            {lastSyncResult && (
              <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-700 text-emerald-400">
                <span>آخرین همگام‌سازی:</span>
                <span>{lastSyncResult.timestamp}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
