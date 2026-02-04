# Copilot / AI agent instructions — Expense Tracker (frontend)

This file captures concise, repository-specific guidance so an AI coding agent can be productive immediately.

## 🚀 High-level architecture
- Single-page React + TypeScript app using Vite. Entry: `src/main.tsx` → `src/App.tsx`.
- Routing: `react-router-dom` (routes defined in `src/App.tsx`). Pages live in `src/pages/` and map 1:1 to routes (e.g. `/expenses` → `src/pages/ExpensesPage.tsx`).
- Layout: `src/layout/AppShell.tsx` provides global UI context (year/month, header). Pages must NOT re-render AppShell; they run inside the ShellLayout in `App.tsx` and use `useAppShell()` / `useAppYearMonth()` to update header and month.

## 🔧 API & auth patterns
- Single API helper: `src/api.ts` — use `api<T>(path, options)` for all backend calls.
  - Reads `localStorage.token` and sets `Authorization: Bearer <token>`.
  - Auto-sets `Content-Type: application/json` unless the body is a `FormData`.
  - On 401 clears `localStorage.token` and redirects to `/login`.
  - Throws `Error(message)` using backend-provided message when `!res.ok`.
- Example call:
  ```ts
  await api('/expenses', { method: 'POST', body: JSON.stringify({ year, month, ... }) });
  ```
- API base: `API_BASE = \"http://localhost:3000\"` in `src/api.ts` — the backend is expected to run locally (see Backend section). Be mindful of CORS issues when the backend is not running.

## 🧠 UI & state conventions
- Most pages load data inside a useEffect keyed by `{year, month}` and expose `loadAll()` / `loadX()` helpers (follow patterns in `src/pages/ExpensesPage.tsx`).
- Use `loading`, `error`, and `info` state variables consistently for UX and error handling.
- Use small in-memory draft maps for inline editing (e.g. `DraftMap`, `PlannedDraftMap`) with helper functions like `getDraft()` / `setDraft()` (see `src/pages/ExpensesPage.tsx`, `src/pages/BudgetsPage.tsx`).
- Month-closure logic:
  - Several pages call `loadMonthCloses()` and check `isMonthClosed` before mutating data. Respect this pattern when adding any create/update/delete operations (see `src/pages/AdminPage.tsx`, `src/pages/ExpensesPage.tsx`, `src/pages/InvestmentsPage.tsx`).
- Onboarding is stored per-user in localStorage under `ground:onboarding:v1:<userId>` (managed in `AppShell`). Use `reopenOnboarding()` / `setOnboardingStep()` when necessary.

## ⚙️ Developer workflows
- Frontend commands (from root `expense-tracker-frontend`):
  - `npm run dev` — start Vite dev server
  - `npm run build` — `tsc -b && vite build`
  - `npm run preview` — preview production build
  - `npm run lint` — run ESLint
- Backend (sibling folder `expense-tracker-backend`):
  - `cd ../expense-tracker-backend && npm run dev` — dev server (uses `tsx watch`).
  - `npm run seed` — runs Prisma seed script (`prisma/seed.ts`).
  - Prisma migrations are in `prisma/migrations` (backend) — useful for schema changes.
- If adding runtime-only config, prefer Vite env/define variables rather than changing hardcoded constants (`API_BASE` in `src/api.ts`).

## 📐 Integration & cross-cutting notes
- When adding new API endpoints, prefer adding typed consumer helpers or page-level loader functions that call `api(...)` and surface meaningful error messages to the UI.
- Keep backend URL in sync with `API_BASE` in `src/api.ts`. If you need runtime config, use Vite env/define variables rather than changing code in many places.
- No test suite detected — treat logic changes conservatively and add focused tests where feasible.

## ✅ When opening a PR / implementing a feature
- Follow the `AppShell` contract: set page header in `useEffect` via `useAppShell()` and avoid re-instantiating global providers.
- Use `api()` for backend interactions and handle errors from thrown `Error(message)`.
- Respect month close checks before mutations.
- Prefer the existing draft map patterns for inline edits (consistent shape & helpers).
- Update or add a route in `src/App.tsx` when adding a page.

## Files to inspect (quick)
- `src/App.tsx` — routing & auth guard
- `src/api.ts` — single source of truth for server comms
- `src/auth.ts` — auth helpers (login/register)
- `src/layout/AppShell.tsx` — global context, onboarding
- `src/pages/ExpensesPage.tsx` — canonical page patterns (loaders, drafts, monthClose)

If anything here is unclear or you want examples for a specific change (e.g., adding a page, creating a loader, or handling month-closures), tell me which area to expand and I'll iterate.
