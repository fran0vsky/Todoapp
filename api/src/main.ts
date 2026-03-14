import express from 'express';

const app = express();
const port = process.env.PORT ?? 3333;

app.use(express.json());

app.get('/api', (req, res) => {
  res.json({ message: 'Hello from Todo API' });
});

app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
});
