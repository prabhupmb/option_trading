import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthState {
    user: User | null;
    session: Session | null;
    loading: boolean;
}

export function useAuth() {
    const [authState, setAuthState] = useState<AuthState>({
        user: null,
        session: null,
        loading: true,
    });

    useEffect(() => {
        // Get the initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setAuthState({
                user: session?.user ?? null,
                session,
                loading: false,
            });
        });

        // Listen for auth state changes (login, logout, token refresh)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                console.log('🔐 Auth state changed:', _event);
                setAuthState({
                    user: session?.user ?? null,
                    session,
                    loading: false,
                });
            }
        );

        // Cleanup subscription on unmount
        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signInWithGoogle = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin, // Redirect back to wherever the app is running
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
    };

    return {
        user: authState.user,
        session: authState.session,
        loading: authState.loading,
        isAuthenticated: !!authState.session,
        signInWithGoogle,
        signOut,
    };
}
