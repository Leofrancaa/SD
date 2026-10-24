import { failure, guard, json, parseRange } from "@/lib/api-route";
import { produtoDetalhe } from "@/lib/vendas-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const check = guard(request, "produtos");
  if ("response" in check) return check.response;
  const { codigo } = await params;
  const range = parseRange(new URL(request.url).searchParams);
  if (!range || !/^\d{1,14}$/.test(codigo))
    return json({ error: "Produto, período ou filtro inválido." }, 400);
  try {
    return json(
      await produtoDetalhe(codigo, range.ini, range.fim, range.situacao),
    );
  } catch (error) {
    return failure(error, "api/produtos/[codigo]");
  }
}
