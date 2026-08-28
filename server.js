const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// List of public Invidious API mirrors
const INVIDIOUS_INSTANCES = [
    'https://invidious.nerdvpn.de',
    'https://inv.tux.pizza',
    'https://invidious.drgns.space',
    'https://vid.puffyan.us'
];

app.get('/stream', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('URL is required');

    // Extract 11-character Video ID
    const match = videoUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=))([^"&?\/\s]{11})/);
    if (!match) return res.status(400).send('Invalid YouTube URL');

    const videoId = match[1];
    let streamUrl = null;

    // Cycle through public Invidious instances until a working stream is resolved
    for (const instance of INVIDIOUS_INSTANCES) {
        try {
            const apiRes = await fetch(`${instance}/api/v1/videos/${videoId}`);
            if (!apiRes.ok) continue;

            const data = await apiRes.json();
            
            // Grab format stream with combined audio and video
            const format = data.formatStreams.find(f => f.container === 'mp4') || data.formatStreams[0];
            if (format && format.url) {
                streamUrl = format.url;
                break;
            }
        } catch (e) {
            console.log(`Failed instance ${instance}, trying next...`);
        }
    }

    if (!streamUrl) {
        return res.status(500).send('Could not fetch video from active streaming nodes.');
    }

    try {
        // Fetch raw video stream bytes and pipe directly back to browser
        const videoStream = await fetch(streamUrl);
        res.setHeader('Content-Type', 'video/mp4');

        const reader = videoStream.body.getReader();
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }
        res.end();

    } catch (err) {
        console.error('Piping Error:', err);
        if (!res.headersSent) {
            res.status(500).send('Stream relay broke.');
        }
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
