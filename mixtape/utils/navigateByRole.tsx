/*
 * Role-based post-authentication routing.
 *
 * After sign-in we don't know whether the user is a fan or an artist until we
 * read their `profiles.role`. This helper does that lookup and sends them to
 * the correct tab group, keeping the fan and artist entry points in one place.
 */

import { Router } from "expo-router";
import { supabase } from "@/database/db";

/**
 * Fetches the current user's role from the profiles table
 * and navigates to the correct tab group.
 * - fan   → /(tabs)
 * - artist → /(artist-tabs)
 */
export async function navigateByRole(router: Router): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const destination = profile?.role === "artist" ? "/(artist-tabs)" : "/(tabs)";
  router.replace(destination as any);
}
