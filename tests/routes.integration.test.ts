import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer, type Server } from "http";
import { randomUUID } from "crypto";
import { hashText, generateKeyPair, signHash } from "../client/src/lib/crypto";

// Integration tests: real Express app (helmet, CORS, body parsing, rate limiters,
// routes) over real HTTP. Only the storage layer and external services
// (TSA/OTS/Arweave/email) are replaced, so no DB or network is needed.

process.env.NODE_ENV = "production"; // production CSP; VERCEL=1 skips static/cron/listen
process.env.VERCEL = "1";
process.env.ADMIN_SECRET = "test-admin-secret";
process.env.CRON_SECRET = "test-cron-secret";

// ─── In-memory storage ────────────────────────────────────────────────────────

interface Row {
  [key: string]: unknown;
  id: string;
  hash: string;
  is_public: boolean;
  content: string | null;
}

const predictionsById = new Map<string, Row>();
const attestationsById = new Map<string, Row>();
const waitlistByEmail = new Map<string, Row>();
const votes = new Map<string, "like" | "dislike">(); // `${predictionId}:${fingerprint}`

vi.mock("../server/storage", () => ({
  storage: {
    async getStats() {
      return { total: predictionsById.size };
    },
    async getAdminStats() {
      return { total: predictionsById.size, otsByStatus: {}, arweaveByStatus: {} };
    },
    async getPredictionByHash(hash: string) {
      return [...predictionsById.values()].find((p) => p.hash === hash) ?? null;
    },
    async getPredictionById(id: string) {
      return predictionsById.get(id) ?? null;
    },
    async registerPredictionWithEmail(data: Record<string, unknown>) {
      const row: Row = {
        id: randomUUID(),
        created_at: new Date(),
        timestamp_utc: new Date(),
        bitcoin_block: null,
        arweave_tx_id: null,
        content: null,
        ...data,
      } as Row;
      predictionsById.set(row.id, row);
      return row;
    },
    async updateOtsStatus() {},
    async updateArweaveStatus() {},
    async getPublicPredictions() {
      const rows = [...predictionsById.values()].filter((p) => p.is_public);
      return { predictions: rows, total: rows.length };
    },
    async getVoteCounts(predictionId: string) {
      let likes = 0;
      let dislikes = 0;
      for (const [key, type] of votes) {
        if (!key.startsWith(`${predictionId}:`)) continue;
        if (type === "like") likes++;
        else dislikes++;
      }
      return { likes, dislikes };
    },
    async getMyVote(predictionId: string, fingerprint: string) {
      return votes.get(`${predictionId}:${fingerprint}`) ?? null;
    },
    async upsertVote(predictionId: string, voteType: "like" | "dislike", fingerprint: string) {
      votes.set(`${predictionId}:${fingerprint}`, voteType);
    },
    async removeVote(predictionId: string, fingerprint: string) {
      votes.delete(`${predictionId}:${fingerprint}`);
    },
    async revealPrediction(id: string, data: { content?: string; is_public: boolean }) {
      const row = predictionsById.get(id);
      if (!row) return;
      if (data.content) row.content = data.content;
      row.is_public = data.is_public;
    },
    async getAttestationByPredictionId(predictionId: string) {
      return (
        [...attestationsById.values()].find((a) => a.prediction_id === predictionId) ?? null
      );
    },
    async getAttestationById(id: string) {
      return attestationsById.get(id) ?? null;
    },
    async insertAttestation(data: Record<string, unknown>) {
      const row: Row = { created_at: new Date(), ...data } as Row;
      attestationsById.set(row.id, row);
      return row;
    },
    async getWaitlistEntryByEmail(email: string) {
      return waitlistByEmail.get(email) ?? null;
    },
    async insertWaitlistEntry(email: string) {
      const row: Row = { id: randomUUID(), email } as unknown as Row;
      waitlistByEmail.set(email, row);
      return row;
    },
    async confirmEmailByToken() {
      return false;
    },
    async getPendingArweaveUploads() {
      return [];
    },
  },
}));

