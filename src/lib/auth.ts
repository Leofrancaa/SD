// Autenticação: usuários no banco (Supabase, senha em hash scrypt) e sessão em
// cookie assinado (HMAC-SHA256). Sem Supabase configurado (desenvolvimento e
// testes), cai para um usuário por perfil com senha em variável de ambiente.
// Só roda no servidor.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isRole, roleLabels, type Role } from "@/lib/roles";
import { burnPasswordTime, verifyPassword } from "@/lib/password";
import { supabaseConfigurado, supabaseRpc } from "@/lib/supabase-server";

export const SESSION_COOKIE = "sd_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 horas

export type Identity = { sub?: string; nome?: string };
export type Session = { role: Role; exp: number } & Identity;

const isProduction = process.env.NODE_ENV === "production";

// Em desenvolvimento há valores padrão para facilitar; em produção (inclusive
// preview na Vercel) as variáveis são obrigatórias e o login falha fechado.
const devDefaults = {
  AUTH_SECRET: "dev-only-secret-change-me-0123456789",
  ADMIN_PASSWORD: "admin",
  GERENCIA_PASSWORD: "gerencia",
} as const;

function env(name: keyof typeof devDefaults) {
  const value = process.env[name];
  if (value) return value;
  return isProduction ? undefined : devDefaults[name];
}

function secret() {
  const value = env("AUTH_SECRET");
  return value && value.length >= 32 ? value : undefined;
}

/** Usuários vêm do banco quando o Supabase está configurado no servidor. */
export function usersFromDatabase() {
  return supabaseConfigurado();
}

export function authConfigured() {
  return Boolean(
    secret() &&
    (usersFromDatabase() ||
      (env("ADMIN_PASSWORD") && env("GERENCIA_PASSWORD"))),
  );
}

function passwordFor(role: Role) {
  return env(role === "admin" ? "ADMIN_PASSWORD" : "GERENCIA_PASSWORD");
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

// Compara em tempo constante (hash antes para igualar o tamanho).
function safeEqual(a: string, b: string) {
  return timingSafeEqual(digest(a), digest(b));
}

export function checkCredentials(username: string, password: string) {
  const role = username.trim().toLowerCase();
  if (!isRole(role)) return null;
  const expected = passwordFor(role);
  if (!expected || !safeEqual(password, expected)) return null;
  return role;
}

function sign(payload: string, key: string) {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

type DbUser = {
  id: string;
  empresa_id: string;
  nome: string;
  perfil: string;
  senha_hash: string;
};

/**
 * Confere usuário e senha. Com banco: busca o usuário ativo e compara o hash
 * scrypt (tempo constante, inclusive para usuário inexistente). Sem banco:
 * senhas das variáveis de ambiente (só desenvolvimento/testes).
 */
export async function authenticate(
  username: string,
  password: string,
): Promise<({ role: Role } & Identity) | null> {
  const login = username.trim().toLowerCase();
  if (!usersFromDatabase()) {
    const role = checkCredentials(login, password);
    return role ? { role, nome: roleLabels[role] } : null;
  }
  if (!/^[a-z0-9._-]{3,32}$/.test(login)) {
    await burnPasswordTime(password);
    return null;
  }
  const rows = await supabaseRpc<DbUser[]>("auth_usuario", {
    p_usuario: login,
  });
  const user = rows[0];
  if (!user) {
    await burnPasswordTime(password);
    return null;
  }
  if (
    !(await verifyPassword(password, user.senha_hash)) ||
    !isRole(user.perfil)
  )
    return null;
  supabaseRpc("auth_registrar_login", { p_id: user.id }).catch(() => {});
  return { role: user.perfil, sub: user.id, nome: user.nome };
}

export function createToken(
  role: Role,
  now = Date.now(),
  identity: Identity = {},
) {
  const key = secret();
  if (!key)
    throw new Error("AUTH_SECRET ausente ou curto (mín. 32 caracteres).");
  const session: Session = {
    role,
    exp: Math.floor(now / 1000) + SESSION_MAX_AGE,
    ...(identity.sub ? { sub: identity.sub.slice(0, 64) } : {}),
    ...(identity.nome ? { nome: identity.nome.slice(0, 80) } : {}),
  };
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

export function verifyToken(
  token: string | undefined,
  now = Date.now(),
): Session | null {
  const key = secret();
  if (!key || !token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  if (!safeEqual(signature, sign(payload, key))) return null;
  try {
    const session = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<Session>;
    if (!isRole(session.role) || typeof session.exp !== "number") return null;
    if (session.exp * 1000 <= now) return null;
    return {
      role: session.role,
      exp: session.exp,
      ...(typeof session.sub === "string" ? { sub: session.sub } : {}),
      ...(typeof session.nome === "string" ? { nome: session.nome } : {}),
    };
  } catch {
    return null;
  }
}

// Lê a sessão direto do cabeçalho Cookie (usado nas rotas de API).
export function sessionFromRequest(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  const token = header
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(SESSION_COOKIE.length + 1);
  return verifyToken(token);
}

export async function getSession() {
  const jar = await cookies();
  return verifyToken(jar.get(SESSION_COOKIE)?.value);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};
