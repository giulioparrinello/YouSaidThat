**YouSaidThat.org**

PRD --- Backend & Technical Architecture

*For: Opus 4.6 (Backend Implementation)*

v1.0 --- February 2026

**1. System Overview**

YouSaidThat.org is a privacy-first prediction notarization platform. The backend\'s role is deliberately minimal: store hashes and cryptographic proofs, never content. The system must be trustworthy precisely because it cannot read, modify, or delete any prediction content.

The backend handles: prediction metadata registration, OpenTimestamps batch anchoring, email relay for reminders, public attestation storage, and verification endpoints. Everything else --- encryption, key generation, capsule creation, decryption --- happens client-side in the browser.

**1.1 Core Constraints**

- Server NEVER receives or stores plaintext prediction content.

- Server NEVER receives or stores private keys.

- Server NEVER receives raw email addresses --- only SHA-256 hashes of emails.

- No user accounts. No authentication required for basic flows.

- All endpoints are stateless where possible.

- The system must be horizontally scalable with no session state.

**2. Recommended Tech Stack**

**2.1 Core**

- Runtime: Node.js 20 LTS with TypeScript.

- Framework: Fastify (preferred over Express for performance and schema validation) or Next.js API Routes if the frontend team prefers a monorepo.

- Database: Supabase (PostgreSQL) --- already used by the product owner for other projects. Provides managed Postgres, row-level security, and a REST/realtime layer.

- ORM: Drizzle ORM or Supabase client directly. Drizzle preferred for type safety.

- Email: Resend or Postmark for transactional email (reminder notifications).

- Queue: Supabase pg_cron or a lightweight queue (BullMQ on Redis) for OTS batch processing.

**2.2 External Services**

- OpenTimestamps: Public calendar servers at https://alice.btc.calendar.opentimestamps.org and https://bob.btc.calendar.opentimestamps.org. Batch submission, confirmation polling.

