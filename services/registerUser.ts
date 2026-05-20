import { supabase } from './supabase';

const N8N_BASE_URL = 'https://prabhupadala01.app.n8n.cloud';

export interface RegisterPayload {
  fullName: string;
  userName: string;
  email: string;
  phone?: string;
  password: string;
}

export type RegisterResult =
  | { status: 'email_confirmation_needed' }
  | { status: 'success' }
  | { status: 'error'; code: 400 | 401 | 409 | 500; message: string; details?: string[]; field?: 'email' | 'username' };

export async function registerUser(payload: RegisterPayload): Promise<RegisterResult> {
  const { fullName, userName, email, phone, password } = payload;

  // STEP 1 — Supabase Auth signup
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { user_name: userName, full_name: fullName } },
  });

  if (error) {
    return { status: 'error', code: 400, message: error.message };
  }

  // Email confirmation required — no session yet
  if (!data.session) {
    return { status: 'email_confirmation_needed' };
  }

  // STEP 2 — Call n8n register-user endpoint
  const token = data.session.access_token;
  let resp: Response;
  try {
    resp = await fetch(`${N8N_BASE_URL}/webhook/register-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userName, email, fullName, phone }),
    });
  } catch {
    return { status: 'error', code: 500, message: 'Network error. Please try again or contact support.' };
  }

  let result: any = {};
  try {
    result = await resp.json();
  } catch {
    // Non-JSON response
  }

  if (resp.status === 201) {
    return { status: 'success' };
  }

  if (resp.status === 400) {
    const details: string[] = Array.isArray(result?.details) ? result.details : [];
    return { status: 'error', code: 400, message: result?.message || 'Validation error.', details };
  }

  if (resp.status === 401) {
    return { status: 'error', code: 401, message: 'Session expired, please try again.' };
  }

  if (resp.status === 409) {
    const msg: string = result?.error || 'Conflict error.';
    const field: 'email' | 'username' = msg.toLowerCase().includes('username') ? 'username' : 'email';
    return { status: 'error', code: 409, message: msg, field };
  }

  return { status: 'error', code: 500, message: 'Something went wrong. Please try again or contact support.' };
}
