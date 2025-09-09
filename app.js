const express = require('express');
const app = express();
const PORT = 3000;
app.use(express.static('public'));
app.use(express.json()); 
const crypto = require('crypto');

const { Pool } = require('pg');

const pool = new Pool({
  user: 'meenakshi',
  host: 'localhost',
  database: 'personalbudget',
  password: '',
  port: 5432,
});


const jwt = require('jsonwebtoken');

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.decode(token); // or verify with secret if needed
      req.user = { email: decoded.email };
      next();
    } catch (err) {
      return res.sendStatus(403);
    }
  } else {
    res.sendStatus(401);
  }
}

const { 
  CognitoIdentityProviderClient, 
  SignUpCommand, 
  ConfirmSignUpCommand,
  InitiateAuthCommand // for login
} = require('@aws-sdk/client-cognito-identity-provider');
const cognito = new CognitoIdentityProviderClient({ region: 'us-west-1' });

// Helper to compute SECRET_HASH
function getSecretHash(username, clientId, clientSecret) {
  return crypto
    .createHmac('SHA256', clientSecret)
    .update(username + clientId)
    .digest('base64');
}



// Cognito signup route
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  const clientId = '79bsi302esn08u8demmdgg8lig';
  const clientSecret = '13mvan5d2b3urj3f17o2h73udeln9r3d167kdfj7tvjd8adp79u';

  const username = email;

  const params = {
    ClientId: clientId,
    Username: username,
    Password: password,
    UserAttributes: [{ Name: 'email', Value: email }],
    SecretHash: getSecretHash(username, clientId, clientSecret)
  };

  try {
    const command = new SignUpCommand(params);
    await cognito.send(command);
    res.json({ message: 'Sign up successful! Please check your email for confirmation.' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }

  
});
app.post('/confirm', async (req, res) => {
  const { email, code } = req.body;
  const clientId = '79bsi302esn08u8demmdgg8lig';
  const clientSecret = '13mvan5d2b3urj3f17o2h73udeln9r3d167kdfj7tvjd8adp79u';
    const username = email;
    if (!username) {
      return res.status(400).json({ message: 'User not found. Did you sign up?' });
    }
  try {
        await cognito.send(new ConfirmSignUpCommand({
        ClientId: clientId,
        Username: username,
        ConfirmationCode: code,
        SecretHash: getSecretHash(username, clientId, clientSecret)
      }));

    res.json({ message: 'Email confirmed! You can now log in.' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
});


app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const clientId = '79bsi302esn08u8demmdgg8lig';
  const clientSecret = '13mvan5d2b3urj3f17o2h73udeln9r3d167kdfj7tvjd8adp79u';

  const username = email; // retrieve the actual Cognito username

  if (!username) {
    return res.status(400).json({ message: 'User not found. Did you sign up?' });
  }

  try {
    const authCommand = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
        SECRET_HASH: getSecretHash(username, clientId, clientSecret)
      }
    });

    const response = await cognito.send(authCommand);
    // response.AuthenticationResult contains IdToken, AccessToken, RefreshToken
    res.json({
      message: 'Login successful!',
      token: response.AuthenticationResult.IdToken
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
});

let totalBudget = 0;

// Create a new envelope
app.post('/envelopes', authenticateJWT, async (req, res) => {
  const { category, amount } = req.body;

  const username = req.user?.email; 

  try {
    const result = await pool.query(
      'INSERT INTO envelopes (username, category, amount) VALUES ($1, $2, $3) RETURNING *;',
      [username, category, amount]
    );

    res.status(201).json({
      message: 'Envelope created',
      envelope: result.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error' });
  }
});

app.get('/envelopes', authenticateJWT, async (req, res) => {
  const username = req.user?.email; // from JWT

  try {
    const result = await pool.query(
      'SELECT * FROM envelopes WHERE username = $1 ORDER BY id',
      [username]
    );
    res.json({ envelopes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error' });
  }
});

//Withdraw money from an envelope
app.post('/envelopes/withdraw', authenticateJWT, async (req, res) => {
  const { category, amount } = req.body;

  const username = req.user?.email; 

  try {
    const result = await pool.query(
      'UPDATE envelopes SET amount = amount - $3 WHERE username = $1 AND category = $2 AND amount >= $3 RETURNING *;',
      [username, category, amount]
    );
    if (result.rows.length === 0) {
        return res.status(400).json({ message: 'Insufficient funds in envelope' });
    }

    res.status(201).json({
      message: 'Money withdrawn',
      envelope: result.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error' });
  }
});

/** 
//Get a specific envelope by Category
app.get('/envelopes/:id', (req, res) => {
  const envelope = envelopes.find(e => e.id === parseInt(req.params.id));
  if (!envelope) {
    return res.status(404).json({ message: 'Envelope not found' });
  } 
  res.json(envelope);
});





//Delete an envelope
app.post('/envelopes/delete', (req, res) => {
  const { id } = req.body;
  envelopes = envelopes.filter(e => e.id != parseInt(id));
});

//Transfer money between envelopes
app.post('/envelopes/transfer/:from/:to', (req, res) => {
  const envelope_from = envelopes.find(e => e.id === parseInt(req.params.from));
  const envelope_to = envelopes.find(e => e.id === parseInt(req.params.to));
  if (!envelope_from) {
    return res.status(404).json({ message: 'Envelope from not found' });
  } 
  if (!envelope_to) {
    return res.status(404).json({ message: 'Envelope to not found' });
  }
  envelope_from.amount -= req.body.amount;
  envelope_to.amount += req.body.amount;
  res.json({
    message: 'Transfer successful',
    envelope_from,
    envelope_to
  });
});*/

//Start the server
app.listen(PORT, () => {
  console.log('Server running at http://localhost:3000/');
});


