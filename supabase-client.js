// Supabase client — the publishable key is safe in frontend code (RLS protects the data).
// NEVER put the service_role / secret key here.
const SUPABASE_URL = 'https://gvgtiisiywcwmvohlmlk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZDoTFpAcSgDTZHVVuGzjCQ_eKo_L4Pn';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
