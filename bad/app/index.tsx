/*
 * Root authentication gate for the app.
 *
 * Determines the user's authentication state using the `useSession` hook
 * and routes accordingly:
 * - Shows a loading screen while the session is being resolved
 * - Redirects authenticated users to the main tabs
 * - Displays the login screen if no session exists
 */

import { Redirect } from "expo-router";

import Loading from "@/components/loading";
import Login from "@/components/login";
import useSession from "@/utils/useSession";

export default function App() {
  const session = useSession();

  if (session) {
    console.log("hi");
    // return <Redirect href="/tabs" />;
  } else if (session === undefined) {
    return <Loading />;
  } else {
    return <Login />;
  }
}
