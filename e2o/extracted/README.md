# e2open Design System

A design system for **e2open** — the connected supply chain software company. This system captures the brand identity, voice, visual foundations, and UI patterns distilled from the official *e2open Brand Guidelines (R9, Jan 2026)*.

> **Tagline:** *Moving as one.™*
>
> **Positioning:** *More Than* — not just visibility or collaboration, but industry‑defining supply chain solutions.

---

## About e2open

e2open is a cloud-based, end-to-end supply chain management and orchestration SaaS platform. The company provides solutions across planning, global trade, logistics, supply, and channel — connecting over 400,000 partners and processing billions of transactions annually. Headquartered in Addison, TX.

**Solution suites (each has a dedicated brand color):**
- **Channel** — Channel management software; engage partners and drive sales
- **Planning** — Connected planning platform; agility + performance
- **Global Trade** — Trade content, compliance, Global Knowledge®
- **Logistics** — Shipping, transportation, carrier business
- **Supply** — Multi-tier supplier collaboration and orchestration

## Sources

- **`uploads/e2open_BrandGuidelines_R9.pdf`** — 89-page official brand book (Jan 2026). Single source of truth for everything in this system.
- **`www.e2open.com`** — live marketing website (for real-world reference).
- No Figma or codebase provided. UI kit is built from the brand book's *Snapshots* and *UI components* descriptions plus publicly visible web patterns.

---

## Index

- **`README.md`** *(this file)* — brand overview, content fundamentals, visual foundations, iconography
- **`colors_and_type.css`** — CSS variables for the full palette, type scale, spacing, shadows, radii
- **`fonts/`** — primary typeface (Graphik → Inter substitute) and fallbacks
- **`assets/`** — logos, brand-device SVGs, illustration placeholders, icon set
- **`preview/`** — Design System tab card previews (one small HTML per concept)
- **`ui_kits/marketing/`** — recreation of the e2open marketing website (hero, nav, suite grid, CTAs, footer) — see its own README
- **`SKILL.md`** — Agent-Skill entry point for re-use in Claude Code

---

## Content fundamentals

### Voice

> e2open is **inspired, confident, and conversational** — reflecting a commitment to clarity, optimism, and results-driven communication.

| We are | We are not |
|---|---|
| Inspired | In-the-weeds |
| Confident | Salesy |
| Conversational | Overly technical |

- **Inspired.** Energizing, ambitious, optimistic. *"We come to work each day ready to make a positive difference in our clients' businesses — and in our world."*
- **Confident.** Matter-of-fact about capability. *"Our AI-powered technology is and will always be ahead of whatever complexities supply chains throw at us."*
- **Conversational.** Plain, precise language. No dumbing down, but no jargon. *"Our solutions are highly complicated. Our communications are anything but."*

### Tone dos & don'ts

**Do:**
- Keep it simple. Don't write more than is needed.
- Use outcome-based storytelling — focus on what the user *gains*, not what we *give*.
- Ask questions that beg for answers (that we have).
- Light humor is fine if relatable and appropriate.
- Talk about *connection* whenever possible.

**Don't:**
- Don't drift into white-paper territory in an ad or video script.
- Don't use sports metaphors or colloquialisms — we are a global brand.
- Don't just ramble about e2open. The story is about the *reader*.
- Don't use tired words like "optimization" or "synergies."
- Avoid directive language ("should," "must," "need to"). Prefer *"Manufacturers will be pressed to identify areas for modernization."*

### Casing

- The company is always **e2open** — lowercase "e" — except as the first word of a sentence or press-release headline, where it becomes **E2open**.
- The tagline is **Moving as one.™** — sentence case, with the ™, never italicized.
- **Title Case** for: H1 headlines, navigation items, resource titles, solution names. *"Supply Chain Visibility"*.
- **Sentence case** for: all social media, subheads, CTAs and button text, non-H1 headlines. *"Streamline your supply chain"*.
- **Solution suites** capitalized when named (*e2open Planning*, *e2open Supply*); lowercase when speaking generally about *"supply planning"* or *"demand."*
- **Possessive.** Write *"e2open Supply Planning"*, never *"e2open's Supply Planning"*.

### Style

- **Oxford comma** always. *"strategy, design, and execution"*.
- **US**, **EU** — no periods.
- **"supply chains"** (plural), never *"the supply chain"* — there are thousands, each with its own dynamics.
- **No emoji** in brand copy. Ever.
- En dash `—` used generously for rhythm and asides.

### Example copy (lifted from the PDF)

- H1: *"Supply Chain Planning: Make Profitable Plans and Increase Agility"*
- H1: *"Applied AI That Truly Understands Your Supply Chain"*
- Subhead: *"Plan and manage your business with a new level of confidence"*
- Body opener: *"Choose the connected planning platform that combines agility with the breadth to meet your immediate needs and the depth to grow with you."*
- Narrative anchor: *"E2open delivers more than the status quo — offering next-generation solutions that do more than just offer visibility or collaboration."*

