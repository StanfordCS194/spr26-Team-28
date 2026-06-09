/*
 * Shared helpers for aggregating fans' Spotify listening data.
 *
 * Several screens turn a set of per-fan Spotify snapshots (rows from the
 * `fan_spotify_data` table) into ranked tallies of the tracks and artists those
 * fans listen to — the artist INSIGHTS dashboard and the collaboration
 * recommender both need this. Keeping the aggregation here is the single source
 * of truth so the logic cannot drift between screens (previously it was
 * copy-pasted into two different index screens).
 */

/** How many fans have a given track in their top tracks. */
export interface TrackTally {
  name: string;
  artists: string;
  count: number;
}

/** How many fans have a given artist in their top artists. */
export interface ArtistTally {
  name: string;
  count: number;
}

/**
 * A single `fan_spotify_data` row, narrowed to the fields used for aggregation.
 * The JSON columns are loosely typed because they hold raw Spotify API objects.
 */
export interface FanSpotifyRow {
  top_tracks?: any[] | null;
  top_artists?: any[] | null;
  recently_played?: any[] | null;
}

export interface FanDataAggregate {
  /** Top `topN` tracks across all fans, most common first. */
  topTracks: TrackTally[];
  /** Top `topN` artists across all fans, most common first. */
  topArtists: ArtistTally[];
  /** Total number of recently-played entries summed across all fans. */
  totalPlays: number;
  /**
   * Full (un-truncated) tallies keyed by Spotify id/name. Callers that need to
   * compare two fanbases' tastes (e.g. collaboration recommendations) use these
   * rather than the top-N slices above.
   */
  trackCounts: Record<string, TrackTally>;
  artistCounts: Record<string, ArtistTally>;
}

const DEFAULT_TOP_N = 5;

/**
 * Aggregate a list of fan Spotify snapshots into ranked track/artist tallies.
 * Safe against missing/null columns and malformed entries.
 */
export function aggregateFanData(
  rows: FanSpotifyRow[] | null | undefined,
  topN: number = DEFAULT_TOP_N,
): FanDataAggregate {
  const trackCounts: Record<string, TrackTally> = {};
  const artistCounts: Record<string, ArtistTally> = {};
  let totalPlays = 0;

  for (const row of rows ?? []) {
    for (const t of row?.top_tracks ?? []) {
      const key = t?.id ?? t?.name;
      if (key == null) continue;
      if (!trackCounts[key]) {
        trackCounts[key] = {
          name: t.name,
          artists: t.artists?.map((a: any) => a.name).join(", ") ?? "",
          count: 0,
        };
      }
      trackCounts[key].count += 1;
    }

    for (const a of row?.top_artists ?? []) {
      const key = a?.id ?? a?.name;
      if (key == null) continue;
      if (!artistCounts[key]) {
        artistCounts[key] = { name: a.name, count: 0 };
      }
      artistCounts[key].count += 1;
    }

    totalPlays += (row?.recently_played ?? []).length;
  }

  const topTracks = Object.values(trackCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
  const topArtists = Object.values(artistCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);

  return { topTracks, topArtists, totalPlays, trackCounts, artistCounts };
}

/** Format a number compactly: 1234 -> "1.2K", 1_500_000 -> "1.5M". */
export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}
