'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Navbar from '@/components/Navbar';
import DailyProductOrdersView from '@/components/DailyProductOrdersView';
import { Profile } from '@/types/database';

export default function AdminDailyProductsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      setAuthLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        router.push('/sales');
        return;
      }

      if (isMounted) {
        setCurrentProfile(profile);
        setAuthLoading(false);
      }
    }

    checkAuth();
    return () => {
      isMounted = false;
    };
  }, [router]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <>
      <Navbar currentProfile={currentProfile} activeTab="daily-products" />
      <DailyProductOrdersView
        portal="admin"
        backUrl="/admin"
        currentProfile={currentProfile}
      />
    </>
  );
}