---

## Visual foundations

### Philosophy

White is the anchor. The brand *lives* in whitespace. Color is deployed with intention — dark, grounded accents for credibility; pastels only sparingly for warmth. Headlines are **oversized and light-weight**, creating a quiet-luxury, enterprise-confident feel. Nothing shouts.

### Color

The palette is structured as **5 hue families × 3 shades** plus a carbon/white neutral spine:

| Family | Light | Medium | Dark |
|---|---|---|---|
| Carbon (neutral) | `#ebebeb` | `#cccccc` | `#282828` |
| Cadet (teal) | `#97baba` | `#3d8080` | `#1e5b67` |
| Sage (green) | `#a3ca8c` | `#80994d` | `#517222` |
| Gold | `#e8ce96` | `#c69a3f` | `#8e7029` |
| Violet | `#b9ace8` | `#7239a4` | `#4d3075` |

White `#FFFFFF` is the **most-used color**. Each hue family is typically mapped to a solution suite (the PDF confirms suite-specific color treatments; exact mapping is design-team owned — see `preview/colors-suites.html` for the working assumption).

**Proportions rule:** white dominates. When adding color, prefer *dark* shades. Mediums for depth. Pastels/lights only sparingly — overused they read as "Easter color scheme."

**Red is permissible** for alerts, issues, errors in illustrations — not a brand color.

### Typography

- **Primary:** **Graphik** (Commercial Type). Four weights only: Light (300), Regular (400), Medium (500), Semibold (600).
- **Secondary/fallback:** Arial (for Microsoft Suite & email).
- **Substituted here:** Graphik is commercial. We use **Inter** (self-hosted via Google Fonts) as the closest geometric grotesque match. **→ Flagged to the user; please supply licensed Graphik `.woff2` files to replace `fonts/inter/*`.**

**Weight usage:**
- **Light** — large headlines only. Never below 20pt.
- **Regular** — body, and headlines below 20pt.
- **Medium** — CTA buttons *only*.
- **Semibold** — subheads, labels, statistics / graphic type.

**Hierarchy pattern:**
- H1 (display): Graphik Light, 64–96pt, Title Case, tight leading
- H2: Graphik Light, 40–48pt
- Label / eyebrow: Graphik Semibold, 12–14pt, uppercase with letter-spacing
- Subhead: Graphik Semibold — pair with Light H1 for contrast
- Body: Graphik Regular, 16–18pt, generous leading

**Leading.** Adjusted manually per layout; PDF stresses breathable but not disconnected. Default `line-height: 1.35` for headlines, `1.55` for body. Leading appears *different* on dark vs light — always review on both.

### Spacing & grid

Two grid systems:
- **Layout grid** — 12-column (default) or 9-column (simpler layouts) for web/email.
- **Square grid** — the *core structural system*. Evenly spaced uniform squares, used for brand devices, templates, and these guidelines themselves. Pixel-like framework; align everything to it.

Spacing tokens in `colors_and_type.css`: `--space-1` = 4px → `--space-16` = 128px on a 4/8px step.

### Corner radii

From the *Snapshots* construction rules:
- **Outer frames (snapshot cards):** 12pt / **12px** (`--radius-card`)
- **Inner icon frames inside cards:** 8pt / **8px** (`--radius-inner`)
- **Small component elements:** 4pt / **4px** (`--radius-xs`)
- **Text-frame pills:** fully rounded / **9999px** (`--radius-pill`)

### Shadows

The *Snapshots* spec defines one canonical elevation:

```
box-shadow: 5px 15px 20px rgba(40, 40, 40, 0.10);
/* Mode: Multiply, Opacity 10%, Offset X 5 Y 15, Blur 20, Color Carbon */
```

One shadow. One elevation. No depth ladder; cards either have this shadow or they don't. See `--shadow-card` in `colors_and_type.css`.

### Backgrounds, imagery, illustration

- **Backgrounds are predominantly white** or *light cadet* (`#dce8e8`-ish tint of cadet). Full-color backgrounds reserved for moments of drama / emphasis in explainer videos.
- **No gradients** as backgrounds; the brand does not use them.
- **No patterns, textures, grain, or repeating motifs.**
- **No bluish-purple enterprise-SaaS gradient slop.** Violet is used flat, never as a blend.
- **Photography** — authentic, documentary-style, real supply-chain scenarios. Bright, ambient lighting, heightened exposure, natural colors, natural depth of field. Warm from the *subject*, not post-processed.
- **Illustration** — clean, flat, approachable. Used to simplify complex topics. Prefer the library; duplicate & recolor before creating new. Don't overdo people-illustration (avoids cartoonish).
- **Snapshots** — the signature brand device. Cut-out UI components (cards with the 12px radius and the one shadow) composed over photography to tell a product story. Max 3 components per ad; up to 5 in website sections.

