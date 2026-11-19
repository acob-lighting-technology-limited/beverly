---
name: Beverly PUE
description: Glass for what floats, solid for what you read, in the Beverly Call yellow palette, with flat black and white options. One accent for battery swap and appliance sales operations.
colors:
  beverly-yellow: "#fcd95c"
  flat fill-yellow-top: "#ffe88a"
  flat fill-yellow-deep: "#e6b933"
  field-cream: "#fff3c4"
  field-butter: "#fbe79b"
  field-pearl: "#f4f4f0"
  field-peach: "#f4b8a8"
  field-dark-top: "#262319"
  field-dark-mid: "#181711"
  field-dark-deep: "#101115"
  ink: "#1f1f22"
  ground-white: "#ffffff"
  ground-black: "#000000"
  surface-cream: "#fffdf6"
  surface-smoke: "#1d1b16"
  surface-mono-light: "#f6f6f7"
  surface-mono-dark: "#101012"
  surface-green-light: "#f3faf4"
  surface-green-dark: "#0a140d"
  pearl-white: "#fafafa"
  pure-white: "#ffffff"
  mono-dark-ink: "#09090a"
  wallet-green: "#138a2f"
  wallet-green-mist: "#dff2e4"
  wallet-forest-top: "#0a2a14"
  wallet-forest-mid: "#06190d"
  wallet-forest-deep: "#04120a"
  ink-dark-mode: "#f3f1e8"
  amber-text: "#6b5000"
  ok-green: "#2fbf71"
  danger-red: "#c62828"
  danger-red-dark-mode: "#ff8a80"
typography:
  display:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: "clamp(30px, 4.2vw, 44px)"
    fontWeight: 750
    lineHeight: 1.04
    letterSpacing: "-0.035em"
  body:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 750
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body-sm:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
  body-lg:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  headline:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 750
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  display-xl:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: "clamp(44px, 7vw, 76px)"
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "-0.045em"
  stat:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: "clamp(34px, 4.4vw, 52px)"
    fontWeight: 750
    lineHeight: 1.05
    letterSpacing: "-0.045em"
  tile-title:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: "clamp(28px, 3.4vw, 38px)"
    fontWeight: 750
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  code-display:
    fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Consolas, monospace"
    fontSize: "42px"
    fontWeight: 700
    letterSpacing: "0.18em"
  label:
    fontFamily: "ui-sans-serif, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    letterSpacing: "0.06em"
  code:
    fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Consolas, monospace"
    fontSize: "12px"
rounded:
  sm: "12px"
  md: "18px"
  lg: "26px"
  xl: "34px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "18px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.beverly-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
    height: "44px"
  button-glass:
    backgroundColor: "rgba(255,255,255,0.52)"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
    height: "44px"
  input-glass:
    backgroundColor: "rgba(255,255,255,0.40)"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "12px 18px"
    height: "46px"
  panel-glass:
    backgroundColor: "rgba(255,255,255,0.52)"
    rounded: "{rounded.lg}"
    padding: "28px"
  rail-bead-active:
    backgroundColor: "{colors.beverly-yellow}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    size: "48px"
---

# Design System: Beverly PUE

## Overview

**Creative North Star: "The Charged Pane"**

Two materials, each with one job. Glass is for what floats above the page: the rail, the section tabs, the account chip and menu, dialogs, tooltips and the sign-in card. Solid is for what you read and fill in: boards, panels, tables, cards, inputs and buttons, so figures and forms never compete with the field behind them.

The palette is the Beverly Call one: pearl and cream grounds, a single yellow for every action, and dark ink for text. The product is an operations tool, so the glass serves scanning first: text sits on enough fill to stay readable, status uses small lit dots, and numbers stay tabular.

**Key Characteristics:**
- One accent, Beverly yellow, as a flat fill; everything else is cream, pearl, glass and ink.
- Light is frosted white glass over cream; dark is smoked glass over near-black.
- Pills for every control; large radii for every surface.
- Dark ink on yellow, never white.
- Unknown data shows a dash, never a made-up number.

## Colors

A warm, near-monochrome palette with one job per tone: the field is the world, the yellow is the action, the glass is the surface.

