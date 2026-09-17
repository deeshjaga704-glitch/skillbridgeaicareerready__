import { supabase } from "./supabase";
import { setActiveUserId } from "../skillbridge-store";

export async function getAuthenticatedSession() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    if (error.message === "Auth session missing!") {
      setActiveUserId(null);
      return null;
    }

    setActiveUserId(null);
    throw error;
  }

  setActiveUserId(user?.id ?? null);
  return user;
}

export async function signUp(
  email: string,
  password: string
) {
  return await supabase.auth.signUp({
    email,
    password,
  });
}

export async function signIn(
  email: string,
  password: string
) {
  return await supabase.auth.signInWithPassword({
    email,
    password,
  });
}

export async function signOut() {
  const result = await supabase.auth.signOut();
  setActiveUserId(null);
  return result;
}

export async function getCurrentUser() {
  return getAuthenticatedSession();
}