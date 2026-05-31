/*
 * select-location.tsx
 *
 * Fan onboarding step: pick country then city.
 * Inserted between select-account and connect-music.
 *
 * Uses the `country-state-city` package for comprehensive offline data
 * (~250 countries, ~150k cities). Saves { country, city } to profiles.
 *
 * Install: npx expo install country-state-city
 */

import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useRef, useState } from "react";
import { Country, City } from "country-state-city";

import { supabase } from "@/database/db";
import theme from "@/assets/theme";

// ─── Derived data (computed once at module load) ───────────────────────────────

const ALL_COUNTRIES = Country.getAllCountries().map((c) => ({
  name: c.name,
  isoCode: c.isoCode,
}));

// ─── SearchDropdown ────────────────────────────────────────────────────────────

interface SearchDropdownProps {
  label: string;
  placeholder: string;
  value: string;
  options: string[];
  disabled?: boolean;
  onSelect: (value: string) => void;
}

function SearchDropdown({
  label,
  placeholder,
  value,
  options,
  disabled = false,
  onSelect,
}: SearchDropdownProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  }, [query, options]);

  function handleSelect(item: string) {
    setQuery(item);
    setOpen(false);
    onSelect(item);
    Keyboard.dismiss();
  }

  function handleFocus() {
    if (!disabled) {
      if (query === value && value !== "") setQuery("");
      setOpen(true);
    }
  }

  function handleBlur() {
    setTimeout(() => {
      setOpen(false);
      setQuery(value);
    }, 150);
  }

  // Keep query in sync when parent resets value (e.g. country change clears city)
  if (!open && query !== value) {
    setQuery(value);
  }

  const visible = filtered.slice(0, 7);
  const overflow = filtered.length - 7;

  return (
    <View style={dd.wrapper}>
      <Text style={dd.label}>{label}</Text>

      <View
        style={[
          dd.inputRow,
          open && dd.inputRowOpen,
          disabled && dd.inputRowDisabled,
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[dd.input, disabled && dd.inputDisabled]}
          value={open ? query : value}
          onChangeText={(t) => { setQuery(t); setOpen(true); }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={disabled ? "Select a country first" : placeholder}
          placeholderTextColor={theme.colors.muted}
          editable={!disabled}
          autoCorrect={false}
          autoCapitalize="words"
        />
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={disabled ? theme.colors.border : theme.colors.muted}
        />
      </View>

      {open && (
        <View style={dd.listContainer}>
          {visible.length > 0 ? (
            <>
              <FlatList
                data={visible}
                keyExtractor={(item, index) => `${item}-${index}`}
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={false}
                style={dd.list}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={[
                      dd.listItem,
                      index === visible.length - 1 && dd.listItemLast,
                    ]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        dd.listItemText,
                        item === value && dd.listItemTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                    {item === value && (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={theme.colors.primary}
                      />
                    )}
                  </TouchableOpacity>
                )}
              />
              {overflow > 0 && (
                <View style={dd.moreRow}>
                  <Text style={dd.moreText}>
                    +{overflow} more — keep typing to narrow down
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={dd.emptyRow}>
              <Text style={dd.emptyText}>No results found</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const dd = StyleSheet.create({
  wrapper: { position: "relative", zIndex: 10 },
  label: {
    fontFamily: theme.fonts.sansMedium,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: theme.border.button,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: theme.colors.background,
  },
  inputRowOpen: {
    borderColor: theme.colors.text,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  inputRowDisabled: { opacity: 0.45 },
  input: {
    flex: 1,
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
    padding: 0,
  },
  inputDisabled: { color: theme.colors.muted },
  listContainer: {
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: theme.colors.text,
    borderBottomLeftRadius: theme.border.button,
    borderBottomRightRadius: theme.border.button,
    backgroundColor: theme.colors.card,
    overflow: "hidden",
  },
  list: { maxHeight: 245 },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  listItemLast: { borderBottomWidth: 0 },
  listItemText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    color: theme.colors.text,
  },
  listItemTextSelected: {
    fontFamily: theme.fonts.sansSemiBold,
    color: theme.colors.primary,
  },
  moreRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  moreText: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.tiny,
    color: theme.colors.muted,
    letterSpacing: 0.3,
  },
  emptyRow: { paddingHorizontal: 16, paddingVertical: 16 },
  emptyText: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    color: theme.colors.muted,
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SelectLocation() {
  const router = useRouter();

  // Store both the display name and isoCode for the selected country
  const [countryName, setCountryName] = useState("");
  const [countryIso, setCountryIso] = useState("");
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);

  const countryNames = useMemo(
    () => ALL_COUNTRIES.map((c) => c.name),
    []
  );

  // City list derived from selected country's isoCode
  const cityNames = useMemo(() => {
    if (!countryIso) return [];
    return City.getCitiesOfCountry(countryIso)?.map((c) => c.name) ?? [];
  }, [countryIso]);

  function handleCountrySelect(name: string) {
    const found = ALL_COUNTRIES.find((c) => c.name === name);
    setCountryName(name);
    setCountryIso(found?.isoCode ?? "");
    setCity("");
  }

  const canContinue = countryName.trim() !== "" && city.trim() !== "";

  async function handleContinue() {
    setSaving(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert("Error", "Could not get user session.");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ country: countryName, city })
        .eq("id", user.id);

      if (error) {
        Alert.alert("Error", error.message);
        return;
      }

      router.push("/(sign-in)/connect-music");
    } catch (error: any) {
      Alert.alert("Network error", error.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  function skip() {
    router.push("/(sign-in)/connect-music");
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <View style={styles.inner}>
          {/* Top row */}
          <View style={styles.topRow}>
            <Pressable style={styles.back} onPress={() => router.back()}>
              <Ionicons
                name="chevron-back"
                size={20}
                color={theme.colors.text}
              />
            </Pressable>
            <Pressable onPress={skip}>
              <Text style={styles.skipLabel}>SKIP</Text>
            </Pressable>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Where are you based?</Text>
            <Text style={styles.subtitle}>
              This helps artists understand where their listeners are in the
              world.
            </Text>
          </View>

          {/* Dropdowns */}
          <View style={styles.fields}>
            <View style={styles.dropdownCountry}>
              <SearchDropdown
                label="COUNTRY"
                placeholder="Search countries..."
                value={countryName}
                options={countryNames}
                onSelect={handleCountrySelect}
              />
            </View>
            <View style={styles.dropdownCity}>
              <SearchDropdown
                label="CITY"
                placeholder="Search cities..."
                value={city}
                options={cityNames}
                disabled={!countryName}
                onSelect={setCity}
              />
            </View>
          </View>

          {/* Privacy notice */}
          <View style={styles.privacyCard}>
            <Ionicons
              name="shield-checkmark-outline"
              size={15}
              color={theme.colors.muted}
            />
            <Text style={styles.privacyText}>
              This information will only be shared with artists you follow and
              will never be tied to your name. You can change your location at
              any time in{" "}
              <Text style={styles.privacyBold}>You → Location</Text>.
            </Text>
          </View>

          <View style={{ flex: 1 }} />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable
            style={[
              styles.button,
              (!canContinue || saving) && styles.buttonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!canContinue || saving}
          >
            <Ionicons
              name="location-outline"
              size={18}
              color={theme.colors.darkText}
            />
            <Text style={styles.buttonLabel}>
              {saving ? "Saving..." : "Continue"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  keyboardView: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  skipLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.small,
    color: theme.colors.muted,
    letterSpacing: 0.6,
  },
  header: { marginTop: 10, marginBottom: 32 },
  title: {
    fontFamily: theme.fonts.sansBoldItalic,
    fontSize: theme.fontSizes.title,
    lineHeight: 34,
    color: theme.colors.text,
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.body,
    lineHeight: 26,
    color: theme.colors.muted,
  },
  fields: { gap: 0, marginBottom: 24 },
  dropdownCountry: { zIndex: 20, marginBottom: 28 },
  dropdownCity: { zIndex: 10 },
  privacyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: theme.colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    padding: 14,
  },
  privacyText: {
    flex: 1,
    fontFamily: theme.fonts.sans,
    fontSize: theme.fontSizes.small,
    lineHeight: 20,
    color: theme.colors.muted,
  },
  privacyBold: {
    fontFamily: theme.fonts.sansSemiBold,
    color: theme.colors.text,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    backgroundColor: theme.colors.background,
  },
  button: {
    width: "100%",
    height: 55,
    backgroundColor: theme.colors.primary,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonLabel: {
    fontFamily: theme.fonts.ui,
    fontSize: theme.fontSizes.button,
    color: theme.colors.darkText,
  },
});