### Primary
- **Beverly Yellow** (#fcd95c): the primary action, the active rail bead, the active tab lens, the avatar, the stock bar. Always a flat fill with no gradient or gloss, and always carrying dark ink.

### Neutral
- **Field** (light: pearl #f4f4f0 to cream #fff3c4 to butter #fbe79b, with a peach light #f4b8a8; dark: #262319 to #101115): the page ground, with three blurred lights moving over it.
- **Ink** (#1f1f22 light, #f3f1e8 dark): all text. Secondary text is the same ink at 74% so it stays tinted by the surface.
- **Amber Text** (#6b5000 light, #f2d36b dark): links and inline emphasis, where yellow itself would be too pale to read.

### Semantic
- **OK Green** (#2fbf71): the lit dot on healthy states only.
- **Danger Red** (#c62828 light, #ff8a80 dark): faults and errors.

### Named Rules
**The One Accent Rule.** Yellow is the only accent. Green and red appear only as state dots and messages.
**The Dark Ink On Yellow Rule.** Text on yellow is #1f1f22. White on yellow fails contrast.
**The Unknown Is A Dash Rule.** A reading the platform did not send is shown as a dash, never as zero.

### Palettes

The system ships three palettes, each in light and dark, chosen in Settings from the account menu. Every screen follows because components read tokens, never colours.

- **Beverly yellow** (the default, described above): cream field, yellow flat fill, dark ink.
- **Black and white**: a flat white ground (#ffffff) with black flat buttons and white text in light; a flat black ground (#000000) with white flat buttons and black text (#09090a) in dark. No hue at all; state red, gold and green still mark state.
- **White and green** (the Beverly wallet portal): a flat white ground and wallet-green flat fill (#138a2f) carrying white text in light; a flat black ground with a bright green flat fill carrying dark ink in dark.

**The Palette Rule.** A palette changes the accent family, the ground and the ink tint, and nothing else. Layout, shape and type are identical in all three.
**The Flat Ground Rule.** Black and white, and White and green, have no gradient and no moving lights: white in light, black in dark. Only Beverly yellow has the warm field.

## Typography

**Display and Body Font:** the platform's own UI face (SF Pro on Apple devices, Segoe UI Variable on Windows), with system fallbacks.
**Mono Font:** JetBrains Mono for codes and raw data only.

**Character:** the device's native voice, tightened at large sizes, so the app feels at home on whatever it runs on.

### Hierarchy
- **Display** (750, clamp(30px, 4.2vw, 44px), 1.04, -0.035em): page titles.
- **Display XL** (750, clamp(44px, 7vw, 76px), 1, -0.045em): the hub title only.
- **Tile Title** (750, clamp(28px, 3.4vw, 38px)): the two hub workspace tiles.
- **Stat** (750, clamp(34px, 4.4vw, 52px)): the one lead figure on a board.
- **Code Display** (mono 700, 42px, +0.18em): the pickup code on a swap.
- **Headline** (750, 26px, -0.03em): dialog titles, detail titles, readouts. 
- **Title** (750, 20px, -0.025em): panel titles and the brand name.
- **Body Large** (400, 15px): blurbs and sign-in copy.
- **Body Small** (600, 13px): tabs, helper text, counts.
- **Body** (400, 14px, 1.5): tables, forms, notes. Blurbs stay under 62ch.
- **Label** (700, 12px, +0.06em, uppercase): table headers only. No text is smaller than 12px.

### Named Rules
**The Tabular Rule.** Every number in a table or readout uses tabular figures so columns stay aligned.

## Layout

A floating glass rail on the left (68px) holds the sections; on phones it becomes a glass bar at the bottom. A slim top bar carries the brand, where you are, and the account menu. Under it, a glass capsule of section tabs appears when a section has more than one screen. Content is left-aligned with the header edge, never centred, with a 1280px ceiling. Spacing steps are 8, 12, 18, 24 and 40px.

## Elevation & Depth

Depth is optical, not stacked. Glass surfaces (floating chrome only) have a translucent fill, a backdrop blur (30px, saturated), a bright top rim, a soft inner edge, and a long soft shadow with an offset. Floating menus and dialogs use a more opaque fill so text never competes with what is behind them.

### Shadow Vocabulary
- **Panel** (`0 28px 60px -26px rgba(110,78,0,.34), 0 3px 10px rgba(110,78,0,.07)`): every glass surface.

### Named Rules
**The Rim Rule.** Every glass edge carries a bright 1px top highlight. Without it the surface is just a blurred box.

## Shapes

Round, always. Controls are full pills (999px). Panels use 26px corners; dialogs, the sign-in card and the hub tiles use 34px. Nothing has a hard corner and nothing is clipped into a shape.

## Components

### Buttons
- **Shape:** full pill (999px), 44px tall.
- **Primary:** flat yellow with dark ink, no gradient and no gloss; lifts 1px on hover, presses to 98%.
- **Secondary:** a flat outlined pill on the surface colour.

### Inputs / Fields
- **Style:** inset glass: a well cut into the surface, with an inner top shadow.
- **Focus:** a dark ink ring in light theme, a yellow ring in dark.

### Navigation
- **Rail:** round 48px beads; the active one is a flat yellow disc. Hover scales to 110% and shows its name in a glass label to the right.
- **Section tabs:** a glass capsule with a yellow lens that slides to the active tab.
- **Mobile:** the rail becomes a glass bar with labels at the bottom.

### Status capsules
A small glass pill with a lit dot: green for healthy states, red for faults.

### Account menu
The shared Beverly menu: profile, theme, the other portals (Wallet Admin, Vendor, Customer, Wallet landing), back to CRM for operations roles, sign out.

## Do's and Don'ts

### Do:
- **Do** use glass only for what floats (rail, tabs, menus, dialogs, tooltips, sign-in card) and solid surfaces for everything you read or fill in.
- **Do** keep text on at least 4.5:1 contrast over the fill, and raise the fill where a surface floats over busy content.
- **Do** put dark ink on yellow.
- **Do** show a dash for unknown data.
- **Do** keep motion to the tab lens and the field's slow drift, both off under reduced motion.

### Don't:
- **Don't** add a second accent colour.
- **Don't** put glass behind data, forms or buttons, and don't nest one surface inside another; use a line or an inset well.
- **Don't** use overshoot or bounce easing; use exponential ease-out.
- **Don't** put a label or kicker above a heading.
- **Don't** use hard corners, hard offset shadows, or gradient text.
