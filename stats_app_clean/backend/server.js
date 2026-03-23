const express = require('express');
const cors    = require('cors');
const path    = require('path');
const statsRoutes = require('./routes/stats');

const app  = express();
const PORT = process.env.PORT || 3000;   // Render sets PORT automatically

app.use(cors());
app.use(express.json());

// Serve web_client folder (css, js, html, images)
app.use(express.static(path.join(__dirname, '../web_client')));

// Root → always homepage
app.get('/', (_req, res) =>
  res.sendFile(path.join(__dirname, '../web_client/index.html'))
);

// All stat API routes
app.use('/api', statsRoutes);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', message: 'Stats Calculator API running' })
);

app.listen(PORT, () => {
  console.log('\n✅  StatIQ running on port ' + PORT);
  console.log('🌐  Homepage → http://localhost:' + PORT + '\n');
});
