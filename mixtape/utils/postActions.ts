// Supabase interaction functions for post likes and comments.

import { supabase } from "@/database/db";

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  commenter_name: string;
  commenter_initials: string;
}

// Toggle a like on a post. Returns true if the post is now liked,
// false if the like was removed.
export async function toggleLike(
  postId: string,
  userId: string
): Promise<boolean> {
  const liked = await isLiked(postId, userId);

  if (liked) {
    await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId);
    return false;
  }

  await supabase
    .from("post_likes")
    .insert({ post_id: postId, user_id: userId });
  return true;
}

// Return the total number of likes on a post.
export async function getLikeCount(postId: string): Promise<number> {
  const { count } = await supabase
    .from("post_likes")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);
  return count ?? 0;
}

// Check whether a specific user has liked a post.
export async function isLiked(
  postId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("post_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  return data !== null;
}

// Add a comment to a post.
export async function addComment(
  postId: string,
  userId: string,
  body: string
): Promise<void> {
  await supabase
    .from("comments")
    .insert({ post_id: postId, user_id: userId, body });
}

// Helper to derive initials from a display name.
function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Fetch all comments for a post, joined with the commenter profile.
export async function getComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("id, post_id, user_id, body, created_at, profiles:user_id(name)")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return (data as any[]).map((row) => {
    const name = row.profiles?.name ?? "Unknown";
    return {
      id: row.id,
      post_id: row.post_id,
      user_id: row.user_id,
      body: row.body,
      created_at: row.created_at,
      commenter_name: name,
      commenter_initials: initialsFrom(name),
    };
  });
}
