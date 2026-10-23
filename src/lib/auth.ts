// Autenticação simples, sem banco: um usuário por perfil, senhas em variáveis
// de ambiente e sessão em cookie assinado (HMAC-SHA256). Só roda no servidor.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isRole, type Role } from "@/lib/roles";

export const SESSION_COOKIE = "sd_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 horas

export type Session = { role: Role; exp: number };

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

export function authConfigured() {
  return Boolean(secret() && env("ADMIN_PASSWORD") && env("GERENCIA_PASSWORD"));
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

export function createToken(role: Role, now = Date.now()) {
  const key = secret();
  if (!key)
    throw new Error("AUTH_SECRET ausente ou curto (mín. 32 caracteres).");
  const session: Session = {
    role,
    exp: Math.floor(now / 1000) + SESSION_MAX_AGE,
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
    return { role: session.role, exp: session.exp };
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
