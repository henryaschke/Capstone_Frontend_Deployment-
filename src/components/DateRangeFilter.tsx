import React from 'react';
import { CalendarDays } from 'lucide-react';
import type { DateRange } from '../types';

interface DateRangeFilterProps {
  dateRange: DateRange;
  setDateRange: React.Dispatch<React.SetStateAction<DateRange>>;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ dateRange, setDateRange }) => {
  const handleToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setDateRange({ start: today, end: today });
  };

  return (
    <div className="glass-card rounded-lg p-4 mb-6">
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-300 mb-1">From</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            className="block w-full rounded-lg border-gray-600 bg-dark-800/50 text-white"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-300 mb-1">To</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            className="block w-full rounded-lg border-gray-600 bg-dark-800/50 text-white"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={handleToday}
            className="px-4 py-2 bg-primary-600/30 rounded-lg text-white hover:bg-primary-600/50 transition-colors flex items-center space-x-2"
          >
            <CalendarDays className="w-4 h-4" />
            <span>Today</span>
          </button>
        </div>
      </div>
    </div>
  );
};