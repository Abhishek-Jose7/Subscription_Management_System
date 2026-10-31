import React from 'react';
import { X, HelpCircle, ArrowRight } from 'lucide-react';

interface ExplainData {
  baseUnitPrice?: string;
  variantAddon?: string;
  effectiveUnitPrice?: string;
  quantity: number;
  grossAmount: string;
  discountAmount?: string;
  discount?: string;
  netAmount?: string;
  net?: string;
  taxes?: Array<{
    name: string;
    rate: string;
    priceIncluded: boolean;
    amount: string;
  }>;
  tax?: string;
  taxTotal?: string;
  finalTotal: string;
}

interface ExplainPriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  lineDescription: string;
  explain: ExplainData | null;
}

export function ExplainPriceModal({
  isOpen,
  onClose,
  lineDescription,
  explain,
}: ExplainPriceModalProps) {
  if (!isOpen || !explain) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-600" />
            <h3 className="font-semibold text-slate-900 text-sm">
              Price Waterfall Explainer
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs text-slate-500 font-medium">Item Description</p>
            <p className="text-sm font-semibold text-slate-800">{lineDescription}</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3 font-mono text-xs">
            {/* Step 1: Base & Variant */}
            <div className="flex items-center justify-between text-slate-600">
              <span>1. Base Unit Price</span>
              <span className="font-semibold">₹{explain.baseUnitPrice || '0.00'}</span>
            </div>

            {explain.variantAddon && (
              <div className="flex items-center justify-between text-indigo-700 bg-indigo-50/50 p-1.5 rounded">
                <span>+ Variant Extra Price</span>
                <span className="font-semibold">+₹{explain.variantAddon}</span>
              </div>
            )}

            {/* Step 2: Multiplied by Quantity */}
            <div className="flex items-center justify-between text-slate-700 font-semibold border-t border-slate-200 pt-2">
              <span>2. Quantity ({explain.quantity} units)</span>
              <span>× {explain.quantity}</span>
            </div>
            <div className="flex items-center justify-between text-slate-900 font-bold">
              <span>= Line Gross Total</span>
              <span>₹{explain.grossAmount}</span>
            </div>

            {/* Step 3: Discounts */}
            {(explain.discountAmount || explain.discount) && (
              <div className="flex items-center justify-between text-emerald-700 bg-emerald-50/60 p-1.5 rounded border border-emerald-200">
                <span>3. Discount Applied</span>
                <span className="font-bold">-₹{explain.discountAmount || explain.discount}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-slate-700 font-medium">
              <span>= Pre-Tax Net Amount</span>
              <span>₹{explain.netAmount || explain.net || explain.grossAmount}</span>
            </div>

            {/* Step 4: Taxes */}
            <div className="border-t border-slate-200 pt-2 space-y-1">
              <span className="text-slate-500 font-sans block text-[11px]">4. Taxes & Levies:</span>
              {explain.taxes && explain.taxes.length > 0 ? (
                explain.taxes.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between text-slate-700 pl-2">
                    <span>+ {t.name} ({t.rate})</span>
                    <span>+₹{t.amount}</span>
                  </div>
                ))
              ) : explain.tax ? (
                <div className="flex items-center justify-between text-slate-700 pl-2">
                  <span>+ Tax</span>
                  <span>+₹{explain.tax}</span>
                </div>
              ) : (
                <div className="text-slate-400 pl-2">No tax applicable</div>
              )}
            </div>

            {/* Final Total */}
            <div className="flex items-center justify-between text-sm font-bold text-slate-900 border-t-2 border-slate-300 pt-3 bg-white p-2 rounded">
              <span className="font-sans">Final Line Amount</span>
              <span className="text-indigo-700 text-base">₹{explain.finalTotal}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 italic">
            Exact to the paisa. Calculated via integer minor units with largest-remainder discount allocation.
          </p>
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            Close Explainer
          </button>
        </div>
      </div>
    </div>
  );
}
