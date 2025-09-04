const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());



let envelopes = [];
let totalBudget = 0;

app.post('/envelopes', (req, res) => {
  const { category, amount } = req.body;
  let newEnvelope = { id: envelopes.length + 1, category, amount }
  console.log(envelopes)
  envelopes.push(newEnvelope);
  totalBudget += amount;
  res.status(201).json({
    message: 'Envelope created',
    envelope: newEnvelope,
    totalBudget
  }); 

});

app.get('/envelopes/:id', (req, res) => {
    console.log(envelopes)

  const envelope = envelopes.find(e => e.id === parseInt(req.params.id));
  if (!envelope) {
    return res.status(404).json({ message: 'Envelope not found' });
  } 
  res.json(envelope);
});

app.get('/envelopes', (req, res) => {
  res.json({ envelopes, totalBudget });
});

app.listen(PORT, () => {
  console.log('Server running at http://localhost:3000/');
});


