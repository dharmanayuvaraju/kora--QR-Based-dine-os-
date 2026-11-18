"use client";

import dynamic from "next/dynamic";
import { RoleAuthGate } from "@/components/RoleAuthGate";

const ManagementSuite = dynamic(
  () => import("@/components/ManagementSuite").then((m) => m.ManagementSuite),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F7F8] text-xs font-medium text-stone-500">
        Loading Owner Executive Suite...
      </div>
    ),
  }
);

export default function OwnerPage() {
  return (
    <RoleAuthGate requiredRoles={["owner"]} preferredRole="owner">
      {({ user, logout }) => (
        <ManagementSuite user={user} logout={logout} mode="owner" />
      )}
    </RoleAuthGate>
  );
}
