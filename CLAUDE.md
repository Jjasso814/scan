# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Dev server with HMR at http://localhost:5173
npm run build    # Production build
npm run preview  # Preview production build locally
```

Local development requires a `.env.local` file (not committed) with the environment variables listed below.

## Deployment

Hosted on Vercel with auto-deploy from the `main` branch. **Git commits must use `jasso-juan@hotmail.com` as author email** — otherwise Vercel blocks the deploy (only that email has contributor access on the Hobby plan).

Serverless functions in `/api/` run as Vercel Edge Functions. The SPA is served from `/index.html` via the catch-all rewrite in `vercel.json`.

### Environment Variables (Vercel Settings → Environment Variables)

| Variable | Notes |
|---|---|
| `ANTHROPIC_API_KEY` | **No `VITE_` prefix** — server-only |
| `GMAIL_USER` | Gmail sender address |
| `GMAIL_APP_PASSWORD` | App-specific password (not main Gmail password) |
| `VITE_FIXED_EMAIL` | Default recipient shown in Phase 4 |
| `APP_PASSWORD` | Optional — activates login screen if set |
| `VITE_REQUIRE_AUTH` | Optional — set to `"1"` to show login UI |
| `ALLOWED_ORIGIN` | CORS for `/api/analyze`, default `"*"` |

## Architecture

### 4-Phase Workflow

All phase state lives in `App.jsx`. The app never navigates — it conditionally renders one phase component at a time based on `phase` (1–4).

```
Phase 1 → Select tipo: "materia_prima" | "maquinaria"
Phase 2 → Upload packing list / carrier label / product tags → Claude extracts JSON → buildRows() normalizes → rows[]
Phase 3 → Sequential per-bulto verification (bulto 1 of N, 2 of N…) → Claude confirms no_parte + cantidad → updates rows[]
Phase 4 → Editable table → CSV download + email send
```

**Key state variables in App.jsx:**
- `tipo` — drives all prompts, CSV columns, and normalization logic
- `rows` — the single source of truth for the editable table; mutated by Phase 2 and Phase 3
- `extracted` — raw Phase 2 Claude response; kept for reconciliation totals
- `allImgs` — accumulates ALL File objects across phases 2 and 3 (used for email attachments)
- `bultoIdx` — current 0-based index in Phase 3 sequential scan
- `imgWarning` — set when Claude reports `calidad_imagenes === "mala"` or >2 ⚠️ fields; blocks Phase 3 until user dismisses

### AI Prompt System (`src/config/prompts.js`)

Two builders:
- `buildPhase2Prompt(tipo)` — extracts all logistics fields from document images into a strict JSON schema. Includes 18 rules that override common AI mistakes (PO vs Serie confusion, carrier name normalization, país de fabricación vs remitente, etc.).
- `buildPhase3Prompt(tipo, rows)` — verifies a single physical bulto against the rows extracted in Phase 2. Observaciones must be EXACTLY one of 5 predefined phrases.

**Critical rules baked into prompts:**
- **Maquinaria cantidad**: read the trailing number in the product name ("PISTON O WIPER 100" → 100), not the Packing List Qty (which = boxes, not pieces).
- **Multiple packing lists**: one row per document per part number — never sum quantities across documents.
- **Serie vs PO**: "PO#" or "P/O:" patterns go to `po`, never to `serie`.
- **Carrier**: brand only — "UPS GROUND" → "UPS".
- **Origen**: ISO-2 fabrication country from "Made in" / "COO:", not the shipper's address.

### Data Normalization (`src/utils/claudeApi.js` → `buildRows()`)

After the Claude API call, `buildRows(ext, tipo)` converts the raw JSON into table rows:

1. **PO rescue** — if Claude incorrectly put "PO# XXXX" into `serie`, it's moved to `po`.
2. **Warning stripping** — removes "⚠️ " prefix from all values before display.
3. **Maquinaria quantity fallback** — if Claude returned `cantidad=1` but `descripcion_ingles` ends in a number ≥2, extract that number as the real quantity.
4. **Materia prima expansion** — if 1 part + `bultos_total > 1`, expand to N rows (quantity divided equally, one row per bulto).
5. **Carrier / tipo_bulto / origen normalization** — standardizes common variations.
6. **Tracking normalization** — strips spaces, uppercases, fixes OCR error "12..." → "1Z..." for UPS.

### Image Processing (two independent pipelines)

**Pipeline 1 — Claude API** (`prepareForApi` in `claudeApi.js`):
- If image dimensions ≤ 2048px → send original bytes (no re-encoding to avoid double-compression artifacts).
- If larger → canvas resize to max 2048px @ JPEG 92%.
- Fallback to original if canvas fails and file ≤ 8MB.

**Pipeline 2 — Email** (`resizeForEmail` in `claudeApi.js`):
- Dynamic quality in `handleEmail()` based on image count: ≤3 imgs → 1600px/85%; 4-6 → 1400px/80%; 7-10 → 1200px/75%; 11+ → 1024px/70%.
- `api/sendmail.js` has a 4MB body cap (Vercel limit is 4.5MB). When budget is tight, images are sorted by size ascending so the maximum number of images fits; then reordered by original index before attaching.

### Serverless Functions

**`/api/analyze.js`** — secure proxy to `https://api.anthropic.com/v1/messages`. Uses `claude-sonnet-4-6` with `temperature: 0` and `max_tokens: 4096`. Handles optional Basic auth via `APP_PASSWORD`.

**`/api/sendmail.js`** — Gmail SMTP via Nodemailer. Accepts CSV + base64 images array. Enforces 4MB body cap with smart image selection.

### File Size Constraint

Keep all source files under ~200 lines. If a file approaches that limit, extract logic into a new utility or component.
