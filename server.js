const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = 3000;

// Read database.json
let songs;
async function loadSongs() {
    const data = await fs.readFile('project_source/database.json', 'utf8');
    songs = JSON.parse(data).songs;
}

// GET /songs - Get all songs
app.get('/songs', (req, res) => {
    res.json(songs);
});

// GET /songs/:id - Get song by ID
app.get('/songs/:id', (req, res) => {
    const song = songs.find(s => s.songId === req.params.id);
    if (!song) {
        return res.status(404).json({ error: 'Song not found' });
    }
    res.json(song);
});

// Start server
async function startServer() {
    await loadSongs();
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

startServer(); 