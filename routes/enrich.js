const express = require('express');
const router = express.Router();
const { readJson, writeJson } = require('../lib/store');

const LEADS_FILE = 'leads.json';

/**
 * POST /api/enrich/email
 * body: { leadId: "google_place_id", domain: "examplestore.com" }
 *
 * Uses Hunter.io's Domain Search API to find the most likely contact email
 * for a business domain (e.g. buying@, info@, sales@).
 * Docs: https://hunter.io/api-documentation/v2#domain-search
 */
router.post('/email', async (req, res) => {
  const { leadId, domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'domain is required' });

  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'HUNTER_API_KEY is not configured' });

  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(
    domain
  )}&api_key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const bestMatch = (data.data && data.data.emails && data.data.emails[0]) || null;

    if (leadId) {
      const leads = await readJson(LEADS_FILE, []);
      const updated = leads.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              email: bestMatch ? bestMatch.value : null,
              emailStatus: bestMatch ? 'found' : 'not_found',
              emailConfidence: bestMatch ? bestMatch.confidence : null,
            }
          : lead
      );
      await writeJson(LEADS_FILE, updated);
    }

    res.json({ domain, email: bestMatch ? bestMatch.value : null, raw: bestMatch });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to enrich email' });
  }
});

module.exports = router;
