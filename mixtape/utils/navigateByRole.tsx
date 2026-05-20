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
