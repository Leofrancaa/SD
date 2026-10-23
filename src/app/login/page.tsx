import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wheat } from "lucide-react";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar · Superdeli" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(session.role === "admin" ? "/" : "/?view=inventory");
  return (
    <main className="login-shell">
      <section className="panel login-card" aria-labelledby="login-title">
        <span className="brand-symbol login-symbol">
          <Wheat size={24} />
        </span>
        <h1 id="login-title">Entrar na Superdeli</h1>
        <p>Use o acesso do seu perfil.</p>
        <LoginForm />
      </section>
    </main>
  );
}
