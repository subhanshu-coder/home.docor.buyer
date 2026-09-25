const state = {
  sender: JSON.parse(localStorage.getItem('sender') || 'null'),
  activeLead: null,
};

// --- Nav ---
document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`view-${btn.dataset.view}`).classList.remove('hidden');
    if (btn.dataset.view === 'leads') loadLeads();
  });
});

// --- Settings ---
const settingsForm = document.getElementById('settings-form');
if (state.sender) {
  settingsForm.sellerName.value = state.sender.sellerName || '';
  settingsForm.sellerReplyTo.value = state.sender.sellerReplyTo || '';
  settingsForm.sellerAddress.value = state.sender.sellerAddress || '';
}
settingsForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(settingsForm));
  localStorage.setItem('sender', JSON.stringify(data));
  state.sender = data;
  alert('Saved. This is included on every outreach email you send.');
});

// --- Search ---
const searchForm = document.getElementById('search-form');
const resultsEl = document.getElementById('results');

searchForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { category, city, state: st, source } = Object.fromEntries(new FormData(searchForm));
  resultsEl.innerHTML = '<li>Searching…</li>';

  const endpoint = source === 'google' ? '/api/buyers/search' : '/api/apollo/search-companies';

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, city, state: st }),
  });
  const data = await res.json();
  renderResults(data.results || []);
});

function renderResults(results) {
  if (!results.length) {
    resultsEl.innerHTML = '<li>No matches. Try a broader category or nearby city.</li>';
    return;
  }
  resultsEl.innerHTML = '';
  results.forEach((r) => resultsEl.appendChild(resultCard(r)));
}

function resultCard(lead) {
  const li = document.createElement('li');
  li.className = 'result-item';
  li.innerHTML = `
    <div>
      <div class="result-name">${lead.name}</div>
      <div class="result-address">${lead.address || ''}</div>
      <div class="result-email ${lead.email ? '' : 'missing'}">
        ${lead.email ? `${lead.contactName ? lead.contactName + ' — ' : ''}${lead.email}` : 'Email not enriched yet'}
      </div>
    </div>
    <div class="row-actions">
      <button data-action="enrich">Find email</button>
      <button data-action="compose" ${lead.email ? '' : 'disabled'}>Compose</button>
    </div>
  `;
  li.querySelector('[data-action="enrich"]').addEventListener('click', () => enrichLead(lead, li));
  li.querySelector('[data-action="compose"]').addEventListener('click', () => openComposer(lead));
  return li;
}

// async function enrichLead(lead, li) {
//   if (lead.source === 'apollo') {
//     return enrichLeadViaApollo(lead, li);
//   }
//   const domain = prompt(`Website domain for ${lead.name}? (e.g. examplestore.com)`);
//   if (!domain) return;
//   const res = await fetch('/api/enrich/email', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ leadId: lead.id, domain }),
//   });
//   const data = await res.json();
//   lead.email = data.email;
//   li.replaceWith(resultCard(lead));
// }

async function enrichLeadViaApollo(lead, li) {
  let domain = lead.domain;
  if (!domain) {
    domain = prompt(`Website domain for ${lead.name}? (e.g. examplestore.com)`);
    if (!domain) return;
  }

  // Step 1 (free): find the right person — owner, buyer, merchandising manager, etc.
  const contactRes = await fetch('/api/apollo/find-contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadId: lead.id, domain }),
  });
  const contactData = await contactRes.json();
  const person = contactData.person;

  if (!person) {
    alert('No buyer-type contact found at this company in Apollo.');
    return;
  }

  if (!confirm(`Found ${person.name} (${person.title}). Reveal their email? This uses 1 Apollo credit.`)) {
    return;
  }

  // Step 2 (costs 1 credit): reveal the actual email address
  const emailRes = await fetch('/api/apollo/reveal-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadId: lead.id, contactId: person.id, domain }),
  });
  const emailData = await emailRes.json();
  lead.email = emailData.email;
  lead.contactName = person.name;
  lead.contactTitle = person.title;
  li.replaceWith(resultCard(lead));
}

// --- Leads table ---
async function loadLeads() {
  const el = document.getElementById('leads-table');
  el.innerHTML = 'Loading…';
  const res = await fetch('/api/buyers/leads');
  const leads = await res.json();
  el.innerHTML = '';
  if (!leads.length) {
    el.innerHTML = '<p>No leads yet — run a search first.</p>';
    return;
  }
  leads.forEach((lead) => {
    const row = document.createElement('div');
    row.className = 'lead-row';
    row.innerHTML = `
      <div>
        <div class="result-name">${lead.name}</div>
        <div class="result-address">${lead.email || 'no email'} · ${lead.outreachStatus || 'not contacted'}</div>
      </div>
      <div class="row-actions">
        <button data-action="compose" ${lead.email ? '' : 'disabled'}>Compose</button>
      </div>
    `;
    row.querySelector('[data-action="compose"]').addEventListener('click', () => openComposer(lead));
    el.appendChild(row);
  });
}

// --- Composer modal ---
const modal = document.getElementById('email-modal');
const modalTo = document.getElementById('modal-to');
const modalSubject = document.getElementById('modal-subject');
const modalBody = document.getElementById('modal-body');

function openComposer(lead) {
  if (!state.sender) {
    alert('Add your sender details first (Sender details tab) — required on every email.');
    return;
  }
  state.activeLead = lead;
  modalTo.textContent = `To: ${lead.email}`;
  modalSubject.value = `Interested in carrying our home decor line?`;
  modalBody.value = `Hi ${lead.name} team,\n\nI make [your product] and think it could be a great fit for your shelves. Would you be open to a quick look at the line?\n\nBest,\n${state.sender.sellerName}`;
  modal.classList.remove('hidden');
}

document.getElementById('modal-cancel').addEventListener('click', () => modal.classList.add('hidden'));

document.getElementById('modal-send').addEventListener('click', async () => {
  const lead = state.activeLead;
  const res = await fetch('/api/outreach/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      leadId: lead.id,
      to: lead.email,
      subject: modalSubject.value,
      bodyHtml: modalBody.value.replace(/\n/g, '<br/>'),
      sellerName: state.sender.sellerName,
      sellerAddress: state.sender.sellerAddress,
      sellerReplyTo: state.sender.sellerReplyTo,
    }),
  });
  const data = await res.json();
  if (data.ok) {
    alert('Sent.');
    modal.classList.add('hidden');
  } else {
    alert('Failed: ' + (data.error || 'unknown error'));
  }
});
