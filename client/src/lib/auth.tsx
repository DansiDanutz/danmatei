/**
 * Auth provider — wires the Supabase JS client into a React context so the
 * rest of the app can `useAuth()` for the current user, profile, role, and
 * sign-in / sign-out helpers.
 *
 * `profile` is fetched from the `fotbal.profiles` row that the server-side
 * trigger creates on signup (gated on `raw_user_meta_data.app === 'fotbal'`).
 * Sessions persist in localStorage; we listen for cross-tab auth changes.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type UserRole = "owner" | "super_admin" | "trainer" | "parent";

export type Profile = {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  locale: string;
  avatar_path: string | null;
  created_at: string;
  updated_at: string;
};

export type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  profileComplete: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (input: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
  }) => Promise<{ error?: string }>;
  /** Google OAuth — primary sign-in/sign-up method. Redirects through
   *  Supabase to Google's consent screen and back. */
  signInWithGoogle: (redirectTo?: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, role, full_name, phone, locale, avatar_path, created_at, updated_at"
      )
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.warn("[auth] profile load error", error.message);
      setProfile(null);
      return;
    }
    setProfile(data as Profile | null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        if (data.session?.user) await loadProfile(data.session.user.id);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (cancelled) return;
        setSession(newSession);
        if (newSession?.user) await loadProfile(newSession.user.id);
        else setProfile(null);
      }
    );

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return error ? { error: error.message } : {};
  }, []);

  const signUp = useCallback(
    async ({
      email,
      password,
      fullName,
      phone,
    }: {
      email: string;
      password: string;
      fullName: string;
      phone?: string;
    }) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            app: "fotbal",
            role: "parent",
            full_name: fullName,
            phone: phone ?? null,
          },
          emailRedirectTo:
            (import.meta.env.VITE_APP_URL as string | undefined) ??
            window.location.origin,
        },
      });
      return error ? { error: error.message } : {};
    },
    []
  );

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    const target =
      redirectTo ??
      (import.meta.env.VITE_APP_URL as string | undefined) ??
      window.location.origin;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${target}/dashboard`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) return { error: error.message };
    if (data?.url) window.location.href = data.url;
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const profileComplete = useMemo(() => {
    if (!profile) return false;
    // Phone is the gate for Google sign-ups; full_name is pre-filled from Google
    return !!profile.phone && profile.phone.trim().length >= 8;
  }, [profile]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      profile,
      profileComplete,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      refreshProfile,
    }),
    [
      loading,
      session,
      profile,
      profileComplete,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function useRole(): UserRole | null {
  return useAuth().profile?.role ?? null;
}
