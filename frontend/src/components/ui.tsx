// Shared UI primitives for Bit-s.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";

import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  testID,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "outline" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: any;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const s = useBtn();
  const { colors } = useTheme();
  const bg =
    variant === "primary" ? colors.brandPrimary
    : variant === "secondary" ? colors.brandSecondary
    : variant === "danger" ? colors.error
    : "transparent";
  const fg =
    variant === "primary" ? colors.onBrandPrimary
    : variant === "secondary" ? colors.onBrandSecondary
    : variant === "danger" ? colors.onError
    : colors.onSurface;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === "outline" && { borderWidth: 1.5, borderColor: colors.borderStrong },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={s.row}>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[s.label, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const useBtn = makeStyles((c) => ({
  btn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { fontSize: 16, fontWeight: "700" },
}));

export function Field({
  label,
  error,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string; style?: any }) {
  const s = useField();
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      {label && <Text style={s.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[s.input, error && { borderColor: colors.error }, style]}
        {...props}
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

const useField = makeStyles((c) => ({
  label: { fontSize: 13, fontWeight: "600", color: c.onSurfaceSecondary },
  input: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
    paddingHorizontal: spacing.md,
    fontSize: 15,
    color: c.onSurface,
  },
  error: { color: c.error, fontSize: 12 },
}));

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const s = useCard();
  return <View style={[s.card, style]}>{children}</View>;
}

const useCard = makeStyles((c) => ({
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.border,
  },
}));

export function Badge({ text, color }: { text: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: color + "22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: "flex-start" }}>
      <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{text}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", padding: spacing.xl, gap: spacing.sm }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary }}>
        <Ionicons name={icon} size={34} color={colors.brandPrimary} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: "700", color: colors.onSurface, textAlign: "center" }}>{title}</Text>
      {subtitle ? <Text style={{ fontSize: 14, color: colors.muted, textAlign: "center" }}>{subtitle}</Text> : null}
    </View>
  );
}
