import { supabase } from './supabase';

export const DISCLAIMER_VERSION = '2025-07-25';

export interface DisclaimerAcceptance {
  id: string;
  user_id: string;
  disclaimer_version: string;
  accepted_at: string;
  user_agent: string | null;
  ip_address: string | null;
}

export async function hasAcceptedCurrentDisclaimer(
  userId: string
): Promise<DisclaimerAcceptance | null> {
  const { data } = await supabase
    .from('disclaimer_acceptances')
    .select('*')
    .eq('user_id', userId)
    .eq('disclaimer_version', DISCLAIMER_VERSION)
    .maybeSingle();
  return data ?? null;
}

export async function recordDisclaimerAcceptance(
  userId: string
): Promise<DisclaimerAcceptance | null> {
  const { data, error } = await supabase
    .from('disclaimer_acceptances')
    .insert({
      user_id: userId,
      disclaimer_version: DISCLAIMER_VERSION,
      user_agent: navigator.userAgent,
    })
    .select()
    .single();

  // Ignore unique constraint violation (already accepted)
  if (error && error.code === '23505') {
    const existing = await hasAcceptedCurrentDisclaimer(userId);
    return existing;
  }

  return data ?? null;
}
