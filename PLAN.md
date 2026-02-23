# YouSaidThat — Piano di sviluppo
> Versione: 1.0 · Data: 2026-02-22 · Stato: **da implementare**

---

## Indice

1. [Fix di sicurezza (priorità lancio)](#1-fix-di-sicurezza)
2. [Community — feed predizioni pubbliche](#2-community-feed)
3. [PDF Certificate — download con certificato](#3-pdf-certificate)
4. [Ordine di esecuzione](#4-ordine-di-esecuzione)
5. [Dipendenze da installare](#5-dipendenze)

---

## 1. Fix di sicurezza

### 1.1 Body size limit — DoS risk
**Priorità: CRITICA · Effort: 5 minuti**

`express.json()` attualmente non ha limite di dimensione. Un attacker può inviare payload arbitrariamente grandi causando OOM sul server Vercel.

**File:** `server/index.ts`

**Fix:**
```typescript
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: false, limit: "50kb" }));
```

---

### 1.2 Security headers HTTP — helmet
**Priorità: ALTA · Effort: 15 minuti**

Il server non invia nessuno degli header di sicurezza standard. Mancano:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy`
- `Permissions-Policy`

**File:** `server/index.ts`, `package.json`

**Fix:**
```bash
npm install helmet
```
```typescript
import helmet from "helmet";

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        // unsafe-inline richiesto da Framer Motion + GSAP
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    // disabilitato: incompatibile con Vercel edge cache
  })
);
```

> **Nota Vercel:** Vercel aggiunge già alcuni header ma non CSP. helmet + Vercel si sovrappongono senza conflitti.

---

### 1.3 XSS in display_name — DOMPurify
**Priorità: ALTA · Effort: 20 minuti**

La sanitizzazione attuale in `server/routes.ts:315` usa una regex manuale che non copre entità HTML (`&lt;script&gt;`, `&#x3C;`, zero-width chars, ecc.).

**File:** `server/routes.ts`, `package.json`

**Fix:**
```bash
npm install isomorphic-dompurify
npm install --save-dev @types/dompurify
```
```typescript
import DOMPurify from "isomorphic-dompurify";

// Sostituisce la regex manuale attuale
const sanitizedName = DOMPurify.sanitize(
  display_name.slice(0, 100),
  { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }
);
```

---

### 1.4 Email hashing client-side prima dell'invio
**Priorità: MEDIA · Effort: 30 minuti**

Il client attualmente invia l'email in plain text al server (`server/routes.ts:107`). Il server poi la hasha. Questo viola il principio zero-knowledge applicato alle email, anche se il server scarta l'email originale dopo. La privacy è compromessa in transito.

**File:** `client/src/pages/Create.tsx`, `client/src/lib/crypto.ts`

**Fix in `crypto.ts`:**
```typescript
export async function hashEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  return hashText(normalized); // SHA-256, già implementato
}
```

**Fix in `Create.tsx`** (nel submit handler, prima del POST):
```typescript
const emailHash = formData.email
  ? await hashEmail(formData.email)
  : undefined;

// Invia emailHash invece di email raw
await api.registerPrediction({ ...payload, email_hash: emailHash });
```

**Fix in `server/routes.ts`:** rimuovere il campo `email` dallo schema di input, accettare solo `email_hash` pre-calcolato.

> **Impatto sul reminder email:** il server non ha mai l'email originale. Il sistema email reminder richiederà un meccanismo separato (vedere ROADMAP 7.x). Per ora il campo viene rimosso dal flusso server senza rompere nulla — le email reminder sono comunque uno stub.

---

### 1.5 Rate limiting distribuito — Upstash Redis
**Priorità: MEDIA (critica in produzione scale-out) · Effort: 2 ore**

L'attuale `express-rate-limit` usa memory store in-process. Su Vercel ogni deploy istanza ha il proprio contatore — il rate limit è inutile con 2+ istanze in parallelo.

**File:** `server/middleware/rateLimiter.ts`, `package.json`

**Fix:**
```bash
npm install @upstash/ratelimit @upstash/redis
```

**Nuova variabile `.env`:**
```
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

**Implementazione:**
```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export const registerRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "yousaidthat:register",
});

