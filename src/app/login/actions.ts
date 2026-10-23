"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  authConfigured,
  checkCredentials,
  createToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";

export type LoginState = { error: string } | null;

export async function login(
  _previous: LoginState,
  form: FormData,
): Promise<LoginState> {
  if (!authConfigured())
    return {
      error:
        "Login não configurado no servidor. Defina AUTH_SECRET, ADMIN_PASSWORD e GERENCIA_PASSWORD.",
    };
  const role = checkCredentials(
    String(form.get("username") ?? ""),
    String(form.get("password") ?? ""),
  );
  if (!role) {
    // Atraso fixo para encarecer tentativas em sequência.
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { error: "Usuário ou senha incorretos." };
  }
  (await cookies()).set(
    SESSION_COOKIE,
    createToken(role),
    sessionCookieOptions,
  );
  redirect(role === "admin" ? "/" : "/?view=inventory");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
