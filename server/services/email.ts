import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY not configured");
    _resend = new Resend(apiKey);
  }
  return _resend;
}

function getEmailFrom(): string {
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM not configured — set it to a verified Resend sender address");
  return from;
}

export async function sendWaitlistConfirmationEmail(email: string): Promise<boolean> {
  const from = getEmailFrom();

  try {
    const { error } = await getResend().emails.send({
      from,
      to: email,
      subject: "Welcome to YouSaidThat — You're on the list",
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>YouSaidThat — Welcome</title>
  <style>
    body {
      font-family: 'Inter', sans-serif;
      background: #F5F5F5;
      color: #111111;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 50px auto;
      padding: 50px;
      background: #FFFFFF;
      border-radius: 12px;
      box-shadow: 0 15px 40px rgba(0,0,0,0.08);
      text-align: center;
    }
    h1 {
      font-size: 30px;
      font-weight: 700;
      margin-bottom: 25px;
      letter-spacing: 0.5px;
    }
    p {
      font-size: 17px;
      line-height: 1.6;
      margin-bottom: 35px;
      color: #222222;
    }
    .cta {
      display: inline-block;
      padding: 14px 32px;
      font-weight: 700;
      font-size: 16px;
      border-radius: 8px;
      text-decoration: none;
      background: #111111;
      color: #FFFFFF;
      letter-spacing: 0.5px;
    }
    .footer {
      font-size: 12px;
      color: #888888;
      margin-top: 30px;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome to YouSaidThat</h1>
    <p>
      Thank you for joining our waitlist.
      Here, your words are not just stored—they are <strong>cryptographically sealed</strong>, timestamped, and recorded for the future.
      You are establishing your <strong>digital anteriority</strong>: proof that what you say today existed before anyone else could claim it.
    </p>
    <p>
      Each prediction, thought, or idea you create is protected and ready to be revealed when the time comes.
      The past belongs to no one. But now, you can <strong>claim your place in it</strong>.
    </p>
    <a href="https://yousaidthat.org" class="cta">Visit YouSaidThat</a>
    <div class="footer">
      © 2026 YouSaidThat.org — Your privacy and ownership are our top priority.<br>
      No information will ever be shared without your consent.
    </div>
  </div>
</body>
</html>`,
    });

    if (error) {
      console.error(`[email] Waitlist send error:`, error.message);
      return false;
    }

    console.log(`[email] Waitlist confirmation sent to ${email}`);
    return true;
  } catch (err) {
    console.error(`[email] Waitlist service error:`, err);
    return false;
  }
}

export async function sendEmailConfirmationRequest(
  email: string,
  token: string,
  notifyAt: Date
): Promise<boolean> {
  const from = process.env.EMAIL_FROM || "noreply@yousaidthat.org";
  const confirmUrl = `https://yousaidthat.org/confirm-email?token=${token}`;
  const dateStr = notifyAt.toISOString().slice(0, 10);

  try {
    const { error } = await getResend().emails.send({
      from,
      to: email,
      subject: "Confirm your YouSaidThat delivery reminder",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111">
          <p style="font-size:11px;font-family:monospace;letter-spacing:.15em;text-transform:uppercase;color:#6366f1;margin:0 0 24px">
            YouSaidThat.org
          </p>
          <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;letter-spacing:-.02em">
            Confirm your email reminder
          </h1>
          <p style="color:#444;line-height:1.6">
            Someone (hopefully you) registered a prediction and asked to be notified on <strong>${dateStr}</strong>.
            Click below to confirm you want this reminder.
          </p>
          <div style="margin:28px 0">
            <a href="${confirmUrl}"
               style="display:inline-block;padding:12px 28px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:.02em">
              Confirm reminder
            </a>
          </div>
          <p style="color:#999;font-size:12px;line-height:1.6">
            If you did not register a prediction on YouSaidThat, ignore this email — nothing will happen.<br/>
            This link expires when the target date passes.
          </p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/>
          <p style="color:#bbb;font-size:11px;font-family:monospace">
            YouSaidThat.org · Privacy-first prediction notarization
          </p>
        </div>
      `,
    });

    if (error) {
      console.error(`[email] Confirmation send error:`, error.message);
      return false;
    }

    console.log(`[email] Confirmation request sent to ${email}`);
    return true;
  } catch (err) {
    console.error(`[email] Confirmation service error:`, err);
    return false;
  }
}

export async function sendPredictionConfirmationEmail(params: {
  email: string;
  hash: string;
  mode: string;
  predictionId: string;
}): Promise<boolean> {
  const { email, hash, mode, predictionId } = params;
  const from = getEmailFrom();
  const verifyUrl = `https://yousaidthat.org/verify?hash=${hash}`;
  const modeLabel = mode === "sealed_prediction" ? "Sealed Prediction" : "Proof of Existence";

  try {
    const { error } = await getResend().emails.send({
      from,
      to: email,
      subject: "Your prediction has been anchored — YouSaidThat",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111">
          <p style="font-size:11px;font-family:monospace;letter-spacing:.15em;text-transform:uppercase;color:#6366f1;margin:0 0 24px">
            YouSaidThat.org
          </p>
          <h1 style="font-size:22px;font-weight:700;margin:0 0 16px;letter-spacing:-.02em">
            Your ${modeLabel} is anchored
          </h1>
          <p style="color:#444;line-height:1.6;margin:0 0 24px">
            Your prediction has been registered and is being anchored on the Bitcoin blockchain via OpenTimestamps.
            The SHA-256 hash below is your cryptographic proof of existence.
          </p>
          <div style="background:#f9f9f9;border:1px solid #e5e5e5;border-radius:10px;padding:20px 24px;margin:0 0 24px">
            <p style="margin:0 0 6px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#999">SHA-256 Hash</p>
            <p style="font-family:monospace;font-size:13px;color:#111;word-break:break-all;margin:0">${hash}</p>
          </div>
          <div style="margin:0 0 24px">
            <p style="margin:0 0 8px;font-size:13px;color:#555">What's happening in the background:</p>
            <ul style="margin:0;padding-left:20px;font-size:13px;color:#444;line-height:2">
              <li>&#9953; Bitcoin anchoring via OpenTimestamps — <em>in progress</em></li>
              <li>&#128271; RFC 3161 timestamp token — <em>issued</em></li>
              <li>&#128452; Permanent Arweave storage — <em>uploading</em></li>
            </ul>
          </div>
          <div style="margin:0 0 28px">
            <a href="${verifyUrl}"
               style="display:inline-block;padding:12px 28px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:.02em">
              View your proof
            </a>
          </div>
          <p style="color:#999;font-size:12px;line-height:1.6;margin:0">
            The Arweave permanent link will appear on your verification page once the upload is confirmed (usually within a few minutes).<br/>
            Keep this email as a record — the hash is your key to verification.
          </p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/>
          <p style="color:#bbb;font-size:11px;font-family:monospace">
            YouSaidThat.org &middot; Privacy-first prediction notarization<br/>
            Prediction ID: ${predictionId}
          </p>
        </div>
      `,
    });

    if (error) {
      console.error(`[email] Prediction confirmation send error:`, error.message);
      return false;
    }

    console.log(`[email] Prediction confirmation sent to ${email} for hash ${hash.slice(0, 8)}`);
    return true;
  } catch (err) {
    console.error(`[email] Prediction confirmation service error:`, err);
    return false;
  }
}

export async function sendReminderEmail(params: {
  email: string;
  targetYear: number;
  keywords?: string[] | null;
}): Promise<boolean> {
  const { email, targetYear, keywords } = params;
  const from = getEmailFrom();
  const keywordNote =
    keywords && keywords.length > 0
      ? `<p style="color:#555">Your keywords: <strong>${keywords.join(", ")}</strong></p>`
      : "";

  try {
    const { error } = await getResend().emails.send({
      from,
      to: email,
      subject: `Your ${targetYear} prediction is ready to unlock — YouSaidThat`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#111">
          <p style="font-size:11px;font-family:monospace;letter-spacing:.15em;text-transform:uppercase;color:#6366f1;margin:0 0 24px">
            YouSaidThat.org
          </p>
          <h1 style="font-size:24px;font-weight:700;margin:0 0 16px;letter-spacing:-.02em">
            It's ${targetYear}. Time to unlock.
          </h1>
          <p style="color:#444;line-height:1.6">
            A prediction you sealed for <strong>${targetYear}</strong> can now be unlocked.
          </p>
          ${keywordNote}
          <div style="margin:32px 0;padding:20px;background:#f9f9f9;border-radius:12px;border:1px solid #e5e5e5">
            <p style="margin:0 0 12px;font-size:14px;color:#666">To reveal your prediction:</p>
            <ol style="margin:0;padding-left:20px;font-size:14px;color:#444;line-height:2">
              <li>Go to <a href="https://yousaidthat.org/unlock" style="color:#6366f1">yousaidthat.org/unlock</a></li>
              <li>Upload your <code style="background:#f0f0f0;padding:1px 6px;border-radius:4px">.capsule</code> file</li>
              <li>Your prediction decrypts locally in your browser</li>
            </ol>
          </div>
          <p style="color:#999;font-size:12px;line-height:1.6">
            If you no longer have your .capsule file, the prediction cannot be recovered.<br/>
            This is by design — we hold no keys, no content, no identity.
          </p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0"/>
          <p style="color:#bbb;font-size:11px;font-family:monospace">
            YouSaidThat.org · Privacy-first prediction notarization<br/>
            No content stored · No identity tracked
          </p>
        </div>
      `,
    });

    if (error) {
      console.error(`[email] Send error:`, error.message);
      return false;
    }

    console.log(`[email] Reminder sent for target year ${targetYear}`);
    return true;
  } catch (err) {
    console.error(`[email] Service error:`, err);
    return false;
  }
}
