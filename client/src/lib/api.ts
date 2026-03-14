const BASE = (import.meta.env.VITE_API_URL as string) ?? "";

async function req<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server error (HTTP ${res.status})`);
  }
  if (!res.ok) throw new Error(data?.message ?? `HTTP ${res.status}`);
  return data as T;
}

async function adminReq<T>(
  path: string,
  adminSecret: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "x-admin-secret": adminSecret,
    },
    ...options,
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server error (HTTP ${res.status})`);
  }
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data as T;
}

// ─── Types mirroring server responses ────────────────────────────────────────

export interface RegisterResponse {
  prediction_id: string;
  hash: string;
  mode: string;
  ots_status: string;
  tsa_token: string | null;
  created_at: string;
  arweave_tx_id: string | null;
  arweave_status: string;
}

export interface PublicPrediction {
  id: string;
  hash_preview: string;
  target_year: number | null;
  target_datetime: string | null;
  author_name: string | null;
  keywords: string[] | null;
  mode: string;
  ots_status: string;
  created_at: string;
  timestamp_utc?: string | null;
  content?: string | null;
  arweave_tx_id?: string | null;
  arweave_status?: string;
  likes_count: number;
  dislikes_count: number;
  my_vote: "like" | "dislike" | null;
  is_retroactive?: boolean;
}

export interface VoteResponse {
  likes: number;
  dislikes: number;
  my_vote: "like" | "dislike" | null;
}

export interface PublicPredictionsResponse {
  predictions: PublicPrediction[];
  total: number;
  page: number;
  limit: number;
}

export interface VerifyResponse {
  found: boolean;
  prediction_id?: string;
  hash?: string;
  mode?: string;
  target_year?: number | null;
  target_datetime?: string | null;
  keywords?: string[] | null;
  ots_confirmed?: boolean;
  ots_status?: string;
  bitcoin_block?: number | null;
  timestamp_utc?: string;
  tsa_token?: string | null;
  ots_proof?: string | null;
  content?: string | null;
  arweave_tx_id?: string | null;
  arweave_status?: string;
}

export interface PredictionDetailResponse {
  id: string;
  hash: string;
  mode: string;
  target_year: number | null;
  target_datetime: string | null;
  author_name: string | null;
  keywords: string[] | null;
  ots_status: string;
  bitcoin_block: number | null;
  timestamp_utc: string | null;
  tsa_token: string | null;
  ots_proof: string | null;
  is_public: boolean;
  created_at: string;
  content: string | null;
  arweave_tx_id: string | null;
}

export interface OtsStatusResponse {
  prediction_id: string;
  ots_status: string;
  bitcoin_block: number | null;
  ots_proof: string | null;
}

export interface AdminStatsResponse {
  total: number;
  otsByStatus: Record<string, number>;
  arweaveByStatus: Record<string, number>;
  arweaveBalance: { ar: string; winston: string };
  arweaveAddress: string | null;
}

export interface AdminPendingArweaveResponse {
  predictions: Array<{
    id: string;
    hash: string;
    mode: string;
    target_year: number;
    arweave_status: string;
    created_at: string;
  }>;
  total: number;
}

export interface ClaimResponse {
  attestation_id: string;
  attestation_url: string;
  display_name: string;
  hash: string;
  timestamp_verified: string;
  bitcoin_block: number | null;
}

export interface AttestationPageResponse {
  attestation_id: string;
  display_name: string;
  attestation_url: string | null;
  created_at: string;
  prediction: {
    id: string;
    hash: string;
    mode: string;
    target_year: number;
    keywords: string[] | null;
    ots_status: string;
    bitcoin_block: number | null;
    timestamp_utc: string;
    tsa_token: string | null;
  };
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const api = {
  getStats: () => req<{ total: number }>("/api/stats"),

  registerPrediction: (body: {
    hash: string;
    mode: "proof_of_existence" | "sealed_prediction";
    target_year?: number;
    author_name?: string;
    keywords?: string[];
    email?: string;
    is_public: boolean;
    content?: string;
    content_encrypted?: string;
    drand_round?: number;
    target_datetime?: string;
  }) =>
    req<RegisterResponse>("/api/predictions/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getPublicPredictions: (params?: {
    page?: number;
    limit?: number;
    keyword?: string;
    year?: number;
    fingerprint?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.keyword) qs.set("keyword", params.keyword);
    if (params?.year) qs.set("year", String(params.year));
    if (params?.fingerprint) qs.set("fingerprint", params.fingerprint);
    return req<PublicPredictionsResponse>(
      `/api/predictions/public?${qs.toString()}`
    );
  },

  voteOnPrediction: (id: string, body: { vote_type: "like" | "dislike"; fingerprint: string }) =>
    req<VoteResponse>(`/api/predictions/${id}/vote`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  verifyPrediction: (hash: string) =>
    req<VerifyResponse>(`/api/predictions/verify?hash=${hash}`),

  getPrediction: (id: string) =>
    req<PredictionDetailResponse>(`/api/predictions/${id}`),

  getAttestation: (id: string) =>
    req<AttestationPageResponse>(`/api/attestations/${id}`),

  getOtsStatus: (id: string) =>
    req<OtsStatusResponse>(`/api/predictions/${id}/ots-status`),

  claimPrediction: (body: {
    hash: string;
    public_key: string;
    signature: string;
    display_name: string;
  }) =>
    req<ClaimResponse>("/api/predictions/claim", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  revealPrediction: (
    predictionId: string,
    body: { content?: string; is_public: boolean }
  ) =>
    req<{ ok: boolean; is_public: boolean }>(
      `/api/predictions/${predictionId}/reveal`,
      { method: "POST", body: JSON.stringify(body) }
    ),

  // Admin API (requires adminSecret)
  admin: {
    getStats: (secret: string) =>
      adminReq<AdminStatsResponse>("/api/admin/stats", secret),

    getArweaveBalance: (secret: string) =>
      adminReq<{ ar: string; winston: string }>("/api/admin/arweave-balance", secret),

    getPendingArweave: (secret: string) =>
      adminReq<AdminPendingArweaveResponse>("/api/admin/pending-arweave", secret),

    retryArweave: (secret: string, id: string) =>
      adminReq<{ ok: boolean; arweave_tx_id?: string; message?: string }>(
        `/api/admin/retry-arweave/${id}`,
        secret,
        { method: "POST" }
      ),
  },
};
