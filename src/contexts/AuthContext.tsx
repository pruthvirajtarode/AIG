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
  signIn: (email: string, password: string) => Promise<{ error: string | null; role?: UserRole | null; isStaff?: boolean }>;
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

// ── Auth timeout constant ─────────────────────────────────────
const AUTH_TIMEOUT_MS = 4000;

// Roles that belong in the admin panel (everything except 'participant')
const STAFF_ROLES: UserRole[] = [
  'super_admin', 'operations_admin', 'supplier_manager', 'field_team', 'driver', 'd3_technical_admin',
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileFetchAttempted, setProfileFetchAttempted] = useState(false);
  const initialised = useRef(false);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    if (!isSupabaseConfigured) {
      // Dev mode: set a mock profile so the UI still loads
      const mock = {
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
      } as Profile;
      setProfile(mock);
      setProfileFetchAttempted(true);
      return mock;
    }

    // Set up an abort timer — after AUTH_TIMEOUT_MS, just stop waiting
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; }, AUTH_TIMEOUT_MS);
    let result: Profile | null = null;

    try {
      // Try RPC first (SECURITY DEFINER function bypasses RLS)
      type RpcResult = { data: Profile | null; error: { message: string } | null };
      const rpcResp = await supabase.rpc('get_my_profile') as unknown as RpcResult;
      if (!timedOut && !rpcResp.error && rpcResp.data) {
        setProfile(rpcResp.data);
        result = rpcResp.data;
        return result;
      }

      if (timedOut) {
        console.warn('Profile RPC timed out');
        return null;
      }

      // Fallback: direct table query
      type RowResult = { data: Profile | null; error: { message: string } | null };
      const rowResp = await supabase.from('profiles').select('*').eq('id', userId).single() as unknown as RowResult;
      if (!timedOut && !rowResp.error && rowResp.data) {
        setProfile(rowResp.data);
        result = rowResp.data;
      } else if (!timedOut) {
        console.warn('Profile fetch failed — running without profile data');
      }
      return result;
    } catch (e) {
      console.warn('Profile fetch exception:', e);
      return null;
    } finally {
      clearTimeout(timer);
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
          // Defer: calling supabase APIs synchronously inside this callback can deadlock
          // the auth lock while signInWithPassword() is still resolving.
          const uid = session.user.id;
          setTimeout(() => { void fetchProfile(uid); }, 0);
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

  const signIn = async (email: string, password: string): Promise<{ error: string | null; role?: UserRole | null; isStaff?: boolean }> => {
    try {
      const race = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
        Promise.race<T | null>([p, new Promise<null>(res => setTimeout(() => res(null), ms))]);

      const result = await race(
        supabase.auth.signInWithPassword({ email, password }),
        10000
      );
      if (!result) return { error: 'Login timed out — please check your connection and try again.' };
      const { data, error } = result;
      if (error) return { error: error.message };
      if (!data.user) return { error: 'Sign in failed — no user returned.' };

      setUser(data.user);
      setSession(data.session);

      // Load the profile BEFORE returning so the caller can route by the real role.
      const loaded = await fetchProfile(data.user.id);
      if (!loaded) {
        await supabase.auth.signOut();
        return { error: 'Signed in, but your profile could not be loaded. Please try again.' };
      }
      return { error: null, role: loaded.role, isStaff: STAFF_ROLES.includes(loaded.role) };
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : 'An unexpected error occurred' };
    }
  };

  const signUp = async (params: SignUpParams): Promise<{ error: string | null }> => {
    const { email, password, firstName, lastName, phone, tenantId } = params;
    try {
      const race = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
        Promise.race<T | null>([p, new Promise<null>(res => setTimeout(() => res(null), ms))]);

      const result = await race(
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

  const isStaff = () => !!profile && STAFF_ROLES.includes(profile.role);

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
