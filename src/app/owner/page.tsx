"use client";

import { RoleAuthGate } from "@/components/RoleAuthGate";
import { ManagementSuite } from "@/components/ManagementSuite";

export default function OwnerPage() {
  return (
    <RoleAuthGate requiredRoles={["owner"]} preferredRole="owner">
      {({ user, logout }) => (
        <ManagementSuite user={user} logout={logout} mode="owner" />
      )}
    </RoleAuthGate>
  );
}
