# Turnstile Sample Commands

This project provides sample commands to analyze music streaming data.

## Prerequisites

- Node.js installed
- npm installed

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
node server.js
```

## Available Commands (Run in another terminal)

### 1. Top Songs
Get the top N songs by play count in a time window:
```bash
npm run ingest top-songs "2025-03-01" "2025-03-31" 5
```

### 2. Timeline
View user's top songs and artists for the last M months:
```bash
npm run ingest timeline "724e10de-23b3-4b79-a3ba-70c8787fa3fe" 3
```

### 3. Payout
Calculate artist payout for the last M months:
```bash
npm run ingest payout "John Coltrane" 6
```

## Data Format

The commands process data from `project_source/file.csv` and use song metadata from the API endpoint `http://localhost:3000/songs/:songId` (referenced by database.json).

## Notes

- The server must be running for the commands to work
- Each command provides formatted output in the console
- Invalid song IDs are automatically skipped during processing 