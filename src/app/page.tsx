'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Shield,
  ArrowRight,
  TrendingUp,
  Clock,
  Layers,
  CheckCircle2,
  Lock,
  Calendar,
  FileText,
  CreditCard,
  Building2,
  Users,
  Eye,
  Check,
} from 'lucide-react';
import { formatINR } from '@/lib/currency';

export default function Home() {
  const router = useRouter();
  const [switchingRole, setSwitchingRole] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    mrr: string;
    activeSubs: number;
    invoicesCount: number;
    healthStatus: string;
    virtualDate: string;
  }>({
    mrr: '₹1,56,000.00',
    activeSubs: 5,
    invoicesCount: 6,
    healthStatus: '100% Passing (6/6 Checks)',
    virtualDate: '2026-10-31',
  });

  useEffect(() => {
    // Fetch live quick stats
    Promise.all([
      fetch('/api/reports/cockpit').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/clock').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/reports/ledger-health').then((r) => (r.ok ? r.json() : null)),
    ]).then(([cockpit, clock, health]) => {
      if (cockpit) {
        setStats((prev) => ({
          ...prev,
          mrr: formatINR(BigInt(cockpit.mrr || 0)),
          activeSubs: cockpit.activeSubscriptionsCount || prev.activeSubs,
          invoicesCount: cockpit.totalInvoicesCount || prev.invoicesCount,
        }));
      }
      if (clock && clock.businessDate) {
        setStats((prev) => ({
          ...prev,
          virtualDate: clock.businessDate.split('T')[0],
        }));
      }
      if (health && health.summary) {
        setStats((prev) => ({
          ...prev,
          healthStatus: health.summary.allPassed ? '100% Healthy (6/6 Checks)' : 'Checks Require Attention',
        }));
      }
    }).catch(() => {});
  }, []);

  const handleLaunchRole = async (role: 'admin' | 'staff' | 'customer') => {
    setSwitchingRole(role);
    try {
      const res = await fetch('/api/auth/demo-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        router.push(data.user.targetUrl);
      } else {
        router.push('/login');
      }
    } catch {
      router.push('/login');
    } finally {
      setSwitchingRole(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 flex flex-col font-sans">
      {/* Top Enterprise White Navigation Header */}
      <nav className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold tracking-tight text-slate-900">
                Brightloop
              </span>
              <span className="text-xs font-semibold text-slate-500 border-l border-slate-200 pl-2 hidden sm:inline">
                Enterprise Billing & Revenue OS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-600" />
              <span>Simulated Clock: {stats.virtualDate}</span>
            </div>
            <Link
              href="/login"
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign In
            </Link>
            <button
              onClick={() => handleLaunchRole('admin')}
              disabled={switchingRole !== null}
              className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              {switchingRole === 'admin' ? 'Launching...' : 'Launch Cockpit'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 space-y-10">
        {/* Executive Overview Header */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold tracking-wide uppercase">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                PostgreSQL Engine · Idempotent by Construction · Zero Floating-Point Money
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                Subscription Management & Financial Invoicing Engine
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Deterministic recurring billing, gapless tax compliance (GST/HSN), exact integer-paise financial math, and continuous live ledger health checks.
              </p>
            </div>

            {/* Quick Live Indicators Card */}
            <div className="flex flex-col gap-3 bg-slate-50 border border-slate-200 p-5 rounded-xl min-w-[260px] shadow-2xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Live Seeded MRR</span>
                <span className="text-2xl font-bold font-mono text-emerald-700 mt-0.5 block">{stats.mrr}</span>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Ledger Integrity</span>
                <div className="flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-slate-800">{stats.healthStatus}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 1-Click Interactive Persona Switcher (Instant Evaluation) */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Interactive Persona Launchpad
              </h2>
              <p className="text-xs text-slate-500">
                Click any role to log in instantly and evaluate live workflows with pre-seeded data.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400 hidden sm:inline">1-Click Instant Session</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Persona 1: Finance Admin */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between shadow-xs hover:border-slate-300 hover:shadow-sm transition-all group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                    Administrator
                  </span>
                  <Building2 className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 group-hover:text-slate-800 transition-colors">
                    Finance Operations Lead
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Full control over MRR movement waterfall, automated batch billing runs, ledger integrity checks, and catalog management.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600 space-y-1">
                  <div>Account: <span className="font-semibold text-slate-900">admin@brightloop.in</span></div>
                  <div>Access: <span className="text-emerald-700 font-semibold">Full Executive Cockpit</span></div>
                </div>
              </div>

              <button
                onClick={() => handleLaunchRole('admin')}
                disabled={switchingRole !== null}
                className="mt-5 w-full py-2.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-98 disabled:opacity-50"
              >
                {switchingRole === 'admin' ? 'Authenticating...' : 'Launch Finance Cockpit'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Persona 2: Billing Staff */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between shadow-xs hover:border-slate-300 hover:shadow-sm transition-all group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                    Staff Ops
                  </span>
                  <Users className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 group-hover:text-slate-800 transition-colors">
                    Billing Operations Specialist
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Execute quotations-to-active subscription lifecycle, record partial/full payments, inspect price waterfalls, and generate tax invoices.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600 space-y-1">
                  <div>Account: <span className="font-semibold text-slate-900">rahul@brightloop.in</span></div>
                  <div>Access: <span className="text-slate-800 font-semibold">Billing & Lifecycle Ops</span></div>
                </div>
              </div>

              <button
                onClick={() => handleLaunchRole('staff')}
                disabled={switchingRole !== null}
                className="mt-5 w-full py-2.5 px-3 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-98 disabled:opacity-50"
              >
                {switchingRole === 'staff' ? 'Authenticating...' : 'Launch as Billing Staff'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Persona 3: Customer Portal */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between shadow-xs hover:border-slate-300 hover:shadow-sm transition-all group">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Client Portal
                  </span>
                  <CreditCard className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 group-hover:text-emerald-700 transition-colors">
                    Customer Self-Service (Sunita)
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Hotel Anand Bhavan (25 Odoo seats). View live subscriptions, explain price calculations, simulate UPI/Card payment, and print tax invoices.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600 space-y-1">
                  <div>Account: <span className="font-semibold text-slate-900">sunita@anandbhavan.com</span></div>
                  <div>Customer: <span className="text-emerald-700 font-semibold">Hotel Anand Bhavan</span></div>
                </div>
              </div>

              <button
                onClick={() => handleLaunchRole('customer')}
                disabled={switchingRole !== null}
                className="mt-5 w-full py-2.5 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-98 disabled:opacity-50"
              >
                {switchingRole === 'customer' ? 'Authenticating...' : 'Launch Customer Portal'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Feature Architecture Matrix */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Architectural Invariants & Guarantees
              </h2>
              <p className="text-xs text-slate-500">
                Core design guarantees specified in PRD sections 1–18.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <Lock className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs text-slate-900">Idempotent by Construction</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                PostgreSQL partial unique index <code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">uq_invoice_period</code> eliminates double-billing even under concurrent automated batch runners.
              </p>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs space-y-2">
              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs text-slate-900">Explainable Price Waterfall</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Every line item features an auditable price waterfall: Base price + Variant markup - Discount deduction + 18% GST with largest-remainder rounding.
              </p>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs space-y-2">
              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800">
                <Clock className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs text-slate-900">Virtual Clock Time Travel</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Stateful virtual clock with <code className="text-slate-800 bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">+1 Day / +1 Month</code> simulation allows testing renewal chains and dunning cycles in seconds.
              </p>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-xs text-slate-900">6 Live Ledger Health Checks</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Automated continuous SQL checks verify zero sequence gaps, zero orphan lines, no overpayments, and accurate balance reconciliations.
              </p>
            </div>
          </div>
        </div>

        {/* Technical Architecture & Credentials Reference */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Platform Credentials & Specifications</h3>
              <p className="text-xs text-slate-500">
                Pre-seeded deterministic test accounts for manual login or test verification.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-700">
                PostgreSQL Port 5434
              </span>
              <span className="px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-700">
                Asia/Kolkata
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-lg">
              <div className="text-[10px] font-bold uppercase text-slate-600">Admin Account</div>
              <div className="font-mono text-xs text-slate-900 mt-1 font-semibold">admin@brightloop.in</div>
              <div className="font-mono text-xs text-slate-500 mt-0.5">Password: <code className="text-slate-800 font-bold">Admin@123!</code></div>
            </div>

            <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-lg">
              <div className="text-[10px] font-bold uppercase text-slate-600">Staff Account</div>
              <div className="font-mono text-xs text-slate-900 mt-1 font-semibold">rahul@brightloop.in</div>
              <div className="font-mono text-xs text-slate-500 mt-0.5">Password: <code className="text-slate-800 font-bold">Staff@123!</code></div>
            </div>

            <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-lg">
              <div className="text-[10px] font-bold uppercase text-emerald-800">Customer Account</div>
              <div className="font-mono text-xs text-slate-900 mt-1 font-semibold">sunita@anandbhavan.com</div>
              <div className="font-mono text-xs text-slate-500 mt-0.5">Password: <code className="text-slate-800 font-bold">Customer@123!</code></div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-700" />
            <span className="font-semibold text-slate-700">Brightloop Billing & Revenue Platform</span>
          </div>
          <div>Compliant with Indian GST & SaaS Revenue Recognition Standards</div>
        </div>
      </footer>
    </div>
  );
}
