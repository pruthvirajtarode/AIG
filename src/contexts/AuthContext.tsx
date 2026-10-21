import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { Profile, UserRole } from '@/lib/database.types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  tenantId: string | null;
  isLoading: boolean;
  profileFetchAttempted: boolean;
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

// ── Hard timeout: never wait more than 4 s for any auth operation ──
const AUTH_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileFetchAttempted, setProfileFetchAttempted] = useState(false);
  const initialised = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured) {
      // Dev mode: set a mock profile so the UI still loads
      setProfile({
        id: userId,
        tenant_id: 'demo',
        first_name: 'Demo',
        last_name: 'Admin',
        email: 'demo@alihsangroup.sg',
        role: 'super_admin',
        phone: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Profile);
      setProfileFetchAttempted(true);
      return;
    }

    try {
      // Try RPC first with a hard timeout
      const rpcResult = await withTimeout(supabase.rpc('get_my_profile'), AUTH_TIMEOUT_MS);
      if (rpcResult && !rpcResult.error && rpcResult.data) {
        setProfile(rpcResult.data as Profile);
        setProfileFetchAttempted(true);
        return;
      }

      // Fallback: direct table query with timeout
      const rowResult = await withTimeout(
        supabase.from('profiles').select('*').eq('id', userId).single(),
        AUTH_TIMEOUT_MS
      );
      if (rowResult && !rowResult.error && rowResult.data) {
        setProfile(rowResult.data as Profile);
      } else {
        console.warn('Profile fetch failed — running without profile data');
      }
    } catch (e) {
      console.warn('Profile fetch exception:', e);
    } finally {
      setProfileFetchAttempted(true);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    // Overall timeout: if auth takes >5s, unblock the UI anyway
    const hardTimeout = setTimeout(() => {
      console.warn('Auth timed out — unblocking UI');
      setIsLoading(false);
      setProfileFetchAttempted(true);
    }, 5000);

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id).finally(() => {
          clearTimeout(hardTimeout);
          setIsLoading(false);
        });
      } else {
        clearTimeout(hardTimeout);
        setIsLoading(false);
      }
    }).catch(() => {
      clearTimeout(hardTimeout);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_IN' && session?.user) {
          await fetchProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          setProfileFetchAttempted(false);
        }
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
      clearTimeout(hardTimeout);
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    try {
      const result = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        10000 // 10s for sign-in (user is actively waiting)
      );
      if (!result) return { error: 'Login timed out — please check your connection and try again.' };
      const { data, error } = result;
      if (error) return { error: error.message };
      if (data.user) {
        setUser(data.user);
        setSession(data.session);
      }
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : 'An unexpected error occurred' };
    }
  };

  const signUp = async (params: SignUpParams): Promise<{ error: string | null }> => {
    const { email, password, firstName, lastName, phone, tenantId } = params;
    try {
      const result = await withTimeout(
        supabase.auth.signUp({
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
        }),
        10000
      );
      if (!result) return { error: 'Sign up timed out — please try again.' };
      if (result.error) return { error: result.error.message };
      return { error: null };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : 'Sign up failed' };
    }
  };

  const signOut = async () => {
    setProfile(null);
    setProfileFetchAttempted(false);
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
    profileFetchAttempted,
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
