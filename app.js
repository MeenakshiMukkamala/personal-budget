const express = require('express');
const jwt = require('jsonwebtoken');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Simple health endpoint
app.get('/', (req, res) => {
  res.send('API is running');
});

// JWT auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Invalid Authorization header format' });
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Server misconfigured: JWT_SECRET missing' });
  }
  try {
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// DynamoDB setup
const dynamoClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});
const ddbDocClient = DynamoDBDocumentClient.from(dynamoClient);

// Create envelope endpoint
app.post('/api/envelopes', authenticateToken, async (req, res) => {
  const { name, budget } = req.body || {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' });
  }
  if (budget === undefined || budget === null || Number.isNaN(Number(budget))) {
    return res.status(400).json({ error: 'budget is required and must be a number' });
  }

  const tableName = process.env.ENVELOPES_TABLE || 'Envelopes';
  const nowIso = new Date().toISOString();
  const item = {
    id: uuidv4(),
    userId: req.user.sub || req.user.userId || req.user.id || 'unknown',
    name,
    budget: Number(budget),
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    await ddbDocClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(id)',
      })
    );
    return res.status(201).json({ envelope: item });
  } catch (err) {
    console.error('Failed to write to DynamoDB', { error: err });
    return res.status(500).json({ error: 'Failed to create envelope' });
  }
});

// Postgres setup
const pgConnectionString = process.env.PG_CONNECTION_STRING || process.env.DATABASE_URL;
let pgPool = null;
if (pgConnectionString) {
  pgPool = new Pool({
    connectionString: pgConnectionString,
    ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });
} else {
  console.warn('Postgres not configured: set PG_CONNECTION_STRING or DATABASE_URL');
}

// Create envelope in Postgres
app.post('/api/pg/envelopes', authenticateToken, async (req, res) => {
  if (!pgPool) {
    return res.status(500).json({ error: 'Postgres not configured' });
  }

  const { name, budget } = req.body || {};
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'name is required' });
  }
  if (budget === undefined || budget === null || Number.isNaN(Number(budget))) {
    return res.status(400).json({ error: 'budget is required and must be a number' });
  }

  const userId = req.user.sub || req.user.userId || req.user.id || 'unknown';
  const table = process.env.PG_ENVELOPES_TABLE || 'envelopes';

  // IMPORTANT: Do not include id in the insert list so DEFAULT applies
  const text = `INSERT INTO ${table} (user_id, name, budget) VALUES ($1, $2, $3) RETURNING *`;
  const values = [userId, name, Number(budget)];

  try {
    const result = await pgPool.query(text, values);
    return res.status(201).json({ envelope: result.rows[0] });
  } catch (err) {
    console.error('Failed to write to Postgres', { error: err });
    if (err && err.code === '23502' && (err.column === 'id' || /column\s+"?id"?/.test(String(err.message)))) {
      return res.status(500).json({
        error:
          'id column is NULL. Omit id from INSERT and ensure the id column has DEFAULT/IDENTITY.',
      });
    }
    return res.status(500).json({ error: 'Failed to create envelope in Postgres' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});