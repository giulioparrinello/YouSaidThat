# Contributing to YouSaidThat

---

## Project setup

```bash
git clone https://github.com/giulioparrinello/teaserYST.git
cd teaserYST
npm install
cp .env.example .env   # fill in DATABASE_URL at minimum
npm run db:push        # create tables
npm run dev            # starts backend :5000 + Vite HMR
```

---

## Architecture overview

YouSaidThat is a monorepo with three layers:

```
client/   — React 19 SPA (Vite), runs entirely in the browser
server/   — Express 5 API, deployed as Vercel serverless function
shared/   — Zod schemas + Drizzle models shared by both
```

**Key design principle: the server is deliberately blind.**
It stores SHA-256 hashes and cryptographic proofs — never plaintext content, never private keys, never raw emails. All encryption and decryption happens client-side using the Web Crypto API and `tlock-js`.

### Two prediction modes

| Mode | Encryption | Time gate |
|---|---|---|
| `proof_of_existence` | None (hash only) | Year-based (client UX gate) |
| `sealed_prediction` | drand IBE timelock (BLS12-381) | Exact datetime (cryptographic) |

### Client crypto stack (`client/src/lib/crypto.ts`)

- **SHA-256** — `crypto.subtle.digest`, applied to UTF-8 text
- **RSA-PSS 2048** — key generation, sign/verify for attestation claims
- **tlock-js** — drand IBE encryption (`tlockEncrypt`) and decryption (`tlockDecrypt`) using quicknet chain
- **AES-256-GCM** — legacy v1.0 capsule only (no new usage)

### Database (`shared/schema.ts` + `server/storage.ts`)

Drizzle ORM with Supabase PostgreSQL. Four tables: `predictions`, `attestations`, `email_queue`, `waitlist`. All queries use parameterized statements (no raw SQL with user input).

---

## Development workflow

1. **Branch from `main`**: `git checkout -b feat/your-feature`
2. **TypeScript check**: `npm run check` must pass before opening a PR
3. **Manual testing**: use the dev server (`npm run dev`) — no automated test suite yet
4. **Commit messages**: use imperative mood, describe *why* not *what* when non-obvious
5. **PR description**: summarize the change and how you tested it

---

## Key files to know

| File | Purpose |
|---|---|
| `shared/schema.ts` | Single source of truth for DB schema + Zod validation |
| `server/routes.ts` | All API endpoints — read this to understand the API |
| `server/storage.ts` | `IStorage` interface + `DrizzleStorage` implementation |
| `client/src/lib/crypto.ts` | All client-side crypto (tlock, RSA-PSS, SHA-256) |
| `client/src/pages/Create.tsx` | Multi-step seal flow (mode → text → date → options → seal) |
| `client/src/pages/Unlock.tsx` | Capsule decryption + reveal flow |
| `server/index.ts` | Express setup, Helmet CSP, CORS, body limits |

---

## Known limitations

- **No automated test suite** — integration tests are planned (ROADMAP Phase 7.5). Manual testing is the current approach.
- **Vercel Hobby cron** — Vercel Cron requires a Pro plan. Use Supabase pg_cron instead (see `DEPLOYMENT.md`).
- **Resend domain** — emails are no-ops until the sender domain is verified on Resend.
- **opentimestamps CLI** — the `upgradeOtsProof` function falls back to a simple HTTP check if the opentimestamps Node library fails (acceptable for now).

---

## Environment variables

See `.env.example` for the full list. For local development, only `DATABASE_URL` is strictly required. `ADMIN_SECRET` and `CRON_SECRET` are needed to test admin and cron endpoints.

---

## Questions

Open an issue on GitHub or check the existing documentation:
- `README.md` — project overview
- `PRD.md` — backend architecture reference
- `DEPLOYMENT.md` — production deployment guide
- `docs/openapi.yaml` — full API spec
