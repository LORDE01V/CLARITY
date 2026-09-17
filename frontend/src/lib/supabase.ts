/**
 * Supabase client for authentication and realtime.
 *
 * Uses the anon key (safe for frontend). All privileged operations
 * go through the FastAPI backend using the service role key.
 */

import { createClient } from "@supabase/supabase-js";
import { peekAccessToken, setAccessToken } from "@/lib/auth/token";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase environment variables are not set. Auth features will not work."
  );
}

export const supabase = createClient(
  supabaseUrl ?? "http://localhost:54321",
  supabaseAnonKey ?? "placeholder"
);

/**
 * Retrieve the current session access token for API calls.
 */
export async function getAccessToken(): Promise<string | null> {
  const cached = peekAccessToken();
  if (cached) return cached;

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? null;
  setAccessToken(token);
  return token;
}

export { setAccessToken };
