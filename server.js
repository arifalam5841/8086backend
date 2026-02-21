const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_FILE = path.join(__dirname, 'userdata.json');

app.use(cors());
app.use(express.json({ limit: '2mb' }));

async function ensureDataFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initialData = { users: [] };
    await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

async function readData() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw || '{}');
  if (!Array.isArray(parsed.users)) {
    return { users: [] };
  }
  return parsed;
}

async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/users', async (req, res) => {
  const { userID, email } = req.body || {};
  if (!userID || typeof userID !== 'string') {
    return res.status(400).json({ error: 'userID is required' });
  }

  try {
    const data = await readData();
    const existing = data.users.find((user) => user.userID === userID);

    if (existing) {
      existing.email = typeof email === 'string' ? email : existing.email || '';
      existing.updatedAt = new Date().toISOString();
    } else {
      data.users.push({
        userID,
        email: typeof email === 'string' ? email : '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        codeRuns: [],
      });
    }

    await writeData(data);
    return res.json({ ok: true, userID });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/api/users/:userID/code-runs', async (req, res) => {
  const { userID } = req.params;
  const { language, code } = req.body || {};

  if (!userID) {
    return res.status(400).json({ error: 'userID is required' });
  }
  if (!language || typeof language !== 'string') {
    return res.status(400).json({ error: 'language is required' });
  }
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'code is required' });
  }

  try {
    const data = await readData();
    let user = data.users.find((item) => item.userID === userID);

    if (!user) {
      user = {
        userID,
        email: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        codeRuns: [],
      };
      data.users.push(user);
    }

    user.codeRuns.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      time: new Date().toISOString(),
      language,
      code,
    });
    user.updatedAt = new Date().toISOString();

    await writeData(data);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to store code run' });
  }
});

app.get('/api/users/:userID/code-runs', async (req, res) => {
  const { userID } = req.params;
  if (!userID) {
    return res.status(400).json({ error: 'userID is required' });
  }

  try {
    const data = await readData();
    const user = data.users.find((item) => item.userID === userID);
    if (!user) {
      return res.json({ ok: true, userID, codeRuns: [] });
    }

    const codeRuns = Array.isArray(user.codeRuns) ? [...user.codeRuns].reverse() : [];
    return res.json({ ok: true, userID, codeRuns });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load code run history' });
  }
});

ensureDataFile()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize data file', error);
    process.exit(1);
  });
