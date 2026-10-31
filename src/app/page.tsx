import Link from 'next/link';
import {
  Shield,
  ArrowRight,
  TrendingUp,
  Clock,
  Layers,
  CheckCircle2,
  Lock,
  Calendar,
  Sparkles,
} from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <nav className="border-b border-slate-800 bg-slate-950/70 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Shield className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              Brightloop <span className="text-indigo-400 font-medium">Loopbook</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/app"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all active:scale-95"
            >
              Launch Cockpit
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-16 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 text-xs font-medium mb-6 animate-in fade-in slide-in-from-bottom-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Brightloop Subscription Management & Billing Engine</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl leading-tight">
          A subscription business is a{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-emerald-400">
            time machine for obligations.
          </span>
        </h1>

        <p className="mt-5 text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed">
          Know at any moment what we owe the customer, what the customer owes us, and when each becomes true. Automatic, idempotent, and explainable to the paisa.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          <Link
            href="/app"
            className="px-6 py-3 rounded-xl bg-white text-slate-900 font-bold text-sm hover:bg-slate-100 shadow-lg shadow-white/10 flex items-center gap-2 transition-all active:scale-95"
          >
            Open Finance Cockpit (/app)
            <ArrowRight className="w-4 h-4 text-indigo-600" />
          </Link>
          <Link
            href="/portal"
            className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-sm flex items-center gap-2 transition-all active:scale-95"
          >
            Customer Self-Service Portal (/portal)
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-semibold text-sm transition-all active:scale-95"
          >
            Signup with Live Password Checklist →
          </Link>
        </div>

        {/* Core Principles Grid (PRD Section 1) */}
        <div className="mt-20 w-full text-left">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center mb-8">
            Core Architectural Principles Built In
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-800/50 flex items-center justify-center text-emerald-400 mb-3">
                <Lock className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-100">Idempotent by Construction</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Billing the same period twice is impossible at the database level with PostgreSQL partial unique index (<code className="text-emerald-400 font-mono text-[11px]">uq_invoice_period</code>).
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-800/50 flex items-center justify-center text-indigo-400 mb-3">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-100">Explainable Money</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Every invoice line provides a full price waterfall modal answering "why this amount?" (base → variant → discount → tax) in exact integer paise.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-800/50 flex items-center justify-center text-sky-400 mb-3">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-100">Time is a Dependency</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                A virtual clock powers renewals, expiries, dunning, and time-travel demos in seconds with live <code className="text-sky-400 font-mono text-[11px]">+1 Day / +1 Month</code> controls.
              </p>
            </div>
          </div>
        </div>

        {/* Demo Script Credentials Guide */}
        <div className="mt-12 w-full p-6 rounded-2xl bg-slate-950 border border-slate-800 text-left">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-sm text-white">Pre-Seeded Demo Credentials</h3>
            </div>
            <span className="text-xs font-mono text-slate-400">PostgreSQL Port 5434</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-indigo-400 uppercase font-bold block">Admin Account</span>
              <span className="font-bold text-white block mt-1">admin@brightloop.in</span>
              <span className="font-mono text-slate-400">Admin@123!</span>
            </div>
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Internal Staff</span>
              <span className="font-bold text-white block mt-1">rahul@brightloop.in</span>
              <span className="font-mono text-slate-400">Staff@123!</span>
            </div>
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
              <span className="text-[10px] text-emerald-400 uppercase font-bold block">Customer (Sunita)</span>
              <span className="font-bold text-white block mt-1">sunita@anandbhavan.com</span>
              <span className="font-mono text-slate-400">Customer@123!</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        Loopbook — Brightloop Subscription Management System · Built to the exact PRD specification.
      </footer>
    </div>
  );
}
