import React from 'react';
import { SubscriptionStatus } from '@prisma/client';

interface StateStepperProps {
  currentStatus: SubscriptionStatus;
  isPaused?: boolean;
}

const STEPS: { key: SubscriptionStatus; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'quotation', label: 'Quotation' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'active', label: 'Active' },
  { key: 'closed', label: 'Closed' },
];

export function StateStepper({ currentStatus, isPaused }: StateStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStatus);

  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-0.5 bg-slate-200 z-0"></div>

        {STEPS.map((step, idx) => {
          const isPassed = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          let circleClass = 'bg-white border-2 border-slate-300 text-slate-400';
          let textClass = 'text-slate-500 font-normal';

          if (isPassed) {
            circleClass = 'bg-emerald-600 border-2 border-emerald-600 text-white';
            textClass = 'text-emerald-700 font-semibold';
          } else if (isCurrent) {
            if (isPaused) {
              circleClass = 'bg-amber-500 border-2 border-amber-500 text-white ring-4 ring-amber-100';
              textClass = 'text-amber-700 font-bold';
            } else if (step.key === 'closed') {
              circleClass = 'bg-slate-700 border-2 border-slate-700 text-white ring-4 ring-slate-100';
              textClass = 'text-slate-800 font-bold';
            } else {
              circleClass = 'bg-indigo-600 border-2 border-indigo-600 text-white ring-4 ring-indigo-100';
              textClass = 'text-indigo-800 font-bold';
            }
          }

          return (
            <div key={step.key} className="flex flex-col items-center relative z-10">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all ${circleClass}`}>
                {isPassed ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <span className={`text-xs mt-1.5 whitespace-nowrap ${textClass}`}>
                {step.label}
                {isCurrent && isPaused && ' (Paused)'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
