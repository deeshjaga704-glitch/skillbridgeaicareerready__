import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getCookies, setCookie, setResponseHeaders } from "@tanstack/react-start/server";
import type { User } from "@supabase/supabase-js";

function getSupabaseConfig() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables for server authentication.");
  }

  return {
    url: new URL(supabaseUrl).origin,
    anonKey: supabaseAnonKey,
  };
}

/** Creates a request-scoped Supabase client backed by the incoming auth cookies. */
export function createServerSupabaseClient() {
  const { url, anonKey } = getSupabaseConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return Object.entries(getCookies()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          setCookie(name, value, options as CookieOptions);
        }
        setResponseHeaders(headers);
      },
    },
  });
}

/** Returns the authenticated Supabase user for the current request, or null. */
export async function getServerAuthenticatedUser(
  supabase = createServerSupabaseClient(),
): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    if (error.message === "Auth session missing!") {
      return null;
    }
    throw error;
  }

  return data.user;
}
