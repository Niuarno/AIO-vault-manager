'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  User,
  Phone,
  Tag,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Truck,
  TrendingUp,
  Image as ImageIcon,
} from 'lucide-react';
import { Profile } from '@/types/database';

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [couponCode, setCouponCode] = useState('');

  // Curated Professional SaaS Avatar Presets
  const avatarPresets = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  ];

  useEffect(() => {
    async function loadUser() {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (userProfile) {
        setProfile(userProfile);
        setFullName(userProfile.full_name || '');
        setPhone(userProfile.phone || '');
        setBio(userProfile.bio || '');
        setAvatarUrl(userProfile.avatar_url || avatarPresets[0]);
        if (userProfile.coupon_code) {
          setCouponCode(userProfile.coupon_code);
        } else {
          // Pre-generate a smart coupon suggestion based on email or name
          const baseName = (userProfile.full_name || user.email?.split('@')[0] || 'REP')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');
          setCouponCode(`${baseName.slice(0, 6)}10`);
        }

        // If profile is already complete, redirect to designated workspace
        if (userProfile.full_name?.trim() && userProfile.phone?.trim() && userProfile.phone.length >= 8) {
          redirectToRole(userProfile.role);
          return;
        }
      }
      setLoading(false);
    }

    loadUser();
  }, [router]);

  const redirectToRole = (role: string) => {
    if (role === 'admin') router.push('/admin');
    else if (role === 'packing') router.push('/packing');
    else router.push('/sales');
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    if (!phone.trim() || phone.trim().length < 8) {
      setErrorMsg('Please enter a valid phone number (at least 8 digits) for operational contact.');
      return;
    }

    if (!profile) return;

    setSubmitting(true);

    try {
      const updatePayload: any = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (profile.role === 'sales' && couponCode.trim()) {
        updatePayload.coupon_code = couponCode.trim().toUpperCase();
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', profile.id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('This coupon code is already taken. Please choose another one.');
        }
        throw error;
      }

      // Smooth redirect to role portal
      redirectToRole(profile.role);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to complete profile setup.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <div className="inline-block animate-spin rounded-full h-9 w-9 border-b-2 border-brand-500 mb-3"></div>
          <p className="text-slate-400 text-sm font-medium">Verifying account credentials...</p>
        </div>
      </div>
    );
  }

  const roleLabel =
    profile?.role === 'admin'
      ? 'Administrator'
      : profile?.role === 'packing'
      ? 'Fulfillment & Packing'
      : 'Sales Representative';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full mx-auto">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-500 to-emerald-400 text-white font-black text-xl shadow-lg shadow-brand-500/25 mb-3">
            B
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Complete Your Staff Profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-md mx-auto">
            To coordinate orders and attribute sales, every team member must set up their identity and contact details before accessing the system.
          </p>
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20 mt-3">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Assigned Role: {roleLabel}
          </div>
        </div>

        {/* Onboarding Card */}
        <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-6 sm:p-8 shadow-2xl">
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleCompleteOnboarding} className="space-y-6">
            {/* Step 1: Avatar Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                1. Choose Profile Avatar
              </label>
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-brand-500 bg-slate-800 shadow-md flex-shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-slate-400">
                      {fullName ? fullName[0].toUpperCase() : 'U'}
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap gap-2">
                    {avatarPresets.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAvatarUrl(preset)}
                        className={`w-8 h-8 rounded-xl overflow-hidden border-2 transition-all ${
                          avatarUrl === preset
                            ? 'border-brand-400 scale-110 shadow-md shadow-brand-500/20'
                            : 'border-slate-700 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={preset} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    placeholder="Or paste custom image URL..."
                    className="mt-2 w-full px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Identity & Contact */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                2. Contact & Identification
              </label>

              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Tanvir Hasan"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">
                  Primary Contact Phone (WhatsApp) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Used by dispatch and team leads for operational order coordination.
                </p>
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">
                  Short Bio or Note (Optional)
                </label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Sales executive focusing on Messenger conversions & high-ticket upsells..."
                  className="w-full px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                />
              </div>

              {/* Step 3: Sales Rep Coupon Code Setup (If Sales) */}
              {profile?.role === 'sales' && (
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-brand-500/5 border border-emerald-500/20 space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
                    <Tag className="w-4 h-4" />
                    <span>My Unique Customer Coupon Code</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Whenever customers use this coupon on the website or manual orders, the sale is
                    automatically attributed to you and you earn upsell commission!
                  </p>
                  <input
                    type="text"
                    required
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                    placeholder="BOYON10"
                    className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-emerald-500/30 text-emerald-300 font-mono font-bold text-sm tracking-wider uppercase focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-gradient-to-r from-brand-600 to-emerald-500 hover:from-brand-500 hover:to-emerald-400 text-white font-bold text-sm shadow-lg shadow-brand-500/20 transition-all disabled:opacity-50 active:scale-[0.99]"
            >
              <span>{submitting ? 'Setting up workspace...' : 'Complete Profile & Launch Workspace'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
