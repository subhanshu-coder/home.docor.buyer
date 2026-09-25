const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

async function readJson(filename, fallback) {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, filename), 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJson(filename, data) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2));
}

module.exports = { readJson, writeJson };
