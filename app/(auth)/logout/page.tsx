'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await supabase.auth.signOut();
        // Limpa cache se necessário
        window.localStorage.clear();
      } catch (error) {
        console.error('Logout error:', error);
      } finally {
        router.push('/');
      }
    };

    performLogout();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="text-center">
        <LoadingSpinner />
        <p className="mt-4 text-slate-600 dark:text-slate-400 font-medium">
          Encerrando sessão com segurança...
        </p>
      </div>
    </div>
  );
}
