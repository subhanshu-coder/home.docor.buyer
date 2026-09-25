const express = require('express');
const router = express.Router();
const { readJson, writeJson } = require('../lib/store');

const LEADS_FILE = 'leads.json';
const APOLLO_BASE = 'https://api.apollo.io/api/v1';

function apolloHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Api-Key': process.env.APOLLO_API_KEY,
  };
}

// Job titles worth targeting at a home decor retailer — these are the people
// who actually decide what goes on the shelves.
const BUYER_TITLES = [
  'owner',
  'buyer',
  'merchandising manager',
  'purchasing manager',
  'store manager',
  'general manager',
];

/**
 * POST /api/apollo/search-companies
 * body: { category: "home decor boutique", city: "Austin", state: "TX" }
 *
 * FREE — Apollo's Organization Search does not consume credits.
 * Docs: https://docs.apollo.io/reference/organization-search
 */
router.post('/search-companies', async (req, res) => {
  const { category, city, state } = req.body;
  if (!category || !city || !state) {
    return res.status(400).json({ error: 'category, city and state are required' });
  }
  if (!process.env.APOLLO_API_KEY) {
    return res.status(500).json({ error: 'APOLLO_API_KEY is not configured' });
  }

  try {
    const response = await fetch(`${APOLLO_BASE}/mixed_companies/search`, {
      method: 'POST',
      headers: apolloHeaders(),
      body: JSON.stringify({
        q_organization_keyword_tags: [category],
        organization_locations: [`${city}, ${state}, United States`],
        per_page: 20,
        page: 1,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({ error: 'Apollo API error', details: data });
    }

    const candidates = (data.organizations || []).map((org) => ({
      id: org.id,
      name: org.name,
      address: [org.city, org.state].filter(Boolean).join(', '),
      domain: org.primary_domain || org.website_url || null,
      email: null,
      emailStatus: 'not_found',
      contactName: null,
      contactTitle: null,
      source: 'apollo',
    }));

    const existing = await readJson(LEADS_FILE, []);
    const existingIds = new Set(existing.map((l) => l.id));
    const merged = [...existing, ...candidates.filter((c) => !existingIds.has(c.id))];
    await writeJson(LEADS_FILE, merged);

    res.json({ count: candidates.length, results: candidates });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to search companies via Apollo' });
  }
});

/**
 * POST /api/apollo/find-contact
 * body: { leadId, domain }
 *
 * FREE — People Search does not return emails, just who to target.
 * Docs: https://docs.apollo.io/reference/people-search
 */
router.post('/find-contact', async (req, res) => {
  const { leadId, domain } = req.body;
  if (!domain) return res.status(400).json({ error: 'domain is required' });

  try {
    const response = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
      method: 'POST',
      headers: apolloHeaders(),
      body: JSON.stringify({
        q_organization_domains_list: [domain],
        person_titles: BUYER_TITLES,
        include_similar_titles: true,
        per_page: 1,
        page: 1,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({ error: 'Apollo API error', details: data });
    }

    const person = (data.people || [])[0] || null;

    if (leadId && person) {
      const leads = await readJson(LEADS_FILE, []);
      const updated = leads.map((lead) =>
        lead.id === leadId
          ? { ...lead, contactId: person.id, contactName: person.name, contactTitle: person.title }
          : lead
      );
      await writeJson(LEADS_FILE, updated);
    }

    res.json({ person });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to search contacts via Apollo' });
  }
});

/**
 * POST /api/apollo/reveal-email
 * body: { leadId, contactId, domain }
 *
 * COSTS 1 CREDIT — People Enrichment reveals the actual email address.
 * Only call this on contacts you're actually going to email.
 * Docs: https://docs.apollo.io/reference/people-enrichment
 */
router.post('/reveal-email', async (req, res) => {
  const { leadId, contactId, domain } = req.body;
  if (!contactId) return res.status(400).json({ error: 'contactId is required' });

  try {
    const response = await fetch(`${APOLLO_BASE}/people/match`, {
      method: 'POST',
      headers: apolloHeaders(),
      body: JSON.stringify({
        id: contactId,
        domain,
        reveal_personal_emails: true,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({ error: 'Apollo API error', details: data });
    }

    const email = data.person ? data.person.email : null;

    if (leadId) {
      const leads = await readJson(LEADS_FILE, []);
      const updated = leads.map((lead) =>
        lead.id === leadId
          ? { ...lead, email, emailStatus: email ? 'found' : 'not_found' }
          : lead
      );
      await writeJson(LEADS_FILE, updated);
    }

    res.json({ email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reveal email via Apollo' });
  }
});

module.exports = router;
