const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

app.use(express.static('public'));


let envelopes = [];
let totalBudget = 0;

//Create a new envelope
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

//Get a specific envelope by ID
app.get('/envelopes/:id', (req, res) => {
  const envelope = envelopes.find(e => e.id === parseInt(req.params.id));
  if (!envelope) {
    return res.status(404).json({ message: 'Envelope not found' });
  } 
  res.json(envelope);
});

//Get all envelopes and total budget
app.get('/envelopes', (req, res) => {
  res.json({ envelopes, totalBudget });
});

//Withdraw money from an envelope
app.post('/envelopes/withdraw', (req, res) => {
  const { id, amount } = req.body;
  const envelope = envelopes.find(e => e.id === parseInt(id));
  if (!envelope) {
    return res.status(404).json({ message: 'Envelope not found' });
  }
  if (envelope.amount < amount) {
    return res.status(400).json({ message: 'Insufficient funds in envelope' });
  }
  envelope.amount -= amount;
  totalBudget -= amount;
  res.json({
    message: 'Withdrawal successful',
    envelope,
    totalBudget
  });
}
);

//Delete an envelope
app.post('/envelopes/delete', (req, res) => {
  const { id } = req.body;
  envelopes = envelopes.filter(e => e.id != parseInt(id));
  res.json({ message: 'Envelope deleted', envelopes, totalBudget });
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
  envelope_from.amount -= parseFloat(req.body.amount);
  envelope_to.amount += parseFloat(req.body.amount);
  res.json({
    message: 'Transfer successful',
    envelope_from,
    envelope_to
  });
});

//Start the server
app.listen(PORT, () => {
  console.log('Server running at http://localhost:3000/');
});


