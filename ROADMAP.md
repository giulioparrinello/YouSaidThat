# YouSaidThat — Roadmap operativo

> Stato: **pre-launch** · Ultimo aggiornamento: 2026-02-22

---

## Legenda

| Simbolo | Significato |
|---------|-------------|
| ✅ | Completato |
| 🔄 | In corso |
| ❌ | Da fare |
| ⚠️ | Bug / problema noto |
| 🔒 | Bloccante per il lancio |

---

## Architettura — Le due modalità

> Chiarimento architetturale v2 (2026-02-22). Sostituisce la distinzione `full_phrase / flickered`.

### Modalità 1 — Proof of Existence
- L'utente scrive un testo **o carica un PDF**
- Sceglie visibilità: pubblica (community feed) o privata
- Il sistema ancora l'hash su Bitcoin via OTS
- L'utente scarica un **certificato** che prova che quel contenuto esisteva in quella data
- Può inserire un anno di riferimento come **metadata** (non un lock) → notifica email in quell'anno
- Il testo è **accessibile da subito**, nessuna cifratura obbligatoria
- Core: **prova di QUANDO**, non segreto su COSA

### Modalità 2 — Sealed Prediction
- L'utente scrive un testo e inserisce un **anno target** (es. 2050)
- Il browser cifra il testo client-side con AES-256-GCM, genera keypair RSA
- Calcola l'hash del testo in chiaro e lo ancora su Bitcoin
- Il server **non vede mai** il contenuto
- L'utente scarica una `.capsule` (testo cifrato, chiave privata, hash, proof OTS, token TSA, anno target)
- Nel 2050 carica la capsule su `/unlock`, il browser decifra e verifica
- Il blocco temporale è un **gate di interfaccia**, non crittografico (da comunicare onestamente)
- Core: **prova di QUANDO + segretezza ragionevole su COSA** fino all'anno target

### Rimozione "flickered"
- Il concetto `flickered` è **rimosso** come funzione standalone
- La distinzione `full_phrase / flickered` è sostituita da `proof_of_existence / sealed_prediction`
- La colonna `type` nel DB è stata sostituita con `mode`

---

## FASE 0 — Infrastruttura & Configurazione

| # | Task | Stato | Note |
|---|------|-------|------|
| 0.1 | `DATABASE_URL` da Supabase | ✅ | `postgresql://postgres.rncxqhiyglvjjuhscosy:***@pooler.supabase.com:6543/postgres` |
| 0.2 | File `.env` creato | ✅ | |
| 0.3 | Tutte le variabili d'ambiente compilate | ✅ | `RESEND_API_KEY` configurata |
| 0.4 | Schema DB deployato su Supabase | ✅ | 3 tabelle create con indici e constraints |
| 0.5 | Tabelle verificate su Supabase | ✅ | `predictions`, `attestations`, `email_queue` |
| 0.6 | Migrazione `type → mode` applicata | ✅ | `mode`: `proof_of_existence` / `sealed_prediction` |

### Variabili d'ambiente

| Variabile | Stato |
|-----------|-------|
| `DATABASE_URL` | ✅ |
| `OTS_CALENDAR_URL_1` | ✅ |
| `OTS_CALENDAR_URL_2` | ✅ |
| `TSA_URL` | ✅ |
| `RESEND_API_KEY` | ✅ |
| `EMAIL_FROM` | ⚠️ richiede dominio verificato su Resend |
| `NODE_ENV` | ✅ |
| `PORT` | ✅ |
| `VITE_API_URL` | ❌ da impostare in produzione |

---

## FASE 1 — Bug critici da fixare prima del lancio

| # | Task | Stato | Priorità | File |
|---|------|-------|----------|------|
| 1.1 | **Email in chiaro** — `email_queue` salva email raw. Cambiare: frontend invia `email_hash` (SHA-256), backend salva solo hash. Email usata una volta lato client per Resend, poi non salvata. | ✅ | Alta | `shared/schema.ts`, `server/routes.ts`, `client/src/pages/Create.tsx` |
| 1.2 | **Endpoint `GET /api/attestations/:id`** — aggiunto ✅ | ✅ | Alta | `server/routes.ts` |
| 1.3 | **`email_queue` manca `email_hash`** — schema attuale ha campo `email` raw | ✅ | Alta | `shared/schema.ts`, migrazione DB |
| 1.4 | **`GET /health`** health check endpoint | ✅ | Media | `server/routes.ts` |
| 1.5 | **Transazioni atomiche** — `register` inserisce in `predictions` e `email_queue` in operazioni separate | ✅ | Media | `server/routes.ts` |

---

## FASE 2 — API & Backend (MVP)

| # | Endpoint | Stato | Note |
|---|----------|-------|------|
| 2.1 | `POST /api/predictions/register` | ✅ | Ora accetta `mode` invece di `type` |
| 2.2 | `GET /api/predictions/public` | ✅ | Filtra solo `mode=proof_of_existence` + `is_public=true` |
| 2.3 | `GET /api/predictions/verify?hash=` | ✅ | Ritorna `mode` al posto di `type` |
| 2.4 | `POST /api/predictions/claim` | ✅ | Year gate server-side, RSA-PSS verify |
| 2.5 | `GET /api/predictions/:id` | ✅ | Metadati con `mode` |
| 2.6 | `GET /api/predictions/:id/ots-status` | ✅ | Polling OTS |
| 2.7 | `GET /api/attestations/:id` | ✅ | **Aggiunto** — ritorna attestation + prediction annessa |
| 2.8 | `GET /health` | ✅ | **Aggiunto** |
| 2.9 | Supporto hash PDF (Modalità 1) | ✅ | Backend riceve solo hash — il frontend calcola SHA-256 del binario PDF |

