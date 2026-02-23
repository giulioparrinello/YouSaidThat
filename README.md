# YouSaidThat

**Prove you said it before anyone else.**

YouSaidThat is a privacy-first prediction notarization platform. Seal your predictions today, reveal them later — with cryptographic proof that you knew it first.

The server never sees your text. Everything that matters happens in your browser.

---

## How it works

1. **Write** your prediction and choose a reveal date (up to 2040)
2. **Encrypt** — your text is encrypted client-side with AES-256; only a SHA-256 hash is sent to the server
3. **Anchor** — the hash is submitted to the Bitcoin blockchain via [OpenTimestamps](https://opentimestamps.org/) and an RFC 3161 TSA token is issued
4. **Seal** — a `.capsule` file is generated locally containing your encrypted prediction and the cryptographic proofs
5. **Reveal** — on the unlock date, decrypt locally and download a verifiable PDF certificate

No keys, no plaintext, no content ever leaves your device.

---

## Features

- **Zero-knowledge architecture** — the backend stores only hashes and proofs
- **Bitcoin anchoring** — immutable, decentralized timestamps via OpenTimestamps
- **RFC 3161 TSA** — standard trusted timestamping as a secondary proof layer
- **AES-256 + RSA-PSS** — client-side encryption with signature verification
- **PDF certificates** — downloadable proof with embedded blockchain evidence
- **Community feed** — browse public predictions by topic and year
- **Rate limiting + Helmet** — hardened API endpoints

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, TailwindCSS, ShadCN UI, Framer Motion |
| Backend | Express 5, Node.js, TypeScript |
| Database | PostgreSQL via Drizzle ORM |
| Crypto | Web Crypto API (browser), `node:crypto` (server) |
| Timestamps | OpenTimestamps, RFC 3161 TSA |
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

Create a `.env` file at the root:

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
SESSION_SECRET=your-secret-here
RESEND_API_KEY=your-resend-key        # optional, for email reminders
```

### Database

```bash
npm run db:push
```

### Development

```bash
npm run dev        # starts backend on :5000
npm run dev:client # starts Vite dev server
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
│   ├── pages/          # Home, Create, Verify, Unlock, Community
│   ├── components/     # UI components (ShadCN + custom)
│   └── lib/            # API client, crypto utils, certificate generation
├── server/
│   ├── routes.ts       # API endpoints
│   ├── storage.ts      # Database layer
│   ├── services/       # OTS, TSA, email
│   └── middleware/     # Rate limiting
└── shared/
    └── schema.ts       # Shared Zod schemas + Drizzle models
```

---

## Deployment

The project is configured for [Vercel](https://vercel.com). Set the environment variables in the Vercel dashboard and connect to a Supabase PostgreSQL instance.

---

## License

MIT
