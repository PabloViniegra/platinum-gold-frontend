---
version: alpha
name: Platinum Gold
description: An API field guide found in Isaac's basement. Dark room chrome, aged paper reading surfaces, Upheaval display type, and Source Sans 3 technical copy.
colors:
  surface: "oklch(0.145 0.025 52)"
  surface-raised: "oklch(0.205 0.03 52)"
  on-surface: "oklch(0.93 0.025 78)"
  on-surface-muted: "oklch(0.75 0.035 72)"
  border: "oklch(0.34 0.045 55)"
  primary: "oklch(0.83 0.12 82)"
  primary-hover: "oklch(0.91 0.105 88)"
  on-primary: "oklch(0.16 0.035 50)"
  tertiary: "oklch(0.68 0.15 30)"
  paper: "oklch(0.86 0.055 82)"
  paper-raised: "oklch(0.91 0.045 88)"
  paper-border: "oklch(0.55 0.075 67)"
  ink: "oklch(0.22 0.045 52)"
  ink-muted: "oklch(0.4 0.045 55)"
  error: "oklch(0.65 0.17 28)"
  on-error: "oklch(0.98 0.01 28)"
  quality-0: "oklch(0.58 0.01 70)"
  quality-1: "oklch(0.9 0.01 80)"
  quality-2: "oklch(0.84 0.14 95)"
  quality-3: "oklch(0.8 0.14 80)"
  quality-4: "oklch(0.72 0.16 55)"
typography:
  title:
    fontFamily: Source Sans 3
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.02em
  display:
    fontFamily: Upheaval
    fontSize: 48px
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: 0.02em
  headline-lg:
    fontFamily: Source Sans 3
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Source Sans 3
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Source Sans 3
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.7
  body-md:
    fontFamily: Source Sans 3
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.65
  body-sm:
    fontFamily: Source Sans 3
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: Source Sans 3
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0.06em
  code:
    fontFamily: ui-monospace
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
rounded:
  none: 0px
  sm: 2px
  md: 4px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  gutter: 24px
  margin: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: 12px
    typography: "{typography.body-md}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: 12px
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: 12px
    typography: "{typography.body-md}"
  input:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: 12px
    typography: "{typography.body-md}"
  code-block:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 16px
    typography: "{typography.code}"
---

## Overview

Platinum Gold is documentation for frontend developers integrating a read-only Binding of Isaac item API. It is not a player catalog.

The interface lives inside the game world. Dark room chrome frames an aged field guide; the mural, paper, map-like navigation, hard shadows, and hand-made display type make the documentation feel found in Isaac's basement. Source Sans 3 protects technical readability. The experience may be theatrical around the document, never inside code or dense reference data.

## Colors

`surface` is the page. `surface-raised` is cards, code, and inputs. `on-surface` is body text. `on-surface-muted` is captions and helper text, never body copy.

`primary` is candle gold. It is the interactive hue on dark surfaces and the focus ring. `primary-hover` is the lit state. Links on paper use dark oxblood ink so they retain contrast against the warm sheet.

`tertiary` is dried blood. Use it for active map marks and rare static emphasis. It is not a second action color.

`paper`, `paper-raised`, `paper-border`, `ink`, and `ink-muted` form the reading surface. Long technical content belongs on paper; global chrome and code remain in the room palette.

`error` is dried blood. Errors and destructive actions only.

`quality-0` through `quality-4` map to the API quality field. Use them as marks, stars, or borders. Do not set small text in a quality color.

`border` is the default hairline. Do not invent extra greys.

## Themes

Default appearance is dark. The document ships `color-scheme: dark`; paper is a local light surface inside that dark environment.

