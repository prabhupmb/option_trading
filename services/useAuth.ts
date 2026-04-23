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
    const [authState, setAuthState] = useState<AuthState>({
        user: null,
        session: null,
        loading: true,
        verificationStatus: 'idle',
        verificationData: {},
        isTrialUser: false,
    });

    const verifyUser = useCallback(async (session: Session) => {
        console.log('🔐 Verifying user access...');
        setAuthState(prev => ({
            ...prev,
            verificationStatus: prev.verificationStatus === 'allowed' ? 'allowed' : 'verifying',
            verificationData: prev.verificationStatus === 'allowed' ? prev.verificationData : {}
        }));

        try {
            const email = session.user.email;
            if (!email) throw new Error('No email in session');

            // DB is the single source of truth — no webhook fallback
            const { data: userProfile, error: dbError } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (dbError || !userProfile) {
                // Not in DB → show signup form so they can request access
                console.log('📝 User not in DB — showing signup');
                setAuthState(prev => ({
                    ...prev,
                    verificationStatus: 'signup',
                    verificationData: {
                        email: email,
                        fullName: session.user.user_metadata.full_name,
                        avatarUrl: session.user.user_metadata.avatar_url,
                    },
                }));
                return;
            }

            console.log('✅ User found in DB:', userProfile);

            if (!userProfile.is_active) {
                // In DB but not yet approved by admin
                setAuthState(prev => ({
                    ...prev,
                    verificationStatus: 'denied',
                    verificationData: {
                        email: email,
                        message: 'Your account is pending admin approval.',
                    }
                }));
                return;
            }

            // Active user — check trial status
            const userRole = userProfile.role as UserRole;
            const userAccessLevel = userProfile.access_level as AccessLevel;
            const trialEligible = isTrialEligible(userRole, userAccessLevel);
            const daysLeft = trialEligible && userProfile.created_at
                ? getTrialDaysLeft(userProfile.created_at)
                : undefined;
            const trialExpired = trialEligible && daysLeft !== undefined && daysLeft <= 0;

            setAuthState(prev => ({
                ...prev,
                verificationStatus: trialExpired ? 'trial_expired' : 'allowed',
                role: userRole,
                accessLevel: userAccessLevel,
                isTrialUser: trialEligible,
                trialDaysLeft: daysLeft,
                dbUserId: userProfile.id,
                verificationData: {
                    email: userProfile.email,
                    fullName: userProfile.name || session.user.user_metadata.full_name,
                    avatarUrl: session.user.user_metadata.avatar_url,
                },
            }));

        } catch (error) {
            console.error('❌ Verification failed:', error);
            setAuthState(prev => ({
                ...prev,
                verificationStatus: 'denied',
                verificationData: {
                    message: 'Unable to verify access. Please check your connection.',
                },
            }));
        }
    }, []);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setAuthState(prev => ({
                ...prev,
                user: session?.user ?? null,
                session,
                loading: false,
            }));

            if (session) {
                verifyUser(session);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                console.log('🔐 Auth state changed:', event);
                setAuthState(prev => ({
                    ...prev,
                    user: session?.user ?? null,
                    session,
                    loading: false,
                    verificationStatus: session ? prev.verificationStatus : 'idle',
                    verificationData: session ? prev.verificationData : {},
                }));

                if (event === 'SIGNED_IN' && session) {
                    verifyUser(session);
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, [verifyUser]);

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        });
        if (error) {
            console.error('❌ Google sign-in error:', error.message);
        }
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('❌ Sign-out error:', error.message);
        }
        setAuthState({
            user: null,
            session: null,
            loading: false,
            verificationStatus: 'idle',
            verificationData: {},
            isTrialUser: false,
        });
    };

    return {
        user: authState.user,
        session: authState.session,
        loading: authState.loading,
        isAuthenticated: !!authState.session,
        verificationStatus: authState.verificationStatus,
        verificationData: authState.verificationData,
        role: authState.role,
        accessLevel: authState.accessLevel,
        trialDaysLeft: authState.trialDaysLeft,
        isTrialUser: authState.isTrialUser,
        dbUserId: authState.dbUserId,
        signInWithGoogle,
        signOut,
    };
}

