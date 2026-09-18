'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import {
  User,
  Phone,
  Tag,
  Lock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Sparkles,
  ArrowLeft,
  Save,
  KeyRound,
  ShieldCheck,
  Truck,
  TrendingUp,
  Upload,
  Camera,
  Wallet,
  CreditCard,
  Building2,
} from 'lucide-react';
import { Profile, UpsellReward } from '@/types/database';
import { formatCurrency } from '@/lib/utils';

export default function UniversalProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  // Editable Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [couponCode, setCouponCode] = useState('');

  // Payment Information fields
  const [paymentMethod, setPaymentMethod] = useState<'bkash' | 'nagad' | 'rocket' | 'bank'>('bkash');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Stats / Rewards summary
  const [rewards, setRewards] = useState<UpsellReward[]>([]);
  const [copiedCoupon, setCopiedCoupon] = useState(false);

  // Colorful Cat Avatar Presets
  const catAvatarPresets = [
    { name: 'Orange Tabby', url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=160&auto=format&fit=crop&q=80' },
    { name: 'Calico Cat', url: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=160&auto=format&fit=crop&q=80' },
    { name: 'Cool Cat', url: 'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=160&auto=format&fit=crop&q=80' },
    { name: 'Ginger Kitten', url: 'https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=160&auto=format&fit=crop&q=80' },
    { name: 'White Fluff', url: 'https://images.unsplash.com/photo-1561948955-570b270e7c36?w=160&auto=format&fit=crop&q=80' },
    { name: 'Striped Cat', url: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=160&auto=format&fit=crop&q=80' },
    { name: 'Grey Persian', url: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=160&auto=format&fit=crop&q=80' },
    { name: 'British Blue', url: 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?w=160&auto=format&fit=crop&q=80' },
  ];

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Image file must be under 5MB');
      return;
    }

    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 256;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setAvatarUrl(compressed);
        }
        setUploadingImage(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    async function loadData() {
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
        setAvatarUrl(userProfile.avatar_url || '');
        setCouponCode(userProfile.coupon_code || '');

        if (userProfile.payment_info) {
          const pi = userProfile.payment_info as any;
          setPaymentMethod(pi.method || 'bkash');
          setAccountNumber(pi.account_number || '');
          setAccountName(pi.account_name || '');
          setBankName(pi.bank_name || '');
          setBranchName(pi.branch_name || '');
          setRoutingNumber(pi.routing_number || '');
        }

        // Fetch rewards if sales rep
        if (userProfile.role === 'sales') {
          const { data: userRewards } = await supabase
            .from('upsell_rewards')
            .select('*')
            .eq('sales_rep_id', user.id);

          if (userRewards) {
            setRewards(userRewards as UpsellReward[]);
          }
        }
      }
      setLoading(false);
    }

    loadData();
  }, [router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setSaveSuccess('');
    setSaveError('');

    try {
      const updateData: any = {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        payment_info: {
          method: paymentMethod,
          account_number: accountNumber.trim(),
          account_name: accountName.trim(),
          bank_name: bankName.trim(),
          branch_name: branchName.trim(),
          routing_number: routingNumber.trim(),
        },
        updated_at: new Date().toISOString(),
      };

      if (profile.role === 'sales' && couponCode.trim()) {
        updateData.coupon_code = couponCode.trim().toUpperCase();
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile.id)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('This coupon code is already taken. Please choose another one.');
        }
        throw error;
      } else if (data) {
        setProfile(data);
        setSaveSuccess('Profile settings updated successfully!');
        setTimeout(() => setSaveSuccess(''), 4000);
      }
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setUpdatingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordError(error.message);
      } else {
        setPasswordSuccess('Password updated securely! Use your new password on next sign in.');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordSuccess(''), 5000);
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const copyCouponToClipboard = () => {
    if (profile?.coupon_code) {
      navigator.clipboard.writeText(profile.coupon_code);
      setCopiedCoupon(true);
      setTimeout(() => setCopiedCoupon(false), 2000);
    }
  };

  const totalEarned = rewards.reduce((sum, r) => sum + Number(r.bonus_amount || 0), 0);
  const approvedEarned = rewards
    .filter((r) => r.status === 'approved' || r.status === 'paid')
    .reduce((sum, r) => sum + Number(r.bonus_amount || 0), 0);

  const getRoleDashboardPath = (role?: string) => {
    if (role === 'admin') return '/admin';
    if (role === 'packing') return '/packing';
    return '/sales';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar currentProfile={null} />
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600 mb-3"></div>
          <p className="text-slate-600 font-medium">Loading profile preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar currentProfile={profile} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <button
              onClick={() => router.push(getRoleDashboardPath(profile?.role))}
              className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back to Workspace
            </button>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              My Profile & Settings
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Customize your staff persona, operational contact details, and account security.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {profile?.role === 'admin' && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                System Administrator
              </span>
            )}
            {profile?.role === 'packing' && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                <Truck className="w-3.5 h-3.5 mr-1" />
                Fulfillment & Packing Team
              </span>
            )}
            {profile?.role === 'sales' && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <TrendingUp className="w-3.5 h-3.5 mr-1" />
                Sales Executive
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Quick Profile Card */}
          <div className="lg:col-span-1 space-y-6">
            {/* Persona Summary Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center">
              <div className="relative inline-block mx-auto mb-4">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-tr from-brand-600 to-emerald-400 p-0.5 shadow-md">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={fullName || 'Avatar'}
                      className="w-full h-full rounded-full object-cover bg-white"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-extrabold text-2xl">
                      {(fullName || profile?.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              <h2 className="text-lg font-bold text-slate-900">{fullName || 'Staff Member'}</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{profile?.email}</p>

              {phone && (
                <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-slate-100 text-slate-700 font-medium mt-2">
                  <Phone className="w-3 h-3 mr-1 text-slate-400" />
                  {phone}
                </div>
              )}

              {bio && (
                <p className="text-xs text-slate-600 italic bg-slate-50 rounded-xl p-3 mt-4 border border-slate-100 text-left">
                  &ldquo;{bio}&rdquo;
                </p>
              )}

              {/* Sales Rep Earnings Summary (if Sales) */}
              {profile?.role === 'sales' && (
                <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-2 gap-2 text-left">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="text-[10px] font-semibold uppercase text-slate-400">
                      Total Rewards
                    </div>
                    <div className="text-sm font-bold text-brand-600">
                      {formatCurrency(totalEarned)}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="text-[10px] font-semibold uppercase text-slate-400">
                      Approved/Paid
                    </div>
                    <div className="text-sm font-bold text-emerald-600">
                      {formatCurrency(approvedEarned)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sales Rep Coupon Card */}
            {profile?.role === 'sales' && (
              <div className="bg-gradient-to-br from-brand-50 to-emerald-50 rounded-2xl p-6 border border-emerald-200 shadow-sm relative overflow-hidden">
                <div className="flex items-center space-x-2 text-emerald-900 font-bold mb-2">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  <span>My Unique Customer Coupon</span>
                </div>
                <p className="text-xs text-emerald-800 mb-4 leading-relaxed">
                  When a customer uses this coupon on the website or manual orders, the sale is
                  auto-assigned to you with your commission!
                </p>

                <div className="bg-white rounded-xl p-3.5 border-2 border-dashed border-emerald-300 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                      Active Coupon
                    </span>
                    <span className="font-mono text-base font-extrabold text-slate-900">
                      {profile?.coupon_code || 'NONE'}
                    </span>
                  </div>

                  {profile?.coupon_code && (
                    <button
                      onClick={copyCouponToClipboard}
                      className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
                    >
                      {copiedCoupon ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Customization Forms */}
          <div className="lg:col-span-2 space-y-8">
            {/* Section 1: Personal Information */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
              <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Personal Information</h2>
                  <p className="text-xs text-slate-500">
                    Update how your name and contact appear across the order dashboard
                  </p>
                </div>
              </div>

              {saveSuccess && (
                <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center space-x-3 text-emerald-800 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <span>{saveSuccess}</span>
                </div>
              )}

              {saveError && (
                <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center space-x-3 text-rose-800 text-sm">
                  <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Shakil Ahmed"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      Contact Phone *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="017XXXXXXXX"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                {profile?.role === 'sales' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      My Customer Coupon Code
                    </label>
                    <div className="relative">
                      <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                        placeholder="SHAKIL10"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 font-mono font-bold text-sm uppercase focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                {/* Avatar Selection: Cat Avatars & Custom Upload */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Profile Avatar
                    </label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
                    >
                      <Upload className="w-3.5 h-3.5 text-slate-500" />
                      <span>{uploadingImage ? 'Processing...' : 'Upload Custom Picture'}</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageFileChange}
                    />
                  </div>

                  {/* Colorful Cat Avatars Grid */}
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block mb-2">
                      Select a Cat Avatar:
                    </span>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
                      {catAvatarPresets.map((cat, idx) => {
                        const isSelected = avatarUrl === cat.url;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setAvatarUrl(cat.url)}
                            className={`flex flex-col items-center p-1.5 rounded-xl border-2 transition-all ${
                              isSelected
                                ? 'border-brand-600 bg-brand-50/50 shadow-xs ring-2 ring-brand-100 scale-105'
                                : 'border-slate-200 hover:border-slate-300 bg-white'
                            }`}
                            title={cat.name}
                          >
                            <div className="w-11 h-11 rounded-full overflow-hidden bg-slate-100">
                              <img
                                src={cat.url}
                                alt={cat.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span className="text-[9px] text-slate-600 font-medium truncate w-full text-center mt-1">
                              {cat.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Custom Image URL Input */}
                  <div className="pt-2">
                    <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                      Or paste an external Image URL:
                    </label>
                    <input
                      type="url"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    Short Bio
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Role description, WhatsApp availability, or team notes..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm shadow-md shadow-brand-200 transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving changes...' : 'Save Profile'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Section 2: Payout & Banking Information (for commission earnings) */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
              <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Payout & Banking Information</h2>
                  <p className="text-xs text-slate-500">
                    Configure your wallet or bank account where your daily commission payouts will be sent
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-5">
                {/* Method selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                    Preferred Payout Method *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: 'bkash', label: 'bKash', icon: Wallet },
                      { id: 'nagad', label: 'Nagad', icon: Wallet },
                      { id: 'rocket', label: 'Rocket', icon: Wallet },
                      { id: 'bank', label: 'Bank Transfer', icon: Building2 },
                    ].map((m) => {
                      const Icon = m.icon;
                      const isSel = paymentMethod === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id as any)}
                          className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center space-y-1.5 ${
                            isSel
                              ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-100 font-bold text-emerald-900'
                              : 'border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${isSel ? 'text-emerald-600' : 'text-slate-400'}`} />
                          <span className="text-xs">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Account / Mobile number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                    {paymentMethod === 'bank' ? 'Bank Account Number *' : `${paymentMethod.toUpperCase()} Personal Number *`}
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder={paymentMethod === 'bank' ? '1234567890123' : '017XXXXXXXX'}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>

                {/* Bank Details (Conditional) */}
                {paymentMethod === 'bank' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Account Holder Name *
                      </label>
                      <input
                        type="text"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        placeholder="e.g. Saheduzzaman Nour"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Bank Name *
                      </label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. Dutch-Bangla Bank"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Branch Name
                      </label>
                      <input
                        type="text"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        placeholder="e.g. Dhanmondi Branch"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                        Routing Number
                      </label>
                      <input
                        type="text"
                        value={routingNumber}
                        onChange={(e) => setRoutingNumber(e.target.value)}
                        placeholder="e.g. 090270000"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-200 transition-all disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Saving...' : 'Save Payment Information'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Section 2: Change Password & Security */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
              <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Account Security</h2>
                  <p className="text-xs text-slate-500">
                    Change your password to keep your dashboard access safe
                  </p>
                </div>
              </div>

              {passwordSuccess && (
                <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center space-x-3 text-emerald-800 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {passwordError && (
                <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center space-x-3 text-rose-800 text-sm">
                  <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={updatingPassword || !newPassword}
                    className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-md transition-all disabled:opacity-50"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{updatingPassword ? 'Updating...' : 'Update Password'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
