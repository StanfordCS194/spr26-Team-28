/**
 * Hook that returns the current Supabase auth session.
 * Starts as null and returns the session once it's found.
 * If the user is not logged in, returns null.
 */

import { useEffect, useState } from "react";

import { supabase as db } from "@/database/db";
import { Session } from "@supabase/supabase-js";

export default function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const getSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await db.auth.getSession();

        if (error) {
          // If there's an auth error (like invalid refresh token), clear the session
          console.log("Session expired or invalid, signing out");
          setSession(null);
          // Sign out to clear any stale tokens - use silent signOut
          await db.auth.signOut({ scope: "local" });
          return;
        }

        setSession(session);
      } catch (error) {
        // Silently handle session errors and clear auth state
        console.log("Unable to restore session, starting fresh");
        setSession(null);
        await db.auth.signOut({ scope: "local" }).catch(() => {});
      }
    };

    // Get session on mount
    getSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange(async (_event, session) => {
      if (_event === "TOKEN_REFRESHED") {
        console.log("Token refreshed successfully");
      }
      if (_event === "SIGNED_OUT") {
        console.log("User signed out");
      }
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return session;
}
