// Design tokens for Bit-s. Green-forward identity, light + dark.
// Keys match the "color" block of design_guidelines.json.
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  surface: "#FFFFFF",
  onSurface: "#111111",
  surfaceSecondary: "#F4F6F5",
  onSurfaceSecondary: "#111111",
  surfaceTertiary: "#E9EDEB",
  onSurfaceTertiary: "#111111",
  surfaceInverse: "#0E1512",
  onSurfaceInverse: "#FFFFFF",
  muted: "#6B7280",

  brand: "#0CAF60",
  onBrand: "#FFFFFF",
  brandPrimary: "#0CAF60",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E7F7EF",
  onBrandSecondary: "#0A7D45",
  brandTertiary: "#F2FCF7",
  onBrandTertiary: "#0A7D45",

  success: "#0CAF60",
  onSuccess: "#FFFFFF",
  warning: "#F6C000",
  onWarning: "#111111",
  error: "#E23B3B",
  onError: "#FFFFFF",
  info: "#2563EB",
  onInfo: "#FFFFFF",

  border: "#E5E9E7",
  borderStrong: "#CFD6D2",
  divider: "#EEF1F0",
};

const dark: typeof light = {
  surface: "#0B0F0D",
  onSurface: "#F4F7F5",
  surfaceSecondary: "#141A17",
  onSurfaceSecondary: "#EAEFEC",
  surfaceTertiary: "#1E2622",
  onSurfaceTertiary: "#D6DCD8",
  surfaceInverse: "#F4F7F5",
  onSurfaceInverse: "#0B0F0D",
  muted: "#8B948F",

  brand: "#12C46E",
  onBrand: "#04140C",
  brandPrimary: "#12C46E",
  onBrandPrimary: "#04140C",
  brandSecondary: "#123123",
  onBrandSecondary: "#4FE39C",
  brandTertiary: "#0F241A",
  onBrandTertiary: "#4FE39C",

  success: "#12C46E",
  onSuccess: "#04140C",
  warning: "#F6C000",
  onWarning: "#111111",
  error: "#F16464",
  onError: "#1A0606",
  info: "#5B8DEF",
  onInfo: "#04101F",

  border: "#232B27",
  borderStrong: "#333D38",
  divider: "#1A211D",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 12, lg: 20, pill: 999 };
