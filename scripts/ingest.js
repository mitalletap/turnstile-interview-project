const fs = require('fs').promises;
const { parse } = require('csv-parse');
const path = require('path');
const http = require('http');

// Function to fetch song data from API
async function fetchSongData(songId) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:3000/songs/${songId}`, (res) => {
            if (res.statusCode === 404) {
                resolve(null);
                return;
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
            res.on('error', reject);
        }).on('error', reject);
    });
}

// Function to get top songs in a time window
async function getTopSongs(start, end, N) {
    const csvPath = path.join(__dirname, '..', 'project_source/file.csv');
    const csvContent = await fs.readFile(csvPath, 'utf8');
    
    const songCounts = new Map();
    const parser = parse(csvContent, {
        columns: true,
        skip_empty_lines: true
    });

    for await (const record of parser) {
        const timestamp = new Date(record.timestamp);
        if (timestamp >= new Date(start) && timestamp <= new Date(end)) {
            songCounts.set(record.songId, (songCounts.get(record.songId) || 0) + 1);
        }
    }

    return Array.from(songCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, N)
        .map(([songId]) => songId);
}

// Function to get user timeline
async function getUserTimeline(userId, M) {
    const csvPath = path.join(__dirname, '..', 'project_source/file.csv');
    const csvContent = await fs.readFile(csvPath, 'utf8');
    
    const monthlyData = new Map();
    const parser = parse(csvContent, {
        columns: true,
        skip_empty_lines: true
    });

    for await (const record of parser) {
        if (record.userId === userId) {
            const date = new Date(record.timestamp);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyData.has(monthKey)) {
                monthlyData.set(monthKey, { songs: new Map(), artists: new Map() });
            }
            
            const monthData = monthlyData.get(monthKey);
            monthData.songs.set(record.songId, (monthData.songs.get(record.songId) || 0) + 1);
            
            const songData = await fetchSongData(record.songId);
            if (songData) {
                monthData.artists.set(songData.artist, (monthData.artists.get(songData.artist) || 0) + 1);
            }
        }
    }

    const months = Array.from(monthlyData.keys()).sort().slice(-M);
    const result = {};

    for (const month of months) {
        const monthData = monthlyData.get(month);
        const topSong = Array.from(monthData.songs.entries())
            .sort((a, b) => b[1] - a[1])[0];
        const topArtist = Array.from(monthData.artists.entries())
            .sort((a, b) => b[1] - a[1])[0];
        
        result[month] = {
            topSong: topSong ? await fetchSongData(topSong[0]) : null,
            topArtist: topArtist ? topArtist[0] : null
        };
    }

    return result;
}

// Function to calculate artist payout
async function calculateArtistPayout(artist, M) {
    const csvPath = path.join(__dirname, '..', 'project_source/file.csv');
    const csvContent = await fs.readFile(csvPath, 'utf8');
    
    let totalMinutes = 0;
    const parser = parse(csvContent, {
        columns: true,
        skip_empty_lines: true
    });

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - M);

    for await (const record of parser) {
        const date = new Date(record.timestamp);
        if (date >= cutoffDate) {
            const songData = await fetchSongData(record.songId);
            if (songData && songData.artist === artist && record.durationMs > 10000) {
                totalMinutes += record.durationMs / 60000;
            }
        }
    }

    return totalMinutes * 0.001;
}

// Main function to handle commands
async function main() {
    const command = process.argv[2];
    const args = process.argv.slice(3);

    if (!command) {
        const csvPath = path.join(__dirname, '..', 'project_source', 'file.csv');
        const csvContent = await fs.readFile(csvPath, 'utf8');
        const parser = parse(csvContent, {
            columns: true,
            skip_empty_lines: true
        });

        const allData = [];
        for await (const record of parser) {
            const songData = await fetchSongData(record.songId);
            if (songData) {
                allData.push({
                    ...record,
                    ...songData
                });
            }
        }
        console.log(JSON.stringify(allData, null, 2));
        return;
    }

    switch (command) {
        case 'top-songs':
            if (args.length !== 3) {
                console.log('Usage: node ingest.js top-songs <start> <end> <N>');
                process.exit(1);
            }
            const [start, end, N] = args;
            const topSongs = await getTopSongs(start, end, parseInt(N));
            console.log(`Top ${N} songs from ${start} to ${end}:`);
            for (const songId of topSongs) {
                const songData = await fetchSongData(songId);
                if (songData) {
                    console.log(`${songData.title} by ${songData.artist} (${songId})`);
                }
            }
            break;

        case 'timeline':
            if (args.length !== 2) {
                console.log('Usage: node ingest.js timeline <userId> <M>');
                process.exit(1);
            }
            const [userId, M] = args;
            const timeline = await getUserTimeline(userId, parseInt(M));
            console.log(`Timeline for user ${userId} (last ${M} months):`);
            for (const [month, data] of Object.entries(timeline)) {
                console.log(`\n${month}:`);
                if (data.topSong) {
                    console.log(`Top Song: ${data.topSong.title} by ${data.topSong.artist}`);
                }
                if (data.topArtist) {
                    console.log(`Top Artist: ${data.topArtist}`);
                }
            }
            break;

        case 'payout':
            if (args.length !== 2) {
                console.log('Usage: node ingest.js payout <artist> <M>');
                process.exit(1);
            }
            const [artist, months] = args;
            const payout = await calculateArtistPayout(artist, parseInt(months));
            console.log(`Payout for ${artist} (last ${months} months):`);
            console.log(`Total: $${payout.toFixed(2)}`);
            break;

        default:
            console.log('Available commands:');
            console.log('  top-songs <start> <end> <N>');
            console.log('  timeline <userId> <M>');
            console.log('  payout <artist> <M>');
            process.exit(1);
    }
}

main().catch(console.error); 