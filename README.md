# Ledger — Home Decor Buyer Finder

A working starter for the internship brief: find potential US buyers (boutiques, gift
shops, interior design studios) for home decor sellers, then send them outreach email —
all through three integrated third-party APIs.

## How it works

```
Seller enters: "home decor boutique" + "Austin, TX"
        │
        ▼
1) Google Places API (Text Search)  →  list of real businesses (name, address)
        │
        ▼
2) Hunter.io (Domain Search)        →  best-guess verified email for that business's website
        │
        ▼
3) SendGrid (Mail Send)             →  sends the outreach email, with a
                                        CAN-SPAM–compliant footer + unsubscribe link
```

Leads and their status (found → email enriched → emailed) are kept in
`data/leads.json` — a flat file so the project runs with zero database setup.
Swap this for Postgres/MongoDB once you're past the MVP stage.

## APIs integrated

| Purpose | API | Free tier |
|---|---|---|
| Discover buyer businesses | [Google Places API](https://developers.google.com/maps/documentation/places/web-service/text-search) | $200/mo credit |
| Find a contact email for a business domain | [Hunter.io Domain Search](https://hunter.io/api-documentation/v2#domain-search) | 25 searches/mo |
| Send the outreach email | [SendGrid Mail Send](https://docs.sendgrid.com/api-reference/mail-send/mail-send) | 100 emails/day |

Swap-in alternatives worth knowing about: **Yelp Fusion API** or **Foursquare
Places API** instead of Google Places; **Apollo.io** or **Clearbit** instead of
Hunter.io; **Mailgun** or **AWS SES** instead of SendGrid.

## Setup

```bash
npm install
cp .env.example .env   # then fill in your API keys
npm start
```

Open `http://localhost:3000`.

## Legal note — read before sending real emails

Cold-emailing US businesses is legal, but the **CAN-SPAM Act** sets rules this
project follows and you must keep following if you extend it:

- accurate "From" address and a subject that isn't deceptive
- your real physical business address in every email (the app requires this
  before it lets you send)
- a working one-click unsubscribe link (built into every email; `/api/outreach/unsubscribe`
  adds the address to a suppression list that's checked before every send)
- opt-outs must be honored — don't remove the suppression-list check

Two things this starter does **not** do, which you'd want before using it for
real: rate-limit sending (to avoid spam-flagging your domain) and validate
that you have a legitimate business reason to contact each lead. Only pull
business contact data through the official APIs above — don't scrape sites in
ways that violate their terms of service.

## Where to take it next

- Swap the JSON file store for a real database and add per-seller accounts/auth
- Add a Places "Nearby Search" radius option instead of just city/state text
- Track email opens/replies via SendGrid's event webhook
- Add a queue (e.g. BullMQ) so outreach sends in the background with rate limiting
# home.docor.buyer
