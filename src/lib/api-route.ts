// Utilitários das rotas de dados: sessão, perfil e validação do período.
import { sessionFromRequest, type Session } from "@/lib/auth";
import { canAccess } from "@/lib/roles";
import {
  daysBetween,
  isIsoDate,
  isSituacao,
  type Situacao,
} from "@/lib/vendas";
import { VendasNaoConfiguradas } from "@/lib/vendas-server";

export const MAX_DIAS = 800; // mesmo limite das funções no banco
export const noStore = { "Cache-Control": "private, no-store" };

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: noStore });
}

/** Devolve a sessão ou uma resposta de erro pronta (401/403). */
export function guard(
  request: Request,
  view: string,
): { session: Session } | { response: Response } {
  const session = sessionFromRequest(request);
  if (!session)
    return {
      response: json({ error: "Sessão expirada. Entre novamente." }, 401),
    };
  if (!canAccess(session.role, view))
    return { response: json({ error: "Seu perfil não tem acesso." }, 403) };
  return { session };
}

export function parseRange(
  params: URLSearchParams,
): { ini: string; fim: string; situacao: Situacao } | null {
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
    return null;
  return { ini, fim, situacao };
}

export function failure(error: unknown, where: string) {
  if (error instanceof VendasNaoConfiguradas)
    return json(
      {
        error:
          "A conexão com o banco de vendas ainda não foi configurada no servidor.",
        code: "not_configured",
      },
      503,
    );
  console.error(where, error);
  return json(
    { error: "Não foi possível carregar os dados agora. Tente de novo." },
    502,
  );
}
