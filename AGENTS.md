# Family Tree Web Application

**Goal:** A mobile-first family tree visualization and editing app using the family-chart library.

**Tech Stack:** Bun (native HTTP + SQLite) | Vue 3 + Vite + TypeScript | family-chart + d3

**Design Principle:** Mobile-first — all UI must work well on vertical/small screens before desktop.

**Build Command:** After making significant changes to the client, run `cd client && bun run build` (or `vue-tsc -b && vite build`) to verify no TypeScript errors.

## CSS Architecture

- **External CSS files**: Each component gets a matching `.css` file, referenced via `<style src="./ComponentName.css" scoped></style>`
- **Structure**: `styles/variables.css` (vars), `styles/base.css` (reset), `styles/utilities.css` (shared), `styles/vendor/` (3rd party)
- **No inline `<style>` blocks in `.vue` files**
