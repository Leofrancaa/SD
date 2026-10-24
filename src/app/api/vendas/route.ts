import { sessionFromRequest } from "@/lib/auth";
import { canAccess } from "@/lib/roles";
import { daysBetween, isIsoDate, isSituacao } from "@/lib/vendas";
import { painelVendas, VendasNaoConfiguradas } from "@/lib/vendas-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_DIAS = 800; // mesmo limite da função no banco
const noStore = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const session = sessionFromRequest(request);
  if (!session)
    return Response.json(
      { error: "Sessão expirada. Entre novamente." },
      { status: 401, headers: noStore },
    );
  if (!canAccess(session.role, "vendas"))
    return Response.json(
      { error: "Seu perfil não tem acesso às vendas." },
      { status: 403, headers: noStore },
    );

  const params = new URL(request.url).searchParams;
  const ini = params.get("ini");
  const fim = params.get("fim");
  const situacao = params.get("situacao") ?? "todas";
  if (
    !isIsoDate(ini) ||
    !isIsoDate(fim) ||
    fim < ini ||
    daysBetween(ini, fim) > MAX_DIAS ||
    !isSituacao(situacao)
  )
    return Response.json(
      { error: "Período ou filtro inválido." },
      { status: 400, headers: noStore },
    );

  try {
    const data = await painelVendas(ini, fim, situacao);
    return Response.json(data, { headers: noStore });
  } catch (error) {
    if (error instanceof VendasNaoConfiguradas)
      return Response.json(
        {
          error:
            "A conexão com o banco de vendas ainda não foi configurada no servidor.",
          code: "not_configured",
        },
        { status: 503, headers: noStore },
      );
    console.error("api/vendas", error);
    return Response.json(
      { error: "Não foi possível carregar as vendas agora. Tente de novo." },
      { status: 502, headers: noStore },
    );
  }
}
