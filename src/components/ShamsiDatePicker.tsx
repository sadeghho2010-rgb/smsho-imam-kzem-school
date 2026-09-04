import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronRight, ChevronLeft, X, Check } from 'lucide-react';
import { 
  parseShamsiDate, 
  formatShamsiDate, 
  getDaysInShamsiMonth, 
  getShamsiDayOfWeek, 
  SHAMSI_MONTH_NAMES, 
  SHAMSI_WEEKDAY_NAMES_SHORT, 
  getTodayShamsi 
} from '../lib/jalali';
import { motion, AnimatePresence } from 'motion/react';

interface ShamsiDatePickerProps {
  value: string;
  onChange: (dateStr: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
}

export const ShamsiDatePicker: React.FC<ShamsiDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = '1405/01/01',
  className = '',
  required = false,
  disabled = false,
  id
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Parse existing date or default to today
  const parsed = parseShamsiDate(value || getTodayShamsi());
  const [viewYear, setViewYear] = useState<number>(parsed.year || 1405);
  const [viewMonth, setViewMonth] = useState<number>(parsed.month || 1);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync view state when value changes or popover opens
  useEffect(() => {
    if (value) {
      const p = parseShamsiDate(value);
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }, [value, isOpen]);

  // Handle outside click to close popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const formatted = formatShamsiDate(viewYear, viewMonth, day);
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    const today = getTodayShamsi();
    const p = parseShamsiDate(today);
    setViewYear(p.year);
    setViewMonth(p.month);
    onChange(today);
    setIsOpen(false);
  };

  // Days in current view month
  const totalDays = getDaysInShamsiMonth(viewYear, viewMonth);
  // Weekday index for day 1 of month (0 = Saturday, 6 = Friday)
  const firstDayOfMonthStr = formatShamsiDate(viewYear, viewMonth, 1);
  const startDayOffset = getShamsiDayOfWeek(firstDayOfMonthStr);

  const todayStr = getTodayShamsi();

  // Generate years list for dropdown (e.g. 1395 to 1415)
  const yearsList = Array.from({ length: 30 }, (_, i) => 1395 + i);

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label htmlFor={id} className="block font-bold text-slate-700 text-xs mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <input
          type="text"
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(true)}
          className={`w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 text-center text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all ${className}`}
          dir="ltr"
        />
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className="absolute left-2 text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg transition-colors"
          title="انتخاب از تقویم"
        >
          <CalendarIcon size={18} />
        </button>
      </div>

      {/* DatePicker Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 top-full mt-2 right-0 sm:right-auto sm:left-0 min-w-[290px] max-w-[320px] bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 space-y-3"
            dir="rtl"
          >
            {/* Header: Year & Month Selectors */}
            <div className="flex items-center justify-between gap-1 pb-2 border-b border-slate-100">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                title="ماه قبل"
              >
                <ChevronRight size={18} />
              </button>

              <div className="flex items-center gap-1.5">
                {/* Month Dropdown */}
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  className="bg-slate-100 hover:bg-slate-200 border-none font-black text-xs text-slate-800 py-1.5 px-2 rounded-lg cursor-pointer focus:outline-none"
                >
                  {SHAMSI_MONTH_NAMES.map((mName, idx) => (
                    <option key={idx + 1} value={idx + 1}>
                      {mName}
                    </option>
                  ))}
                </select>

                {/* Year Dropdown */}
                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  className="bg-slate-100 hover:bg-slate-200 border-none font-black text-xs text-slate-800 py-1.5 px-2 rounded-lg cursor-pointer focus:outline-none"
                >
                  {yearsList.map(y => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
                title="ماه بعد"
              >
                <ChevronLeft size={18} />
              </button>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 text-center gap-1">
              {SHAMSI_WEEKDAY_NAMES_SHORT.map((wd, i) => (
                <span
                  key={i}
                  className={`text-[11px] font-black py-1 ${i === 6 ? 'text-rose-500' : 'text-slate-400'}`}
                >
                  {wd}
                </span>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {/* Empty padding cells for start weekday offset */}
              {Array.from({ length: startDayOffset }).map((_, idx) => (
                <div key={`offset-${idx}`} className="h-8" />
              ))}

              {/* Day cells */}
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                const dateStr = formatShamsiDate(viewYear, viewMonth, day);
                const isSelected = value === dateStr;
                const isToday = todayStr === dateStr;
                const dayOfWeek = (startDayOffset + day - 1) % 7;
                const isFriday = dayOfWeek === 6;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleSelectDay(day)}
                    className={`h-8 w-8 mx-auto rounded-xl text-xs font-black flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 scale-105'
                        : isToday
                        ? 'bg-indigo-50 border border-indigo-400 text-indigo-700 hover:bg-indigo-100'
                        : isFriday
                        ? 'text-rose-600 hover:bg-rose-50'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Footer Action Buttons */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleSelectToday}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
              >
                <Check size={13} />
                <span>امروز ({todayStr})</span>
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
              >
                <X size={13} />
                <span>بستن</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
