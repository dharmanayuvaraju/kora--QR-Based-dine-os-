"use client";

import dynamic from "next/dynamic";
import { RoleAuthGate } from "@/components/RoleAuthGate";

const ManagementSuite = dynamic(
  () => import("@/components/ManagementSuite").then((m) => m.ManagementSuite),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F7F8] text-xs font-medium text-stone-500">
        Loading Manager Operations...
      </div>
    ),
  }
);

export default function ManagerPage() {
  return (
    <RoleAuthGate requiredRoles={["manager"]} preferredRole="manager">
      {({ user, logout }) => (
        <ManagementSuite user={user} logout={logout} mode="manager" />
      )}
    </RoleAuthGate>
  );
}
