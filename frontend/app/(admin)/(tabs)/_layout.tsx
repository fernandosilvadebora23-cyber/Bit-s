import React from "react";

import { RoleTabs } from "@/src/components/tabs";

export default function AdminTabs() {
  return (
    <RoleTabs
      tabs={[
        { name: "dashboard", title: "Painel", icon: "grid-outline" },
        { name: "providers", title: "Prestadores", icon: "people-outline" },
        { name: "orders", title: "Pedidos", icon: "receipt-outline" },
        { name: "settings", title: "Ajustes", icon: "settings-outline" },
      ]}
    />
  );
}
