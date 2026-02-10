import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://npwnnlxhdpvgfdpvrohi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_TAykwCsieEVaOafYSUfjYA_FadvFq2t';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
