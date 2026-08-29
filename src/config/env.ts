import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};

export function assertSupabaseConfigured() {
  required('SUPABASE_URL', env.supabaseUrl);
  required('SUPABASE_ANON_KEY', env.supabaseAnonKey);
  required('SUPABASE_SERVICE_ROLE_KEY', env.supabaseServiceRoleKey);
}
