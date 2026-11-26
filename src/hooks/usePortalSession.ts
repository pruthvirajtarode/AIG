import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppData } from '@/contexts/AppDataContext';
import { normaliseEmail, normaliseName, participantFullName } from '@/lib/orderRules';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AppOrder, AppCertificate, AppParticipant } from '@/contexts/AppDataContext';

export const PORTAL_EMAIL_STORAGE_KEY = 'aigms_portal_participant_email';
export const PORTAL_ORDER_STORAGE_KEY = 'aigms_portal_order_ref';
export const PORTAL_SESSION_EVENT = 'aigms_portal_session_change';

export interface UsePortalSessionResult {
  sessionEmail: string | null;
  sessionOrderRef: string | null;
  participantName: string;
  matchedParticipant: AppParticipant | null;
  matchedOrders: AppOrder[];
  matchedCertificates: AppCertificate[];
  isSignedIn: boolean;
  isStaffUser: boolean;
  isStaffPreview: boolean;
  signIn: (identifier: string) => Promise<{ success: boolean; error?: string; name?: string }>;
  signOut: () => void;
}

export function usePortalSession(): UsePortalSessionResult {
  const { user, profile, isStaff } = useAuth();
  const { orders, participants, certificates, refreshFromCloud } = useAppData();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const urlOrderParam = (searchParams.get('order') || searchParams.get('ref') || '').trim().toUpperCase();
  const urlEmailParam = normaliseEmail(searchParams.get('email'));

  const isStaffUser = Boolean(isStaff() || (profile?.role && profile.role !== 'participant'));

  const getStoredValue = (key: string): string | null => {
    try {
      if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
        return globalThis.localStorage.getItem(key);
      }
    } catch {}
    return null;
  };

  // Local storage state
  const [storedEmail, setStoredEmail] = useState<string | null>(() => {
    return getStoredValue(PORTAL_EMAIL_STORAGE_KEY);
  });

  const [storedOrderRef, setStoredOrderRef] = useState<string | null>(() => {
    return getStoredValue(PORTAL_ORDER_STORAGE_KEY);
  });

  // Listen for storage / custom session changes across components
  useEffect(() => {
    const handleSessionChange = () => {
      setStoredEmail(getStoredValue(PORTAL_EMAIL_STORAGE_KEY));
      setStoredOrderRef(getStoredValue(PORTAL_ORDER_STORAGE_KEY));
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(PORTAL_SESSION_EVENT, handleSessionChange);
      window.addEventListener('storage', handleSessionChange);
      return () => {
        window.removeEventListener(PORTAL_SESSION_EVENT, handleSessionChange);
        window.removeEventListener('storage', handleSessionChange);
      };
    }
  }, []);

  // Sync from URL params on load if provided
  useEffect(() => {
    if (urlOrderParam) {
      if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
        globalThis.localStorage.setItem(PORTAL_ORDER_STORAGE_KEY, urlOrderParam);
      }
      setStoredOrderRef(urlOrderParam);
    }
    if (urlEmailParam) {
      if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
        globalThis.localStorage.setItem(PORTAL_EMAIL_STORAGE_KEY, urlEmailParam);
      }
      setStoredEmail(urlEmailParam);
    }
  }, [urlOrderParam, urlEmailParam]);

  // Determine active identifier
  const activeOrderRef = urlOrderParam || storedOrderRef;
  const authUserEmail = (!isStaffUser && user?.email) ? normaliseEmail(user.email) : null;
  const activeEmail = urlEmailParam || storedEmail || authUserEmail;

  // Resolve direct order if activeOrderRef is set
  const directOrder = useMemo(() => {
    if (!activeOrderRef) return null;
    return orders.find(o => o.order_ref.trim().toUpperCase() === activeOrderRef.toUpperCase()) || null;
  }, [orders, activeOrderRef]);

  // Resolve matching participant
  const matchedParticipant = useMemo<AppParticipant | null>(() => {
    if (directOrder?.participant_id) {
      const match = participants.find(p => p.id === directOrder.participant_id);
      if (match) return match as unknown as AppParticipant;
    }
    if (activeEmail) {
      const match = participants.find(p => normaliseEmail(p.email) === activeEmail);
      if (match) return match as unknown as AppParticipant;
    }
    if (directOrder?.participant) {
      const match = participants.find(p => normaliseName(participantFullName(p)) === normaliseName(directOrder.participant));
      if (match) return match as unknown as AppParticipant;
    }
    return null;
  }, [directOrder, participants, activeEmail]);

  // Resolve participant's orders
  const matchedOrders = useMemo<AppOrder[]>(() => {
    // If no participant identity is active:
    // STAFF USERS MUST NOT SEE ALL COMPANY ORDERS IN PARTICIPANT PORTAL
    if (!activeOrderRef && !activeEmail && !matchedParticipant) {
      return [];
    }

    const filtered = orders.filter(o => {
      if (activeOrderRef && o.order_ref.trim().toUpperCase() === activeOrderRef.toUpperCase()) return true;
      if (directOrder && o.id === directOrder.id) return true;
      if (matchedParticipant && o.participant_id === matchedParticipant.id) return true;
      if (activeEmail && o.email && normaliseEmail(o.email) === activeEmail) return true;
      if (matchedParticipant && normaliseName(o.participant) === normaliseName(participantFullName(matchedParticipant))) return true;
      if (directOrder?.participant && normaliseName(o.participant) === normaliseName(directOrder.participant)) return true;
      return false;
    });

    return filtered;
  }, [orders, activeOrderRef, activeEmail, matchedParticipant, directOrder]);

  // Resolve participant's certificates
  const matchedCertificates = useMemo<AppCertificate[]>(() => {
    if (matchedOrders.length === 0 && !activeOrderRef) {
      return [];
    }

    const myOrderRefs = new Set(matchedOrders.map(o => o.order_ref.toUpperCase()));
    if (activeOrderRef) myOrderRefs.add(activeOrderRef.toUpperCase());

    return certificates.filter(
      c => myOrderRefs.has(c.order_ref.toUpperCase()) && ['generated', 'sent', 'regenerated'].includes(c.status)
    ) as unknown as AppCertificate[];
  }, [certificates, matchedOrders, activeOrderRef]);

  // Resolve display name
  const participantName = useMemo(() => {
    if (matchedParticipant) {
      return participantFullName(matchedParticipant);
    }
    if (directOrder?.participant) {
      return directOrder.participant;
    }
    if (matchedOrders.length > 0 && matchedOrders[0].participant) {
      return matchedOrders[0].participant;
    }
    if (activeEmail) {
      const username = activeEmail.split('@')[0].replace(/[0-9_.-]+/g, ' ').trim();
      if (username) {
        return username.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }
    return '';
  }, [matchedParticipant, directOrder, matchedOrders, activeEmail]);

  const isSignedIn = Boolean(activeOrderRef || activeEmail || (matchedOrders.length > 0));
  const isStaffPreview = isStaffUser && isSignedIn;

  // Sign in by email or order reference
  const signIn = useCallback(async (identifier: string): Promise<{ success: boolean; error?: string; name?: string }> => {
    const raw = identifier.trim();
    if (!raw) {
      return { success: false, error: 'Please enter your registered email address or Order Reference.' };
    }

    const isEmail = raw.includes('@');
    const isOrderRef = raw.toUpperCase().startsWith('ORD-') || raw.toUpperCase().startsWith('AIG-');
    const cleanEmail = normaliseEmail(raw);
    const cleanRef = raw.toUpperCase();

    // 1. Check local loaded state
    let matchedName = '';
    let foundEmail = '';
    let foundOrderRef = '';

    if (isEmail) {
      const part = participants.find(p => normaliseEmail(p.email) === cleanEmail);
      const ord = orders.find(o => normaliseEmail(o.email) === cleanEmail);
      if (part || ord) {
        matchedName = part ? participantFullName(part) : ord?.participant || '';
        foundEmail = cleanEmail;
        if (ord?.order_ref) foundOrderRef = ord.order_ref;
      }
    } else {
      const ord = orders.find(o => o.order_ref.toUpperCase() === cleanRef);
      if (ord) {
        matchedName = ord.participant;
        foundOrderRef = ord.order_ref;
        if (ord.email) foundEmail = normaliseEmail(ord.email);
      }
    }

    // 2. If not found in memory, query Supabase cloud database
    if (!matchedName && isSupabaseConfigured) {
      try {
        if (isEmail) {
          const resOrd = await supabase
            .from('aigms_orders')
            .select('order_ref, participant, email')
            .ilike('email', cleanEmail)
            .limit(1);

          const ordRows = resOrd.data as Array<{ order_ref?: string; participant?: string; email?: string }> | null;

          if (ordRows && ordRows.length > 0) {
            matchedName = ordRows[0].participant || '';
            foundEmail = cleanEmail;
            foundOrderRef = ordRows[0].order_ref || '';
          } else {
            const resPart = await supabase
              .from('aigms_participants')
              .select('full_name, first_name, last_name, email')
              .ilike('email', cleanEmail)
              .limit(1);

            const partRows = resPart.data as Array<{ full_name?: string; first_name?: string; last_name?: string; email?: string }> | null;

            if (partRows && partRows.length > 0) {
              matchedName = partRows[0].full_name || `${partRows[0].first_name || ''} ${partRows[0].last_name || ''}`.trim();
              foundEmail = cleanEmail;
            }
          }
        } else {
          const resOrd = await supabase
            .from('aigms_orders')
            .select('order_ref, participant, email')
            .eq('order_ref', cleanRef)
            .limit(1);

          const ordRows = resOrd.data as Array<{ order_ref?: string; participant?: string; email?: string }> | null;

          if (ordRows && ordRows.length > 0) {
            matchedName = ordRows[0].participant || '';
            foundOrderRef = ordRows[0].order_ref || '';
            if (ordRows[0].email) foundEmail = normaliseEmail(ordRows[0].email);
          }
        }

        if (matchedName && refreshFromCloud) {
          void refreshFromCloud();
        }
      } catch {
        // network or supabase issue
      }
    }

    if (!matchedName && !foundEmail && !foundOrderRef) {
      return {
        success: false,
        error: isEmail
          ? `No orders or certificates found for email "${raw}". Please verify you are using the registered email from your order confirmation.`
          : `No order found with reference "${cleanRef}". Please check the reference in your WhatsApp confirmation message.`,
      };
    }

    // Save to storage
    if (foundEmail) {
      if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
        globalThis.localStorage.setItem(PORTAL_EMAIL_STORAGE_KEY, foundEmail);
      }
      setStoredEmail(foundEmail);
    }
    if (foundOrderRef) {
      if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
        globalThis.localStorage.setItem(PORTAL_ORDER_STORAGE_KEY, foundOrderRef);
      }
      setStoredOrderRef(foundOrderRef);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(PORTAL_SESSION_EVENT));
    }
    return { success: true, name: matchedName };
  }, [orders, participants, refreshFromCloud]);

  // Sign out participant
  const signOut = useCallback(() => {
    try {
      if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
        globalThis.localStorage.removeItem(PORTAL_EMAIL_STORAGE_KEY);
        globalThis.localStorage.removeItem(PORTAL_ORDER_STORAGE_KEY);
        globalThis.localStorage.removeItem('aigms_tracked_order');
        globalThis.localStorage.removeItem('aigms_latest_created_order');
      }
    } catch {}
    setStoredEmail(null);
    setStoredOrderRef(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(PORTAL_SESSION_EVENT));
    }
  }, []);

  return {
    sessionEmail: activeEmail,
    sessionOrderRef: activeOrderRef,
    participantName,
    matchedParticipant,
    matchedOrders,
    matchedCertificates,
    isSignedIn,
    isStaffUser,
    isStaffPreview,
    signIn,
    signOut,
  };
}
