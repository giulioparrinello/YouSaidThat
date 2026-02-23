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
}

const BRAND_COLOR: [number, number, number] = [99, 102, 241]; // indigo-500
const DARK: [number, number, number] = [17, 17, 17];
const MID: [number, number, number] = [102, 102, 102];
const LIGHT: [number, number, number] = [229, 229, 229];
const BG: [number, number, number] = [250, 250, 250];

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

  // Cert label right side
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

  // Type
  label(doc, "Type", 24, y + 2);
  const modeLabel =
    data.mode === "sealed_prediction" ? "Sealed Prediction" : "Proof of Existence";
  value(doc, modeLabel, 24, y + 8);

  // Target year
  if (data.targetYear) {
    label(doc, "Target Year", 90, y + 2);
    value(doc, String(data.targetYear), 90, y + 8);
  }

  // Date
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

  // Hash
  label(doc, "SHA-256 Hash", 24, y);
  y += 5;
  doc.setFontSize(7.5);
  doc.setFont("courier", "normal");
  setColor(doc, DARK);
  doc.text(data.hash, 24, y);
  y += 10;

  // Keywords
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
    chip(doc, "✓  RFC 3161 TSA — Actalis", 24, y + 4, [34, 197, 94]);
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
    ? [34, 197, 94]
    : data.otsStatus === "failed"
    ? [239, 68, 68]
    : [245, 158, 11];

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

  // ── Revealed content (post-unlock only) ──────────────────────────────────────
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

  // ── How to verify ───────────────────────────────────────────────────────────
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  setColor(doc, DARK);
  doc.text("How to Verify", 20, y);
  y += 2;
  rule(doc, y + 2);
  y += 10;

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  setColor(doc, DARK);

  const steps =
    data.mode === "sealed_prediction" && !data.revealedContent
      ? [
          "1. Keep your .capsule file safe — it contains your encryption key.",
          `2. In ${data.targetYear ?? "the target year"}, go to yousaidthat.org/unlock`,
          "3. Upload your .capsule file to decrypt and reveal the original content.",
          "4. The system will verify the hash against the registered proof.",
          "5. Optionally, claim public authorship with your cryptographic signature.",
        ]
      : [
          "1. Go to yousaidthat.org/verify",
          "2. Enter the SHA-256 hash shown in this certificate.",
          "3. The system returns the full cryptographic proof — blockchain anchor included.",
          "4. Independently verify the OTS proof using opentimestamps.org/verify.",
        ];

  for (const step of steps) {
    doc.text(step, 24, y);
    y += 6;
  }

  y += 6;

  // ── Disclaimer ──────────────────────────────────────────────────────────────
  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(LIGHT[0], LIGHT[1], LIGHT[2]);
  doc.roundedRect(18, y - 4, W - 36, 22, 2, 2, "FD");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  setColor(doc, MID);
  doc.text("DISCLAIMER", 24, y + 2);
  doc.setFont("helvetica", "normal");
  setColor(doc, MID);
  const disclaimer = doc.splitTextToSize(
    "This certificate is a human-readable summary of the cryptographic proof. " +
    "The authoritative proof is the .capsule file and the embedded OTS/TSA tokens. " +
    "YouSaidThat.org does not store prediction content — only cryptographic hashes.",
    W - 56
  );
  doc.text(disclaimer, 24, y + 8);
  y += 28;

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