| Token | Dark (default) | Light |
| --- | --- | --- |
| surface | oklch(0.19 0.022 68) | oklch(0.91 0.028 75) |
| surface-raised | oklch(0.24 0.024 68) | oklch(0.96 0.016 75) |
| on-surface | oklch(0.93 0.018 78) | oklch(0.22 0.03 65) |
| on-surface-muted | oklch(0.78 0.02 70) | oklch(0.42 0.03 65) |
| border | oklch(0.35 0.03 68) | oklch(0.8 0.03 75) |
| primary | oklch(0.82 0.11 222) | oklch(0.45 0.12 222) |
| primary-hover | oklch(0.88 0.11 222) | oklch(0.38 0.12 222) |
| on-primary | oklch(0.16 0.03 222) | oklch(0.98 0.01 222) |
| tertiary | oklch(0.78 0.12 85) | oklch(0.52 0.12 85) |
| error | oklch(0.65 0.17 28) | oklch(0.5 0.17 28) |
| on-error | oklch(0.98 0.01 28) | oklch(0.98 0.01 28) |
| quality-0 | oklch(0.58 0.01 70) | oklch(0.45 0.01 70) |
| quality-1 | oklch(0.9 0.01 80) | oklch(0.35 0.01 70) |
| quality-2 | oklch(0.84 0.14 95) | oklch(0.55 0.14 95) |
| quality-3 | oklch(0.8 0.14 80) | oklch(0.52 0.14 80) |
| quality-4 | oklch(0.72 0.16 55) | oklch(0.5 0.16 55) |

## Typography

Two webfonts. Bind `public/fonts/upheavtt.ttf` to family `Upheaval` and serve it as woff2. Load Source Sans 3 at 400 and 600 only. Code uses `ui-monospace`. Do not load a third webfont.

Upheaval is display only. It owns the brand, page title, major guide chapters, and short game-like labels. Never set it below 24px or use it for body copy, tables, code, buttons, or inputs. Disable fake bold and italic on it (`font-synthesis: none`).

On `/` only, the hero shout is fluid: `clamp(2rem, 8vw, 5.5rem)` at display line-height `1.05`. Docs route titles use `title` (48px) and `headline-lg` (32px), both Source Sans 3 semibold.

Source Sans 3 is every repetitive and technical surface: body, navigation, buttons, labels, tables, subheadings, and code captions. Italic is allowed only inside body paragraphs.

`label-md` is uppercase via CSS, never by typing caps into copy. Apply `tabular-nums` to `gameId`, quality, `rechargeTime`, `limit`, and `offset`. Cap prose at about 65 characters. `text-wrap: balance` on titles, `pretty` on short descriptions.

## Layout

4px base. The guide uses a map rail plus a paper sheet. Prose stays near 68ch, while endpoint tables and code may use the full sheet width.

Group related controls with `{spacing.md}` inside and `{spacing.lg}` between groups. `/` is a title-screen threshold; docs routes open into the field guide without a marketing hero.

## Elevation & Depth

Depth is physical rather than ambient. Paper casts a short, hard shadow onto the room. Raised dark controls use borders, not floating glass shadows. Avoid generic blurred card elevation.

## Shapes

Controls use `{rounded.sm}`. Code blocks and raised panels use `{rounded.md}`. Paper, tables, map rooms, and rules stay close to square. No pills and no soft SaaS cards.

## Components

One filled primary button per view. Peer actions use `button-secondary` (transparent, hairline border, `on-surface` text). Primary hover is `{colors.primary-hover}`. Focus-visible is a 2px `{colors.primary}` ring with 2px offset.

Inputs keep 16px text on every viewport. Placeholder and helper text use `{colors.on-surface-muted}`. Error text and error borders use `{colors.error}`.

Code blocks use `code-block`. Inline code uses `{typography.code}` on `{colors.surface-raised}` without looking like a button.

## Do's and Don'ts

- Do keep tear blue on interactive elements only.
- Do convert Upheaval to woff2 before shipping.
- Don't set Upheaval below 32px or on body copy.
- Don't load a third webfont.
- Don't use blood red except for errors and destructive actions.
- Don't use quality colors as small text.
- Do let `tboi-wall.webp` establish the world on `/` and appear as a heavily obscured environmental layer on guide routes.
- Do use paper grain, room seams, hard shadows, and map geometry when they clarify hierarchy.
- Don't add a decorative HUD, fake health counters, or game controls that imply unavailable functionality.
- Don't mix pill radii with the 2px/4px scale.
- Do meet WCAG AA on every text pair against its actual background.
