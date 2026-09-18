import React from "react";

import { RoleTabs } from "@/src/components/tabs";

export default function ProviderTabs() {
  return (
    <RoleTabs
      tabs={[
        { name: "home", title: "Início", icon: "flash" },
        { name: "jobs", title: "Serviços", icon: "briefcase-outline" },
        { name: "earnings", title: "Ganhos", icon: "cash-outline" },
        { name: "profile", title: "Perfil", icon: "person-outline" },
      ]}
    />
  );
}
