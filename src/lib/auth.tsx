import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

type ProfileStatus = 'pending' | 'active' | 'suspended';
type ProfileRole = 'admin' | 'user';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: ProfileRole;
  status: ProfileStatus;
}

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id, data.session.user.email ?? '');
      }
      setLoading(false);
    }

    void bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        void loadProfile(nextSession.user.id, nextSession.user.email ?? '');
      } else {
        setProfile(null);
        setIsAdmin(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string, email: string) {
    const lowerEmail = email.toLowerCase();

    const { data: profileRow } = await supabase
      .from('user_profiles')
      .select('id,email,full_name,role,status')
      .eq('id', userId)
      .maybeSingle();

    if (!profileRow) {
      await supabase.from('user_profiles').upsert({
        id: userId,
        email: lowerEmail,
        role: 'user',
        status: 'pending',
      });
    }

    const { data: refreshed } = await supabase
      .from('user_profiles')
      .select('id,email,full_name,role,status')
      .eq('id', userId)
      .single();

    setProfile(refreshed as UserProfile);

    const { data: adminRow } = await supabase
      .from('app_admins')
      .select('email')
      .eq('email', lowerEmail)
      .maybeSingle();

    setIsAdmin(Boolean(adminRow) || refreshed?.role === 'admin');
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value = useMemo(
    () => ({ session, profile, loading, isAdmin, signOut }),
    [session, profile, loading, isAdmin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
