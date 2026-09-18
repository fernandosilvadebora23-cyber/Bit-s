// Minimal toast system mounted at the root (above tabs/modals).
import { Ionicons } from "@react-native-vector-icons/ionicons";
import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { radius, spacing, useTheme } from "@/src/theme";

type ToastKind = "success" | "error" | "info";
type ToastCtx = { show: (msg: string, kind?: ToastKind) => void };
const Ctx = createContext<ToastCtx>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<{ msg: string; kind: ToastKind } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const show = useCallback((msg: string, kind: ToastKind = "info") => {
    setState({ msg, kind });
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
        setState(null),
      );
    }, 2600);
  }, [opacity]);

  const bg = state?.kind === "success" ? colors.success : state?.kind === "error" ? colors.error : colors.surfaceInverse;
  const fg = state?.kind === "info" ? colors.onSurfaceInverse : colors.onSuccess;
  const icon = state?.kind === "success" ? "checkmark-circle" : state?.kind === "error" ? "alert-circle" : "information-circle";

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {state && (
        <Animated.View
          pointerEvents="none"
          style={[styles.wrap, { top: insets.top + spacing.sm, opacity }]}
        >
          <View style={[styles.toast, { backgroundColor: bg }]} testID="toast">
            <Ionicons name={icon as any} size={20} color={fg} />
            <Text style={[styles.text, { color: fg }]} numberOfLines={2}>{state.msg}</Text>
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: spacing.lg, right: spacing.lg, alignItems: "center", zIndex: 9999 },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    maxWidth: 520,
  },
  text: { flex: 1, fontSize: 14, fontWeight: "600" },
});
