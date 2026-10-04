# TALLER DE GRABADO

Web app (React + TypeScript + Vite) that simulates printmaking techniques. It is delivered as a single
HTML file that works by double-click (`npm run build` → `dist/index.html`). No backend.

- **The plan is `docs/PLANNING.md`.** It holds the architecture, the engines, the pipeline, the phases and
  the decisions taken. Before starting a phase, read its row in section M and the relevant sections.
- **The interface follows the design kit in `docs/design-kit/`.** Before designing or changing any
  screen, read `README.md`, `01-principios.md` and `03-anatomia-y-layout.md`. Reuse the pieces in
  `src/ui/` before creating new ones (`src/ui/` is the kit copy: don't change it, extend it in
  separate files). Check every screen against `07-checklist.md` (390 × 844, 375 × 812, 360 × 740 and
  1440 × 900).
- No UI text is written in components: everything comes from `src/i18n/es.ts` (`t('…')`), in Rioplatense
  Spanish with voseo.
- All effect parameters use physical units (mm, lpi, pt), never pixels.
- Code and comments in English; interface in Spanish.
