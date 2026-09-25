const express = require('express');
const router = express.Router();
const { readJson, writeJson } = require('../lib/store');

const LEADS_FILE = 'leads.json';

/**
 * POST /api/buyers/search
 * body: { category: "home decor boutique" | "gift shop" | "interior design store" ...,
 *         city: "Austin", state: "TX" }
 *
 * Uses the Google Places API (Text Search) to find candidate buyer businesses
 * (boutiques, gift shops, interior designers, home goods retailers) in a US location.
 * Docs: https://developers.google.com/maps/documentation/places/web-service/text-search
 */
router.post('/search', async (req, res) => {
  const { category, city, state } = req.body;

  if (!category || !city || !state) {
    return res.status(400).json({ error: 'category, city and state are required' });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY is not configured' });
  }

  const query = `${category} in ${city}, ${state}, USA`;
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
    query
  )}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return res.status(502).json({ error: 'Google Places API error', details: data.status });
    }

    const candidates = (data.results || []).map((place) => ({
      id: place.place_id,
      name: place.name,
      address: place.formatted_address,
      rating: place.rating || null,
      businessStatus: place.business_status || null,
      // website/phone require a Place Details follow-up call (see /api/buyers/details)
      email: null,
      emailStatus: 'not_found',
      source: 'google_places',
    }));

    // Persist as leads so they show up in the dashboard's lead list
    const existing = await readJson(LEADS_FILE, []);
    const existingIds = new Set(existing.map((l) => l.id));
    const merged = [...existing, ...candidates.filter((c) => !existingIds.has(c.id))];
    await writeJson(LEADS_FILE, merged);

    res.json({ count: candidates.length, results: candidates });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to search buyers' });
  }
});

/**
 * GET /api/buyers/:placeId/details
 * Follow-up call to get website + phone number for a specific place,
 * needed before we can look up an email domain.
 */
router.get('/:placeId/details', async (req, res) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const { placeId } = req.params;
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website,formatted_phone_number,formatted_address&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data.result || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch place details' });
  }
});

/**
 * GET /api/buyers/leads
 * Returns everything saved so far, for the dashboard's lead table.
 */
router.get('/leads', async (req, res) => {
  const leads = await readJson(LEADS_FILE, []);
  res.json(leads);
});

module.exports = router;
