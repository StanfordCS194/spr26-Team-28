/**
 * Hook that checks whether a fan's Spotify data is stale and returns
 * freshness metadata so screens can prompt the user to re-sync.
 *
 * Data is considered stale when fetched_at is null or older than
 * STALE_THRESHOLD_DAYS (7 days).
 */

import { useEffect, useState } from "react";
import { supabase } from "@/database/db";

const STALE_THRESHOLD_DAYS = 7;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface DataFreshness {
  isStale: boolean;
  lastFetched: Date | null;
  daysSinceSync: number;
}

export default function useDataFreshness(): DataFreshness {
  const [freshness, setFreshness] = useState<DataFreshness>({
    isStale: true,
    lastFetched: null,
    daysSinceSync: 0,
  });

  useEffect(() => {
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("fan_spotify_data")
        .select("fetched_at")
        .eq("fan_id", user.id)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.log("useDataFreshness: could not fetch timestamp", error.message);
        return;
      }

      if (!data || !data.fetched_at) {
        setFreshness({ isStale: true, lastFetched: null, daysSinceSync: 0 });
        return;
      }

      const fetched = new Date(data.fetched_at);
      const days = Math.floor((Date.now() - fetched.getTime()) / MS_PER_DAY);

      setFreshness({
        isStale: days >= STALE_THRESHOLD_DAYS,
        lastFetched: fetched,
        daysSinceSync: days,
      });
    }

    check();
  }, []);

  return freshness;
}
