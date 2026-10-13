"use client";

import { useState } from "react";
import {
  Check,
  Copy,
  Mail,
  MessageCircle,
  RotateCcw,
  Send,
} from "lucide-react";
import type { Product } from "@/lib/demo";
import { groupBySupplier, supplierMessage } from "@/lib/operations";

type Item = { product: Product; quantity: number };

/**
 * Gera mensagens de pedido por fornecedor, prontas para o dono revisar e
 * enviar. Nada é enviado pelo sistema: os botões só abrem o app escolhido
 * com o texto preenchido ou copiam o texto.
 */
export function SupplierMessages({
  items,
  onNotice,
}: {
  items: Item[];
  onNotice: (message: string) => void;
}) {
  const [delivery, setDelivery] = useState("");
  // Edição manual vale enquanto o texto gerado não mudar (mesmos itens e entrega).
  const [edits, setEdits] = useState<
    Record<string, { base: string; text: string }>
  >({});
  const [copied, setCopied] = useState("");
  const groups = groupBySupplier(items);

  async function copy(supplier: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(supplier);
      onNotice(
        `Mensagem para ${supplier} copiada. Cole no WhatsApp ou e-mail.`,
      );
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      onNotice(
        "Não foi possível copiar automaticamente. Selecione o texto e copie manualmente.",
      );
    }
  }

  if (!groups.length) return null;
  return (
    <section
      className="supplier-messages"
      aria-labelledby="supplier-messages-title"
    >
      <div className="supplier-heading">
        <div>
          <span className="small-label">PEDIDO PRONTO PARA ENVIAR</span>
          <h3 id="supplier-messages-title">
            <Send size={18} aria-hidden="true" />
            Mensagens para os fornecedores
          </h3>
          <p>
            Uma mensagem por fornecedor com os itens selecionados acima. Revise,
            ajuste se quiser e envie pelo canal que você já usa.
          </p>
        </div>
        <div className="field supplier-delivery">
          <label htmlFor="supplier-delivery">
            Entrega desejada <span>Opcional</span>
          </label>
          <input
            id="supplier-delivery"
            type="text"
            maxLength={80}
            placeholder="Ex.: quinta-feira, até as 7h"
            value={delivery}
            onChange={(event) => setDelivery(event.target.value)}
          />
        </div>
      </div>
      <div className="supplier-grid">
        {groups.map(({ supplier, items: list }) => {
          const generated = supplierMessage({
            supplier,
            delivery,
            items: list.map((item) => ({
              name: item.product.name,
              quantity: item.quantity,
              unit: item.product.unit,
            })),
          });
          const edit = edits[supplier];
          const edited = edit?.base === generated && edit.text !== generated;
          const text = edit?.base === generated ? edit.text : generated;
          const id = `supplier-${supplier.replace(/\W+/g, "-").toLowerCase()}`;
          return (
            <article className="supplier-card" key={supplier}>
              <header>
                <div>
                  <strong>{supplier}</strong>
                  <span>
                    {list.length} {list.length === 1 ? "item" : "itens"}
                    {edited && " · editada"}
                  </span>
                </div>
                {edited && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setEdits((current) => {
                        const next = { ...current };
                        delete next[supplier];
                        return next;
                      })
                    }
                  >
                    <RotateCcw size={14} />
                    Restaurar
                  </button>
                )}
              </header>
              <label className="sr-only" htmlFor={id}>
                Mensagem para {supplier}
              </label>
              <textarea
                id={id}
                rows={Math.min(14, text.split("\n").length + 1)}
                value={text}
                onChange={(event) =>
                  setEdits((current) => ({
                    ...current,
                    [supplier]: { base: generated, text: event.target.value },
                  }))
                }
              />
              <div className="supplier-actions">
                <button
                  type="button"
                  className="button primary"
                  onClick={() => copy(supplier, text)}
                >
                  {copied === supplier ? (
                    <Check size={16} />
                  ) : (
                    <Copy size={16} />
                  )}
                  {copied === supplier ? "Copiada" : "Copiar"}
                </button>
                <a
                  className="button secondary"
                  href={`https://wa.me/?text=${encodeURIComponent(text)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle size={16} />
                  WhatsApp
                </a>
                <a
                  className="button secondary"
                  href={`mailto:?subject=${encodeURIComponent(`Pedido Superdeli · ${supplier}`)}&body=${encodeURIComponent(text)}`}
                >
                  <Mail size={16} />
                  E-mail
                </a>
              </div>
            </article>
          );
        })}
      </div>
      <p className="purchase-note">
        Os botões só abrem o WhatsApp ou o e-mail com o texto preenchido: você
        escolhe o contato e envia. Nenhuma mensagem sai sem a sua confirmação.
        Fornecedores e contatos desta demonstração são fictícios.
      </p>
    </section>
  );
}
