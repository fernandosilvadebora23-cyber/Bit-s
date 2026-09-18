import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { queryClient } from "@/src/query-client";
import { useToast } from "@/src/components/toast";
import { Button, Card, Field } from "@/src/components/ui";
import { Screen } from "@/src/components/screen";
import { makeStyles, radius, spacing, useTheme } from "@/src/theme";

export default function CustomerProfile() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const toast = useToast();

  const addressesQ = useQuery({ queryKey: ["addresses"], queryFn: () => api("/me/addresses") });
  const addresses = addressesQ.data?.addresses || [];

  const [adding, setAdding] = useState(false);
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [saving, setSaving] = useState(false);

  const addAddress = async () => {
    if (!street || !number) return toast.show("Preencha rua e número", "error");
    setSaving(true);
    try {
      await api("/me/addresses", {
        method: "POST",
        body: { label: "Endereço", street, number, neighborhood, city: "Curitiba", state: "PR" },
      });
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      setStreet(""); setNumber(""); setNeighborhood(""); setAdding(false);
      toast.show("Endereço adicionado", "success");
    } catch (e: any) {
      toast.show(e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const removeAddress = async (id: string) => {
    await api(`/me/addresses/${id}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["addresses"] });
  };

  return (
    <Screen title="Perfil" subtitle={user?.email}>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }} bottomOffset={20}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={s.avatar}><Ionicons name="person" size={28} color={colors.brandPrimary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{user?.name}</Text>
            <Text style={s.sub}>{user?.phone || user?.email}</Text>
          </View>
        </Card>

        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>Endereços</Text>
          <Pressable testID="toggle-add-address" onPress={() => setAdding((a) => !a)}>
            <Ionicons name={adding ? "close" : "add-circle"} size={26} color={colors.brandPrimary} />
          </Pressable>
        </View>

        {adding && (
          <Card style={{ gap: spacing.md }}>
            <Field label="Rua" testID="addr-street" value={street} onChangeText={setStreet} placeholder="Rua das Flores" />
            <Field label="Número" testID="addr-number" value={number} onChangeText={setNumber} placeholder="123" keyboardType="numeric" />
            <Field label="Bairro" testID="addr-neighborhood" value={neighborhood} onChangeText={setNeighborhood} placeholder="Centro" />
            <Button testID="save-address-button" label="Salvar endereço" onPress={addAddress} loading={saving} />
          </Card>
        )}

        {addresses.map((a: any) => (
          <View key={a.address_id} style={s.addrRow}>
            <Ionicons name="location" size={20} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={s.addrText}>{a.street}, {a.number}</Text>
              <Text style={s.addrSub}>{a.neighborhood} · {a.city}{a.is_default ? " · Padrão" : ""}</Text>
            </View>
            <Pressable testID={`del-addr-${a.address_id}`} onPress={() => removeAddress(a.address_id)} hitSlop={8}>
              <Ionicons name="trash-outline" size={20} color={colors.muted} />
            </Pressable>
          </View>
        ))}

        <Text style={s.sectionTitle}>Pagamento</Text>
        <View style={s.addrRow}>
          <Ionicons name="card" size={20} color={colors.brandPrimary} />
          <View style={{ flex: 1 }}>
            <Text style={s.addrText}>Pix (simulado)</Text>
            <Text style={s.addrSub}>Método padrão do MVP</Text>
          </View>
        </View>

        <Button testID="logout-button" label="Sair" variant="outline" icon="log-out-outline" onPress={logout} />
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.brandTertiary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 18, fontWeight: "800", color: c.onSurface },
  sub: { fontSize: 13, color: c.muted },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: c.onSurface },
  addrRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: c.surfaceSecondary, borderRadius: radius.md, padding: spacing.md },
  addrText: { fontSize: 15, fontWeight: "700", color: c.onSurface },
  addrSub: { fontSize: 12, color: c.muted },
}));
