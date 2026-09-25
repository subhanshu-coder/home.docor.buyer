const express = require('express');
const router = express.Router();
const { readJson, writeJson } = require('../lib/store');

const LEADS_FILE = 'leads.json';
const UNSUB_FILE = 'unsubscribed.json';

/**
 * Every commercial email sent through this app must stay CAN-SPAM compliant:
 *  - accurate "From" name/address and non-deceptive subject
 *  - your real physical postal address
 *  - a working, one-click unsubscribe link
 *  - opt-outs must be honored (we check the unsubscribe list before every send)
 * https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
 */
function buildCompliantHtml({ bodyHtml, sellerName, sellerAddress, unsubscribeUrl }) {
  return `
    <div style="font-family:sans-serif;font-size:15px;line-height:1.5;color:#222;">
      ${bodyHtml}
      <hr style="margin-top:32px;border:none;border-top:1px solid #ddd;" />
      <p style="font-size:12px;color:#888;">
        Sent by ${sellerName} · ${sellerAddress}<br/>
        Don't want emails like this? <a href="${unsubscribeUrl}">Unsubscribe</a>.
      </p>
    </div>`;
}

/**
 * POST /api/outreach/send
 * body: {
 *   leadId, to, subject, bodyHtml,
 *   sellerName, sellerAddress, sellerReplyTo
 * }
 *
 * Sends via SendGrid's /v3/mail/send endpoint.
 * Docs: https://docs.sendgrid.com/api-reference/mail-send/mail-send
 */
router.post('/send', async (req, res) => {
  const { leadId, to, subject, bodyHtml, sellerName, sellerAddress, sellerReplyTo } = req.body;

  if (!to || !subject || !bodyHtml || !sellerName || !sellerAddress) {
    return res.status(400).json({
      error: 'to, subject, bodyHtml, sellerName and sellerAddress are all required',
    });
  }

  const unsubscribed = await readJson(UNSUB_FILE, []);
  if (unsubscribed.includes(to)) {
    return res.status(403).json({ error: 'This recipient has opted out and cannot be emailed' });
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    return res.status(500).json({ error: 'SendGrid is not configured' });
  }

  const unsubscribeUrl = `${process.env.PUBLIC_BASE_URL || 'http://localhost:3000'}/api/outreach/unsubscribe?email=${encodeURIComponent(
    to
  )}`;

  const html = buildCompliantHtml({ bodyHtml, sellerName, sellerAddress, unsubscribeUrl });

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: fromEmail, name: sellerName },
        reply_to: { email: sellerReplyTo || fromEmail },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return res.status(502).json({ error: 'SendGrid rejected the email', details: errBody });
    }

    if (leadId) {
      const leads = await readJson(LEADS_FILE, []);
      const updated = leads.map((lead) =>
        lead.id === leadId
          ? { ...lead, outreachStatus: 'sent', lastSentAt: new Date().toISOString() }
          : lead
      );
      await writeJson(LEADS_FILE, updated);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

/**
 * GET /api/outreach/unsubscribe?email=...
 * The link every outreach email must contain. Adds the address to a
 * permanent suppression list that /send checks before every send.
 */
router.get('/unsubscribe', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).send('Missing email');

  const unsubscribed = await readJson(UNSUB_FILE, []);
  if (!unsubscribed.includes(email)) {
    unsubscribed.push(email);
    await writeJson(UNSUB_FILE, unsubscribed);
  }

  res.send('You have been unsubscribed and will not receive further emails.');
});

module.exports = router;
