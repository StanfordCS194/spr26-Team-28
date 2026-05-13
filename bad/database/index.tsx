/*
 * Re-exports the shared Supabase client instance for convenience and
 * consistent imports across the application.
 *
 * This module ensures all consumers use the same initialized client.
 */

import db from "@/database/db";

export { db };
