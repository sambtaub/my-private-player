const express = require('express');
const { Innertube, CustomEvent } = require('youtubei.js');
const path = require('path');
const app = express();

let youtube;

// Initialize YouTube parser client
Innertube.create().then((yt) => {
    youtube = yt;
    console.log('YouTube API initialized successfully');
}).catch(err => console.error('Init Error:', err));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/stream', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('URL is required');

    if (!youtube) {
        return res.status(503).send('Server is starting up, try again in a moment.');
    }

    try {
        // Extract Video ID from URL
        const match = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/);
        if (!match) return res.status(400).send('Invalid YouTube URL');

        const videoId = match[1];

        res.setHeader('Content-Type', 'video/mp4');

        // Fetch stream using web client signatures
        const stream = await youtube.download(videoId, {
            type: 'video+audio',
            quality: 'best'
        });

        // Pipe web stream to Express response
        for await (const chunk of stream) {
            res.write(chunk);
        }
        res.end();

    } catch (err) {
        console.error('Stream Error:', err);
        if (!res.headersSent) {
            res.status(500).send('Failed to stream video source.');
        }
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
