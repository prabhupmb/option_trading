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

    // --- Password recovery flag ---
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

    // --- onAuthStateChange: synchronous state only, no network calls ---
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
            console.log('Auth state changed:', event);
            if (event === 'PASSWORD_RECOVERY') {
                setIsPasswordRecovery(true);
            }
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

            const { data: initialData, error } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .maybeSingle();

            if (ignore) return;

            console.log('[auth] Profile query done. Found:', !!initialData, '| Error:', error?.code, error?.message);

            if (error) {
                setProfile(undefined);
                setProfileError({ code: error.code || 'UNKNOWN', message: error.message });
                setVerificationStatus('denied');
                setVerificationData({ message: `DB error: ${error.code} — ${error.message}` });
                return;
            }

            let profileData = initialData;

            if (!profileData) {
                // User not in DB — auto-register via n8n and wait for it
                console.log('[auth] User not in DB — auto-registering via n8n');
                const fullName = session.user.user_metadata.full_name || session.user.user_metadata.name || '';
                const phone = session.user.user_metadata.phone || '';
                const userName = (
                    fullName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20)
                    || email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20)
                );

                try {
                    await fetch('https://prabhupadala01.app.n8n.cloud/webhook/register-user', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${session.access_token}`,
                        },
                        body: JSON.stringify({ userName, fullName, email, phone }),
                    });
                } catch {}

                if (ignore) return;

                // Re-fetch profile after webhook creates the record
                const { data: refetchData } = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', email)
                    .maybeSingle();

                if (ignore) return;
                profileData = refetchData;

                if (!profileData) {
                    setProfile(null);
                    setProfileError(null);
                    setVerificationStatus('denied');
                    setVerificationData({
                        email,
                        message: 'Your account is being set up. Please refresh in a moment.',
                    });
                    return;
                }
            }

            // User found in DB
            setProfile(profileData);
            setProfileError(null);

            if (!profileData.is_active) {
                // Unapproved user — allow during 30-day free trial
                const trialDays = profileData.created_at ? getTrialDaysLeft(profileData.created_at) : 0;
                if (trialDays <= 0) {
                    setVerificationStatus('trial_expired');
                    setVerificationData({
                        email,
                        message: 'Your 30-day free trial has expired. Please contact admin for access.',
                    });
                    return;
                }
                // Within trial period — fall through to allow access
            }

            // Active user or trial user — set up access
            const userRole = profileData.role as UserRole;
            const userAccessLevel = profileData.access_level as AccessLevel;
            const trialEligible = !profileData.is_active || isTrialEligible(userRole, userAccessLevel);
            const daysLeft = trialEligible && profileData.created_at
                ? getTrialDaysLeft(profileData.created_at)
                : undefined;
            const trialExpired = trialEligible && daysLeft !== undefined && daysLeft <= 0;

            setRole(userRole);
            setAccessLevel(userAccessLevel);
            setIsTrialUser(trialEligible);
            setTrialDaysLeft(daysLeft);
            setDbUserId(profileData.id);
            setVerificationStatus(trialExpired ? 'trial_expired' : 'allowed');
            setVerificationData({
                email: profileData.email,
                fullName: (() => {
                    const raw = profileData.display_name || profileData.full_name || profileData.user_name || session.user.user_metadata.full_name || '';
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

    const clearPasswordRecovery = useCallback(() => {
        setIsPasswordRecovery(false);
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
        isPasswordRecovery,
        signInWithGoogle,
        signOut,
        clearPasswordRecovery,
    };
}
