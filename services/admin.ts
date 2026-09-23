const raw = (import.meta.env.VITE_ADMIN_EMAILS as string | undefined) ?? '';

export const ADMIN_EMAILS: string[] = raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

export const isAdminEmail = (email?: string | null): boolean =>
    !!email && ADMIN_EMAILS.includes(email.toLowerCase());
