// Hook for picking and uploading a profile image to Supabase Storage.

import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

import { supabase } from "@/database/db";

const BUCKET = "avatars";

type UseImagePickerResult = {
  pickAndUpload: () => Promise<string | null>;
  uploading: boolean;
};

// Picks an image from the device library, uploads it to the "avatars" bucket
// in Supabase Storage, and updates the profiles table with the public URL.
// Returns the public URL on success, or null if the user cancelled or an
// error occurred.
export default function useImagePicker(): UseImagePickerResult {
  const [uploading, setUploading] = useState(false);

  async function pickAndUpload(): Promise<string | null> {
    try {
      // Request permission to access the media library.
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          "Permission required",
          "Please allow access to your photo library in Settings.",
        );
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (result.canceled || result.assets.length === 0) {
        return null;
      }

      setUploading(true);

      const asset = result.assets[0];
      const uri = asset.uri;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert("Error", "You must be signed in to upload an avatar.");
        return null;
      }

      const filePath = `${user.id}.jpg`;

      // Read the file from the local URI and convert to a Blob for upload.
      const response = await fetch(uri);
      const blob = await response.blob();

      // Upload to Supabase Storage, overwriting any existing file.
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, blob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        Alert.alert("Upload failed", uploadError.message);
        return null;
      }

      // Build the public URL for the uploaded file.
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

      // Append a cache-busting timestamp so the image refreshes immediately.
      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      // Persist the URL in the profiles table.
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);

      if (updateError) {
        Alert.alert("Profile update failed", updateError.message);
        return null;
      }

      return avatarUrl;
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not upload image.");
      return null;
    } finally {
      setUploading(false);
    }
  }

  return { pickAndUpload, uploading };
}
