'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  BarChart3,
  RefreshCw,
  Play,
  Eye,
  CheckCircle2,
  AlertOctagon,
  Clock,
  FileText,
  DollarSign,
  TrendingUp,
  Users,
  Layers,
  Tag,
  LogOut,
  HelpCircle,
  Plus,
  ArrowUpRight,
  CreditCard,
  RotateCcw,
} from 'lucide-react';
import { VirtualClockBanner } from '@/components/ui/VirtualClockBanner';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StateStepper } from '@/components/ui/StateStepper';
import { ExplainPriceModal } from '@/components/ui/ExplainPriceModal';
import { formatINR } from '@/lib/currency';

export default function DashboardApp() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<
    'cockpit' | 'subscriptions' | 'invoices' | 'ledger' | 'radar' | 'catalog' | 'discounts' | 'staff'
  >('cockpit');

  // Metrics
  const [metrics, setMetrics] = useState<any>(null);
  const [waterfall, setWaterfall] = useState<any>(null);
  const [ledgerHealth, setLedgerHealth] = useState<any>(null);
  const [renewals, setRenewals] = useState<any[]>([]);

  // Subscriptions & Invoices
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [subStatusFilter, setSubStatusFilter] = useState('all');

  const [invoices, setInvoices] = useState<any[]>([]);
  const [invStatusFilter, setInvStatusFilter] = useState('all');

  // Products, Plans, Discounts
  const [products, setProducts] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);

  // Modals & Actions
  const [explainModal, setExplainModal] = useState<{ isOpen: boolean; description: string; explain: any }>({
    isOpen: false,
    description: '',
    explain: null,
  });

  const [billingPreview, setBillingPreview] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Payment recording modal
  const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean; invoice: any; amount: string; method: string }>({
    isOpen: false,
    invoice: null,
    amount: '',
    method: 'upi',
  });

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // Fetch session
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) router.push('/login');
        return res.json();
      })
      .then((data) => {
        if (data.authenticated) {
          if (data.user.role === 'customer') {
            router.push('/portal');
          } else {
            setUser(data.user);
          }
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const loadAllData = async () => {
    try {
      // 1. Cockpit metrics
      const mRes = await fetch('/api/reports/cockpit');
      if (mRes.ok) setMetrics(await mRes.json());

      // 2. MRR waterfall
      const wRes = await fetch('/api/reports/mrr-waterfall');
      if (wRes.ok) setWaterfall(await wRes.json());

      // 3. Subscriptions
      const sRes = await fetch(`/api/subscriptions?status=${subStatusFilter}`);
      if (sRes.ok) {
        const sData = await sRes.json();
        setSubscriptions(sData.subscriptions || []);
      }

      // 4. Invoices
      const iRes = await fetch(`/api/invoices?status=${invStatusFilter}`);
      if (iRes.ok) {
        const iData = await iRes.json();
        setInvoices(iData.invoices || []);
      }

      // 5. Ledger Health
      const lRes = await fetch('/api/reports/ledger-health');
      if (lRes.ok) setLedgerHealth(await lRes.json());

      // 6. Renewal Radar
      const rRes = await fetch('/api/reports/renewal-radar');
      if (rRes.ok) {
        const rData = await rRes.json();
        setRenewals(rData.renewals || []);
      }

      // 7. Products & Plans
      const pRes = await fetch('/api/products');
      if (pRes.ok) {
        const pData = await pRes.json();
        setProducts(pData.products || []);
      }

      const plRes = await fetch('/api/plans');
      if (plRes.ok) {
        const plData = await plRes.json();
        setPlans(plData.plans || []);
      }

      // 8. Discounts
      const dRes = await fetch('/api/discounts');
      if (dRes.ok) {
        const dData = await dRes.json();
        setDiscounts(dData.discounts || []);
      }

      // 9. Staff (if admin)
      const stRes = await fetch('/api/staff');
      if (stRes.ok) {
        const stData = await stRes.json();
        setStaffUsers(stData.staff || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (user) loadAllData();
  }, [user, subStatusFilter, invStatusFilter]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  // Run Billing (Dry Run or Real)
  const handleTriggerBilling = async (dryRun: boolean) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/billing/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (dryRun) {
        setBillingPreview(data);
        showToast(`Dry Run: ${data.invoicesPreview?.length || 0} invoices simulated`);
      } else {
        setBillingPreview(null);
        showToast(`Billing Run completed! ${data.createdCount} invoices created, ${data.skippedCount} skipped.`);
        await loadAllData();
      }
    } catch (err: any) {
      alert(`Billing run error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Subscription state transition
  const handleTransition = async (subId: string, targetStatus: string, reason?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/subscriptions/${subId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStatus, reason: reason || 'Action by staff' }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Transition rejected (HTTP ${res.status}): ${data.error}`);
        return;
      }
      showToast(`State changed to ${targetStatus.toUpperCase()}`);
      await loadAllData();
      if (selectedSub?.id === subId) {
        const updatedDetail = await fetch(`/api/subscriptions/${subId}`);
        const d = await updatedDetail.json();
        setSelectedSub(d.subscription);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 1-Click Renew
  const handleRenew = async (subId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/subscriptions/${subId}/renew`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`Subscription renewed! New sub ID: ${data.newSubscriptionId}`);
      await loadAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Inspect invoice "Why this amount?"
  const handleOpenWhyThisAmount = async (invId: string) => {
    try {
      const res = await fetch(`/api/invoices/${invId}`);
      const data = await res.json();
      if (res.ok && data.invoice.lines.length > 0) {
        const firstLine = data.invoice.lines[0];
        setExplainModal({
          isOpen: true,
          description: firstLine.description,
          explain: firstLine.explain,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Record payment
  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal.invoice) return;

    setActionLoading(true);
    try {
      const amountPaise = BigInt(Math.round(parseFloat(paymentModal.amount) * 100));
      const idempotencyKey = `pay_${paymentModal.invoice.id}_${Date.now()}`;

      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: paymentModal.invoice.id,
          amount: amountPaise.toString(),
          method: paymentModal.method,
          idempotencyKey,
          reference: `DEMO-REF-${Date.now().toString().slice(-6)}`,
          note: 'Recorded via Finance Cockpit',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast(`Payment of ₹${paymentModal.amount} recorded successfully`);
      setPaymentModal({ isOpen: false, invoice: null, amount: '', method: 'upi' });
      await loadAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Void payment
  const handleVoidPayment = async (paymentId: string) => {
    const reason = prompt('Enter reason for voiding this payment:');
    if (!reason) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voidReason: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showToast('Payment voided and invoice balance reopened');
      await loadAllData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* 1. Virtual Clock Interactive Banner */}
      <VirtualClockBanner onTimeAdvanced={loadAllData} />

      {/* 2. Top Header Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <Shield className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-slate-900">
                Brightloop <span className="text-indigo-600 font-semibold">Loopbook</span>
              </span>
              <span className="ml-2 text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                {user?.role || 'Staff'} View
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleTriggerBilling(true)}
              disabled={actionLoading}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-600" />
              Billing Dry Run
            </button>
            <button
              onClick={() => handleTriggerBilling(false)}
              disabled={actionLoading}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Run Billing For Real
            </button>
            <div className="h-5 w-px bg-slate-200 mx-1"></div>
            <span className="text-xs font-medium text-slate-600 hidden md:inline">
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

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 border-t border-slate-100 overflow-x-auto">
          {[
            { key: 'cockpit', label: 'Finance Cockpit', icon: BarChart3 },
            { key: 'subscriptions', label: 'Subscriptions', icon: Layers },
            { key: 'invoices', label: 'Invoices & Payments', icon: FileText },
            { key: 'ledger', label: 'Ledger Health', icon: CheckCircle2 },
            { key: 'radar', label: 'Renewal Radar', icon: Clock },
            { key: 'catalog', label: 'Products & Plans', icon: Tag },
            { key: 'discounts', label: 'Discounts', icon: TrendingUp },
            ...(user?.role === 'admin' ? [{ key: 'staff', label: 'Staff Management', icon: Users }] : []),
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
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

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1">
        {/* TAB 1: COCKPIT */}
        {activeTab === 'cockpit' && (
          <div className="space-y-6">
            {/* KPI Summary Cards (PRD Section 10) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Active Subscriptions
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900 font-mono">
                    {metrics?.activeSubscriptionsCount ?? '0'}
                  </span>
                  {metrics?.pausedSubscriptionsCount > 0 && (
                    <span className="text-xs text-amber-600 font-medium">
                      ({metrics.pausedSubscriptionsCount} paused)
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Monthly Recurring Revenue (MRR)
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-indigo-700 font-mono tabular-nums">
                    {metrics ? formatINR(BigInt(metrics.mrr)) : '₹0.00'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Normalized post-discount, pre-tax
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Annual Run Rate (ARR)
                </span>
                <div className="mt-1">
                  <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                    {metrics ? formatINR(BigInt(metrics.arr)) : '₹0.00'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">
                  MRR × 12
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Cash Collected
                </span>
                <div className="mt-1">
                  <span className="text-2xl font-bold text-emerald-600 font-mono tabular-nums">
                    {metrics ? formatINR(BigInt(metrics.cashCollected)) : '₹0.00'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Non-voided payments
                </span>
              </div>
            </div>

            {/* Invoiced vs Outstanding & Overdue */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Total Invoiced
                </span>
                <span className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1 block">
                  {metrics ? formatINR(BigInt(metrics.totalInvoiced)) : '₹0.00'}
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Outstanding AR (Confirmed)
                </span>
                <span className="text-xl font-bold text-slate-700 font-mono tabular-nums mt-1 block">
                  {metrics ? formatINR(BigInt(metrics.outstandingAr)) : '₹0.00'}
                </span>
              </div>

              <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-200 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
                    Revenue at Risk (Overdue AR)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-800">
                    {metrics?.overdueCount ?? 0} Invoices
                  </span>
                </div>
                <span className="text-xl font-bold text-rose-700 font-mono tabular-nums mt-1 block">
                  {metrics ? formatINR(BigInt(metrics.overdueAr)) : '₹0.00'}
                </span>
              </div>
            </div>

            {/* MRR Movement Waterfall (PRD Section 10 View 2) */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    MRR Movement Waterfall
                  </h3>
                  <p className="text-xs text-slate-500">
                    Computed from append-only <code className="font-mono text-indigo-600">mrr_events</code>
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-mono">Current Month</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-center">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Start MRR</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {waterfall ? formatINR(BigInt(waterfall.startMrr)) : '₹0.00'}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 uppercase font-semibold block">+ New</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    +{waterfall ? formatINR(BigInt(waterfall.newMrr)) : '₹0.00'}
                  </span>
                </div>
                <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                  <span className="text-[10px] text-indigo-700 uppercase font-semibold block">+ Expansion</span>
                  <span className="font-mono font-bold text-indigo-700 text-sm">
                    +{waterfall ? formatINR(BigInt(waterfall.expansionMrr)) : '₹0.00'}
                  </span>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <span className="text-[10px] text-amber-700 uppercase font-semibold block">- Contraction</span>
                  <span className="font-mono font-bold text-amber-700 text-sm">
                    -{waterfall ? formatINR(BigInt(waterfall.contractionMrr)) : '₹0.00'}
                  </span>
                </div>
                <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                  <span className="text-[10px] text-rose-700 uppercase font-semibold block">- Churn</span>
                  <span className="font-mono font-bold text-rose-700 text-sm">
                    -{waterfall ? formatINR(BigInt(waterfall.churnMrr)) : '₹0.00'}
                  </span>
                </div>
                <div className="p-3 bg-slate-900 text-white rounded-lg border border-slate-900">
                  <span className="text-[10px] text-slate-300 uppercase font-semibold block">= End MRR</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {waterfall ? formatINR(BigInt(waterfall.endMrr)) : '₹0.00'}
                  </span>
                </div>
              </div>
            </div>

            {/* Aging Breakdown Panel */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <h3 className="font-bold text-slate-900 text-sm mb-3">
                Overdue Aging Buckets
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {metrics?.agingBuckets &&
                  Object.entries(metrics.agingBuckets).map(([bucket, data]: [string, any]) => (
                    <div key={bucket} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">{bucket} Days</span>
                        <span className="text-[11px] font-semibold text-slate-500">{data.count} inv</span>
                      </div>
                      <span className="text-base font-bold font-mono text-slate-900 block mt-1">
                        {formatINR(BigInt(data.amount))}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SUBSCRIPTIONS */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">Filter Status:</span>
                {['all', 'draft', 'quotation', 'confirmed', 'active', 'closed'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setSubStatusFilter(st)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-colors ${
                      subStatusFilter === st
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Number</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Plan</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Start Date</th>
                      <th className="px-4 py-3">Next Invoice</th>
                      <th className="px-4 py-3 text-right">Total (Paise)</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">
                          {sub.number}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{sub.customer.company || sub.customer.name}</div>
                          <div className="text-[11px] text-slate-400">{sub.customer.name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-800">{sub.plan.name}</span>
                          <span className="text-[10px] text-slate-400 block capitalize">{sub.plan.billingPeriod}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={sub.status} />
                          {sub.pausedUntil && (
                            <span className="text-[10px] text-amber-600 block mt-0.5">Paused</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          {new Date(sub.startDate).toISOString().split('T')[0]}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          {sub.nextInvoiceDate ? new Date(sub.nextInvoiceDate).toISOString().split('T')[0] : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {formatINR(BigInt(sub.totalAmount))}
                        </td>
                        <td className="px-4 py-3 text-right space-x-1 whitespace-nowrap">
                          {sub.status === 'draft' && (
                            <button
                              onClick={() => handleTransition(sub.id, 'quotation')}
                              className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-[11px]"
                            >
                              Send Quote
                            </button>
                          )}
                          {sub.status === 'quotation' && (
                            <button
                              onClick={() => handleTransition(sub.id, 'confirmed')}
                              className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-[11px]"
                            >
                              Confirm
                            </button>
                          )}
                          {sub.status === 'confirmed' && (
                            <button
                              onClick={() => handleTransition(sub.id, 'active')}
                              className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-[11px]"
                            >
                              Activate
                            </button>
                          )}
                          {sub.status === 'active' && (
                            <>
                              <button
                                onClick={() => {
                                  const reason = prompt('Reason for closing:');
                                  if (reason) handleTransition(sub.id, 'closed', reason);
                                }}
                                className="px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-[11px]"
                              >
                                Close
                              </button>
                            </>
                          )}
                          {sub.status === 'closed' && (
                            <button
                              onClick={() => handleRenew(sub.id)}
                              className="px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 font-semibold text-[11px]"
                            >
                              Renew Link
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: INVOICES & PAYMENTS */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase">Filter:</span>
                {['all', 'confirmed', 'paid', 'overdue', 'cancelled'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setInvStatusFilter(st)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-colors ${
                      invStatusFilter === st
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Number</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3">Derived Status</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Paid / Balance</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-800">
                          {inv.number}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {inv.customerName}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">
                          {new Date(inv.periodStart).toISOString().split('T')[0]} →{' '}
                          {new Date(inv.periodEnd).toISOString().split('T')[0]}
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
                          <span className="text-emerald-700 font-semibold">{formatINR(BigInt(inv.amountPaid))}</span>
                          {BigInt(inv.balance) > 0n && (
                            <span className="text-slate-400 block text-[10px]">
                              Bal: {formatINR(BigInt(inv.balance))}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                          {/* "Why this amount?" Button */}
                          <button
                            onClick={() => handleOpenWhyThisAmount(inv.id)}
                            className="px-2 py-1 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-[11px] inline-flex items-center gap-1"
                          >
                            <HelpCircle className="w-3 h-3" />
                            Why this amount?
                          </button>

                          {/* Record Payment Button */}
                          {inv.status === 'confirmed' && BigInt(inv.balance) > 0n && (
                            <button
                              onClick={() => {
                                const balRupees = (Number(BigInt(inv.balance)) / 100).toFixed(2);
                                setPaymentModal({
                                  isOpen: true,
                                  invoice: inv,
                                  amount: balRupees,
                                  method: 'upi',
                                });
                              }}
                              className="px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-[11px] inline-flex items-center gap-1"
                            >
                              <CreditCard className="w-3 h-3" />
                              Pay
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: LEDGER HEALTH (PRD Section 7.6) */}
        {activeTab === 'ledger' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    Ledger Health & Integrity Verification
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live SQL checks guaranteeing zero double-billing and exact paisa reconciliation.
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs">
                  {ledgerHealth?.allGreen ? 'ALL CHECKS GREEN' : 'DISCREPANCIES DETECTED'}
                </span>
              </div>

              <div className="space-y-3">
                {ledgerHealth?.checks.map((c: any) => (
                  <div
                    key={c.id}
                    className={`p-3.5 rounded-lg border flex items-start justify-between ${
                      c.passed
                        ? 'bg-emerald-50/40 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${c.passed ? 'bg-emerald-600' : 'bg-rose-600'}`}></span>
                        <h4 className="font-bold text-xs">{c.title}</h4>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">{c.description}</p>
                      <p className="text-[11px] font-mono mt-1 font-semibold text-slate-800">{c.details}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      c.passed ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                    }`}>
                      {c.passed ? 'PASSED' : 'VIOLATION'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: RENEWAL RADAR (PRD Section 6 & 10) */}
        {activeTab === 'radar' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="mb-4 pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  Renewal Radar
                </h3>
                <p className="text-xs text-slate-500">
                  Subscriptions expiring within 7 / 30 / 60 days with 1-click renewal.
                </p>
              </div>

              {renewals.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No subscriptions expiring within the 60-day window.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {renewals.map((r) => (
                    <div key={r.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900">{r.number}</span>
                          <span className="font-semibold text-xs text-slate-800">{r.customerName}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.windowBucket === '7'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : r.windowBucket === '30'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            Expires in {r.daysUntilExpiry} days
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {r.planName} · Value: {formatINR(BigInt(r.totalAmount))}
                        </p>
                      </div>

                      <button
                        onClick={() => handleRenew(r.id)}
                        disabled={!r.allowRenew}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs disabled:opacity-40"
                      >
                        1-Click Renew
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: CATALOG */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <h3 className="font-bold text-slate-900 text-sm mb-3">
                Products & Variants (PRD Base 1,000 + Brand: Odoo +560 = 1,560)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map((p) => (
                  <div key={p.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">{p.name}</h4>
                        <span className="text-[10px] uppercase font-semibold text-indigo-600 block mt-0.5">{p.type}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {formatINR(BigInt(p.salesPrice))}
                      </span>
                    </div>

                    {p.attributes && p.attributes.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-200 text-xs">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold">Configured Variant Extras:</span>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {p.attributes[0].values.map((v: any) => (
                            <span key={v.id} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono text-slate-700">
                              {v.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <h3 className="font-bold text-slate-900 text-sm mb-3">
                Plans & D14 Lifecycle Flags
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((pl) => (
                  <div key={pl.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50/50">
                    <h4 className="font-bold text-slate-900 text-xs">{pl.name}</h4>
                    <span className="font-mono font-bold text-indigo-700 text-sm block mt-1">
                      {formatINR(BigInt(pl.price))} / {pl.billingPeriod}
                    </span>
                    <div className="mt-3 pt-2 border-t border-slate-200 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Min Quantity:</span>
                        <span className="font-bold text-slate-800">{pl.minQuantity} units</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Allow Pause:</span>
                        <span className={pl.allowPause ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                          {pl.allowPause ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Allow Early Close:</span>
                        <span className={pl.allowEarlyClose ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                          {pl.allowEarlyClose ? 'Yes' : 'No'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Auto Close on End:</span>
                        <span className={pl.autoCloseOnEnd ? 'text-amber-700 font-semibold' : 'text-slate-400'}>
                          {pl.autoCloseOnEnd ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: DISCOUNTS */}
        {activeTab === 'discounts' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Discount Rules & Redemptions
                  </h3>
                  <p className="text-xs text-slate-500">
                    Automatic evaluation at invoice generation; stops at limit or expiry.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {discounts.map((d) => (
                  <div key={d.id} className="p-4 rounded-lg border border-slate-200 bg-slate-50/50">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">{d.name}</h4>
                        <span className="text-[10px] text-slate-500 block capitalize">{d.scope} scope · {d.type}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-700 text-sm">
                        {d.type === 'percent' ? `${Number(d.value) / 100}%` : formatINR(BigInt(d.value))}
                      </span>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200 text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Usage Limit:</span>
                        <span className="font-bold font-mono">
                          {d.usedCount} of {d.usageLimit} uses
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Active Window:</span>
                        <span className="font-mono text-slate-700">
                          {new Date(d.startDate).toISOString().split('T')[0]} →{' '}
                          {new Date(d.endDate).toISOString().split('T')[0]}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: STAFF MANAGEMENT (ADMIN ONLY) */}
        {activeTab === 'staff' && user?.role === 'admin' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
              <h3 className="font-bold text-slate-900 text-sm mb-3">
                Internal Staff Users
              </h3>
              <div className="divide-y divide-slate-100">
                {staffUsers.map((st) => (
                  <div key={st.id} className="py-3 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">{st.name}</span>
                      <span className="font-mono text-[11px] text-slate-500">{st.emailNorm}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                      Staff Role
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* "Why this amount?" Price Waterfall Modal */}
      <ExplainPriceModal
        isOpen={explainModal.isOpen}
        onClose={() => setExplainModal({ isOpen: false, description: '', explain: null })}
        lineDescription={explainModal.description}
        explain={explainModal.explain}
      />

      {/* Record Payment Modal */}
      {paymentModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm mb-1">
              Record Payment against {paymentModal.invoice?.number}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter amount in Rupees. Supports partial payments.
            </p>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase">
                  Payment Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentModal.amount}
                  onChange={(e) => setPaymentModal({ ...paymentModal, amount: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase">
                  Payment Method
                </label>
                <select
                  value={paymentModal.method}
                  onChange={(e) => setPaymentModal({ ...paymentModal, method: e.target.value })}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPaymentModal({ isOpen: false, invoice: null, amount: '', method: 'upi' })}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs disabled:opacity-50"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
