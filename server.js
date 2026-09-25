require('dotenv').config();
const express = require('express');
const path = require('path');

const buyersRoute = require('./routes/buyers');
const enrichRoute = require('./routes/enrich');
const outreachRoute = require('./routes/outreach');
const apolloRoute = require('./routes/apollo');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/buyers', buyersRoute);
app.use('/api/enrich', enrichRoute);
app.use('/api/outreach', outreachRoute);
app.use('/api/apollo', apolloRoute);

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`Home Decor Buyer Finder running on http://localhost:${PORT}`);
});