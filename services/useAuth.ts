import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

export type VerificationStatus = 'idle' | 'verifying' | 'allowed' | 'signup' | 'denied' | 'unauthorized';

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
}

export function useAuth() {
    const [authState, setAuthState] = useState<AuthState>({
        user: null,
        session: null,
        loading: true,
        verificationStatus: 'idle',
        verificationData: {},
    });

    const verifyUser = useCallback(async (session: Session) => {
        console.log('🔐 Verifying user access...');
        setAuthState(prev => ({
            ...prev,
            // If already allowed, keep 'allowed' to avoid UI flicker, otherwise 'verifying'
            verificationStatus: prev.verificationStatus === 'allowed' ? 'allowed' : 'verifying',
            verificationData: prev.verificationStatus === 'allowed' ? prev.verificationData : {}
        }));

        try {
            const resp = await fetch('https://prabhupadala01.app.n8n.cloud/webhook/verify-user', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
            });

            console.log('🔐 Verification response status:', resp.status);

            // Parse response body
            let result: any = {};
            try {
                const body = await resp.json();
                // Handle array response (n8n sometimes returns arrays)
                result = Array.isArray(body) ? body[0] : body;
            } catch (e) {
                console.warn('⚠️ Could not parse response body');
            }

            console.log('🔐 Verification result:', result);

            // ═══════════════════════════════════════════════════════
            // DECISION LOGIC — based on response body fields
            // result.allowed is the PRIMARY gate for dashboard access
            // ═══════════════════════════════════════════════════════

            if (resp.status === 401) {
                // 🔒 Unauthorized — sign out immediately
                console.log('🔒 Unauthorized (401) — signing out');
                await supabase.auth.signOut();
                setAuthState(prev => ({
                    ...prev,
                    user: null,
                    session: null,
                    verificationStatus: 'unauthorized',
                    verificationData: {},
                }));

            } else if (result.allowed === true) {
                // ✅ allowed === true → show dashboard
                console.log('✅ User verified — access granted (allowed: true, reason:', result.reason, ')');
                setAuthState(prev => ({
                    ...prev,
                    verificationStatus: 'allowed',
                    verificationData: {
                        email: result.email,
                        fullName: result.fullName,
                        avatarUrl: result.avatarUrl,
                    },
                }));

            } else if (result.reason === 'not_registered') {
                // 📝 allowed === false, reason: not_registered → signup form
                console.log('📝 New user — signup required (allowed: false, reason: not_registered)');
                setAuthState(prev => ({
                    ...prev,
                    verificationStatus: 'signup',
                    verificationData: {
                        email: result.email,
                        fullName: result.fullName,
                        avatarUrl: result.avatarUrl,
                        message: result.message,
                        reason: result.reason,
                    },
                }));

            } else {
                // 🚫 allowed === false (or missing) for any other reason → denied
                const denyMessage = result.message || 'Access denied. You are not authorized to use this application.';
                console.log('🚫 Access denied:', denyMessage, '(allowed:', result.allowed, ', reason:', result.reason, ')');
                setAuthState(prev => ({
                    ...prev,
                    verificationStatus: 'denied',
                    verificationData: {
                        message: denyMessage,
                        email: result.email,
                    },
                }));
            }
        } catch (error) {
            console.error('❌ Verification webhook failed:', error);
            setAuthState(prev => ({
                ...prev,
                verificationStatus: 'denied',
                verificationData: {
                    message: 'Unable to verify access. Please check your connection and try again.',
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
        });
    };

    return {
        user: authState.user,
        session: authState.session,
        loading: authState.loading,
        isAuthenticated: !!authState.session,
        verificationStatus: authState.verificationStatus,
        verificationData: authState.verificationData,
        signInWithGoogle,
        signOut,
    };
}
