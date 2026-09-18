import React from "react";

import { RoleTabs } from "@/src/components/tabs";

export default function CustomerTabs() {
  return (
    <RoleTabs
      tabs={[
        { name: "home", title: "Início", icon: "home" },
        { name: "orders", title: "Pedidos", icon: "receipt-outline" },
        { name: "notifications", title: "Alertas", icon: "notifications-outline" },
        { name: "profile", title: "Perfil", icon: "person-outline" },
      ]}
    />
  );
}
