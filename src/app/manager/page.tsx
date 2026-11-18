"use client";

import { RoleAuthGate } from "@/components/RoleAuthGate";
import { ManagementSuite } from "@/components/ManagementSuite";

export default function ManagerPage() {
  return (
    <RoleAuthGate requiredRoles={["manager", "owner"]} preferredRole="manager">
      {({ user, logout }) => (
        <ManagementSuite user={user} logout={logout} mode="manager" />
      )}
    </RoleAuthGate>
  );
}