- TSA RFC 3161: Actalis Free TSA (https://tsa.actalis.it/TSA/tss-usr-gen) for qualified timestamps. Free tier available.

- IPFS (optional, v2): Store encrypted capsule content for redundancy. Not required for MVP.

**2.3 Hosting**

- API: Railway, Render, or Fly.io. Alternatively Vercel Serverless Functions if co-deployed with Next.js frontend.

- Database: Supabase managed instance. Free tier sufficient for MVP.

- Estimated monthly cost at MVP scale (\< 10k predictions/month): under 20 EUR.

**3. Database Schema**

**3.1 Table: predictions**

Stores the public metadata of each registered prediction. Never stores content.

|               |             |                                                      |
|---------------|-------------|------------------------------------------------------|
| **Column**    | **Type**    | **Description**                                      |
| id            | UUID        | Primary key, generated server-side                   |
| hash          | TEXT        | SHA-256 of original plaintext. Unique.               |
| type          | TEXT        | \'full_phrase\' or \'flickered\'                     |
| target_year   | INTEGER     | Year the prediction is sealed until                  |
| keywords      | TEXT\[\]    | Up to 3 optional keywords                            |
| email_hash    | TEXT        | SHA-256 of email (nullable). Never raw email.        |
| ots_status    | TEXT        | \'pending\', \'confirmed\', \'failed\'               |
| ots_proof     | BYTEA       | Serialized OTS proof blob (nullable until confirmed) |
| tsa_token     | BYTEA       | RFC 3161 TSA response token (nullable)               |
| bitcoin_block | INTEGER     | Bitcoin block height of anchoring (nullable)         |
| timestamp_utc | TIMESTAMPTZ | Server time of registration                          |
| is_public     | BOOLEAN     | Whether to show on landing page. Default false.      |
| created_at    | TIMESTAMPTZ | Auto-generated                                       |

> *The hash column has a UNIQUE constraint. Duplicate hash submissions return the existing record (idempotent registration).*

**3.2 Table: attestations**

Stores optional public identity claims --- when a user reveals themselves as the author of a prediction after the target year.

|                 |             |                                     |
|-----------------|-------------|-------------------------------------|
| **Column**      | **Type**    | **Description**                     |
| id              | UUID        | Primary key                         |
| prediction_id   | UUID        | FK to predictions.id                |
| display_name    | TEXT        | Name or handle chosen by claimer    |
| public_key      | TEXT        | User\'s public key (PEM)            |
| signature       | TEXT        | Signature of hash using private key |
| attestation_url | TEXT        | Shareable URL for this attestation  |
| created_at      | TIMESTAMPTZ | Auto-generated                      |

> *Signature verification: backend verifies that signature = Sign(hash, private_key) matches public_key before storing. This prevents fake claims.*

**3.3 Table: email_queue**

Stores hashed emails for reminder notifications. Processed annually.

|               |             |                                   |
|---------------|-------------|-----------------------------------|
| **Column**    | **Type**    | **Description**                   |
| id            | UUID        | Primary key                       |
| prediction_id | UUID        | FK to predictions.id              |
| email_hash    | TEXT        | SHA-256 of email address          |
| target_year   | INTEGER     | Year to send reminder             |
| sent_at       | TIMESTAMPTZ | Null until sent                   |
| status        | TEXT        | \'pending\', \'sent\', \'failed\' |

> *The email_hash cannot be used to send emails directly. The system stores the hash, but the user must have provided their email during registration. At reminder time, the system matches email_hash to a separate (encrypted, isolated) email lookup table --- or the email is sent via a separate privacy-preserving mechanism. Implementation detail left to Opus.*

**4. API Endpoints**

All endpoints return JSON. All POST endpoints require Content-Type: application/json. No authentication required for MVP (rate limiting applies).

**4.1 Endpoint Summary**

|            |                           |                                                      |
|------------|---------------------------|------------------------------------------------------|
| **Method** | **Path**                  | **Description**                                      |
| **POST**   | /api/predictions/register | Register a new prediction hash                       |
| **GET**    | /api/predictions/public   | List public prediction metadata for landing page     |
| **GET**    | /api/predictions/verify   | Verify a prediction hash and return OTS proof        |
| **POST**   | /api/predictions/claim    | Submit a public identity attestation                 |
| **GET**    | /api/predictions/:id      | Get a single prediction\'s public metadata           |
| **POST**   | /api/ots/callback         | Internal: OTS confirmation webhook (cron or polling) |

**4.2 POST /api/predictions/register**

**Request Body**

> {
>
> \"hash\": \"string (SHA-256, 64 hex chars) --- REQUIRED\",
>
> \"type\": \"full_phrase\" \| \"flickered\" --- REQUIRED\",
>
> \"target_year\": \"integer (next year to +50) --- REQUIRED\",
>
> \"keywords\": \[\"string\", \...\] (max 3, max 30 chars each) --- optional\",
>
> \"email_hash\": \"string (SHA-256 of email, 64 hex chars) --- optional\",
>
> \"is_public\": \"boolean --- default false\"
>
> }

**Response 201 Created**

> {
>
> \"prediction_id\": \"uuid\",
>
> \"hash\": \"string\",
>
> \"ots_status\": \"pending\",
>
> \"tsa_token\": \"base64 string (RFC 3161 token, generated immediately)\",
>
> \"created_at\": \"ISO 8601 UTC\"
>
> }

**Response 200 OK (duplicate hash --- idempotent)**

> { \"prediction_id\": \"uuid\", \"hash\": \"string\", \"ots_status\": \"pending\|confirmed\", \... }

**Validation**

- hash: must be exactly 64 hex characters.

- target_year: must be an integer \>= current year + 1 and \<= current year + 50.

- keywords: array, max 3 items, each item max 30 chars, alphanumeric + spaces only.

- email_hash: if provided, must be exactly 64 hex characters.

**Side Effects**

- Submit hash to OpenTimestamps batch calendar. Store pending OTS job.

- Generate and store RFC 3161 TSA token immediately (synchronous call to Actalis TSA).

- If email_hash provided: create row in email_queue for target_year reminder.

**4.3 GET /api/predictions/public**

**Query Parameters**

- page (integer, default 1), limit (integer, default 20, max 50)

- keyword (string, optional filter)

- year (integer, optional filter)

**Response 200**

> {
>
> \"predictions\": \[
>
> {
>
> \"id\": \"uuid\",
>
> \"hash_preview\": \"a3f9c2d1 (first 8 chars of hash)\",
>
> \"target_year\": 2030,
>
> \"keywords\": \[\"AI\", \"market\"\],
>
> \"type\": \"flickered\",
>
> \"created_at\": \"ISO 8601\"
>
> }
>
> \],
>
> \"total\": 142,
>
> \"page\": 1,
>
> \"limit\": 20
>
> }
>
> *Only predictions where is_public = true are returned. Full hash is never exposed in list view.*

**4.4 GET /api/predictions/verify**

**Query Parameters**

- hash (string, required) --- full 64-char SHA-256

**Response 200 (found)**

> {
>
> \"found\": true,
>
> \"prediction_id\": \"uuid\",
>
> \"hash\": \"full sha-256\",
>
> \"target_year\": 2028,
>
> \"keywords\": \[\"energy\", \"solar\"\],
>
> \"type\": \"full_phrase\",
>
> \"ots_confirmed\": true,
>
> \"bitcoin_block\": 872143,
>
> \"timestamp_utc\": \"2026-02-15T14:32:11Z\",
>
> \"tsa_token\": \"base64 RFC 3161 token\",
>
> \"ots_proof\": \"base64 OTS proof blob\"
>
> }

**Response 200 (not found)**

> { \"found\": false }

**4.5 POST /api/predictions/claim**

**Request Body**

> {
>
> \"hash\": \"string (SHA-256, 64 hex chars) --- REQUIRED\",
>
> \"public_key\": \"string (PEM RSA-OAEP 2048 public key) --- REQUIRED\",
>
> \"signature\": \"string (base64, RSA-PSS signature of hash using private key) --- REQUIRED\",
>
> \"display_name\": \"string (max 100 chars) --- REQUIRED\"
>
> }

**Validation**

- Verify prediction with hash exists in DB.

- Verify current year \>= target_year of the prediction (server-side enforcement --- claim only allowed after target year).

- Verify RSA-PSS signature: decode public_key, verify signature against hash. Reject if invalid.

- One claim per hash (unique constraint on prediction_id in attestations table).

**Response 201**

> {
>
> \"attestation_id\": \"uuid\",
>
> \"attestation_url\": \"https://yousaidthat.org/attestation/{id}\",
>
> \"display_name\": \"string\",
>
> \"hash\": \"string\",
>
> \"timestamp_verified\": \"ISO 8601 UTC\",
>
> \"bitcoin_block\": 872143
>
> }

**5. OpenTimestamps Integration**

**5.1 Submission**

When a prediction is registered, the hash is submitted to the OTS public calendar server for batch anchoring. The OTS client library (JavaScript/Python) handles batching transparently.

- Submit hash to: https://alice.btc.calendar.opentimestamps.org and https://bob.btc.calendar.opentimestamps.org (dual submission for redundancy).

- Store the serialized incomplete proof (pending confirmation) in the predictions table as ots_proof with ots_status = \'pending\'.

**5.2 Confirmation Polling**

Bitcoin block confirmation takes 1--24 hours. A background job must poll for upgrades:

- Run every 6 hours via Supabase pg_cron or a cron job.

- For all predictions with ots_status = \'pending\', attempt to upgrade the OTS proof using the calendar server.

- On successful upgrade: update ots_proof with the complete proof, set ots_status = \'confirmed\', record bitcoin_block.

- On failure after 7 days: set ots_status = \'failed\', trigger re-submission.

**5.3 Proof Delivery**

When ots_status transitions to \'confirmed\', the prediction_id is flagged. On the next time the user calls GET /api/predictions/verify for this hash, the complete OTS proof is returned so the user can update their local .capsule file.

> *Consider adding a webhook or polling endpoint: GET /api/predictions/:id/ots-status so the frontend can poll for OTS confirmation and prompt the user to re-download an updated .capsule.*

**6. RFC 3161 TSA Integration**

Unlike OTS (which takes hours), the TSA token is generated synchronously during registration. This gives the user immediate, legally-recognized proof of existence.

- Provider: Actalis Free TSA --- https://tsa.actalis.it/TSA/tss-usr-gen

- Process: POST a DER-encoded TimeStampRequest with the SHA-256 hash of the prediction. Receive a signed TimeStampResponse.

- Store the raw TSA response bytes in the predictions.tsa_token column.

- Return the base64-encoded token in the registration response so the frontend can embed it in the .capsule file immediately.

> *Node.js implementation: use the \'node-forge\' library or \'pkijs\' for constructing RFC 3161 requests. The Actalis endpoint is free and does not require registration for low-volume use.*

**7. Security & Privacy**

**7.1 Rate Limiting**

- POST /api/predictions/register: 10 requests per IP per minute, 100 per day.

- POST /api/predictions/claim: 5 requests per IP per hour.

- GET endpoints: 100 requests per IP per minute.

- Implement via Fastify rate-limit plugin or Cloudflare WAF rules.

**7.2 Input Sanitization**

- All string inputs sanitized before DB insertion (Drizzle ORM parameterized queries prevent SQLi).

- Keywords: strip HTML, allow only alphanumeric + spaces + hyphens.

- display_name in attestations: strip HTML, max 100 chars.

- public_key: validate as valid PEM format before storing.

**7.3 What the Server Cannot Do**

This is a design constraint, not just a security note. The server:

- Cannot read any prediction content --- it only stores hashes.

- Cannot identify users --- no accounts, no raw emails, no IP logs retained.

- Cannot reverse a hash --- SHA-256 is one-way.

- Cannot forge an OTS proof --- the proof is anchored in Bitcoin.

- Cannot delete a Bitcoin timestamp --- once anchored, it is permanent.

**7.4 Legal / GDPR**

- No personal data stored in plain text.

- email_hash is not personal data under GDPR (irreversible hash with no rainbow table risk at this scale).

- No cookies, no tracking pixels, no analytics in MVP.

- Add a Privacy Policy page noting: no content stored, no identity linked, email hash only for reminders.

**8. Shared Contracts with Frontend**

This section defines the exact data structures shared between the frontend (Gemini) and backend (Opus). Both must implement these contracts identically.

**8.1 .capsule File Schema**

The .capsule file is generated by the frontend and never sent to the server. However, the backend returns data (tsa_token, prediction_id, ots_proof) that the frontend must embed into the capsule after registration. The agreed schema is:

> {
>
> \"version\": \"1.0\",
>
> \"type\": \"full_phrase\" \| \"flickered\",
>
> \"target_year\": 2030,
>
> \"keywords\": \[\"string\", \...\],
>
> \"hash\": \"\<SHA-256 of plaintext, 64 hex chars\>\",
>
> \"public_key\": \"\<RSA-OAEP 2048 public key, PEM\>\",
>
> \"private_key\": \"\<RSA-OAEP 2048 private key, PEM\>\",
>
> \"encrypted_content\": \"\<AES-256-GCM ciphertext, base64\>\",
>
> \"nonce\": \"\<AES-GCM nonce, 12 bytes, base64\>\",
>
> \"ots_proof\": \"\<base64 OTS proof blob, null if pending\>\",
>
> \"tsa_token\": \"\<base64 RFC 3161 token\>\",
>
> \"created_at\": \"\<ISO 8601 UTC\>\",
>
> \"prediction_id\": \"\<UUID from backend\>\"
>
> }
>
> *For flickered type: encrypted_content, private_key may be null. The full plaintext is never stored in the file or on the server.*

**8.2 Crypto Specification**

Both frontend and backend must agree on the following crypto parameters to ensure interoperability:

- Hash function: SHA-256 (WebCrypto: SHA-256). Applied to UTF-8 encoded plaintext.

- Asymmetric key: RSA-OAEP, 2048-bit, hash: SHA-256. Generated via window.crypto.subtle.generateKey.

- Symmetric encryption: AES-256-GCM. Key derived from password or randomly generated. 12-byte random nonce.

- Signature (for attestation claim): RSA-PSS, SHA-256, saltLength: 32.

- All binary data (keys, proofs, ciphertext) serialized as base64 in the capsule file.

**9. Email Reminder System**

Users who provide an email during prediction creation receive a reminder in the year their prediction\'s target year arrives.

- Email addresses are NEVER stored in plain text. The system stores only email_hash (SHA-256).

- At registration time, the raw email is used once to queue the reminder via the email provider, then discarded.

- Cron job runs on January 1 of each year: query email_queue for rows with target_year = current_year and status = \'pending\'. Send reminder via Resend/Postmark. Mark as sent.

- Email content: \'Your prediction from \[year\] can now be unlocked at yousaidthat.org/unlock. Your .capsule file is required.\'

- No prediction content, no hash, no personal data in the email body.

**10. MVP Scope & Phasing**

**Phase 1 --- MVP (implement first)**

- POST /api/predictions/register with TSA integration (synchronous) and OTS submission (async).

- GET /api/predictions/public for landing page feed.

- GET /api/predictions/verify for verification page.

- OTS polling job (every 6 hours).

- Email reminder queue (cron job January 1 each year).

- Basic rate limiting.

- Supabase schema deployed and seeded.

**Phase 2 --- Post-launch**

- POST /api/predictions/claim (attestation system).

- GET /api/predictions/:id/ots-status (polling endpoint for frontend).

- Admin dashboard (internal) to monitor OTS confirmation rates.

- IPFS fallback for capsule storage.

**11. Environment Variables**

|                           |                                                      |
|---------------------------|------------------------------------------------------|
| **Variable**              | **Description**                                      |
| DATABASE_URL              | Supabase PostgreSQL connection string                |
| SUPABASE_SERVICE_ROLE_KEY | Supabase service role key for server-side operations |
| OTS_CALENDAR_URL_1        | https://alice.btc.calendar.opentimestamps.org        |
| OTS_CALENDAR_URL_2        | https://bob.btc.calendar.opentimestamps.org          |
| TSA_URL                   | https://tsa.actalis.it/TSA/tss-usr-gen               |
| RESEND_API_KEY            | Transactional email API key                          |
| EMAIL_FROM                | Sender address (e.g. noreply@yousaidthat.org)        |
| RATE_LIMIT_WINDOW_MS      | Rate limit window in ms (default: 60000)             |
| NODE_ENV                  | development \| production                            |

**12. Frontend--Backend Integration Checklist**

When the frontend (Gemini) implementation is complete and handed to Opus for backend integration, verify the following:

- Frontend sends hash as 64-char lowercase hex string --- backend validates format.

- Frontend embeds tsa_token from registration response into .capsule file immediately after POST /register.

- Frontend polls GET /api/predictions/:id/ots-status after registration and offers re-download of updated .capsule when ots_status transitions to \'confirmed\'.

- Frontend signature for attestation uses RSA-PSS with SHA-256 and saltLength 32 --- backend verifies with same parameters.

- Frontend sends email_hash as SHA-256 of lowercase-trimmed email --- backend stores as-is.

- Frontend does NOT send raw email to any endpoint.

- Frontend year gate on /unlock uses client clock --- this is intentional and documented as a UX gate, not a cryptographic guarantee.

- Backend year gate on POST /claim uses server clock --- this IS a cryptographic enforcement.
