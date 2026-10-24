// Hash de senha com scrypt (node:crypto), sem dependências externas.
// Formato salvo no banco: scrypt$N$r$p$salt_base64$hash_base64
import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

const N = 2 ** 17; // custo recomendado pela OWASP para scrypt
const R = 8;
const P = 1;
const KEYLEN = 64;

function derive(
  password: string,
  salt: Buffer,
  options: ScryptOptions,
  keylen: number,
) {
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, keylen, options, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}

const maxmem = (n: number, r: number) => 128 * n * r * 2;

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await derive(
    password,
    salt,
    { N, r: R, p: P, maxmem: maxmem(N, R) },
    KEYLEN,
  );
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  if (![n, r, p].every(Number.isInteger) || n > 2 ** 20 || r > 32 || p > 4)
    return false;
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (!salt.length || !expected.length) return false;
  const key = await derive(
    password,
    salt,
    { N: n, r, p, maxmem: maxmem(n, r) },
    expected.length,
  );
  return timingSafeEqual(key, expected);
}

// Hash fixo usado quando o usuário não existe, para o tempo de resposta não
// revelar quais usuários são válidos.
const DUMMY =
  "scrypt$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" +
  Buffer.alloc(64).toString("base64");
export async function burnPasswordTime(password: string) {
  await verifyPassword(password, DUMMY).catch(() => false);
}
