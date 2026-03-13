import jsPDF from "jspdf";

export interface CertificateData {
  predictionId: string;
  hash: string;
  mode: "proof_of_existence" | "sealed_prediction";
  targetYear?: number;
  /** v2 tlock: exact unlock datetime, ISO 8601 */
  targetDatetime?: string | null;
  /** v2 tlock: drand quicknet round number */
  drandRound?: number | null;
  keywords?: string[];
  /** Optional author name */
  authorName?: string;
  createdAt: string;
  /** TSA-certified timestamp (= moment of registration), ISO 8601 */
  timestampUtc?: string | null;
  tsaToken?: string | null;
  otsStatus?: string;
  bitcoinBlock?: number | null;
  /** Revealed content — only included post-unlock */
  revealedContent?: string;
  // Proof of existence content fields
  content?: string;
  contentEncrypted?: string;
  encryptionKey?: string;
  arweaveTxId?: string | null;
}

const BRAND: [number, number, number] = [99, 102, 241];   // indigo-500
const DARK:  [number, number, number] = [17, 17, 17];
const MID:   [number, number, number] = [102, 102, 102];
const LIGHT: [number, number, number] = [220, 220, 220];
const BG:    [number, number, number] = [250, 250, 250];
const GREEN: [number, number, number] = [34, 197, 94];
const AMBER: [number, number, number] = [245, 158, 11];
const RED:   [number, number, number] = [239, 68, 68];
const TEAL:  [number, number, number] = [20, 184, 166];

const W = 210; // A4 width mm
const MARGIN = 20;
const INNER = W - MARGIN * 2; // 170mm content width

function tc(doc: jsPDF, rgb: [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

function rule(doc: jsPDF, y: number, color: [number, number, number] = LIGHT) {
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.25);
  doc.line(MARGIN, y, W - MARGIN, y);
}

function sectionHeader(doc: jsPDF, text: string, y: number): number {
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  tc(doc, DARK);
  doc.text(text, MARGIN, y);
  y += 1.5;
  rule(doc, y + 2, BRAND);
  return y + 8;
}

function label(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  tc(doc, MID);
  doc.text(text.toUpperCase(), x, y);
}

function val(doc: jsPDF, text: string, x: number, y: number, maxWidth = INNER - 4): number {
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  tc(doc, DARK);
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return lines.length;
}

function mono(doc: jsPDF, text: string, x: number, y: number, maxWidth = INNER - 8, size = 7) {
  doc.setFontSize(size);
  doc.setFont("courier", "normal");
  tc(doc, DARK);
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return lines.length;
}

function chip(doc: jsPDF, text: string, x: number, y: number, color: [number, number, number] = BRAND): number {
  const tw = doc.getTextWidth(text);
  const w = tw + 8;
  doc.setFillColor(color[0], color[1], color[2]);
  doc.roundedRect(x, y - 4.5, w, 6.5, 1.5, 1.5, "F");
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(text, x + 4, y);
  return w;
}

function card(doc: jsPDF, x: number, y: number, w: number, h: number, fill: [number, number, number] = [255, 255, 255], border: [number, number, number] = LIGHT) {
  doc.setFillColor(fill[0], fill[1], fill[2]);
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, "FD");
}

