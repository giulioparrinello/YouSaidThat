import jsPDF from "jspdf";

export interface CertificateData {
  predictionId: string;
  hash: string;
  mode: "proof_of_existence" | "sealed_prediction";
  targetYear?: number;
  keywords?: string[];
  createdAt: string;
  tsaToken?: string | null;
  otsStatus?: string;
  bitcoinBlock?: number | null;
  /** Revealed content — only included post-unlock, never for sealed pre-unlock */
  revealedContent?: string;
  // Proof of existence content fields
  content?: string;              // original cleartext (cleartext sub-mode)
  contentEncrypted?: string;     // ciphertext (encrypted sub-mode)
  encryptionKey?: string;        // AES-256-GCM key (encrypted sub-mode — keep safe!)
  arweaveTxId?: string | null;   // Arweave TX ID for permanent storage
}

const BRAND_COLOR: [number, number, number] = [99, 102, 241]; // indigo-500
const DARK: [number, number, number] = [17, 17, 17];
const MID: [number, number, number] = [102, 102, 102];
const LIGHT: [number, number, number] = [229, 229, 229];
const BG: [number, number, number] = [250, 250, 250];
const GREEN: [number, number, number] = [34, 197, 94];
const AMBER: [number, number, number] = [245, 158, 11];
const RED: [number, number, number] = [239, 68, 68];

