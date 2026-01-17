
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

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

// Initialize the client. Note: If keys are missing, the client will be created 
// but requests will fail, which is better than a hard crash on boot.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
