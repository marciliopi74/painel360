---
name: SUS Brasil 360
colors:
  surface: '#f2fbff'
  surface-dim: '#c8dee7'
  surface-bright: '#f2fbff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#e4f7ff'
  surface-container: '#dcf1fb'
  surface-container-high: '#d6ecf5'
  surface-container-highest: '#d0e6ef'
  on-surface: '#091e25'
  on-surface-variant: '#3e494a'
  inverse-surface: '#1f333a'
  inverse-on-surface: '#def4fe'
  outline: '#6e797a'
  outline-variant: '#bdc9ca'
  surface-tint: '#006972'
  primary: '#00626a'
  on-primary: '#ffffff'
  primary-container: '#0e7c86'
  on-primary-container: '#ddfbff'
  inverse-primary: '#7cd4df'
  secondary: '#006d3b'
  on-secondary: '#ffffff'
  secondary-container: '#75fca7'
  on-secondary-container: '#00743f'
  tertiary: '#85480c'
  on-tertiary: '#ffffff'
  tertiary-container: '#a35f24'
  on-tertiary-container: '#fff2eb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#98f0fb'
  primary-fixed-dim: '#7cd4df'
  on-primary-fixed: '#001f23'
  on-primary-fixed-variant: '#004f56'
  secondary-fixed: '#75fca7'
  secondary-fixed-dim: '#57df8d'
  on-secondary-fixed: '#00210e'
  on-secondary-fixed-variant: '#00522b'
  tertiary-fixed: '#ffdcc4'
  tertiary-fixed-dim: '#ffb780'
  on-tertiary-fixed: '#2f1400'
  on-tertiary-fixed-variant: '#6f3800'
  background: '#f2fbff'
  on-background: '#091e25'
  surface-variant: '#d0e6ef'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system embodies a modern, clinical, yet approachable municipal public health interface. Tailored specifically for municipal health secretaries, epidemiologists, coordinators, and Community Health Agents (ACS), the experience conveys institutional reliability, utmost data precision, and operational calm under demanding public administration schedules.

The visual style unites **Clean Functionalism** with **Modern Data Ergonomics**:
- **Clarity over ornament:** Interfaces reduce cognitive strain, allowing fast triage of Previne Brasil indicator metas and e-SUS synchronizations.
- **Immediate scannability:** Visual cues (progress meters, micro-badges, and conditional states) communicate status without requiring tabular deciphering.
- **Accessible & Grounded:** Clean off-white canvases anchor high-contrast slate text and calm teal-petróleo accents, producing an institutional tool that feels robust, contemporary, and dependable.

## Colors

The palette balances public healthcare authority with precise clinical telemetry.

- **Primary (`#0E7C86` - Deep Teal):** Used for key navigational landmarks, prominent interactive actions, table headers, and primary indicator KPIs.
- **Secondary (`#2FBF71` - Clinical Green):** Signals goal achievement ("Ótimo", "Bom"), successful e-SUS sync batches, and positive performance trajectories.
- **Tertiary (`#F4A261` - Warm Amber):** Reserved for "Regular / Atenção" states, warning thresholds, and upcoming deadline warnings.
- **Neutral (`#1A2E35` - Deep Slate):** High-contrast, fatigue-reducing tone for body copy, data values, and structural framing.
- **Danger / Alert (`#E5533C` - Soft Red):** Strictly reserved for non-compliance, missing pregnant consultations, unlinked cadastros, and server sync failures.
- **Tonal Backdrops & Accents:** `#F7F9FA` forms the base desktop and mobile viewport canvas; `#FFFFFF` defines isolated cards; `#E8F4F5` supplies the tinted badge fill for primary indicators; `#EDF2F7` supplies subtle architectural dividers and borderlines.

## Typography

Inter serves as the universal typeface across all viewports and modules to maximize legibility on budget low-DPI municipal monitors as well as high-density mobile displays used in the field.

- **Scale Discipline:** Strict hierarchy where `headline-lg` (`24px/700`) anchors main dashboards, and `headline-sm` (`18px/600`) commands card headers and Previne Brasil metric panels.
- **Tabular Numerals:** For numeric progress, goal ratios (e.g., `452 / 600`), and dates, enable `font-variant-numeric: tabular-nums` to keep alignment stable across dynamic data refreshes.
- **Micro-labels (`11px - 12px`):** Used on status chips and target percentage labels with slight positive letter spacing to guarantee instant visual parsing under sunlight during field tasks.

## Layout & Spacing

The layout is built on a responsive 12-column fluid grid on desktop viewports (collapsing to a 4-column structure on mobile devices) bounded by a maximum shell of `1440px`.

