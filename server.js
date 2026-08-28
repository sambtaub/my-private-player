const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/stream', async (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('URL is required');

    try {
        // Request stream resolution from Cobalt API
        const response = await fetch('https://api.cobalt.tools/api/json', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: videoUrl,
                videoQuality: '720'
            })
        });

        const data = await response.json();

        if (data.status === 'stream' || data.status === 'redirect') {
            // Pipe the clean, unblocked stream back to the client
            const videoStream = await fetch(data.url);
            res.setHeader('Content-Type', 'video/mp4');
            
            const reader = videoStream.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(value);
            }
            return res.end();
        } else {
            console.error('Cobalt Error Response:', data);
            return res.status(500).send('Unable to resolve video stream.');
        }

    } catch (err) {
        console.error('Proxy Error:', err);
        if (!res.headersSent) {
            res.status(500).send('Failed to fetch media stream.');
        }
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
