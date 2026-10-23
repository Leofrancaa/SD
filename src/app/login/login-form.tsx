"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    null,
  );
  return (
    <form className="login-form" action={action}>
      <div className="field">
        <label htmlFor="username">Usuário</label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          placeholder="admin ou gerencia"
          required
          aria-invalid={state?.error ? true : undefined}
        />
      </div>
      <div className="field">
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state?.error ? true : undefined}
        />
      </div>
      {state?.error && (
        <p className="login-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="button primary" type="submit" disabled={pending}>
        <LogIn size={17} />
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
