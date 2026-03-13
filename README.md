# YouSaidThat

**Prove you said it before anyone else.**

YouSaidThat is a privacy-first prediction notarization platform. Seal your predictions today, reveal them later — with cryptographic proof that you knew it first.

The server never sees your text. Everything that matters happens in your browser.

---

## Two modes

### Proof of Existence
Write something you want to prove you knew. A SHA-256 hash is anchored on Bitcoin via OpenTimestamps and an RFC 3161 TSA token is issued immediately. The content stays on your device; the hash is optionally public on the community feed.

### Sealed Prediction
Your text is encrypted client-side using [drand IBE timelock](https://drand.love/) (`tlock-js`). It is **mathematically impossible to decrypt before the chosen date** — the decryption key does not exist until drand publishes the beacon for that round. A `.capsule` file is generated locally containing the tlock ciphertext and the cryptographic proofs.

---

## How it works

1. **Choose mode** — Proof of Existence or Sealed Prediction
2. **Write** your prediction
3. **Pick a date** — year-based gate (Proof of Existence) or exact datetime (Sealed Prediction)
4. **Seal** — client-side tlock encryption + SHA-256 hash sent to the server; OTS + TSA anchoring starts
5. **Reveal** — on or after the unlock date, decrypt locally with drand beacon; publish to community feed if desired

No keys, no plaintext, no content ever leaves your device.

---

## Features

- **Zero-knowledge architecture** — backend stores only hashes and proofs, never content
- **drand IBE timelock** — cryptographically enforced time-lock via BLS12-381 identity-based encryption
- **Bitcoin anchoring** — immutable, decentralized timestamps via OpenTimestamps (Alice + Bob calendars)
- **RFC 3161 TSA** — synchronous trusted timestamping as a secondary proof layer (Actalis)
- **Arweave storage** — permanent off-chain backup of cryptographic proofs
- **RSA-PSS attestation** — sign and publicly claim authorship after unlock
- **PDF certificates** — downloadable proof with embedded blockchain evidence
- **Community feed** — browse public predictions by topic and year
- **Rate limiting + Helmet + HSTS** — hardened API endpoints

---

## Architecture

```mermaid
graph LR
    Browser["Browser\n(React + WebCrypto)"]
    API["Express API\n(Vercel serverless)"]
    DB["PostgreSQL\n(Supabase)"]
    OTS["OpenTimestamps\nAlice + Bob"]
    TSA["RFC 3161 TSA\nActalis"]
    Arweave["Arweave\n(permanent storage)"]
    drand["drand quicknet\n(IBE timelock)"]

    Browser -->|"SHA-256 hash only"| API
    API --> DB
    API -->|"async"| OTS
    API -->|"sync"| TSA
    API -->|"async"| Arweave
    Browser -->|"fetch beacon for decrypt"| drand
```

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite 7, TailwindCSS v4, Radix UI, Framer Motion, GSAP |
| Backend | Express 5, Node.js 20, TypeScript, tsx (dev), esbuild (prod) |
| Database | PostgreSQL via Drizzle ORM (Supabase) |
| Timelock | tlock-js v0.9.0, drand quicknet (BLS12-381 IBE) |
| Crypto | Web Crypto API (browser), `node:crypto` (server) |
| Timestamps | OpenTimestamps (Bitcoin), RFC 3161 TSA (Actalis) |
| Storage | Arweave (permanent proof backup) |
| Email | Resend |
| PDF | jsPDF |
| Deploy | Vercel + Supabase |

---

## Getting started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (local or [Supabase](https://supabase.com))

### Install

```bash
git clone https://github.com/giulioparrinello/teaserYST.git
cd teaserYST
npm install
```

### Environment

Copy `.env.example` to `.env` and fill in the required values:

```bash
cp .env.example .env
```

Minimum required for local development:
```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
ADMIN_SECRET=your-random-32-char-admin-secret
CRON_SECRET=your-random-32-char-cron-secret
```

See `.env.example` for all variables and [DEPLOYMENT.md](./DEPLOYMENT.md) for production setup.

### Database

```bash
npm run db:push
```

### Development

```bash
npm run dev        # starts backend on :5000 + Vite HMR
```

### Production build

```bash
npm run build
npm start
```

---

## Project structure

```
├── client/src/
│   ├── pages/          # Home, Create, Verify, Unlock, Community, Attestation
│   ├── components/     # UI components (Radix UI + custom)
│   └── lib/            # API client, crypto (tlock + WebCrypto), certificate generation
├── server/
│   ├── routes.ts       # All API endpoints
│   ├── storage.ts      # Database layer (Drizzle ORM)
│   ├── services/       # OTS, TSA, Arweave, email, cron
│   └── middleware/     # Rate limiting
├── shared/
│   └── schema.ts       # Shared Zod schemas + Drizzle models
├── docs/
│   └── openapi.yaml    # OpenAPI 3.0 spec
├── DEPLOYMENT.md       # Production deployment guide
└── CONTRIBUTING.md     # Contributor guide
```

---

## API summary

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/predictions/register` | Register hash (OTS + TSA + Arweave) |
| `GET` | `/api/predictions/public` | Community feed (public predictions) |
| `GET` | `/api/predictions/verify` | Verify by SHA-256 hash |
| `GET` | `/api/predictions/:id` | Get prediction metadata |
| `GET` | `/api/predictions/:id/ots-status` | Poll OTS confirmation |
| `POST` | `/api/predictions/:id/reveal` | Reveal content + optionally publish |
| `POST` | `/api/predictions/claim` | Claim authorship (RSA-PSS attestation) |
| `GET` | `/api/attestations/:id` | Public attestation page |
| `POST` | `/api/waitlist` | Waitlist signup |
| `GET` | `/health` | Health check |

Full spec: [docs/openapi.yaml](./docs/openapi.yaml)

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step instructions covering Vercel, Supabase, domain setup, and Resend configuration.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

MIT
