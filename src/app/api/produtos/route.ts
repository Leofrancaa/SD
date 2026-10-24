import { failure, guard, json, parseRange } from "@/lib/api-route";
import { painelProdutos } from "@/lib/vendas-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const check = guard(request, "produtos");
  if ("response" in check) return check.response;
  const range = parseRange(new URL(request.url).searchParams);
  if (!range) return json({ error: "Período ou filtro inválido." }, 400);
  try {
    return json(await painelProdutos(range.ini, range.fim, range.situacao));
  } catch (error) {
    return failure(error, "api/produtos");
  }
}