function statusChip(doc: jsPDF, status: string, x: number, y: number, bitcoinBlock?: number | null): number {
  if (status === "confirmed") {
    const txt = `BITCOIN CONFIRMED${bitcoinBlock ? `  #${bitcoinBlock.toLocaleString()}` : ""}`;
    return chip(doc, txt, x, y, GREEN);
  }
  if (status === "failed") return chip(doc, "ANCHORING FAILED", x, y, RED);
  return chip(doc, "PENDING BITCOIN CONFIRMATION", x, y, AMBER);
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function generateCertificatePdf(data: CertificateData): void {
  const doc = new jsPDF({ orientation: "portrait", format: "a4", unit: "mm" });

  // Background
  doc.setFillColor(BG[0], BG[1], BG[2]);
  doc.rect(0, 0, W, 297, "F");

  // Top accent bar (gradient-like: solid brand)
  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.rect(0, 0, W, 4, "F");

  let y = 18;

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  tc(doc, BRAND);
  doc.text("YOUSAIDTHAT.ORG", MARGIN, y);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  tc(doc, MID);
  doc.text("Privacy-First Cryptographic Notarization", MARGIN, y + 5);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  tc(doc, MID);
  doc.text("CERTIFICATE OF NOTARIZATION", W - MARGIN, y, { align: "right" });
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(`ID: ${data.predictionId}`, W - MARGIN, y + 5, { align: "right" });

  y += 13;
  rule(doc, y, BRAND);
  y += 7;

  // ── Title + subtitle ──────────────────────────────────────────────────────
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  tc(doc, DARK);
  doc.text("Notarization Certificate", MARGIN, y);
  y += 6;

  const isSealedPrediction = data.mode === "sealed_prediction";
  const isTlock = !!data.targetDatetime || !!data.drandRound;
  const modeLabel = isSealedPrediction
    ? (isTlock ? "Sealed Prediction — drand IBE Timelock (v2)" : "Sealed Prediction — AES-256-GCM (v1)")
    : "Proof of Existence";

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  tc(doc, MID);
  const subtitleLine =
    isSealedPrediction
      ? "This certificate proves that an encrypted prediction was committed to the Bitcoin blockchain at the recorded time."
      : "This certificate proves that the following content existed and was committed to the Bitcoin blockchain at the recorded time.";
  doc.text(subtitleLine, MARGIN, y);
  y += 10;

  // ── Identity card ─────────────────────────────────────────────────────────
  const hasAuthor = !!data.authorName;
  card(doc, MARGIN - 2, y - 3, INNER + 4, isTlock ? (hasAuthor ? 82 : 68) : (hasAuthor ? 70 : 56));
  const col1 = MARGIN + 2;
  const col2 = MARGIN + 60;
  const col3 = MARGIN + 115;

  label(doc, "Type", col1, y + 2);
  val(doc, modeLabel, col1, y + 8, 50);

  if (data.authorName) {
    label(doc, "Author", col1, y + 20);
    val(doc, data.authorName, col1, y + 26, 50);
  }

  // Time info
  if (isTlock && data.targetDatetime) {
    const unlockDate = new Date(data.targetDatetime);
    label(doc, "Seals until", col2, y + 2);
    val(doc, unlockDate.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }) + " UTC", col2, y + 8, 52);
    if (data.drandRound) {
      label(doc, "drand round", col2, y + 18);
      doc.setFontSize(8);
      doc.setFont("courier", "normal");
      tc(doc, DARK);
      doc.text(`#${data.drandRound.toLocaleString()}`, col2, y + 24);
    }
  } else if (data.targetYear) {
    label(doc, "Target year", col2, y + 2);
    val(doc, String(data.targetYear), col2, y + 8, 48);
  }

  const regDate = new Date(data.createdAt);
  label(doc, "Registered at", col3, y + 2);
  val(doc,
    regDate.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    col3, y + 8, 55
  );
  val(doc,
    regDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + " UTC",
    col3, y + 14, 55
  );

  y += isTlock ? 34 : 24;
  label(doc, "SHA-256 Hash (hex)", col1, y);
  y += 5;
  mono(doc, data.hash, col1, y, INNER - 4, 7.5);
  y += 8;

  if (data.keywords && data.keywords.length > 0) {
    label(doc, "Keywords", col1, y);
    y += 5;
    let kx = col1;
    for (const kw of data.keywords) {
      chip(doc, kw, kx, y, [100, 100, 100]);
      kx += doc.getTextWidth(kw) + 14;
    }
    y += 8;
  } else {
    y += 4;
  }

  y += 6;

  // ── Proof of Existence: cleartext content ────────────────────────────────
  if (data.content) {
    y = sectionHeader(doc, "Original Content", y);
    const contentLines = doc.splitTextToSize(data.content, INNER - 12);
    const boxH = Math.max(22, contentLines.length * 5 + 14);
    card(doc, MARGIN - 2, y - 3, INNER + 4, boxH);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    tc(doc, DARK);
    doc.text(contentLines, MARGIN + 4, y + 5);
    y += boxH + 8;
  }

  // ── Proof of Existence: encrypted content ────────────────────────────────
  if (data.contentEncrypted) {
    y = sectionHeader(doc, "Encrypted Content", y);

    const cipherLines = doc.splitTextToSize(data.contentEncrypted, INNER - 12);
    const cipherH = Math.max(22, Math.min(cipherLines.length, 5) * 4.5 + 18);
    card(doc, MARGIN - 2, y - 3, INNER + 4, cipherH, [255, 255, 255]);
    label(doc, "AES-256-GCM ciphertext (base64)", MARGIN + 4, y + 2);
    const displayLines = cipherLines.slice(0, 5);
    if (cipherLines.length > 5) displayLines.push("…");
    doc.setFontSize(6.5);
    doc.setFont("courier", "normal");
    tc(doc, DARK);
    doc.text(displayLines, MARGIN + 4, y + 9);
    y += cipherH + 6;

    if (data.encryptionKey) {
      card(doc, MARGIN - 2, y - 3, INNER + 4, 28, [255, 251, 235], [251, 191, 36]);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(146, 64, 14);
      doc.text("DECRYPTION KEY — KEEP THIS CERTIFICATE SAFE", MARGIN + 4, y + 3);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(120, 60, 10);
      doc.text("You need this key to decrypt the ciphertext above. It is not stored anywhere else.", MARGIN + 4, y + 9);
      const keyLines = doc.splitTextToSize(data.encryptionKey, INNER - 12);
      doc.setFont("courier", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(146, 64, 14);
      doc.text(keyLines.slice(0, 2), MARGIN + 4, y + 16);
      y += 34;
    }
    y += 4;
  }

  // ── Sealed Prediction: revealed content (post-unlock) ────────────────────
  if (data.revealedContent) {
    y = sectionHeader(doc, "Revealed Prediction", y);
    const contentLines = doc.splitTextToSize(data.revealedContent, INNER - 12);
    const boxH = Math.max(22, contentLines.length * 5 + 14);
    card(doc, MARGIN - 2, y - 3, INNER + 4, boxH, [240, 253, 244], [134, 239, 172]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    tc(doc, DARK);
    doc.text(contentLines, MARGIN + 4, y + 5);
    y += boxH + 8;
  }

  // ── drand Timelock Details (sealed_prediction v2) ─────────────────────────
  if (isSealedPrediction && isTlock) {
    y = sectionHeader(doc, "Timelock Proof (drand IBE)", y);

    card(doc, MARGIN - 2, y - 3, INNER + 4, 42, [245, 243, 255], [196, 181, 253]);
    label(doc, "Encryption scheme", MARGIN + 4, y + 2);
    val(doc, "IBE/BLS12-381 — Identity-Based Encryption over drand quicknet", MARGIN + 4, y + 8, 130);

    label(doc, "drand Chain Hash", MARGIN + 4, y + 18);
    doc.setFontSize(6.5);
    doc.setFont("courier", "normal");
    tc(doc, DARK);
    doc.text("52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971", MARGIN + 4, y + 24);

    label(doc, "How it works", MARGIN + 4, y + 31);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    tc(doc, MID);
    doc.text(
      "The ciphertext was encrypted using drand's public key for round #" +
      (data.drandRound?.toLocaleString() ?? "?") +
      ". Decryption is mathematically impossible before the drand network publishes that round's beacon.",
      MARGIN + 4, y + 37, { maxWidth: INNER - 8 }
    );
    y += 52;
  }

  // ── Permanent Storage (Arweave) ───────────────────────────────────────────
  if (data.arweaveTxId) {
    y = sectionHeader(doc, "Permanent Storage", y);

    card(doc, MARGIN - 2, y - 3, INNER + 4, 26);
    chip(doc, "ARWEAVE — PERMANENTLY STORED", MARGIN + 4, y + 6, GREEN);
    label(doc, "Transaction URL", MARGIN + 4, y + 15);
    doc.setFontSize(7.5);
    doc.setFont("courier", "normal");
    tc(doc, BRAND);
    doc.text(`https://arweave.net/${data.arweaveTxId}`, MARGIN + 4, y + 21);
    y += 32;
  }

  // ── Timestamp Proofs ──────────────────────────────────────────────────────
  y = sectionHeader(doc, "Timestamp Proofs", y);

  // TSA card
  const tsaH = 28;
  card(doc, MARGIN - 2, y - 3, INNER + 4, tsaH);

  if (data.tsaToken) {
    chip(doc, "RFC 3161 TSA — VERIFIED", MARGIN + 4, y + 5, GREEN);
  } else {
    chip(doc, "RFC 3161 TSA — UNAVAILABLE", MARGIN + 4, y + 5, [180, 180, 180]);
  }

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  tc(doc, MID);
  if (data.tsaToken) {
    const tsaTs = data.timestampUtc || data.createdAt;
    const tsaFormatted = new Date(tsaTs).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "UTC",
    }) + " UTC";
    doc.text(
      `Timestamp: ${tsaFormatted}  |  Actalis CA · SHA-256`,
      MARGIN + 4, y + 12, { maxWidth: INNER - 8 }
    );
    doc.setFontSize(6);
    doc.setFont("courier", "normal");
    tc(doc, [150, 150, 150]);
    doc.text(data.tsaToken.slice(0, 90) + "…", MARGIN + 4, y + 21);
  } else {
    doc.text(
      "TSA token was not available from any provider at registration time. " +
      "Bitcoin OTS anchoring serves as the primary timestamp proof.",
      MARGIN + 4, y + 12, { maxWidth: INNER - 8 }
    );
  }
  y += tsaH + 6;

  // OTS card
  const otsConfirmed = data.otsStatus === "confirmed";
  const otsFailed = data.otsStatus === "failed";
  const otsColor: [number, number, number] = otsConfirmed ? GREEN : otsFailed ? RED : AMBER;
  const otsH = 28;
  card(doc, MARGIN - 2, y - 3, INNER + 4, otsH);

  statusChip(doc, data.otsStatus ?? "pending", MARGIN + 4, y + 5, data.bitcoinBlock);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  tc(doc, MID);
  doc.text(
    otsConfirmed
      ? `SHA-256 hash immutably anchored in Bitcoin block #${data.bitcoinBlock?.toLocaleString() ?? "—"}. ` +
        "Verify independently at opentimestamps.org/verify"
      : otsFailed
      ? "Bitcoin anchoring failed. Contact support if you need re-anchoring."
      : "Pending Bitcoin confirmation (1–24 hours). Re-download the .capsule file once confirmed.",
    MARGIN + 4, y + 12, { maxWidth: INNER - 8 }
  );
  y += otsH + 8;

  // ── Independent Verification ──────────────────────────────────────────────
  y = sectionHeader(doc, "How to Verify Independently", y);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  tc(doc, DARK);

  let steps: string[];

  if (isSealedPrediction && isTlock && !data.revealedContent) {
    steps = [
      "1. Keep your .capsule file — it contains the tlock ciphertext and all proofs.",
      `2. After ${data.targetDatetime ? new Date(data.targetDatetime).toLocaleDateString("en-GB", { dateStyle: "long", timeZone: "UTC" }) : "the target date"}, go to yousaidthat.org/unlock`,
      "3. Upload your .capsule file. The app fetches the drand beacon for round #" + (data.drandRound?.toLocaleString() ?? "?") + " and decrypts.",
      "4. drand verification: curl https://api.drand.sh/52db9ba7…/public/" + (data.drandRound ?? "ROUND"),
      "5. Verify TSA: openssl ts -reply -in token.tsr -text",
      "6. Verify OTS: ots verify proof.ots (opentimestamps.org/verify)",
    ];
  } else if (isSealedPrediction && !data.revealedContent) {
    steps = [
      "1. Keep your .capsule file — it contains your AES-256-GCM encryption key.",
      `2. In ${data.targetYear ?? "the target year"}, go to yousaidthat.org/unlock`,
      "3. Upload your .capsule file to decrypt and verify the original content.",
      "4. Verify TSA: openssl ts -reply -in token.tsr -text",
      "5. Verify OTS: ots verify proof.ots (opentimestamps.org/verify)",
    ];
  } else if (data.content && data.arweaveTxId) {
    steps = [
      `1. Visit https://arweave.net/${data.arweaveTxId} — read the original text.`,
      `2. Compute: echo -n "your text" | sha256sum`,
      `   → Must match: ${data.hash}`,
      "3. Verify TSA: openssl ts -reply -in token.tsr -text",
      "4. Verify OTS: ots verify proof.ots (opentimestamps.org/verify)",
    ];
  } else if (data.contentEncrypted && data.encryptionKey) {
    steps = [
      `1. Visit https://arweave.net/${data.arweaveTxId ?? "[tx_id]"} — copy the ciphertext.`,
      "2. Decrypt with AES-256-GCM using the key printed above in this certificate.",
      `3. Compute: echo -n "decrypted text" | sha256sum`,
      `   → Must match: ${data.hash}`,
      "4. Verify TSA: openssl ts -reply -in token.tsr -text",
      "5. Verify OTS: ots verify proof.ots (opentimestamps.org/verify)",
    ];
  } else {
    steps = [
      "1. Go to yousaidthat.org/verify",
      "2. Enter the SHA-256 hash shown in this certificate.",
      "3. The system returns the full cryptographic proof, including blockchain anchor.",
      "4. Verify OTS proof independently: opentimestamps.org/verify",
      "5. Verify TSA token: openssl ts -reply -in token.tsr -text",
    ];
  }

  for (const step of steps) {
    const stepLines = doc.splitTextToSize(step, INNER - 4);
    doc.text(stepLines, MARGIN + 4, y);
    y += stepLines.length * 5 + 1.5;
  }

  y += 6;

  // ── Disclaimer ────────────────────────────────────────────────────────────
  card(doc, MARGIN - 2, y - 3, INNER + 4, 28, [245, 245, 245], LIGHT);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  tc(doc, MID);
  doc.text("DISCLAIMER", MARGIN + 4, y + 3);
  doc.setFont("helvetica", "normal");
  const disclaimer = doc.splitTextToSize(
    "This certificate is a human-readable summary. The authoritative proof is the .capsule file " +
    "with its embedded OTS and TSA tokens. YouSaidThat.org stores the content hash and, for public " +
    "predictions, the cleartext permanently on Arweave. " +
    (isSealedPrediction
      ? "Sealed predictions are encrypted client-side — the server never sees the plaintext."
      : "The hash alone proves prior existence; the content proves authorship when revealed."),
    INNER - 12
  );
  doc.text(disclaimer, MARGIN + 4, y + 9);
  y += 34;

  // ── Footer ────────────────────────────────────────────────────────────────
  rule(doc, y, LIGHT);
  y += 6;

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  tc(doc, MID);
  doc.text(`Generated: ${new Date().toISOString().slice(0, 10)}`, MARGIN, y);
  doc.text("yousaidthat.org — Privacy-First Prediction Notarization", W / 2, y, { align: "center" });
  doc.text(`Prediction ID: ${data.predictionId.slice(0, 8)}…`, W - MARGIN, y, { align: "right" });

  // Bottom bar
  doc.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
  doc.rect(0, 293, W, 4, "F");

  doc.save(`yousaidthat-certificate-${data.predictionId.slice(0, 8)}.pdf`);
}
