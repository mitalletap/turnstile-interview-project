const { program } = require('commander');
const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');

// Load enriched data
async function loadData() {
    const data = await fs.readFile(path.join(__dirname, '..', 'output.json'), 'utf8');
    return JSON.parse(data);
}

// Top songs by play count in time window
async function topSongs(start, end, n) {
    const data = await loadData();
    const filtered = data.filter(record => {
        const timestamp = moment(record.timestamp);
        return timestamp.isBetween(start, end);
    });

    const counts = filtered.reduce((acc, record) => {
        acc[record.songId] = (acc[record.songId] || 0) + 1;
        return acc;
    }, {});

    return Object.entries(counts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, n)
        .map(([songId]) => songId);
}

// User timeline
async function timeline(userId, months) {
    const data = await loadData();
    const userData = data.filter(record => record.userId === userId);
    const now = moment();
    
    const results = [];
    for (let i = 0; i < months; i++) {
        const monthStart = moment(now).subtract(i, 'months').startOf('month');
        const monthEnd = moment(monthStart).endOf('month');
        
        const monthData = userData.filter(record => {
            const timestamp = moment(record.timestamp);
            return timestamp.isBetween(monthStart, monthEnd);
        });

        const songCounts = {};
        const artistCounts = {};
        
        monthData.forEach(record => {
            songCounts[record.title] = (songCounts[record.title] || 0) + 1;
            artistCounts[record.artist] = (artistCounts[record.artist] || 0) + 1;
        });

        const topSong = Object.entries(songCounts)
            .sort(([,a], [,b]) => b - a)[0]?.[0];
        const topArtist = Object.entries(artistCounts)
            .sort(([,a], [,b]) => b - a)[0]?.[0];

        results.push({
            month: monthStart.format('YYYY-MM'),
            topSong,
            topArtist
        });
    }

    return results;
}

// Artist payout
async function payout(artist, months) {
    const data = await loadData();
    const now = moment();
    const startDate = moment(now).subtract(months, 'months');
    
    const artistData = data.filter(record => 
        record.artist === artist && 
        moment(record.timestamp).isAfter(startDate) &&
        record.durationMs > 10000 // Only count streams > 10 seconds
    );

    const totalMinutes = artistData.reduce((sum, record) => 
        sum + (record.durationMs / 60000), 0
    );

    return totalMinutes * 0.001; // $0.001 per minute
}

// CLI commands
program
    .command('top-songs <start> <end> <n>')
    .description('Get top N songs by play count in time window')
    .action(async (start, end, n) => {
        const songs = await topSongs(start, end, parseInt(n));
        console.log(songs.join('\n'));
    });

program
    .command('timeline <userId> <months>')
    .description('Get user listening history')
    .action(async (userId, months) => {
        const history = await timeline(userId, parseInt(months));
        history.forEach(month => {
            console.log(`${month.month}:`);
            console.log(`  Top Song: ${month.topSong}`);
            console.log(`  Top Artist: ${month.topArtist}`);
        });
    });

program
    .command('payout <artist> <months>')
    .description('Calculate artist payout')
    .action(async (artist, months) => {
        const amount = await payout(artist, parseInt(months));
        console.log(`$${amount.toFixed(2)}`);
    });

program.parse(process.argv); 