'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  CreditCard,
  Layers,
  FileText,
  Clock,
  LogOut,
  HelpCircle,
  Pause,
  Play,
  RotateCcw,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StateStepper } from '@/components/ui/StateStepper';
import { ExplainPriceModal } from '@/components/ui/ExplainPriceModal';
import { formatINR } from '@/lib/currency';

export default function CustomerPortalPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'subscriptions' | 'invoices'>('overview');
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');

  // Explain modal
  const [explainModal, setExplainModal] = useState<{ isOpen: boolean; description: string; explain: any }>({
    isOpen: false,
    description: '',
    explain: null,
  });

  // Pay modal
  const [payModal, setPayModal] = useState<{ isOpen: boolean; invoice: any; method: string }>({
    isOpen: false,
    invoice: null,
    method: 'upi',
  });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) router.push('/login');
        return res.json();
      })
      .then((data) => {
        if (data.authenticated) {
          setUser(data.user);
          loadCustomerData();
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const loadCustomerData = async () => {
    setLoading(true);
    try {
      const sRes = await fetch('/api/subscriptions');
      if (sRes.ok) {
        const sData = await sRes.json();
        setSubscriptions(sData.subscriptions || []);
      }

      const iRes = await fetch('/api/invoices');
      if (iRes.ok) {
        const iData = await iRes.json();
        setInvoices(iData.invoices || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const handlePauseResume = async (subId: string, action: 'pause' | 'resume') => {
    try {
      const res = await fetch(`/api/subscriptions/${subId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);

      showToast(`Subscription ${action === 'pause' ? 'paused' : 'resumed'}`);
      await loadCustomerData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSimulatedPaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModal.invoice) return;

    try {
      const idempotencyKey = `cust_pay_${payModal.invoice.id}_${Date.now()}`;
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: payModal.invoice.id,
          amount: payModal.invoice.balance,
          method: payModal.method,
          idempotencyKey,
          reference: `UPI-GATEWAY-${Date.now().toString().slice(-6)}`,
          note: 'Paid via Customer Portal Simulated Gateway',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(`Payment successful! Invoice ${payModal.invoice.number} marked as Paid.`);
      setPayModal({ isOpen: false, invoice: null, method: 'upi' });
      await loadCustomerData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const totalOutstanding = invoices
    .filter((inv) => inv.status === 'confirmed' && BigInt(inv.balance) > 0n)
    .reduce((sum, inv) => sum + BigInt(inv.balance), 0n);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <Shield className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900">
                Brightloop <span className="text-indigo-600 font-semibold">Portal</span>
              </span>
              <span className="ml-2 text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                Customer Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700">
              {user?.name}
            </span>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex space-x-2 border-t border-slate-100">
          {[
            { key: 'overview', label: 'Overview', icon: Shield },
            { key: 'subscriptions', label: 'My Subscriptions', icon: Layers },
            { key: 'invoices', label: 'Invoices & Billing', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition-colors ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toastMsg}
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full flex-1 space-y-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Active Plans
                </span>
                <span className="text-2xl font-bold font-mono text-slate-900 mt-1 block">
                  {subscriptions.filter((s) => s.status === 'active').length}
                </span>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Outstanding Balance
                </span>
                <span className="text-2xl font-bold font-mono text-indigo-700 mt-1 block tabular-nums">
                  {formatINR(totalOutstanding)}
                </span>
              </div>

              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Next Renewal / Billing
                </span>
                <span className="text-sm font-bold font-mono text-slate-800 mt-2 block">
                  {subscriptions[0]?.nextInvoiceDate
                    ? new Date(subscriptions[0].nextInvoiceDate).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Up to date'}
                </span>
              </div>
            </div>

            {/* Active Subscription Stepper & Preview */}
            {subscriptions.length > 0 && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {subscriptions[0].number} — {subscriptions[0].plan.name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {subscriptions[0].totalQuantity} Seats · Billed {subscriptions[0].plan.billingPeriod}
                    </p>
                  </div>
                  <StatusBadge status={subscriptions[0].status} />
                </div>

                <StateStepper
                  currentStatus={subscriptions[0].status}
                  isPaused={!!subscriptions[0].pausedUntil}
                />

                <div className="pt-2 flex items-center justify-between text-xs">
                  <div className="text-slate-600">
                    Recurring Total:{' '}
                    <strong className="text-slate-900 font-mono">
                      {formatINR(BigInt(subscriptions[0].totalAmount))}
                    </strong>
                  </div>

                  <div className="space-x-2">
                    {subscriptions[0].plan.allowPause && subscriptions[0].status === 'active' && (
                      <button
                        onClick={() =>
                          handlePauseResume(
                            subscriptions[0].id,
                            subscriptions[0].pausedUntil ? 'resume' : 'pause'
                          )
                        }
                        className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5 text-xs"
                      >
                        {subscriptions[0].pausedUntil ? (
                          <>
                            <Play className="w-3.5 h-3.5 text-emerald-600 fill-current" />
                            Resume Plan
                          </>
                        ) : (
                          <>
                            <Pause className="w-3.5 h-3.5 text-amber-600" />
                            Pause Plan
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SUBSCRIPTIONS */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-4">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                  <div>
                    <span className="font-mono font-bold text-sm text-slate-900">{sub.number}</span>
                    <h4 className="text-xs font-semibold text-slate-700">{sub.plan.name}</h4>
                  </div>
                  <StatusBadge status={sub.status} />
                </div>

                <StateStepper currentStatus={sub.status} isPaused={!!sub.pausedUntil} />

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-mono text-slate-700">
                    Total: <strong>{formatINR(BigInt(sub.totalAmount))}</strong> / {sub.plan.billingPeriod}
                  </span>

                  {sub.status === 'active' && sub.plan.allowPause && (
                    <button
                      onClick={() => handlePauseResume(sub.id, sub.pausedUntil ? 'resume' : 'pause')}
                      className="px-3 py-1 rounded bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
                    >
                      {sub.pausedUntil ? 'Resume Subscription' : 'Pause Subscription'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 3: INVOICES & PAYMENTS */}
        {activeTab === 'invoices' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Invoice #</th>
                    <th className="px-4 py-3">Invoice Date</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Paid</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {inv.number}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {new Date(inv.invoiceDate).toISOString().split('T')[0]}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">
                        {new Date(inv.dueDate).toISOString().split('T')[0]}
                      </td>
                      <td className="px-4 py-3">
                        {inv.isOverdue ? (
                          <StatusBadge status="overdue" label={`Overdue (${inv.agingBucket}d)`} />
                        ) : inv.isPartiallyPaid ? (
                          <StatusBadge status="partially_paid" />
                        ) : (
                          <StatusBadge status={inv.status} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {formatINR(BigInt(inv.total))}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-600 tabular-nums">
                        {formatINR(BigInt(inv.amountPaid))}
                      </td>
                      <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                        {inv.status === 'confirmed' && BigInt(inv.balance) > 0n && (
                          <button
                            onClick={() => setPayModal({ isOpen: true, invoice: inv, method: 'upi' })}
                            className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs"
                          >
                            Pay Now ({formatINR(BigInt(inv.balance))})
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Simulated Payment Gateway Modal */}
      {payModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">
                Simulated Payment Gateway
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Paying invoice <strong>{payModal.invoice?.number}</strong>
            </p>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mb-4 flex items-center justify-between font-mono">
              <span className="text-xs text-slate-600">Amount Due:</span>
              <span className="text-lg font-bold text-slate-900">
                {formatINR(BigInt(payModal.invoice?.balance || 0))}
              </span>
            </div>

            <form onSubmit={handleSimulatedPaySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase">
                  Select Simulated Gateway Method
                </label>
                <select
                  value={payModal.method}
                  onChange={(e) => setPayModal({ ...payModal, method: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="upi">Instant UPI (GooglePay / PhonePe / Paytm)</option>
                  <option value="card">Credit / Debit Card (Simulated 3D Secure)</option>
                  <option value="bank_transfer">Net Banking (HDFC / ICICI / SBI)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayModal({ isOpen: false, invoice: null, method: 'upi' })}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs"
                >
                  Authorize Payment (Success)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
