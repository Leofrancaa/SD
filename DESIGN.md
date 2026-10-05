---
version: alpha
name: Superdeli
description: A bakery and minimarket management desk informed by Superdeli's orange and charcoal storefront.
colors:
  primary: "#BD480C"
  accent: "#EAAA35"
  ink: "#282925"
  muted: "#6D716B"
  background: "#F7F8F5"
  surface: "#FFFFFF"
  border: "#E5E7E0"
  success: "#426148"
  danger: "#AC3535"
typography:
  sans:
    fontFamily: "DM Sans, sans-serif"
  display:
    fontFamily: "Manrope, sans-serif"
rounded:
  DEFAULT: "0.75rem"
  sm: "0.5rem"
spacing:
  section-gap: "1.5rem"
  page-max: "90rem"
---

# Superdeli Design System

## Overview

Product register. A management desk for a bakery and minimarket owner checking production, sales and resale inventory between service periods. Retail inventory uses dated closing snapshots, separate from bakery production balances. The signature is a production balance strip: sold, remaining and discarded quantities share the same physical tray, showing where each batch went. A light workspace supports daytime use; a charcoal navigation rail recalls the storefront lettering. Use orange for actions, wheat yellow for pending attention and restrained green for positive operational states.

The user's supplied reference and a public storefront photograph ground the palette. This is a provisional interface identity, not an official logo. The type wordmark uses Manrope; body and controls use locally packaged DM Sans. Anti-references: decorative bakery illustrations, dark full-page dashboards, and speculative business claims.

## Runtime ownership

Model B: canonical CSS variables in src/app/globals.css map colors to --primary, --accent, --ink, --muted, --background, --surface, --border, --success, and --danger. DESIGN.md mirrors these values. Tailwind consumes the same tokens. Shared buttons, badges, fields, navigation and panels live in the application stylesheet. Fonts are self-hosted through @fontsource, avoiding runtime font requests.

## Layout and typography

236px desktop navigation, flexible main content capped at 1440px. Two-column overview with a wide revenue chart and a narrow recommendations list. At 1100px, stack analysis; at 760px, use a compact horizontally scrollable navigation. At 460px, stack header actions and two-column metrics. Tables have their own scroll container. Use tabular numerals, 14px table text, 16px body and 32px display headings.

## Shapes and depth

12px panel radius, 8px controls, 1px borders, no panel shadows. Small status badges may be pills. Section separators express hierarchy; avoid nesting decorated panels.

## Components and states

Orange primary buttons, bordered neutral buttons and quiet text links. Hover darkens primary, visible focus uses primary outline. Disabled controls reduce emphasis and retain labels. Selection is a pale orange fill plus visible text/icon. Forms use inline error messages, explicit labels and first-invalid-field focus. Native date/select controls intentionally accept OS-owned popups. Persistent status uses one live region. No modal is needed for routine recording.

Search is local, immediately responsive, with a clear button. Filters and section persist in URL state; draft entry fields remain transient. Empty states explain the next action. Local storage failure keeps the form values and reports recovery inline. Demo edits persist only in this browser; no shared cloud save is implied.

## Locale, icons, motion and charts

pt-BR and BRL; date-only values are interpreted without UTC shifting. Business timezone: America/Sao_Paulo. Lucide icons, 18–22px, 1.7px stroke, always decorative when paired with text. Color is never the only state signal. Revenue bars have a textual accessible summary; balances expose quantities. Motion is limited to 150ms hover/focus feedback and disabled by prefers-reduced-motion. Global scrollbar styles and scrollbar-gutter prevent layout shifts. Forced colors restore system scrollbar rendering.

## Do and do not

- Keep synthetic data and rule-based suggestion labels visible.
- Calculate discarded loss at cost and show stockouts beside waste.
- Require the owner's review before marking a recommendation approved.
- Do not imply approved suggestions have changed production automatically.
- Do not claim actual AI integration, actual revenue or financial improvement.