---

## FASE 3 — Servizi esterni

| # | Servizio | Stato | Note |
|---|----------|-------|------|
| 3.1 | OpenTimestamps — submit hash | ✅ | `server/services/ots.ts` |
| 3.2 | OTS polling ogni 6h | ✅ | `server/services/cron.ts` — solo `NODE_ENV=production` |
| 3.3 | TSA Actalis RFC 3161 | ✅ | `server/services/tsa.ts` |
| 3.4 | Resend email — reminder annuale | ✅ | `server/services/email.ts` |
| 3.5 | **Dominio verificato su Resend** | ❌ 🔒 | Aggiungere `yousaidthat.org` su resend.com |
| 3.6 | Testare TSA Actalis in produzione | ❌ | Request di test manuale |
| 3.7 | Testare OTS submission | ❌ | Submit hash di test, verificare risposta |

---

## FASE 4 — Frontend & UX

> ⚠️ Il frontend va aggiornato per riflettere la distinzione modale. Le pagine attuali usano ancora `type` (full_phrase/flickered).

| # | Pagina / Feature | Stato | Note |
|---|-----------------|-------|------|
| 4.1 | **Home.tsx** — comunicare le due modalità chiaramente | ✅ | Sezione "Two Modes" + HOW_IT_WORKS corretti |
| 4.2 | **Create.tsx** — selezione modalità come **primo step** | ✅ | Step 0: scelta `proof_of_existence` / `sealed_prediction` |
| 4.3 | **Create.tsx Modalità 1** — upload PDF + hash binario | ✅ | `hashBinary()` via WebCrypto, file mai caricato |
| 4.4 | **Create.tsx** — inviare `mode` invece di `type` al backend | ✅ | Aggiornato |
| 4.5 | **Unlock.tsx** — solo per Modalità 2 | ✅ | Guard aggiunto, `capsule.mode` corretto |
| 4.6 | **Verify.tsx** — mostrare `mode` nei risultati | ✅ | Sostituito `type` con `mode` |
| 4.7 | **Attestation.tsx** — usare `GET /api/attestations/:id` | ✅ | Ora usa `api.getAttestation()` correttamente |
| 4.8 | **Polling OTS** dopo registrazione — re-download capsule | ✅ | `useEffect` polling ogni 30s, badge dinamico, re-download con OTS proof |
| 4.9 | **Pagina Privacy Policy** | ✅ | `/privacy` — plain-language GDPR policy |
| 4.10 | **404 page** | ✅ | |

---

## FASE 5 — Sicurezza & Rate Limiting

| # | Task | Stato |
|---|------|-------|
| 5.1 | Rate limiter `POST /register` (10/min, 100/day) | ✅ |
| 5.2 | Rate limiter `POST /claim` (5/ora) | ✅ |
| 5.3 | Rate limiter GET endpoints (100/min) | ✅ |
| 5.4 | Input sanitization — Zod validation | ✅ |
| 5.5 | Parameterized queries (Drizzle ORM) | ✅ |
| 5.6 | Nessun IP log permanente | ✅ |
| 5.7 | CORS configurato per produzione | ✅ |
| 5.8 | HTTPS enforced in produzione | ❌ |

---

## FASE 6 — Deploy

| # | Task | Stato | Note |
|---|------|-------|------|
| 6.1 | `vercel.json` configurato | ✅ | |
| 6.2 | Build locale (`npm run build`) | ✅ | Build OK, 0 TypeScript errors |
| 6.3 | Variabili d'ambiente su Vercel | ❌ | Dashboard → Settings → Env Vars |
| 6.4 | Deploy su Vercel + test `/health` | ❌ | |
| 6.5 | Dominio `yousaidthat.org` su Vercel | ❌ | |
| 6.6 | Cron job in produzione | ⚠️ | Vercel serverless non supporta long-running process → valutare **Vercel Cron** o **pg_cron su Supabase** |
| 6.7 | Test E2E in staging (Create → Verify → Unlock → Claim) | ❌ | |

---

## FASE 7 — Post-lancio (Phase 2 PRD)

| # | Task | Stato |
|---|------|-------|
| 7.1 | Admin dashboard — monitor OTS confirmation rates | ❌ |
| 7.2 | IPFS fallback per storage capsule | ❌ |
| 7.3 | pg_cron su Supabase per scheduling distribuito | ❌ |
| 7.4 | OpenAPI / Swagger docs | ❌ |
| 7.5 | Test suite (unit + integration) | ❌ |

---

## Ordine di esecuzione consigliato

```
✅ FASE 0 completa
       ↓
1.1 + 1.3    ← fix email (schema DB + codice)
       ↓
4.2 + 4.4    ← frontend: selezione modale + invio campo corretto
       ↓
4.1 + 4.3    ← home page + upload PDF (Modalità 1)
       ↓
4.5 + 4.6 + 4.7   ← Unlock, Verify, Attestation aggiornati
       ↓
3.5 + 3.6 + 3.7   ← verifica servizi esterni
       ↓
5.7 + 5.8         ← CORS + HTTPS
       ↓
6.2 → 6.3 → 6.4 → 6.5 → 6.7   ← deploy
```

---

## Progresso complessivo

| Fase | Completamento |
|------|:-------------:|
| 0 — Infrastruttura | 6 / 6 ✅ |
| 1 — Bug critici | 5 / 5 ✅ |
| 2 — API Backend | 9 / 9 ✅ |
| 3 — Servizi esterni | 4 / 7 |
| 4 — Frontend | 10 / 10 ✅ |
| 5 — Sicurezza | 7 / 8 |
| 6 — Deploy | 2 / 7 |
| 7 — Post-lancio | 0 / 5 |
| **Totale** | **43 / 57** |
