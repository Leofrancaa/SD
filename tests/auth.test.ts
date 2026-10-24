import assert from "node:assert/strict";
import { test } from "node:test";
import { checkCredentials, createToken, verifyToken } from "../src/lib/auth";
import { canAccess } from "../src/lib/roles";

test("credenciais válidas retornam o perfil; inválidas, null", () => {
  assert.equal(checkCredentials("admin", "admin"), "admin");
  assert.equal(checkCredentials(" Gerencia ", "gerencia"), "gerencia");
  assert.equal(checkCredentials("admin", "gerencia"), null);
  assert.equal(checkCredentials("root", "admin"), null);
});

test("token assinado é aceito e expira", () => {
  const now = Date.now();
  const token = createToken("gerencia", now);
  assert.equal(verifyToken(token, now)?.role, "gerencia");
  assert.equal(verifyToken(token, now + 9 * 3600 * 1000), null);
});

test("token adulterado é rejeitado", () => {
  const [, signature] = createToken("gerencia").split(".");
  const forged = Buffer.from(
    JSON.stringify({ role: "admin", exp: 9_999_999_999 }),
  ).toString("base64url");
  assert.equal(verifyToken(`${forged}.${signature}`), null);
  assert.equal(verifyToken("lixo"), null);
  assert.equal(verifyToken(undefined), null);
});

test("gerência vê só as vendas; admin acessa também o chat", () => {
  assert.equal(canAccess("gerencia", "vendas"), true);
  assert.equal(canAccess("gerencia", "chat"), false);
  for (const view of ["vendas", "chat"])
    assert.equal(canAccess("admin", view), true);
});
