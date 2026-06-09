/*
 * Root authentication gate for the app.
 *
 * Determines the user's authentication state using the `useSession` hook
 * and routes accordingly:
 * - Shows a loading screen while the session is being resolved
 * - Redirects authenticated users to their role-specific tabs
 * - Displays the login screen if no session exists
 */

import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

import Loading from "@/components/loading";
import Login from "@/components/login";
import { getRoleDestination } from "@/utils/functions/navigateByRole";
import useSession from "@/utils/hooks/useSession";

export default function App() {
  const session = useSession();
  const [roleDestination, setRoleDestination] = useState<
    | "/(artist-tabs)"
    | "/(tabs)"
    | "/(sign-in)/(onboarding)/select-account"
    | null
  >(null);

  useEffect(() => {
    let active = true;
    setRoleDestination(null);

    if (!session) return;

    getRoleDestination().then((destination) => {
      if (active) {
        setRoleDestination(destination);
      }
    });

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  if (session) {
    if (!roleDestination) {
      return <Loading />;
    }

    return <Redirect href={roleDestination} />;
  } else if (session === undefined) {
    return <Loading />;
  } else {
    return <Login />;
  }
}
