import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing in environment variables. Auth and Database operations will fail.");
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleSupabaseError(error: any, operationType: OperationType, path: string | null) {
  const errMsg = error?.message || String(error);
  console.error(`Supabase Error (${operationType} on ${path}): `, errMsg);
  throw new Error(errMsg);
}
