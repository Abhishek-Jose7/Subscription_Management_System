'use client';

import React from 'react';
import { X, Printer, Download, ShieldCheck, QrCode } from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatINR } from '@/lib/currency';

interface InvoiceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: any;
}

export function InvoiceSheetModal({ isOpen, onClose, invoice }: InvoiceSheetProps) {
  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const isKarnataka = invoice.customer?.billingAddress?.toLowerCase().includes('karnataka');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150 print:m-0 print:border-none print:shadow-none">
        {/* Top Action Bar (hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold text-indigo-400">
              Tax Invoice Sheet
            </span>
            <span className="text-slate-400 text-xs">·</span>
            <span className="font-mono text-xs text-slate-200">{invoice.number}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-400" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Document */}
        <div className="p-8 sm:p-10 space-y-8 print:p-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 border-b border-slate-200 pb-8">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                  B
                </div>
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  Brightloop Technologies Pvt Ltd
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                7th Floor, UB City Tower, Vittal Mallya Road<br />
                Bengaluru, Karnataka 560001, India<br />
                GSTIN: <span className="font-mono font-semibold text-slate-700">29AABCB1234F1Z8</span><br />
                Email: billing@brightloop.in
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                TAX INVOICE
              </span>
              <span className="text-xl font-extrabold font-mono text-slate-900 block mt-1">
                {invoice.number}
              </span>
              <div className="mt-2 space-y-0.5 text-xs text-slate-600 font-mono">
                <div>Date: {new Date(invoice.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                <div>Due Date: {new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                <div>Period: {new Date(invoice.periodStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} — {new Date(invoice.periodEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              </div>
              <div className="mt-3">
                <StatusBadge status={invoice.status} />
              </div>
            </div>
          </div>

          {/* Billed To / Shipping */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50/70 p-4 rounded-xl border border-slate-100 text-xs">
            <div>
              <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider block mb-1">
                Billed To
              </span>
              <div className="font-bold text-slate-900 text-sm">
                {invoice.customer?.company || invoice.customer?.name}
              </div>
              <div className="text-slate-600 mt-1">
                Attn: {invoice.customer?.name}
              </div>
              <div className="text-slate-500 mt-0.5 whitespace-pre-line">
                {invoice.customer?.billingAddress || 'Address on file'}
              </div>
              {invoice.customer?.taxId && (
                <div className="mt-1.5 font-mono text-slate-700">
                  GSTIN: <span className="font-semibold">{invoice.customer.taxId}</span>
                </div>
              )}
            </div>

            <div className="sm:text-right">
              <span className="font-bold text-slate-400 uppercase text-[10px] tracking-wider block mb-1">
                Subscription & Place of Supply
              </span>
              <div className="font-mono text-indigo-700 font-bold">
                {invoice.subscription?.number}
              </div>
              <div className="text-slate-600 mt-1">
                Plan: {invoice.subscription?.planName || 'Standard'}
              </div>
              <div className="text-slate-500 mt-0.5">
                Place of Supply: <span className="font-semibold text-slate-700">{isKarnataka ? 'Karnataka (Intra-state)' : 'Inter-state'}</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Tax Type: {isKarnataka ? 'CGST (9%) + SGST (9%)' : 'IGST (18%)'}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Discount</th>
                  <th className="px-4 py-3 text-right">Tax</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoice.lines?.map((line: any) => (
                  <tr key={line.id}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{line.description}</div>
                      <div className="text-[10px] text-slate-400 font-mono">SAC: 997331 (Cloud SaaS)</div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono">{line.quantity}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {formatINR(BigInt(line.unitPrice))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700 tabular-nums">
                      {BigInt(line.discountAmount) > 0n ? `-${formatINR(BigInt(line.discountAmount))}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600 tabular-nums">
                      {formatINR(BigInt(line.taxAmount))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {formatINR(BigInt(line.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Breakdown */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-t border-slate-200 pt-6">
            <div className="text-xs text-slate-500 max-w-xs space-y-2">
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Digitally Authenticated by Brightloop Engine</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Bank Transfer Details:<br />
                A/C: <span className="font-mono text-slate-700 font-semibold">50200088991122</span> (HDFC Bank)<br />
                IFSC: <span className="font-mono text-slate-700 font-semibold">HDFC0000053</span><br />
                UPI ID: <span className="font-mono text-indigo-700 font-semibold">brightloop@hdfcbank</span>
              </p>
            </div>

            <div className="w-full sm:w-72 space-y-2 text-xs font-mono">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (Pre-Tax):</span>
                <span>{formatINR(BigInt(invoice.subtotal))}</span>
              </div>

              {BigInt(invoice.discountTotal) > 0n && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Discount Applied:</span>
                  <span>-{formatINR(BigInt(invoice.discountTotal))}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600 border-t border-slate-100 pt-1">
                <span>GST Tax Total:</span>
                <span>+{formatINR(BigInt(invoice.taxTotal))}</span>
              </div>

              <div className="flex justify-between text-base font-bold text-slate-900 border-t-2 border-slate-900 pt-2 font-mono">
                <span>Total Due:</span>
                <span className="text-indigo-700">{formatINR(BigInt(invoice.total))}</span>
              </div>

              <div className="flex justify-between text-xs text-emerald-700 font-semibold pt-1">
                <span>Amount Paid:</span>
                <span>{formatINR(BigInt(invoice.amountPaid))}</span>
              </div>

              <div className="flex justify-between text-xs font-bold text-slate-800 bg-slate-100 p-2 rounded">
                <span>Balance Payable:</span>
                <span>{formatINR(BigInt(invoice.balance))}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
