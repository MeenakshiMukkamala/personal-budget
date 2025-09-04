const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

let envelopes = [];
let totalBudget = 0;

app.post('/envelopes', (req, res) => {
  const { category, amount } = req.body;
  envelopes.push({ id: envelopes.length + 1, category, amount });
  totalBudget += amount;

  res.status(201).json({
    message: 'Envelope created',
    envelope: envelopes[0],
    totalBudget
  }); 

});

app.listen(PORT, () => {
  console.log('Server running at http://localhost:3000/');
});


