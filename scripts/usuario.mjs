#!/usr/bin/env node
// Gera o SQL para criar um usuário do painel ou trocar a senha dele.
// A senha (aleatória ou informada) só aparece neste terminal; o banco guarda o hash.
//
// Uso:
//   node scripts/usuario.mjs <usuario> <perfil admin|gerencia> "<Nome>" [empresa_id]
// Depois cole o SQL no SQL Editor do Supabase.
import { randomBytes, randomInt, scrypt } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, argv, exit } from "node:process";

const [
  usuario,
  perfil,
  nome,
  empresa = "7b0a55b2-9ccc-4739-b845-51a7ae4da843",
] = argv.slice(2);
if (
  !usuario ||
  !/^[a-z0-9._-]{3,32}$/.test(usuario) ||
  !["admin", "gerencia"].includes(perfil) ||
  !nome
) {
  console.error(
    'Uso: node scripts/usuario.mjs <usuario> <admin|gerencia> "<Nome>" [empresa_id]',
  );
  exit(1);
}

const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const gerar = () =>
  Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join(
      "",
    ),
  ).join("-");

const rl = createInterface({ input: stdin, output: stdout });
const digitada = (
  await rl.question("Senha (Enter para gerar uma forte automaticamente): ")
).trim();
rl.close();
if (digitada && digitada.length < 12) {
  console.error("Use pelo menos 12 caracteres.");
  exit(1);
}
const senha = digitada || gerar();

const N = 2 ** 17;
const salt = randomBytes(16);
const key = await new Promise((resolve, reject) =>
  scrypt(
    senha.normalize("NFKC"),
    salt,
    64,
    { N, r: 8, p: 1, maxmem: 128 * N * 8 * 2 },
    (e, k) => (e ? reject(e) : resolve(k)),
  ),
);
const hash = `scrypt$${N}$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
const q = (s) => `'${String(s).replaceAll("'", "''")}'`;

if (!digitada)
  console.log(`\nSenha gerada (anote agora, não aparece de novo): ${senha}`);
console.log(`
-- Cole no SQL Editor do Supabase:
insert into app.usuarios (empresa_id, usuario, nome, perfil, senha_hash)
values (${q(empresa)}, ${q(usuario)}, ${q(nome)}, ${q(perfil)}, ${q(hash)})
on conflict (usuario) do update set
  nome = excluded.nome, perfil = excluded.perfil, senha_hash = excluded.senha_hash,
  senha_alterada_em = now(), ativo = true;

-- Para bloquear o acesso depois: update app.usuarios set ativo = false where usuario = ${q(usuario)};
`);
