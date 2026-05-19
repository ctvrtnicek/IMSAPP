---
name: e2open-design
description: Use this skill to generate well-branded interfaces and assets for e2open, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping e2open-branded supply-chain software, marketing sites, decks, and collateral.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files:

- `README.md` — brand context, voice, visual foundations, iconography
- `colors_and_type.css` — all CSS variables (palette, type scale, spacing, radii, shadow, motion)
- `fonts/` — typeface notes (Graphik → Inter substitution flagged)
- `assets/` — logo SVGs (carbon, white, tagline), brand-device placeholder
- `preview/` — small card previews of each design-system concept
- `ui_kits/marketing/` — recreated e2open marketing website with reusable JSX components (Nav, Hero, MoreThan, SuiteGrid, MetricsBand, Insights, FinalCTA, Footer, DemoDialog)

Core brand facts to remember:
- Tagline **Moving as one.™**, narrative **More Than** (more than visibility, more than software).
- Company name always lowercase `e2open` (capitalize E2open only at start of sentence or press-release headline).
- Title Case for H1s, nav, solution names. Sentence case for CTAs, social, subheads.
- Voice is **inspired, confident, conversational**. Never salesy, technical, or in-the-weeds. No emoji.
- Palette: white dominant; Carbon #282828 spine; Cadet / Sage / Gold / Violet accents in Light/Medium/Dark. Prefer dark shades. No gradients as backgrounds.
- Typography: Graphik (sub: Inter). Four weights only — Light 300 for oversized H1s, Regular 400 body, Medium 500 CTAs only, Semibold 600 for subheads & stats.
- Cards: 12px radius, shadow `5px 15px 20px rgba(40,40,40,.10)`. One elevation. Inner icons 8px radius. Pills fully rounded.
- Snapshots are the signature brand device — cut-out UI cards composed over photography.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out of `assets/` and reference `colors_and_type.css` from your HTML. If working on production code, lift the CSS variables and the component patterns from `ui_kits/marketing/`.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts — or production code — depending on the need.
