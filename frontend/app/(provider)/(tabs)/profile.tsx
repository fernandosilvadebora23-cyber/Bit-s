import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { Screen } from "@/src/components/screen";
import { Badge, Button, Card } from "@/src/components/ui";
import { PROVIDER_STATUS_LABEL, statusColor } from "@/src/format";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function ProviderProfile() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const q = useQuery({ queryKey: ["provider-profile"], queryFn: () => api("/provider/me") });
  const p = q.data?.profile;
  const status = p?.status || "PENDENTE";

  return (
    <Screen title="Perfil" subtitle={user?.email}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <View style={s.avatar}><Ionicons name="person" size={28} color={colors.brandPrimary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{user?.name}</Text>
              <Text style={s.sub}>{user?.phone || user?.email}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Text style={s.label}>Verificação:</Text>
            <Badge text={PROVIDER_STATUS_LABEL[status] || status} color={statusColor(status, colors)} />
          </View>
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <Text style={s.sectionTitle}>Categorias de atuação</Text>
          {p?.categories?.length ? (
            <View style={s.chips}>
              {p.categories.map((cat: string) => (
                <View key={cat} style={s.chip}><Text style={s.chipText}>{cat}</Text></View>
              ))}
            </View>
          ) : (
            <Text style={s.sub}>Nenhuma categoria configurada</Text>
          )}
          <View style={s.infoRow}>
            <Text style={s.label}>Raio de atendimento</Text>
            <Text style={s.value}>{p?.radius_km ?? 0} km</Text>
          </View>
          <View style={s.infoRow}>
            <Text style={s.label}>Região</Text>
            <Text style={s.value}>{p?.region || "curitiba"}</Text>
          </View>
        </Card>

        <Button testID="edit-profile-button" label={status === "PENDENTE" ? "Completar cadastro" : "Editar cadastro"} icon="create-outline"
          onPress={() => router.push("/(provider)/onboarding")} />
        <Button testID="logout-button" label="Sair" variant="outline" icon="log-out-outline" onPress={logout} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 18, fontWeight: "800", color: c.onSurface },
  sub: { fontSize: 13, color: c.muted },
  label: { fontSize: 14, color: c.muted },
  value: { fontSize: 14, color: c.onSurface, fontWeight: "700" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: c.onSurface },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { backgroundColor: c.brandTertiary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  chipText: { color: c.onBrandTertiary, fontWeight: "700", fontSize: 13, textTransform: "capitalize" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
}));
