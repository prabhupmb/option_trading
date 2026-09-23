import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';
import { UserRole, AccessLevel } from '../types';

export type VerificationStatus = 'idle' | 'verifying' | 'allowed' | 'signup' | 'denied' | 'unauthorized' | 'trial_expired';

const TRIAL_DURATION_DAYS = 30;

const isTrialEligible = (role?: string, accessLevel?: string): boolean =>
    role !== 'admin' && accessLevel !== 'trade';

const getTrialDaysLeft = (createdAt: string): number => {
    const trialEnd = new Date(createdAt);
    trialEnd.setDate(trialEnd.getDate() + TRIAL_DURATION_DAYS);
    const msLeft = trialEnd.getTime() - Date.now();
    return Math.ceil(msLeft / (1000 * 60 * 60 * 24));
};

export interface VerificationData {
    email?: string;
    fullName?: string;
    avatarUrl?: string;
    message?: string;
    reason?: string;
}

export interface AuthState {
    user: User | null;
    session: Session | null;
    loading: boolean;
    verificationStatus: VerificationStatus;
    verificationData: VerificationData;
    role?: UserRole;
    accessLevel?: AccessLevel;
    trialDaysLeft?: number;
    isTrialUser: boolean;
    dbUserId?: string;
}

export function useAuth() {
    // --- Step 1: auth-ready + session (synchronous only) ---
    const [session, setSession] = useState<Session | null>(null);
    const [authReady, setAuthReady] = useState(false);
    const userId = session?.user?.id ?? null;

    // --- Step 2: profile fetch result ---
    const [profile, setProfile] = useState<any | undefined>(undefined);
    const [profileError, setProfileError] = useState<{ code: string; message: string } | null>(null);

    // --- Step 3: derived verification state ---
    const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('idle');
    const [verificationData, setVerificationData] = useState<VerificationData>({});
    const [role, setRole] = useState<UserRole | undefined>();
    const [accessLevel, setAccessLevel] = useState<AccessLevel | undefined>();
    const [trialDaysLeft, setTrialDaysLeft] = useState<number | undefined>();
    const [isTrialUser, setIsTrialUser] = useState(false);
    const [dbUserId, setDbUserId] = useState<string | undefined>();

    // --- onAuthStateChange: synchronous state only, no network calls ---
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
            console.log('Auth state changed:', event);
            setSession(sess);
            setAuthReady(true);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // --- Profile fetch: runs when userId changes, never inside onAuthStateChange ---
    useEffect(() => {
        if (!userId || !session) {
            setProfile(undefined);
            setProfileError(null);
            return;
        }

        let ignore = false;

        const fetchProfile = async () => {
            setVerificationStatus('verifying');
            const email = session.user.email;
            console.log('[auth] Fetching profile for', email);

            if (!email) {
                if (!ignore) {
                    setProfileError({ code: 'NO_EMAIL', message: 'No email in session' });
                    setVerificationStatus('denied');
                    setVerificationData({ message: 'No email found in session.' });
                }
                return;
            }

            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .maybeSingle();

            if (ignore) return;

            console.log('[auth] Profile query done. Found:', !!data, '| Error:', error?.code, error?.message);

            if (error) {
                setProfile(undefined);
                setProfileError({ code: error.code || 'UNKNOWN', message: error.message });
                setVerificationStatus('denied');
                setVerificationData({ message: `DB error: ${error.code} — ${error.message}` });
                return;
            }

            if (!data) {
                // User not in DB — auto-register via n8n
                console.log('[auth] User not in DB — auto-registering via n8n');
                const fullName = session.user.user_metadata.full_name || session.user.user_metadata.name || '';
                const phone = session.user.user_metadata.phone || '';
                const userName = (
                    fullName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20)
                    || email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20)
                );

                fetch('https://prabhupadala01.app.n8n.cloud/webhook/register-user', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ userName, fullName, email, phone }),
                }).catch(() => {});

                setProfile(null);
                setProfileError(null);
                setVerificationStatus('denied');
                setVerificationData({
                    email,
                    message: 'Your account registration is pending admin approval.',
                });
                return;
            }

            // User found
            setProfile(data);
            setProfileError(null);

            if (!data.is_active) {
                setVerificationStatus('denied');
                setVerificationData({
                    email,
                    message: 'Your account is pending admin approval.',
                });
                return;
            }

            // Active user — check trial status
            const userRole = data.role as UserRole;
            const userAccessLevel = data.access_level as AccessLevel;
            const trialEligible = isTrialEligible(userRole, userAccessLevel);
            const daysLeft = trialEligible && data.created_at
                ? getTrialDaysLeft(data.created_at)
                : undefined;
            const trialExpired = trialEligible && daysLeft !== undefined && daysLeft <= 0;

            setRole(userRole);
            setAccessLevel(userAccessLevel);
            setIsTrialUser(trialEligible);
            setTrialDaysLeft(daysLeft);
            setDbUserId(data.id);
            setVerificationStatus(trialExpired ? 'trial_expired' : 'allowed');
            setVerificationData({
                email: data.email,
                fullName: (() => {
                    const raw = data.display_name || data.full_name || data.user_name || session.user.user_metadata.full_name || '';
                    return raw.charAt(0).toUpperCase() + raw.slice(1);
                })(),
                avatarUrl: session.user.user_metadata.avatar_url,
            });
        };

        fetchProfile();

        return () => { ignore = true; };
    }, [userId]);

    // --- Reset on sign-out ---
    useEffect(() => {
        if (authReady && !session) {
            setVerificationStatus('idle');
            setVerificationData({});
            setProfile(undefined);
            setProfileError(null);
            setRole(undefined);
            setAccessLevel(undefined);
            setTrialDaysLeft(undefined);
            setIsTrialUser(false);
            setDbUserId(undefined);
        }
    }, [authReady, session]);

    const signInWithGoogle = useCallback(async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });
        if (error) {
            console.error('Google sign-in error:', error.message);
        }
    }, []);

    const signOut = useCallback(async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Sign-out error:', error.message);
        }
    }, []);

    return {
        user: session?.user ?? null,
        session,
        loading: !authReady,
        isAuthenticated: !!session,
        verificationStatus,
        verificationData,
        role,
        accessLevel,
        trialDaysLeft,
        isTrialUser,
        dbUserId,
        signInWithGoogle,
        signOut,
    };
}