- **Desktop Layout:** Features a persistent 260px collapsible sidebar for fast switching between e-SUS synchronization logs, Previne indicator scorecards, and UBS (Unidade Básica de Saúde) filters.
- **Mobile Layout (Field / ACS view):** Single-column stack with top-anchored app bar and bottom navigation for rapid one-handed thumb interaction.
- **Rhythm:** An 8pt spatial baseline strictly regulates internal padding. Dashboard cards apply `space-md` (`1rem`) on mobile and `space-lg` (`1.5rem`) on desktop to avoid claustrophobic data tables.

## Elevation & Depth

Visual hierarchy uses a hybrid of clean tonal division and soft, diffuse ambient shadows to maintain performance across low-spec on-premise hardware:

- **Level 0 (Canvas):** Pure `#F7F9FA` backdrop without blur.
- **Level 1 (Cards & Data Panels):** `#FFFFFF` surface bordered by a crisp `1px solid #EDF2F7`, lifted with an ambient shadow: `0 1px 3px rgba(26, 46, 53, 0.04), 0 1px 2px rgba(26, 46, 53, 0.02)`.
- **Level 2 (Dropdowns, Floating Filters, Sticky Headers):** Elevated with `0 4px 12px rgba(26, 46, 53, 0.08)`.
- **Level 3 (Modals, Inconsistency Drilldowns):** Overlay backdrop at `rgba(26, 46, 53, 0.4)` with container elevation `0 12px 32px rgba(26, 46, 53, 0.12)`.

## Shapes

The interface employs a balanced corner radius (Level 2) calibrated to instill a dependable, institutional software feel:

- **Cards & Data Modules:** `8px` (`0.5rem`) radius, matching standard dashboard patterns.
- **Form Controls & Inputs:** `8px` (`0.5rem`) radius for standard touch and click areas.
- **Progress Trackers:** Fully rounded pill radius (`9999px`) to visually distinguish telemetry from structural card boxes.
- **Status Badges:** Small `4px` to `6px` radius to maintain a neat, editorial appearance alongside tabular data.

## Components

### Buttons
- **Primary:** Solid `#0E7C86` with white text, minimum height 44px on mobile for touch compliance, 8px corner radius. Hover: `#0B656D`. Focus: 2px ring offset in `#0E7C86`.
- **Secondary / Outline:** 1px border `#0E7C86`, transparent surface, `#0E7C86` label.
- **Subtle / Ghost:** Padding only, slate text (`#1A2E35`), with `#E8F4F5` hover fill.

### Previne Brasil Progress Bars (Linear Telemetry)
- Horizontal continuous bars with a height of `8px` (compact) or `12px` (featured card).
- Track: `#EDF2F7`.
- Fill color dynamically mapped to achievement:
  - `< 50%`: `#E5533C` (Crítico / Alerta)
  - `50% - 69%`: `#F4A261` (Regular / Atenção)
  - `70% - 89%`: `#0E7C86` (Bom)
  - `≥ 90%`: `#2FBF71` (Ótimo / Meta Batida)

### Classification Badges (Chips)
- Compact `12px` font with `4px 8px` padding.
- **Ótimo / Bom:** Background `#EAF8F1`, text `#1E824C`, dot marker `#2FBF71`.
- **Regular / Atenção:** Background `#FEF6EE`, text `#B25E16`, dot marker `#F4A261`.
- **Inconsistente / Alerta:** Background `#FDF0ED`, text `#B8321D`, dot marker `#E5533C`.
- **Informativo / e-SUS:** Background `#E8F4F5`, text `#0E7C86`.

### Cards & KPI Tiles
- White canvas, `1px solid #EDF2F7`, `8px` border radius.
- Standard structure: Top row with Indicator Code (e.g., "IND 01 - Pré-Natal 6+ Consultas") and trailing badge; Middle row with oversized percentage KPI (`24px/700`); Bottom row with target benchmark comparison (e.g., "Meta: 60% • Atual: 68%").

### Form Inputs & Selects
- Height 40px (desktop) / 44px (mobile). Background `#FFFFFF`, border `1px solid #EDF2F7`.
- Active focus state: border `#0E7C86` with `0 0 0 3px rgba(14, 124, 134, 0.15)`.

### Tables & Micro-Lists
- Header row with `#F7F9FA` background and `#1A2E35` semibold `12px` uppercase labels.
- Alternating subtle hovers (`#F7F9FA`) and `1px solid #EDF2F7` dividing lines for quick horizontal scanning by health agents.