vi.mock("../server/services/tsa", () => ({
  requestTsaToken: vi.fn(async () => "dGVzdC10c2EtdG9rZW4="),
}));

vi.mock("../server/services/ots", () => ({
  submitToOts: vi.fn(async () => null),
}));

vi.mock("../server/services/arweave", () => ({
  uploadContent: vi.fn(async () => null),
  getArweaveBalance: vi.fn(async () => ({ ar: "0", winston: "0" })),
  getArweaveAddress: vi.fn(async () => "test-address"),
  retryPendingUploads: vi.fn(async () => 0),
}));

vi.mock("../server/services/email", () => ({
  sendWaitlistConfirmationEmail: vi.fn(async () => {}),
  sendEmailConfirmationRequest: vi.fn(async () => {}),
  sendPredictionConfirmationEmail: vi.fn(async () => {}),
}));

vi.mock("../server/services/cron", () => ({
  pollOtsStatus: vi.fn(async () => 0),
  startCronJobs: vi.fn(),
}));

// ─── Server lifecycle ─────────────────────────────────────────────────────────

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { default: app } = await import("../server/index");
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No server address");
  baseUrl = `http://127.0.0.1:${address.port}`;

  // Routes are registered by an async init inside server/index — wait for them
  for (let i = 0; i < 50; i++) {
    const res = await fetch(`${baseUrl}/health`).catch(() => null);
    if (res && res.status !== 404) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Routes never became available");
}, 20000);

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
});

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("reports ok with db connected", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.db).toBe("connected");
  });
});

