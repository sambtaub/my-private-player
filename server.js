const express = require('express');
const { Innertube, UniversalCache } = require('youtubei.js');
const path = require('path');
const app = express();

let youtube;

// Initialize YouTube client with session caching enabled
async function initYouTube() {
    try {
        youtube = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true
        });
        console.log('YouTube API initialized');
    } catch (err) {
        console.error('Init Error:', err);
    }
}
initYouTube();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/stream', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('URL is required');

    if (!youtube) {
        return res.status(503).send('Server is starting up, please try again in a few seconds.');
    }

    try {
        // Extract 11-character Video ID
        const match = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/);
        if (!match) return res.status(400).send('Invalid YouTube URL');

        const videoId = match[1];

        // Fetch streaming data specifically requesting combined formats (iOS client type avoids cloud blocks)
        const stream = await youtube.download(videoId, {
            type: 'video+audio',
            quality: 'best',
            client: 'IOS'
        });

        res.setHeader('Content-Type', 'video/mp4');

        // Read and send stream chunks cleanly
        for await (const chunk of stream) {
            res.write(chunk);
        }
        res.end();

    } catch (err) {
        console.error('Stream Error Detail:', err);
        if (!res.headersSent) {
            res.status(500).send('Failed to stream video. The video may be region-restricted or unavailable.');
        }
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
