"use client";

import dynamic from "next/dynamic";

const AuthProvider = dynamic(
  () => import("@/context/AuthContext").then((m) => m.AuthProvider),
  { ssr: false }
);

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
