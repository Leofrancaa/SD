"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  authConfigured,
  authenticate,
  createToken,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { createLimiter } from "@/lib/rate-limit";

export type LoginState = { error: string } | null;

// 5 erros por IP a cada 15 min; 20 por usuário (protege contra IPs trocados).
const byIp = createLimiter({ max: 5, windowMs: 15 * 60_000 });
const byUser = createLimiter({ max: 20, windowMs: 15 * 60_000 });

export async function login(
  _previous: LoginState,
  form: FormData,
): Promise<LoginState> {
  if (!authConfigured())
    return {
      error:
        "Login não configurado no servidor. Defina AUTH_SECRET e a conexão com o Supabase.",
    };
  const list = await headers();
  const ip =
    list.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    list.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local";
  const username = String(form.get("username") ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 64);
  const userKey = `u:${username}`;
  if (byIp.blocked(ip) || byUser.blocked(userKey)) {
    const minutes = Math.ceil(
      Math.max(byIp.retryAfterSeconds(ip), byUser.retryAfterSeconds(userKey)) /
        60,
    );
    return {
      error: `Muitas tentativas incorretas. Aguarde ${minutes} min e tente de novo.`,
    };
  }
  let user: Awaited<ReturnType<typeof authenticate>>;
  try {
    user = await authenticate(
      username,
      String(form.get("password") ?? "").slice(0, 256),
    );
  } catch (error) {
    console.error("login", error);
    return {
      error:
        "Não foi possível verificar o acesso agora. Tente de novo em instantes.",
    };
  }
  if (!user) {
    byIp.fail(ip);
    byUser.fail(userKey);
    // Atraso fixo para encarecer tentativas em sequência.
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { error: "Usuário ou senha incorretos." };
  }
  byIp.reset(ip);
  byUser.reset(userKey);
  (await cookies()).set(
    SESSION_COOKIE,
    createToken(user.role, Date.now(), { sub: user.sub, nome: user.nome }),
    sessionCookieOptions,
  );
  redirect(user.role === "admin" ? "/" : "/?view=inventory");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
