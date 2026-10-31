'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, FastForward, RotateCcw, AlertTriangle } from 'lucide-react';

export function VirtualClockBanner({ onTimeAdvanced }: { onTimeAdvanced?: () => void }) {
  const [clock, setClock] = useState<{
    isSimulated: boolean;
    currentDate: string;
    offsetDays: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchClock = async () => {
    try {
      const res = await fetch('/api/clock');
      if (res.ok) {
        const data = await res.json();
        setClock(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchClock();
  }, []);

  const handleAdvance = async (days: number) => {
    setLoading(true);
    try {
      const res = await fetch('/api/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance', days }),
      });
      if (res.ok) {
        await fetchClock();
        if (onTimeAdvanced) onTimeAdvanced();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      if (res.ok) {
        await fetchClock();
        if (onTimeAdvanced) onTimeAdvanced();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!clock) return null;

  const dateStr = new Date(clock.currentDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className={`w-full px-4 py-2 text-xs flex flex-wrap items-center justify-between border-b transition-colors ${
      clock.isSimulated
        ? 'bg-amber-50/90 border-amber-200 text-amber-900 font-medium'
        : 'bg-white text-slate-800 border-slate-200 shadow-2xs'
    }`}>
      <div className="flex items-center gap-2">
        {clock.isSimulated ? (
          <span className="flex items-center gap-1.5 font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            SIMULATED TIME ACTIVE
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-slate-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-700" />
            System Clock:
          </span>
        )}
        <span className="font-mono text-xs font-bold text-slate-900">
          {dateStr}
        </span>
        {clock.offsetDays !== 0 && (
          <span className="text-amber-700 font-mono">
            (+{clock.offsetDays} days offset)
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mt-1 sm:mt-0">
        <span className="text-slate-500 text-[11px] hidden md:inline">Time Travel:</span>
        <button
          onClick={() => handleAdvance(1)}
          disabled={loading}
          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 rounded border border-slate-300 font-semibold shadow-xs flex items-center gap-1 active:scale-95 disabled:opacity-50"
        >
          <FastForward className="w-3 h-3 text-indigo-600" />
          +1 Day
        </button>
        <button
          onClick={() => handleAdvance(30)}
          disabled={loading}
          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 rounded border border-slate-300 font-semibold shadow-xs flex items-center gap-1 active:scale-95 disabled:opacity-50"
        >
          <FastForward className="w-3 h-3 text-indigo-600" />
          +1 Month (30d)
        </button>
        {clock.isSimulated && (
          <button
            onClick={handleReset}
            disabled={loading}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-semibold shadow-xs flex items-center gap-1 active:scale-95 disabled:opacity-50"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to Today
          </button>
        )}
      </div>
    </div>
  );
}
