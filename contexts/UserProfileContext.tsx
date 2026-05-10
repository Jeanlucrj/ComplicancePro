'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface UserProfile {
  userId: string | null;
  tipoAnvisa: 'cosmetico' | 'medicamento' | 'ambos';
  profileLoaded: boolean;
}

const UserProfileContext = createContext<UserProfile>({
  userId: null,
  tipoAnvisa: 'ambos',
  profileLoaded: false,
});

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [tipoAnvisa, setTipoAnvisa] = useState<'cosmetico' | 'medicamento' | 'ambos'>('ambos');
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;

        const uid = session.user.id;

        // Caminho rápido: user_metadata (não faz request HTTP extra)
        let tipo: 'cosmetico' | 'medicamento' | 'ambos' =
          (session.user.user_metadata?.tipo_anvisa as any) || 'ambos';

        // Fallback: busca o perfil da empresa no banco
        const res = await fetch(`/api/fornecedores?userId=${uid}&onlyPerfil=true`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          if (data.fornecedores?.[0]?.tipo_anvisa) {
            tipo = data.fornecedores[0].tipo_anvisa;
          }
        }

        if (!cancelled) {
          setUserId(uid);
          setTipoAnvisa(tipo);
        }
      } catch (e) {
        console.error('[UserProfile] Erro ao carregar perfil:', e);
      } finally {
        if (!cancelled) setProfileLoaded(true);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <UserProfileContext.Provider value={{ userId, tipoAnvisa, profileLoaded }}>
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  return useContext(UserProfileContext);
}
