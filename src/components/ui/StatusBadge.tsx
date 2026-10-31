import React from 'react';

export type StatusType =
  | 'draft'
  | 'quotation'
  | 'confirmed'
  | 'active'
  | 'closed'
  | 'paused'
  | 'paid'
  | 'overdue'
  | 'partially_paid'
  | 'cancelled';

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const norm = (status || '').toLowerCase();

  switch (norm) {
    case 'active':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          {label || 'Active'}
        </span>
      );
    case 'quotation':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
          {label || 'Quotation'}
        </span>
      );
    case 'confirmed':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
          {label || 'Confirmed'}
        </span>
      );
    case 'paid':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          {label || 'Paid'}
        </span>
      );
    case 'overdue':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-300 font-mono ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
          {label || 'Overdue'}
        </span>
      );
    case 'partially_paid':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
          {label || 'Partially Paid'}
        </span>
      );
    case 'paused':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border-2 border-dashed border-amber-300 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          {label || 'Paused'}
        </span>
      );
    case 'closed':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          {label || 'Closed'}
        </span>
      );
    case 'cancelled':
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 line-through border border-gray-200 ${className}`}>
          {label || 'Cancelled'}
        </span>
      );
    case 'draft':
    default:
      return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-300 ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
          {label || 'Draft'}
        </span>
      );
  }
}
