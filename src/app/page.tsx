import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <Dashboard role={session.role} />;
}
