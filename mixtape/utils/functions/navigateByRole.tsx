/*
 * Role-based post-authentication routing.
 *
 * After sign-in we don't know whether the user is a fan or an artist until we
 * read their `profiles.role`. This helper does that lookup and sends them to
 * the correct tab group, keeping the fan and artist entry points in one place.
 */

import { Router } from "expo-router";
import { supabase } from "@/database/db";

type RoleDestination =
  | "/(artist-tabs)"
  | "/(tabs)"
  | "/(sign-in)/(onboarding)/select-account";

/**
 * Fetches the current user's role from the profiles table
 * and returns the correct tab group.
 * - fan -> /(tabs)
 * - artist -> /(artist-tabs)
 * - missing profile -> /(sign-in)/(onboarding)/select-account
 */
export async function getRoleDestination(): Promise<RoleDestination | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.role) return "/(sign-in)/(onboarding)/select-account";

  return profile?.role === "artist" ? "/(artist-tabs)" : "/(tabs)";
}

/**
 * Navigates to the correct tab group after sign-in or account setup.
 */
export async function navigateByRole(router: Router): Promise<void> {
  const destination = await getRoleDestination();
  if (destination) {
    router.replace(destination as any);
  }
}
