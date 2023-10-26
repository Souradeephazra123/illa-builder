const express = require('express');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL database configuration
const pool = new Pool({
  user: 'your_db_user',
  host: 'your_db_host',
  database: 'your_db_name',
  password: 'your_db_password',
  port: 5432,
});

// Middleware for parsing JSON
app.use(express.json());

// Define CRUD operations

// Create
app.post('/items', async (req, res) => {
  const { name, description } = req.body;
  const query = 'INSERT INTO items (name, description) VALUES ($1, $2) RETURNING *';
  try {
    const result = await pool.query(query, [name, description]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Read
app.get('/items', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM items');
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Update
app.put('/items/:id', async (req, res) => {
  const id = req.params.id;
  const { name, description } = req.body;
  const query = 'UPDATE items SET name = $1, description = $2 WHERE id = $3 RETURNING *';
  try {
    const result = await pool.query(query, [name, description, id]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Delete
app.delete('/items/:id', async (req, res) => {
  const id = req.params.id;
  const query = 'DELETE FROM items WHERE id = $1 RETURNING *';
  try {
    const result = await pool.query(query, [id]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
