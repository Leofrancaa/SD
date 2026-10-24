// Formatação pt-BR compartilhada pelas telas.
export const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value,
  );

export const moneyShort = (value: number) =>
  Math.abs(value) >= 1000
    ? `R$ ${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
    : money(value);

export const integer = (value: number) =>
  Math.round(value).toLocaleString("pt-BR");

export const percent = (value: number, digits = 1) =>
  `${value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

export const signedPercent = (value: number, digits = 1) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${percent(Math.abs(value), digits)}`;

export const share = (part: number, total: number) =>
  total ? (part / total) * 100 : 0;

export const dateBr = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" }).format(
    new Date(`${date.slice(0, 10)}T12:00:00Z`),
  );

export const shortDate = (date: string) =>
  dateBr(date, { day: "2-digit", month: "2-digit" });

export function titleCase(text: string) {
  return text
    .toLocaleLowerCase("pt-BR")
    .replace(
      /(^|[\s/(-])(\p{L})/gu,
      (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase("pt-BR"),
    );
}
