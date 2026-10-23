// Perfis de acesso. Sem segredos: este arquivo também roda no navegador.
export type Role = "admin" | "gerencia";

export const roles: readonly Role[] = ["admin", "gerencia"];

export const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  gerencia: "Gerência",
};

// null = acesso total. Gerência enxerga apenas o estoque.
const allowedViews: Record<Role, readonly string[] | null> = {
  admin: null,
  gerencia: ["inventory"],
};

export function canAccess(role: Role, view: string) {
  const views = allowedViews[role];
  return views === null || views.includes(view);
}

export function isRole(value: unknown): value is Role {
  return roles.includes(value as Role);
}
