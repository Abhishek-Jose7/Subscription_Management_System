'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Shield, ArrowRight, Lock, Mail, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Login failed');
      }

      // Role-based redirect (PRD Decision D4)
      if (data.user.role === 'customer') {
        router.push('/portal');
      } else {
        router.push('/app');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail);
    setPassword(rolePass);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-md">
            <Shield className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            Brightloop <span className="text-indigo-600 font-semibold">Billing</span>
          </span>
        </div>
        <h2 className="mt-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
          Enterprise Subscription & Revenue Platform
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Email Address
              </label>
              <div className="mt-1 relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Password
              </label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="•••••••••"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 border border-transparent rounded-lg shadow-xs text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 transition-colors disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In to Brightloop Billing'}
            </button>
          </form>

          {/* Quick Demo Logins for Judges / Pair Programming */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
              1-Click Demo Credentials:
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@brightloop.in', 'Admin@123!')}
                className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-200 transition-colors flex items-center justify-between text-xs font-medium text-slate-700"
              >
                <span>Admin: <strong className="text-slate-900">admin@brightloop.in</strong></span>
                <span className="text-[10px] bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded">All Access</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('rahul@brightloop.in', 'Staff@123!')}
                className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-200 transition-colors flex items-center justify-between text-xs font-medium text-slate-700"
              >
                <span>Staff: <strong className="text-slate-900">rahul@brightloop.in</strong></span>
                <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded">Ops</span>
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('sunita@anandbhavan.com', 'Customer@123!')}
                className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50/50 hover:border-indigo-200 transition-colors flex items-center justify-between text-xs font-medium text-slate-700"
              >
                <span>Customer: <strong className="text-slate-900">sunita@anandbhavan.com</strong></span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">Portal</span>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/signup"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
            >
              Don't have an account? Sign up with live password checklist →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
