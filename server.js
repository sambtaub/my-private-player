const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

// Pure CORS Proxy Endpoint for YouTube's InnerTube API
app.post('/proxy-innertube', async (req, res) => {
    const { endpoint, body } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });

    try {
        const ytRes = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'com.google.android.youtube/19.29.37 (Linux; U; Android 11; US) gzip',
                'X-YouTube-Client-Name': '3',
                'X-YouTube-Client-Version': '19.29.37'
            },
            body: JSON.stringify(body)
        });

        const data = await ytRes.json();
        return res.json(data);
    } catch (err) {
        console.error('Proxy Error:', err.message);
        return res.status(500).json({ error: 'Proxy request failed.' });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
