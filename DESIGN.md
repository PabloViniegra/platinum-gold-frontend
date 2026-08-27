---
version: alpha
name: Platinum Gold
description: Docs site for the Platinum Gold API. Basement palette, Upheaval for the brand shout, Source Sans 3 for headings and reading.
colors:
  surface: "oklch(0.19 0.022 68)"
  surface-raised: "oklch(0.24 0.024 68)"
  on-surface: "oklch(0.93 0.018 78)"
  on-surface-muted: "oklch(0.78 0.02 70)"
  border: "oklch(0.35 0.03 68)"
  primary: "oklch(0.82 0.11 222)"
  primary-hover: "oklch(0.88 0.11 222)"
  on-primary: "oklch(0.16 0.03 222)"
  tertiary: "oklch(0.78 0.12 85)"
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

The game is the signature, not the interface: Upheaval owns the `/` brand shout, while Source Sans 3 handles docs headings and reading. The dirt-and-tears palette and quality 0 to 4 marks carry the rest of the world. On `/` only, `public/tboi-wall.webp` is the first-viewport field. Everything else is a contemporary docs site. No heart HUD, no dirt textures, no extra collage.

## Colors

`surface` is the page. `surface-raised` is cards, code, and inputs. `on-surface` is body text. `on-surface-muted` is captions and helper text, never body copy.

`primary` is tear blue. It is the only interactive hue: links, the one filled button on a view, and the focus ring. Do not use it on non-interactive headings or decoration. `primary-hover` is that same hue, lighter. `on-primary` is the ink on filled tear surfaces.

`tertiary` is pedestal gold. Use it for quality 4 and for rare static emphasis. It is not a second action color.

`error` is dried blood. Errors and destructive actions only.

`quality-0` through `quality-4` map to the API quality field. Use them as marks, stars, or borders. Do not set small text in a quality color.

`border` is the default hairline. Do not invent extra greys.

## Themes

Default appearance is dark. The document ships `color-scheme: dark`. Light values below are documentation until the spec can encode modes.

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

Upheaval is display only and belongs to the `/` brand shout. Never set it below 32px. Never use it for body, docs headings, UI chrome, buttons, or inputs. Disable fake bold and italic on it (`font-synthesis: none`). The shout stays roman.

On `/` only, the hero shout is fluid: `clamp(2rem, 8vw, 5.5rem)` at display line-height `1.05`. Docs route titles use `title` (48px) and `headline-lg` (32px), both Source Sans 3 semibold.

Source Sans 3 is every repetitive surface plus functional headings: body, navigation, buttons, labels, tables, docs titles, and section headings. Italic is allowed only inside body paragraphs.

`label-md` is uppercase via CSS, never by typing caps into copy. Apply `tabular-nums` to `gameId`, quality, `rechargeTime`, `limit`, and `offset`. Cap prose at about 65 characters. `text-wrap: balance` on titles, `pretty` on short descriptions.

## Layout

4px base. Page margin is `{spacing.margin}`, gutters are `{spacing.gutter}`. Prose sits in a single column near 65ch. Endpoint tables and the playground may use the full content width.

Group related controls with `{spacing.md}` inside and `{spacing.lg}` between groups. Do not add a marketing hero on docs routes. `/` is the exception: a full-viewport mural, then the first-call strip.

## Elevation & Depth

No ambient shadows. Stack `surface` under `surface-raised`, then a 1px `{colors.border}` hairline. Overlays use a dimming scrim, not a large drop shadow.

## Shapes

Controls use `{rounded.sm}`. Code blocks and raised panels use `{rounded.md}`. Tables and rules stay `{rounded.none}`. No pills, no 16px cards.

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
- Don't add pixel backgrounds, splatter, or HUD chrome. `/` may use `tboi-wall.webp` as the first-viewport field; that asset does not travel.
- Don't mix pill radii with the 2px/4px scale.
- Do meet WCAG AA on every text pair against its actual background.