function setColor(doc: jsPDF, rgb: [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function rule(doc: jsPDF, y: number, color: [number, number, number] = LIGHT) {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.3);
  doc.line(20, y, 190, y);
}

function label(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  setColor(doc, MID);
  doc.text(text.toUpperCase(), x, y);
}

function value(doc: jsPDF, text: string, x: number, y: number, maxWidth = 150) {
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  setColor(doc, DARK);
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return lines.length;
}

function chip(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  color: [number, number, number] = BRAND_COLOR
) {
  const w = doc.getTextWidth(text) + 6;
  doc.setFillColor(color[0], color[1], color[2]);
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.roundedRect(x, y - 4, w, 6, 1.5, 1.5, "FD");
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(text, x + 3, y);
}

export function generateCertificatePdf(data: CertificateData): void {
  const doc = new jsPDF({ orientation: "portrait", format: "a4", unit: "mm" });
  const W = 210;

  // ── Background ──────────────────────────────────────────────────────────────
  doc.setFillColor(BG[0], BG[1], BG[2]);
  doc.rect(0, 0, W, 297, "F");

  // ── Top accent bar ──────────────────────────────────────────────────────────
  doc.setFillColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.rect(0, 0, W, 3, "F");

  let y = 22;

  // ── Header ──────────────────────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  setColor(doc, BRAND_COLOR);
  doc.text("YOUSAIDTHAT.ORG", 20, y);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  setColor(doc, MID);
  doc.text("Privacy-First Prediction Notarization", 20, y + 5);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  setColor(doc, MID);
  doc.text("CERTIFICATE OF NOTARIZATION", W - 20, y, { align: "right" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`ID: ${data.predictionId.slice(0, 8)}…`, W - 20, y + 5, { align: "right" });

  y += 14;
  rule(doc, y, BRAND_COLOR);
  y += 10;

  // ── Main title ──────────────────────────────────────────────────────────────
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  setColor(doc, DARK);
  doc.text("Notarization Certificate", 20, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  setColor(doc, MID);
  doc.text(
    "This document certifies that the following digital content was cryptographically",
    20, y
  );
  y += 4.5;
  doc.text("timestamped and anchored on the Bitcoin blockchain via YouSaidThat.org.", 20, y);
  y += 12;

  // ── Metadata block ──────────────────────────────────────────────────────────
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]);
  doc.roundedRect(18, y - 4, W - 36, 52, 3, 3, "FD");

  label(doc, "Type", 24, y + 2);
  const modeLabel =
    data.mode === "sealed_prediction" ? "Sealed Prediction" : "Proof of Existence";
  value(doc, modeLabel, 24, y + 8);

  if (data.targetYear) {
    label(doc, "Target Year", 90, y + 2);
    value(doc, String(data.targetYear), 90, y + 8);
  }

  const dateStr = new Date(data.createdAt).toLocaleDateString("en-GB", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const timeStr = new Date(data.createdAt).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
  label(doc, "Registered", 140, y + 2);
  value(doc, `${dateStr}`, 140, y + 8, 48);
  value(doc, timeStr, 140, y + 13, 48);

  y += 22;

  label(doc, "SHA-256 Hash", 24, y);
  y += 5;
  doc.setFontSize(7.5);
  doc.setFont("courier", "normal");
  setColor(doc, DARK);
  doc.text(data.hash, 24, y);
  y += 10;

  if (data.keywords && data.keywords.length > 0) {
    label(doc, "Topics / Keywords", 24, y - 2);
    y += 3;
    let kx = 24;
    for (const kw of data.keywords) {
      chip(doc, kw, kx, y, [80, 80, 80]);
      kx += doc.getTextWidth(kw) + 12;
    }
    y += 6;
  }

  y += 8;

  // ── Original Content (cleartext proof_of_existence) ──────────────────────────
  if (data.content) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    setColor(doc, DARK);
    doc.text("Original Content", 20, y);
    y += 2;
    rule(doc, y + 2);
    y += 10;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]);
    const contentLines = doc.splitTextToSize(data.content, W - 56);
    const boxH = Math.max(20, contentLines.length * 5 + 12);
    doc.roundedRect(18, y - 4, W - 36, boxH, 2, 2, "FD");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    setColor(doc, DARK);
    doc.text(contentLines, 24, y + 4);
    y += boxH + 10;
  }

  // ── Encrypted Content (encrypted proof_of_existence) ─────────────────────────
  if (data.contentEncrypted) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    setColor(doc, DARK);
    doc.text("Encrypted Content", 20, y);
    y += 2;
    rule(doc, y + 2);
    y += 10;

    // Ciphertext box
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]);
    const cipherLines = doc.splitTextToSize(data.contentEncrypted, W - 56);
    const cipherBoxH = Math.max(18, Math.min(cipherLines.length, 4) * 4.5 + 12);
    doc.roundedRect(18, y - 4, W - 36, cipherBoxH, 2, 2, "FD");
    label(doc, "AES-256-GCM Ciphertext (base64)", 24, y + 2);
    doc.setFontSize(6.5);
    doc.setFont("courier", "normal");
    setColor(doc, DARK);
    // Show first few lines only, truncate for readability
    const displayLines = cipherLines.slice(0, 4);
    if (cipherLines.length > 4) displayLines.push("…");
    doc.text(displayLines, 24, y + 8);
    y += cipherBoxH + 6;

    // Encryption key box (CRITICAL — user must keep this)
    if (data.encryptionKey) {
      doc.setFillColor(255, 251, 235); // amber-50
      doc.setDrawColor(251, 191, 36);  // amber-400
      doc.roundedRect(18, y - 4, W - 36, 26, 2, 2, "FD");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(146, 64, 14); // amber-800
      doc.text("AES-256-GCM DECRYPTION KEY — KEEP THIS SAFE", 24, y + 3);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.text("Without this key you cannot decrypt the content above.", 24, y + 8);
      doc.setFont("courier", "bold");
      doc.setFontSize(7);
      const keyLines = doc.splitTextToSize(data.encryptionKey, W - 56);
      doc.text(keyLines.slice(0, 2), 24, y + 14);
      y += 32;
    }
    y += 4;
  }

  // ── Revealed content (post-unlock sealed_prediction) ─────────────────────────
  if (data.revealedContent) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    setColor(doc, DARK);
    doc.text("Revealed Content", 20, y);
    y += 2;
    rule(doc, y + 2);
    y += 10;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]);
    const contentLines = doc.splitTextToSize(data.revealedContent, W - 56);
    const boxH = Math.max(20, contentLines.length * 5 + 12);
    doc.roundedRect(18, y - 4, W - 36, boxH, 2, 2, "FD");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    setColor(doc, DARK);
    doc.text(contentLines, 24, y + 4);
    y += boxH + 10;
  }

  // ── Permanent Storage (Arweave) ───────────────────────────────────────────────
  if (data.arweaveTxId) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    setColor(doc, DARK);
    doc.text("Permanent Storage", 20, y);
    y += 2;
    rule(doc, y + 2);
    y += 10;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]);
    doc.roundedRect(18, y - 4, W - 36, 22, 2, 2, "FD");

    chip(doc, "✓  Arweave — Permanently Stored", 24, y + 4, GREEN);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    setColor(doc, MID);
    doc.text("Content anchored permanently on the Arweave blockchain. Accessible forever.", 24, y + 11);
    doc.setFont("courier", "normal");
    doc.setFontSize(6.5);
    setColor(doc, BRAND_COLOR);
    doc.text(`arweave.net/${data.arweaveTxId}`, 24, y + 17);
    y += 30;
  }

  // ── Timestamp Proofs ────────────────────────────────────────────────────────
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  setColor(doc, DARK);
  doc.text("Timestamp Proofs", 20, y);
  y += 2;
  rule(doc, y + 2);
  y += 10;

  // TSA
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]);
  doc.roundedRect(18, y - 4, W - 36, 20, 2, 2, "FD");

  if (data.tsaToken) {
    chip(doc, "✓  RFC 3161 TSA — Actalis", 24, y + 4, GREEN);
  } else {
    chip(doc, "○  RFC 3161 TSA — Not available", 24, y + 4, [156, 163, 175]);
  }
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  setColor(doc, MID);
  doc.text(
    data.tsaToken
      ? "Legally-recognized timestamp issued immediately at registration."
      : "TSA token was not available at registration time.",
    24, y + 11
  );
  if (data.tsaToken) {
    doc.setFont("courier", "normal");
    doc.setFontSize(6);
    doc.text(data.tsaToken.slice(0, 80) + "…", 24, y + 16);
  }
  y += 28;

  // OTS
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]);
  doc.roundedRect(18, y - 4, W - 36, 20, 2, 2, "FD");

  const otsConfirmed = data.otsStatus === "confirmed";
  const otsColor: [number, number, number] = otsConfirmed
    ? GREEN
    : data.otsStatus === "failed"
    ? RED
    : AMBER;

  const otsLabel = otsConfirmed
    ? `✓  OpenTimestamps — Bitcoin Block #${data.bitcoinBlock?.toLocaleString() ?? "—"}`
    : data.otsStatus === "failed"
    ? "✗  OpenTimestamps — Anchoring Failed"
    : "◷  OpenTimestamps — Pending Bitcoin Confirmation";

  chip(doc, otsLabel, 24, y + 4, otsColor);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  setColor(doc, MID);
  doc.text(
    otsConfirmed
      ? "Hash permanently anchored in the Bitcoin blockchain. Immutable and tamper-proof."
      : "Bitcoin anchoring takes 1–24 hours. Re-download the .capsule file once confirmed.",
    24, y + 11
  );
  y += 30;

  // ── How to Verify Independently ─────────────────────────────────────────────
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  setColor(doc, DARK);
  doc.text("How to Verify Independently", 20, y);
  y += 2;
  rule(doc, y + 2);
  y += 10;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  setColor(doc, DARK);

  let steps: string[];

  if (data.mode === "sealed_prediction" && !data.revealedContent) {
    steps = [
      "1. Keep your .capsule file safe — it contains your encryption key.",
      `2. In ${data.targetYear ?? "the target year"}, go to yousaidthat.org/unlock`,
      "3. Upload your .capsule file to decrypt and reveal the original content.",
      "4. The system will verify the hash against the registered proof.",
      "5. Optionally, claim public authorship with your cryptographic signature.",
    ];
  } else if (data.content && data.arweaveTxId) {
    // Cleartext proof_of_existence with Arweave
    steps = [
      `1. Visit arweave.net/${data.arweaveTxId} — read the original text directly.`,
      `2. Compute: echo -n "your text" | sha256sum`,
      `   → Should match: ${data.hash.slice(0, 16)}…`,
      "3. Verify TSA token: openssl ts -verify -in token.tsr -data hash.bin -CAfile cacert.pem",
      "4. Verify OTS proof: ots verify proof.ots (or opentimestamps.org/verify)",
    ];
  } else if (data.contentEncrypted && data.encryptionKey) {
    // Encrypted proof_of_existence with Arweave
    steps = [
      `1. Visit arweave.net/${data.arweaveTxId ?? "[tx_id]"} — copy the ciphertext.`,
      "2. Decrypt using AES-256-GCM with the key printed above in this certificate.",
      `3. Compute: echo -n "decrypted text" | sha256sum`,
      `   → Should match: ${data.hash.slice(0, 16)}…`,
      "4. Verify TSA token: openssl ts -verify -in token.tsr -data hash.bin -CAfile cacert.pem",
      "5. Verify OTS proof: ots verify proof.ots (or opentimestamps.org/verify)",
    ];
  } else {
    steps = [
      "1. Go to yousaidthat.org/verify",
      "2. Enter the SHA-256 hash shown in this certificate.",
      "3. The system returns the full cryptographic proof — blockchain anchor included.",
      "4. Independently verify the OTS proof using opentimestamps.org/verify.",
    ];
  }

  for (const step of steps) {
    const stepLines = doc.splitTextToSize(step, W - 48);
    doc.text(stepLines, 24, y);
    y += stepLines.length * 5 + 1;
  }

  y += 6;

  // ── Disclaimer ──────────────────────────────────────────────────────────────
  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]);
  doc.roundedRect(18, y - 4, W - 36, 24, 2, 2, "FD");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  setColor(doc, MID);
  doc.text("DISCLAIMER", 24, y + 2);
  doc.setFont("helvetica", "normal");
  setColor(doc, MID);
  const disclaimer = doc.splitTextToSize(
    "This certificate is a human-readable summary of the cryptographic proof. " +
    "The authoritative proof is the .capsule file and the embedded OTS/TSA tokens. " +
    "YouSaidThat.org stores the content hash and, for public predictions, the cleartext " +
    "anchored permanently on Arweave. Sealed predictions are encrypted client-side — the server never sees plaintext.",
    W - 56
  );
  doc.text(disclaimer, 24, y + 8);
  y += 30;

  // ── Footer ──────────────────────────────────────────────────────────────────
  rule(doc, y, LIGHT);
  y += 6;

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  setColor(doc, MID);
  doc.text(`Generated: ${new Date().toISOString().slice(0, 10)}`, 20, y);
  doc.text("yousaidthat.org — Privacy-First Prediction Notarization", W / 2, y, { align: "center" });
  doc.text(`Prediction ID: ${data.predictionId}`, W - 20, y, { align: "right" });

  // ── Bottom accent bar ────────────────────────────────────────────────────────
  doc.setFillColor(BRAND_COLOR[0], BRAND_COLOR[1], BRAND_COLOR[2]);
  doc.rect(0, 294, W, 3, "F");

  doc.save(`yousaidthat-certificate-${data.predictionId.slice(0, 8)}.pdf`);
}