export const claimRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 h"),
  prefix: "yousaidthat:claim",
});
```

> **Alternativa gratuita:** Upstash ha free tier 10k request/day. Per il MVP va benissimo.

---

### 1.6 OTS polling — Vercel Cron
**Priorità: ALTA · Effort: 1 ora**

`node-cron` in Vercel serverless non viene eseguito: le funzioni serverless vivono 0-10 secondi per richiesta. Il polling OTS ogni 6h richiede un processo persistente che Vercel non supporta nativamente.

**File:** `vercel.json`, nuovo file `api/cron/ots-poll.ts`

**Fix — Vercel Cron:**
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/ots-poll",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

```typescript
// api/cron/ots-poll.ts — endpoint GET protetto da CRON_SECRET
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { storage } from "../../server/storage";
import { upgradeOtsProof } from "../../server/services/ots";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  // logica di polling esistente da cron.ts
  const pending = await storage.getPendingOtsPredictions();
  for (const p of pending) {
    await upgradeOtsProof(p);
  }
  res.json({ processed: pending.length });
}
```

**Nuova variabile `.env`:**
```
CRON_SECRET=<random-string-sicuro>
```

---

## 2. Community Feed

### 2.1 Panoramica

Una nuova pagina `/community` — o sezione nella home — che mostra le predizioni pubbliche (`is_public=true`) in un feed con effetto scroll cinematico.

**API già pronta:** `GET /api/predictions/public` — nessuna modifica backend necessaria.

**Dati disponibili per ogni card:**
- `hash_preview` (prime 8 char dell'hash)
- `keywords` (array, max 3)
- `target_year`
- `mode` (`proof_of_existence` | `sealed_prediction`)
- `created_at`
- `ots_status` (`pending` | `confirmed`)

> Il contenuto delle predizioni **non è mai esposto** — solo metadati. Questo è by design e rispetta l'architettura zero-knowledge.

---

### 2.2 Struttura pagina `/community`

```
/community
├── Header — "The Vault is Open" (titolo + sottotitolo)
├── Filtri — keyword search + filter per anno + filter per mode
├── Feed principale — scroll verticale con cards animate
│   ├── Card predizione pubblica
│   ├── Card predizione pubblica
│   └── ...
├── Load more / infinite scroll
└── CTA — "Add your prediction"
```

---

### 2.3 Design dell'effetto scroll

**Scelta: Vertical staggered feed** con parallax leggero.

Non un semplice elenco: ogni card entra dalla parte inferiore con stagger e rimane visibile con una leggera profondità 3D (rotateX su hover). Effetto ispirato a vault di documenti.

```
┌─────────────────────────────────────────┐
│  Community Vault                         │
│  Predizioni registrate pubblicamente    │
│                                          │
│  [Cerca keyword] [Anno ▼] [Modo ▼]      │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │  🔐 Sealed Prediction           │    │
│  │  #a3f9c2d1...  · 2031          │    │
│  │  [AI] [markets] [finance]       │    │
│  │  ⚡ Bitcoin anchored · Jan 2026 │    │
│  └─────────────────────────────────┘    │
│                                          │
│  ┌─────────────────────────────────┐    │
│  │  👁 Proof of Existence          │    │
│  │  #b7e1a4f2...  · 2028          │    │
│  │  [climate] [energy]             │    │
│  │  ✓ Confirmed block #872143     │    │
│  └─────────────────────────────────┘    │
│                                          │
│          [ Carica altri ]               │
└─────────────────────────────────────────┘
```

**Librerie:** Framer Motion (già installata) per `whileInView` + stagger.

---

### 2.4 Implementazione

**Nuovo file:** `client/src/pages/Community.tsx`

**Aggiornamenti:**
- `client/src/App.tsx` — aggiungere route `/community`
- `client/src/lib/api.ts` — `getPublicPredictions()` già esiste, potrebbe servire cursor-based pagination
- `client/src/pages/Home.tsx` — aggiungere link/CTA verso `/community`

**Componente Card:**
```tsx
// Animazione entry per ogni card
const cardVariants = {
  hidden: { opacity: 0, y: 40, rotateX: -5 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { delay: i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};
```

**Infinite scroll:** Intersection Observer su sentinel div, carica pagina successiva automaticamente.

**Filtri (client-side per primo release, poi query params):**
- Keyword: filtra su `keywords` array
- Anno: `target_year` === selected
- Mode: `proof_of_existence` | `sealed_prediction` | tutti

---

### 2.5 API aggiornamento (opzionale ma raccomandato)

Aggiungere cursor-based pagination per performance con molte predizioni:

```
GET /api/predictions/public?cursor=<last_id>&limit=12&keyword=ai&year=2030
```

Il server ritorna `next_cursor` per la pagina successiva. Più efficiente di `page`+`offset` su grandi dataset.

---

## 3. PDF Certificate

### 3.1 Panoramica

Quando l'utente scarica la `.capsule` o il risultato di verifica, viene generato **in parallelo** un PDF che funge da "certificato di notarizzazione leggibile da umani".

**Principio:** il PDF è un documento di supporto, non la prova crittografica. La prova reale è l'hash + OTS proof + TSA token dentro la capsule.

**Generazione:** **100% client-side** con `@react-pdf/renderer` o `jspdf`. Zero dati nuovi al server.

---

### 3.2 Contenuto del certificato

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   [Logo YouSaidThat]     yousaidthat.org                │
│                                                          │
│   CERTIFICATE OF NOTARIZATION                           │
│   ─────────────────────────────────────────────────     │
│                                                          │
│   This document certifies that the following digital    │
│   content was registered and cryptographically          │
│   timestamped on YouSaidThat.org.                       │
│                                                          │
│   ┌────────────────────────────────────────────────┐   │
│   │  TYPE:    Sealed Prediction / Proof of Exist.  │   │
│   │  DATE:    15 February 2026, 14:32 UTC          │   │
│   │  HASH:    a3f9c2d1b8e7f4a2...  (SHA-256)       │   │
│   │  TARGET:  Year 2031                            │   │
│   │  TOPICS:  AI, markets, finance                 │   │
│   └────────────────────────────────────────────────┘   │
│                                                          │
│   TIMESTAMP PROOFS                                      │
│   ─────────────────────────────────────────────────     │
│   ✓ RFC 3161 TSA (Actalis)     Issued immediately      │
│     Token: [base64 truncato]                           │
│                                                          │
│   ○ OpenTimestamps (Bitcoin)   Pending confirmation    │
│     Status: awaiting Bitcoin block anchoring           │
│     [oppure: Confirmed at block #872143]               │
│                                                          │
│   HOW TO VERIFY                                         │
│   ─────────────────────────────────────────────────     │
│   1. Go to yousaidthat.org/verify                      │
│   2. Enter the SHA-256 hash above                      │
│   3. The system will return the full cryptographic     │
│      proof — blockchain anchor included.               │
│                                                          │
│   For sealed predictions:                              │
│   1. Keep your .capsule file safe                      │
│   2. In year 2031, go to yousaidthat.org/unlock        │
│   3. Upload the .capsule to decrypt and reveal         │
│      the original content                              │
│                                                          │
│   DISCLAIMER                                           │
│   ─────────────────────────────────────────────────     │
│   This certificate is a human-readable summary of      │
│   the cryptographic proof. The authoritative proof     │
│   is the .capsule file and the OTS/TSA tokens.        │
│   YouSaidThat.org does not store your content.        │
│                                                          │
│   ─────────────────────────────────────────────────     │
│   Generated: 15/02/2026  ·  ID: uuid-xxxx-xxxx        │
│                                                          │
└──────────────────────────────────────────────────────┘
```

---

### 3.3 Implementazione

**Libreria scelta: `jspdf` + `jspdf-autotable`**

Motivazione: più leggera di `@react-pdf/renderer`, nessun React renderer separato, bundle più piccolo, matura e stabile.

```bash
npm install jspdf jspdf-autotable
```

**Nuovo file:** `client/src/lib/generateCertificate.ts`

```typescript
import jsPDF from "jspdf";

interface CertificateData {
  predictionId: string;
  hash: string;
  mode: "proof_of_existence" | "sealed_prediction";
  targetYear?: number;
  keywords?: string[];
  createdAt: string;
  tsaToken?: string;
  otsStatus: "pending" | "confirmed" | "failed";
  bitcoinBlock?: number;
}

export function generateCertificatePdf(data: CertificateData): void {
  const doc = new jsPDF({ orientation: "portrait", format: "a4" });
  // ... costruzione documento
  doc.save(`yousaidthat-certificate-${data.predictionId}.pdf`);
}
```

**Integrazione nei punti di download:**

1. **`Create.tsx`** — Step 5 (Seal/Download): dopo il download della `.capsule`, offrire un pulsante "Download Certificate (PDF)" che chiama `generateCertificatePdf()` con i dati della registrazione appena completata.

2. **`Verify.tsx`** — quando una predizione è trovata: pulsante "Download Certificate" che genera il PDF con i dati di verifica.

3. **`Unlock.tsx`** — dopo unlock con successo: PDF con contenuto decriptato incluso nel corpo (solo per `proof_of_existence` — per `sealed_prediction` il PDF contiene il testo rivelato al momento dell'unlock).

---

### 3.4 Comportamento per le due modalità

| Campo | Proof of Existence | Sealed Prediction (pre-unlock) | Sealed Prediction (post-unlock) |
|-------|--------------------|---------------------------------|---------------------------------|
| Contenuto | Incluso nel PDF | NON incluso (hash only) | Incluso nel PDF |
| Hash | ✓ | ✓ | ✓ |
| Data | ✓ | ✓ | ✓ |
| OTS/TSA | ✓ | ✓ | ✓ |
| Istruzioni | Verifica hash | Unlock con .capsule | Attestazione pubblica |

---

## 4. Ordine di esecuzione

```
FASE A — Fix sicurezza (blocca il lancio)
│
├── 1.1  express.json limit            ← 5 min, max priorità
├── 1.2  helmet headers                ← 15 min
├── 1.3  DOMPurify display_name        ← 20 min
└── 1.4  Email hashing client-side     ← 30 min

FASE B — Infrastruttura produzione (prima del lancio)
│
├── 1.6  OTS polling → Vercel Cron     ← 1 ora
└── 1.5  Rate limiting Redis/Upstash   ← 2 ore (opzionale pre-lancio)

FASE C — Feature (post-fix sicurezza)
│
├── 3.x  PDF Certificate               ← 4 ore
│        └── generateCertificate.ts
│        └── Integrazione in Create.tsx + Verify.tsx + Unlock.tsx
│
└── 2.x  Community Feed                ← 6 ore
         └── Community.tsx
         └── Route + nav link
         └── Infinite scroll
         └── Filtri
```

---

## 5. Dipendenze

### Da installare

| Package | Uso | Dove |
|---------|-----|------|
| `helmet` | Security headers | server |
| `isomorphic-dompurify` | XSS sanitization | server |
| `@types/dompurify` | Types per dompurify | server dev |
| `jspdf` | PDF generation | client |
| `jspdf-autotable` | Tabelle in PDF | client |
| `@upstash/ratelimit` | Rate limiting distribuito | server |
| `@upstash/redis` | Redis client per Upstash | server |

### Nuove variabili `.env`

| Variabile | Valore | Note |
|-----------|--------|------|
| `CRON_SECRET` | `<random 32 char>` | Protegge endpoint cron da chiamate esterne |
| `UPSTASH_REDIS_REST_URL` | `https://...upstash.io` | Solo se si implementa 1.5 |
| `UPSTASH_REDIS_REST_TOKEN` | `...` | Solo se si implementa 1.5 |

### Stesse variabili da aggiungere su Vercel Dashboard

Una volta in produzione, tutte le variabili del `.env` devono essere replicate in:
> Vercel Dashboard → Project → Settings → Environment Variables

In particolare per il cron: `CRON_SECRET` deve essere la stessa usata in locale.

---

## Note finali

- I fix **1.1 → 1.4** sono prerequisiti per il lancio. Effort totale: ~1 ora.
- Il **PDF** e la **Community** sono feature indipendenti, sviluppabili in parallelo dopo i fix.
- Il rate limiting Redis (**1.5**) può essere posticipato al lancio se il traffico iniziale è basso — ma va implementato prima di qualsiasi promozione pubblica.
- Il **cron OTS** (**1.6**) è bloccante per la promessa del prodotto: senza Bitcoin anchoring confermato, la funzione principale non funziona correttamente.