### Motion & interaction

The PDF is light on motion specifics. Working inference (flagged — **confirm with brand team**):

- **Easing:** `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out expo) — matches the "Moving as one" sense of arrival, not bounce.
- **Duration:** 200ms for micro (hover), 400ms for card/reveal, 600ms for full page transitions.
- **Hover:** slight darken via `color-mix` (≈6% black) or opacity 0.85 on secondary elements. No color *shift*, no glow, no scale > 1.02.
- **Press:** `transform: scale(0.98)` + shadow reduced 50%. No color flash.
- **No bounce, no elastic, no overshoot.** The brand is composed; motion is calm.
- **Fades** for reveals. No slide-ins longer than 12px.

### Borders, transparency, blur

- **Borders** used sparingly. When present, `1px solid var(--carbon-medium)` on cards that *don't* use the shadow, or `1px solid var(--carbon-light)` for dividers.
- **Transparency** reserved for overlay scrims on hero imagery — carbon at 40–60%.
- **Blur** is *not* a brand tool. No frosted-glass surfaces.

### Layout rules

- Generous whitespace is non-negotiable — "effective white space" is the phrase used in the book.
- Do not crowd the logo. Primary-logo clearspace = X (X = logo height). Badge clearspace = X/2.
- Minimum logo size: **70px digital**, 1.5" print. Badge minimum: **20px digital**.
- Body copy rarely extends beyond 8 of 12 columns. Long-form reads at ~65ch measure.
- CTAs are aligned left with the content column; not floated centered.

### Cards

From the Snapshots construction rules, every card is:

- White background (or full-color suite tone for emphasis)
- 12px outer radius
- Shadow: `5px 15px 20px rgba(40,40,40,0.10)`
- No border when shadowed
- Inner icon chip at 8px radius
- Pills (status tags, metric tags) fully rounded

---

## Iconography

**Source.** e2open maintains a proprietary **icon library** (documented in section 08 of the brand book with 90+ named icons: *actions, airplane, AI, car, carbon dioxide, cellular antenna, chart, chatting, check, city, clock, closed, cloud, collaboration, complexity, compliance, connected data, consultants, copackers, COVID, customers, data, data harmonization, delay, delete, delivery van, distribution center, distributors, do not enter, e2net, ESG, euro, factory, fire, fraud, freight forwarder, garbage, globalization, globe, growth, help, integration, interaction, iron ore, learn cycle, linear, logistics, map pin, money, network, network cellular, new, outsourcing, parcel, product innovation, profit, rail car, resellers, retailers, reverse, route optimization, sales visit, scale, ship, shopping cart, speed, suppliers, tablet, target, teamwork, tracks, train car, transportation logistics, truck, trusted, upgrade, upgrade, user, warehouse, warning, water, yen*…).

**We do not have access to those exact assets.** Per the PDF: *"Contact Brand for usage. Visit our library here:"*

**Substitution (flagged).** We use **Lucide Icons** (`https://unpkg.com/lucide@latest`) via CDN. Lucide is open-source, stroke-based, and the closest match for the clean, thin-stroke line iconography the e2open book describes. **Please upload the official icon set to replace.**

**Style rules inferred from the book & live site:**
- Line icons, ~1.5–2px stroke, rounded endcaps
- Used at 20px / 24px in UI; 48–64px as section leads
- Color: **Carbon** `#282828` by default; suite-color on hover/active; white on dark surfaces
- Never multi-color within a single icon
- Always paired with a label in navigation / product-suite tiles — icon alone is rare

**Emoji:** *never used.* The brand voice is global and professional.

**Unicode as icon:** only the `™` for the tagline and `®` for *Global Knowledge®*.

**Brand device** — e2open also uses an "ownable brand device" representing the connected supply chain (PDF section 06). Treated as a secondary graphic element on reports, decks, merch, events. The book illustrates it but does not publish its geometry. We ship `assets/brand-device-placeholder.svg` as a flagged stand-in.

---

## Caveats

See `README.md` bottom, `SKILL.md`, and the CAVEATS note at the end of the agent's chat. Short version:

1. **Graphik → Inter** font substitution. Flagged.
2. **Icon library → Lucide** substitution. Flagged.
3. **Logo** — the real wordmark is trademarked; we ship a faithful reconstruction of the lowercase `e2open` wordmark in the specified Carbon. Swap with the official SVG when available.
4. **Suite → color mapping** is inferred (book shows icons for Channel / Planning / Global Trade / Logistics / Supply; ties one suite per hue family). Please confirm.
5. **Motion spec** is not in the PDF; we propose a calm, ease-out-expo system. Please confirm.
6. **Brand device geometry** is illustrated only, not spec'd, in the PDF. Placeholder shipped.
