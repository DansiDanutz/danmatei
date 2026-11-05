import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

import { hasRecoveryLinkError } from "./recovery-url";

export const authService = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async resetPassword(email: string) {
    // Without redirectTo Supabase sends the link to its Site URL. On web the
    // link must come back to this app's reset screen.
    const redirectTo =
      Platform.OS === "web"
        ? `${window.location.origin}/auth/reset-password`
        : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw error;
  },

  async hasSession() {
    // A failed link must not fall back to a session already stored in this
    // browser, which could belong to a different account.
    if (
      Platform.OS === "web" &&
      hasRecoveryLinkError(window.location.hash, window.location.search)
    ) {
      return false;
    }
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session !== null;
  },

  async updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },
};
