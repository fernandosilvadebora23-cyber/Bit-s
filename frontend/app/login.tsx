import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/auth";
import { BitsTile } from "@/src/components/logo";
import { useToast } from "@/src/components/toast";
import { Button, Field } from "@/src/components/ui";
import { makeStyles, spacing, useTheme } from "@/src/theme";

const DEMO = [
  { label: "Cliente", email: "cliente1@bits.app" },
  { label: "Prestador", email: "prestador.diarista@bits.app" },
  { label: "Admin", email: "admin@bits.app" },
];

export default function Login() {
  const s = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { login, googleLogin } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const doLogin = async (em?: string, pw?: string) => {
    const e = em ?? email;
    const p = pw ?? password;
    if (!e || !p) return toast.show("Preencha e-mail e senha", "error");
    setLoading(true);
    try {
      await login(e, p);
    } catch (err: any) {
      toast.show(err.message || "Falha ao entrar", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + spacing.xl }]}>
      <KeyboardAwareScrollView contentContainerStyle={s.content} bottomOffset={20}>
        <View style={s.header}>
          <BitsTile size={72} />
          <Text style={s.title}>Bit-s</Text>
          <Text style={s.subtitle}>Serviços presenciais sob demanda em Curitiba</Text>
        </View>

        <View style={s.form}>
          <Field
            label="E-mail"
            testID="login-email-input"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="voce@email.com"
          />
          <Field
            label="Senha"
            testID="login-password-input"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
          />
          <Button testID="login-submit-button" label="Entrar" onPress={() => doLogin()} loading={loading} />

          <View style={s.divider}>
            <View style={s.line} />
            <Text style={s.dividerText}>ou</Text>
            <View style={s.line} />
          </View>

          <Button
            testID="login-google-button"
            label="Continuar com Google"
            variant="outline"
            icon="logo-google"
            onPress={async () => {
              try { await googleLogin(); } catch (e: any) { toast.show(e.message || "Falha no Google", "error"); }
            }}
          />

          <Pressable testID="go-register" onPress={() => router.push("/register")} style={s.registerLink}>
            <Text style={s.registerText}>
              Não tem conta? <Text style={{ color: colors.brandPrimary, fontWeight: "700" }}>Cadastre-se</Text>
            </Text>
          </Pressable>
        </View>

        <View style={s.demoBox}>
          <View style={s.demoHeader}>
            <Ionicons name="flask-outline" size={16} color={colors.muted} />
            <Text style={s.demoTitle}>Acesso rápido de demonstração</Text>
          </View>
          <View style={s.demoRow}>
            {DEMO.map((d) => (
              <Pressable
                key={d.email}
                testID={`demo-login-${d.label.toLowerCase()}`}
                style={s.demoChip}
                onPress={() => doLogin(d.email, "demo1234")}
              >
                <Text style={s.demoChipText}>{d.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.demoHint}>Senha padrão: demo1234</Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  content: { padding: spacing.xl, gap: spacing.xl, flexGrow: 1 },
  header: { alignItems: "center", gap: spacing.sm, marginTop: spacing.lg },
  title: { fontSize: 34, fontWeight: "800", color: c.onSurface, letterSpacing: -1 },
  subtitle: { fontSize: 14, color: c.muted, textAlign: "center" },
  form: { gap: spacing.md },
  divider: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginVertical: spacing.xs },
  line: { flex: 1, height: 1, backgroundColor: c.divider },
  dividerText: { color: c.muted, fontSize: 13 },
  registerLink: { alignItems: "center", paddingVertical: spacing.sm },
  registerText: { color: c.onSurfaceSecondary, fontSize: 14 },
  demoBox: { backgroundColor: c.surfaceSecondary, borderRadius: 16, padding: spacing.lg, gap: spacing.sm, marginTop: "auto" },
  demoHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  demoTitle: { color: c.muted, fontSize: 13, fontWeight: "600" },
  demoRow: { flexDirection: "row", gap: spacing.sm },
  demoChip: { flex: 1, backgroundColor: c.brandTertiary, paddingVertical: spacing.md, borderRadius: 12, alignItems: "center" },
  demoChipText: { color: c.onBrandTertiary, fontWeight: "700", fontSize: 13 },
  demoHint: { color: c.muted, fontSize: 12, textAlign: "center" },
}));
