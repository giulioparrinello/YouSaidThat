const BASE = (import.meta.env.VITE_API_URL as string) ?? "";

async function req<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? `HTTP ${res.status}`);
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
}

export interface PublicPrediction {
  id: string;
  hash_preview: string;
  target_year: number;
  keywords: string[] | null;
  mode: string;
  ots_status: string;
  created_at: string;
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
  target_year?: number;
  keywords?: string[] | null;
  ots_confirmed?: boolean;
  ots_status?: string;
  bitcoin_block?: number | null;
  timestamp_utc?: string;
  tsa_token?: string | null;
  ots_proof?: string | null;
}

export interface OtsStatusResponse {
  prediction_id: string;
  ots_status: string;
  bitcoin_block: number | null;
  ots_proof: string | null;
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
  registerPrediction: (body: {
    hash: string;
    mode: "proof_of_existence" | "sealed_prediction";
    target_year: number;
    keywords?: string[];
    email_hash?: string;
    is_public: boolean;
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
  }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.keyword) qs.set("keyword", params.keyword);
    if (params?.year) qs.set("year", String(params.year));
    return req<PublicPredictionsResponse>(
      `/api/predictions/public?${qs.toString()}`
    );
  },

  verifyPrediction: (hash: string) =>
    req<VerifyResponse>(`/api/predictions/verify?hash=${hash}`),

  getPrediction: (id: string) =>
    req<Record<string, unknown>>(`/api/predictions/${id}`),

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
};