describe("security headers and CORS", () => {
  it("sets CSP, HSTS and X-Frame headers", async () => {
    const res = await fetch(`${baseUrl}/health`);
    const csp = res.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=31536000");
  });

  it("does not echo Access-Control-Allow-Origin for unknown origins", async () => {
    const res = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "https://evil.example.com" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("allows the production origin", async () => {
    const res = await fetch(`${baseUrl}/health`, {
      headers: { Origin: "https://yousaidthat.org" },
    });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://yousaidthat.org");
  });
});

describe("POST /api/predictions/register", () => {
  it("registers a proof of existence and returns the TSA token", async () => {
    const hash = await hashText("integration test content");
    const res = await post("/api/predictions/register", {
      hash,
      mode: "proof_of_existence",
      is_public: false,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.prediction_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.hash).toBe(hash);
    expect(body.tsa_token).toBe("dGVzdC10c2EtdG9rZW4=");
    expect(body.ots_status).toBe("pending");
  });

  it("is idempotent: re-registering the same hash returns the existing record", async () => {
    const hash = await hashText("idempotency check");
    const first = await post("/api/predictions/register", {
      hash,
      mode: "proof_of_existence",
      is_public: false,
    });
    expect(first.status).toBe(201);
    const firstBody = await first.json();

    const second = await post("/api/predictions/register", {
      hash,
      mode: "proof_of_existence",
      is_public: false,
    });
    expect(second.status).toBe(200);
    const secondBody = await second.json();
    expect(secondBody.prediction_id).toBe(firstBody.prediction_id);
  });

  it("rejects a malformed hash", async () => {
    const res = await post("/api/predictions/register", {
      hash: "not-a-hash",
      mode: "proof_of_existence",
      is_public: false,
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/predictions/verify", () => {
  it("rejects an invalid hash format", async () => {
    const res = await fetch(`${baseUrl}/api/predictions/verify?hash=zzz`);
    expect(res.status).toBe(400);
  });

  it("returns found:false for an unknown hash", async () => {
    const hash = await hashText("never registered");
    const res = await fetch(`${baseUrl}/api/predictions/verify?hash=${hash}`);
    expect(res.status).toBe(200);
    expect((await res.json()).found).toBe(false);
  });

  it("returns the registered prediction for a known hash", async () => {
    const hash = await hashText("integration test content");
    const res = await fetch(`${baseUrl}/api/predictions/verify?hash=${hash}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.hash).toBe(hash);
    expect(body.tsa_token).toBe("dGVzdC10c2EtdG9rZW4=");
  });
});

describe("POST /api/predictions/:id/reveal", () => {
  it("rejects content whose hash does not match", async () => {
    const hash = await hashText("integration test content");
    const verify = await fetch(`${baseUrl}/api/predictions/verify?hash=${hash}`);
    const { prediction_id } = await verify.json();

    const res = await post(`/api/predictions/${prediction_id}/reveal`, {
      content: "different content",
      is_public: true,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("hash mismatch");
  });

  it("reveals when the content matches the stored hash", async () => {
    const content = "integration test content";
    const hash = await hashText(content);
    const verify = await fetch(`${baseUrl}/api/predictions/verify?hash=${hash}`);
    const { prediction_id } = await verify.json();

    const res = await post(`/api/predictions/${prediction_id}/reveal`, {
      content,
      is_public: true,
    });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});

describe("POST /api/predictions/claim", () => {
  it("accepts a valid RSA-PSS signature and creates an attestation", async () => {
    const hash = await hashText("claimable prediction");
    const reg = await post("/api/predictions/register", {
      hash,
      mode: "proof_of_existence",
      is_public: false,
    });
    expect(reg.status).toBe(201);

    const { publicKeyPem, privateKeyPem } = await generateKeyPair();
    const signature = await signHash(hash, privateKeyPem);

    const res = await post("/api/predictions/claim", {
      hash,
      public_key: publicKeyPem,
      signature,
      display_name: "Integration Tester",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.attestation_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.display_name).toBe("Integration Tester");
  });

  it("rejects a signature made with a different key", async () => {
    const hash = await hashText("claimable prediction 2");
    await post("/api/predictions/register", {
      hash,
      mode: "proof_of_existence",
      is_public: false,
    });

    const { publicKeyPem } = await generateKeyPair();
    const otherKey = await generateKeyPair();
    const signature = await signHash(hash, otherKey.privateKeyPem);

    const res = await post("/api/predictions/claim", {
      hash,
      public_key: publicKeyPem,
      signature,
      display_name: "Impostor",
    });
    expect(res.status).toBe(400);
    expect((await res.json()).message).toContain("Invalid signature");
  });
});

describe("admin endpoints", () => {
  it("rejects requests without the admin secret", async () => {
    const res = await fetch(`${baseUrl}/api/admin/stats`);
    expect(res.status).toBe(401);
  });

  it("rejects a wrong admin secret", async () => {
    const res = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { "x-admin-secret": "wrong-secret-value" },
    });
    expect(res.status).toBe(401);
  });

  it("accepts the correct admin secret", async () => {
    const res = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { "x-admin-secret": "test-admin-secret" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.arweaveAddress).toBe("test-address");
  });
});

describe("cron endpoints", () => {
  it("rejects a wrong bearer token", async () => {
    const res = await fetch(`${baseUrl}/api/cron/ots-poll`, {
      headers: { Authorization: "Bearer wrong-cron-secret" },
    });
    expect(res.status).toBe(401);
  });

  it("accepts the correct bearer token", async () => {
    const res = await fetch(`${baseUrl}/api/cron/ots-poll`, {
      headers: { Authorization: "Bearer test-cron-secret" },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});

describe("rate limiting", () => {
  // Must run last: it exhausts the register limiter (10/min per IP)
  it("returns 429 once the register limit is exceeded", async () => {
    let got429 = false;
    for (let i = 0; i < 15; i++) {
      const res = await post("/api/predictions/register", {
        hash: "not-a-hash",
        mode: "proof_of_existence",
        is_public: false,
      });
      if (res.status === 429) {
        got429 = true;
        break;
      }
    }
    expect(got429).toBe(true);
  });
});
