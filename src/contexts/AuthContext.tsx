import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/lib/database.types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  tenantId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (params: SignUpParams) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
  isStaff: () => boolean;
  isSuperAdmin: () => boolean;
  isParticipant: () => boolean;
}

interface SignUpParams {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  tenantId?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data as Profile);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_IN' && session?.user) {
          setIsLoading(true); // keep guards waiting until profile is fetched
          await fetchProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signUp = async (params: SignUpParams): Promise<{ error: string | null }> => {
    const { email, password, firstName, lastName, phone, tenantId } = params;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: phone ?? null,
          tenant_id: tenantId ?? null,
          role: 'participant',
        },
      },
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const hasRole = (...roles: UserRole[]): boolean => {
    if (!profile) return false;
    return roles.includes(profile.role);
  };

  const isStaff = () =>
    hasRole('super_admin', 'operations_admin', 'supplier_manager', 'field_team', 'driver', 'd3_technical_admin');

  const isSuperAdmin = () => hasRole('super_admin');
  const isParticipant = () => hasRole('participant');

  const value: AuthContextValue = {
    user,
    session,
    profile,
    role: profile?.role ?? null,
    tenantId: profile?.tenant_id ?? null,
    isLoading,
    isAuthenticated: !!user,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    hasRole,
    isStaff,
    isSuperAdmin,
    isParticipant,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
