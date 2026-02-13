import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';
import { UserRole, AccessLevel } from '../types';

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
    role?: UserRole;
    accessLevel?: AccessLevel;
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
        // Optimistic update
        setAuthState(prev => ({
            ...prev,
            verificationStatus: prev.verificationStatus === 'allowed' ? 'allowed' : 'verifying',
            verificationData: prev.verificationStatus === 'allowed' ? prev.verificationData : {}
        }));

        try {
            const email = session.user.email;
            if (!email) throw new Error('No email in session');

            // 1. Check Supabase 'users' table directly
            const { data: userProfile, error: dbError } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            if (userProfile && !dbError) {
                console.log('✅ User found in DB:', userProfile);

                if (!userProfile.is_active) {
                    // Account disabled
                    setAuthState(prev => ({
                        ...prev,
                        verificationStatus: 'denied',
                        verificationData: {
                            email: email,
                            message: 'Your account has been disabled by an administrator.',
                        }
                    }));
                    return;
                }

                // Access Granted
                setAuthState(prev => ({
                    ...prev,
                    verificationStatus: 'allowed',
                    role: userProfile.role as UserRole,
                    accessLevel: userProfile.access_level as AccessLevel,
                    verificationData: {
                        email: userProfile.email,
                        fullName: userProfile.name || session.user.user_metadata.full_name,
                        avatarUrl: session.user.user_metadata.avatar_url,
                    },
                }));
                return;
            }

            // 2. Fallback to Webhook if user not in DB (likely new user needing signup)
            console.log('⚠️ User not in DB, falling back to webhook verification...');

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
                result = Array.isArray(body) ? body[0] : body;
            } catch (e) {
                console.warn('⚠️ Could not parse response body');
            }

            console.log('🔐 Verification result:', result);

            if (resp.status === 401) {
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
                // If webhook allows but DB check failed, we might use default roles or strictly require DB
                // Assuming default for now
                console.log('✅ User verified via Webhook');
                setAuthState(prev => ({
                    ...prev,
                    verificationStatus: 'allowed',
                    role: 'customer', // Default
                    accessLevel: 'signal', // Default
                    verificationData: {
                        email: result.email,
                        fullName: result.fullName,
                        avatarUrl: result.avatarUrl,
                    },
                }));
            } else if (result.reason === 'not_registered') {
                console.log('📝 New user — signup required');
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
                const denyMessage = result.message || 'Access denied.';
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
        signInWithGoogle,
        signOut,
    };
}

