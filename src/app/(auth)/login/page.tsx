'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { TrendingUp, Truck, ArrowRight, Lock, Mail, User, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'sales' | 'packing'>('sales');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            fullName,
            role,
          }),
        });

        const regData = await res.json();
        if (!res.ok) {
          throw new Error(regData.error || 'Failed to create account.');
        }

        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInErr) throw signInErr;

        window.location.href = '/onboarding';
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        window.location.href = '/';
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper text-ink p-4 sm:p-6 lg:p-8">
      <div className="max-w-md w-full">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-sm bg-ink text-paper font-bold text-xl mb-3 border border-rule">
            B
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight font-display">
            Boyon <span className="text-accent">OMS</span>
          </h1>
          <p className="text-xs text-ink-muted mt-1.5">
            Multi-channel order fulfillment and live inventory
          </p>
        </div>

        {/* Card */}
        <div className="bg-paper-3 rounded-sm p-6 sm:p-8 border-2 border-rule shadow-sm">
          <div className="flex border-b border-rule mb-6" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!isSignUp}
              onClick={() => {
                setIsSignUp(false);
                setErrorMsg(null);
              }}
              className={`flex-1 pb-2.5 text-xs font-semibold text-center border-b-2 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                !isSignUp
                  ? 'border-ink text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isSignUp}
              onClick={() => {
                setIsSignUp(true);
                setErrorMsg(null);
              }}
              className={`flex-1 pb-2.5 text-xs font-semibold text-center border-b-2 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                isSignUp
                  ? 'border-ink text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              Create Account
            </button>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3 bg-rose-50 border border-rose-200 rounded-sm text-rose-800 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-sm text-emerald-800 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div>
                  <label className="block text-xs font-medium text-ink mb-1.5">
                    Full name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-ink-muted absolute left-3 top-3" aria-hidden="true" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Sarah Jenkins"
                      className="w-full pl-9 pr-3 py-2 bg-paper border border-rule rounded-sm text-xs text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink mb-1.5">
                    Select role
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('sales')}
                      className={`p-2.5 rounded-sm border text-center transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                        role === 'sales'
                          ? 'border-ink bg-paper-2 text-ink font-semibold'
                          : 'border-rule bg-paper text-ink-muted hover:text-ink'
                      }`}
                    >
                      <TrendingUp className="w-4 h-4 mx-auto mb-1 text-accent" aria-hidden="true" />
                      <span className="text-xs">Sales Rep</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('packing')}
                      className={`p-2.5 rounded-sm border text-center transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                        role === 'packing'
                          ? 'border-ink bg-paper-2 text-ink font-semibold'
                          : 'border-rule bg-paper text-ink-muted hover:text-ink'
                      }`}
                    >
                      <Truck className="w-4 h-4 mx-auto mb-1 text-accent-2" aria-hidden="true" />
                      <span className="text-xs">Packing</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-ink mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-ink-muted absolute left-3 top-3" aria-hidden="true" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sales@boyon.shop"
                  className="w-full pl-9 pr-3 py-2 bg-paper border border-rule rounded-sm text-xs text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-ink mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-ink-muted absolute left-3 top-3" aria-hidden="true" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-paper border border-rule rounded-sm text-xs text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-accent"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-ink hover:bg-ink-2 text-paper rounded-sm text-xs font-semibold flex items-center justify-center space-x-2 transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              <span>{loading ? 'Processing…' : isSignUp ? 'Create Staff Account' : 'Sign In to Dashboard'}</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>

          {/* Quick Notice */}
          <div className="mt-6 pt-4 border-t border-rule text-center">
            <p className="text-xs text-ink-muted">
              Protected by Supabase Auth with Row-Level Role Security
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
