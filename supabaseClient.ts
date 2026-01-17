

import { createClient } from '@supabase/supabase-js';

// No Vite, usamos import.meta.env para variáveis de ambiente
// Certifique-se de configurar VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel
// Fix: Use type casting to any to access Vite's custom env property on import.meta and resolve TS errors
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
