type SupabaseLikeError = { code?: string; message: string };

/** Maps a Supabase/Postgres error to an HTTP status, RLS denials as 403. */
export function statusForError(error: SupabaseLikeError): number {
  if (error.code === '42501') return 403; // RLS policy violation
  if (error.code === 'PGRST116') return 404; // .single() found no row
  if (error.code === '23505') return 409; // unique_violation
  return 400;
}
