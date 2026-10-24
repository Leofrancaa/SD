"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BadgeDollarSign,
  ChevronRight,
  LogOut,
  MessageCircle,
  Sparkles,
  Wheat,
  type LucideIcon,
} from "lucide-react";
import { BakeryChat } from "./bakery-chat";
import { RealSales } from "./real-sales";
import { canAccess, roleLabels, type Role } from "@/lib/roles";
import { logout } from "@/app/login/actions";

type View = "vendas" | "chat";

const navigation: {
  id: View;
  title: string;
  heading: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: "vendas",
    title: "Vendas",
    heading: "As vendas da Superdeli, de verdade.",
    description:
      "Pedidos, faturamento e ticket médio direto do caixa (BMWeb), atualizados ao longo do dia.",
    icon: BadgeDollarSign,
  },
  {
    id: "chat",
    title: "Conversar com a Cifrai",
    heading: "Conversar com a Cifrai",
    description:
      "Pergunte sobre as vendas reais e entenda os números em linguagem simples.",
    icon: MessageCircle,
  },
];

export function Dashboard({
  role,
  userName,
}: {
  role: Role;
  userName?: string;
}) {
  const allowed = navigation.filter((item) => canAccess(role, item.id));
  const home = allowed[0].id;
  const [view, setView] = useState<View>(home);
  const [message, setMessage] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const current = navigation.find((item) => item.id === view)!;

  useEffect(() => {
    const restore = () => {
      const section = new URLSearchParams(window.location.search).get(
        "view",
      ) as View;
      setView(
        navigation.some((item) => item.id === section) &&
          canAccess(role, section)
          ? section
          : home,
      );
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [role, home]);

  useEffect(() => {
    document.title = `${current.title} · Superdeli`;
  }, [current.title]);

  function navigate(next: View) {
    if (!canAccess(role, next)) return;
    setView(next);
    setMessage("");
    const params = new URLSearchParams(window.location.search);
    params.set("view", next);
    window.history.pushState({}, "", `?${params}`);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Ir para o conteúdo
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Superdeli, início">
          <span className="brand-symbol">
            <Wheat size={27} />
          </span>
          <span>
            superdeli<span className="brand-description">DELICATESSEN</span>
          </span>
        </Link>
        <div className="workspace">
          <span className="workspace-icon">S</span>
          <div>
            <strong>Superdeli</strong>
            <span>Conceição do Jacuípe, BA</span>
          </div>
        </div>
        <span className="nav-label">PADARIA E MINIMERCADO</span>
        <nav aria-label="Menu principal">
          {allowed.map(({ id, title, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "active" : ""}`}
              aria-current={view === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{title}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="powered">
            <span className="eia-logo">
              Cifr<span className="eia-logo-accent">ai</span>
              <Sparkles size={16} />
            </span>
            <span>
              Dados que ajudam
              <br />a decidir melhor.
            </span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Superdeli <ChevronRight size={14} />
            <span>{current.title}</span>
          </div>
          <div className="topbar-right">
            <span className="demo-badge real-badge">
              <span />
              Dados reais · BMWeb
            </span>
            <span className="role-badge">
              {userName && userName !== roleLabels[role]
                ? `${userName} · ${roleLabels[role]}`
                : roleLabels[role]}
            </span>
            <form action={logout}>
              <button className="button secondary logout-button" type="submit">
                <LogOut size={15} />
                Sair
              </button>
            </form>
          </div>
        </header>
        <main id="main" className="page-content">
          <div className="page-heading">
            <div>
              <h1 ref={headingRef} tabIndex={-1}>
                {current.heading}
              </h1>
              <p>{current.description}</p>
            </div>
          </div>
          <div
            className={`status-banner ${message ? "visible" : ""}`}
            role="status"
            aria-live="polite"
          >
            {message}
          </div>

          {view === "vendas" && <RealSales onMessage={setMessage} />}

          {canAccess(role, "chat") && (
            <div hidden={view !== "chat"}>
              <BakeryChat active={view === "chat"} />
            </div>
          )}

          <footer className="page-footer">
            <span>
              Superdeli <span className="footer-dot">·</span> Feito para a
              rotina da padaria e do minimercado.
            </span>
            <span>Cifrai · vendas reais importadas do BMWeb</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
