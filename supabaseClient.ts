
import { createClient } from '@supabase/supabase-js';

/**
 * Utility to safely get environment variables across different environments 
 * (Vite/Vercel uses import.meta.env, while this environment uses process.env)
 */
const getEnvVar = (key: string): string => {
  // Try process.env first (standard for this environment)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  // Try import.meta.env (standard for Vite/Vercel builds)
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return (import.meta as any).env[key] || '';
  }
  return '';
};

// Se as variáveis estiverem vazias, usamos placeholders para evitar que o createClient quebre o app no carregamento.
// Isso permite que o usuário veja a interface e as instruções antes de configurar o backend.
const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || 'placeholder-key';

if (supabaseUrl === 'https://placeholder-project.supabase.co') {
  console.warn('Supabase URL não configurada. Verifique as variáveis de ambiente VITE_SUPABASE_URL na Vercel.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
