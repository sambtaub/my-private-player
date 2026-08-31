const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/favicon.ico', (req, res) => res.status(204).end());

// Relay proxy to YouTube InnerTube endpoints
app.post('/proxy-innertube', async (req, res) => {
    const { endpoint, body, clientType } = req.body;
    if (!endpoint) return res.status(400).json({ error: 'Endpoint required' });

    // Rotate headers based on requested client profile
    const headers = {
        'Content-Type': 'application/json'
    };

    if (clientType === 'TV') {
        headers['User-Agent'] = 'Mozilla/5.0 (SmartHub; SMART-TV; U; Linux/SmartTV) AppleWebKit/537.42 SmartTV';
        headers['X-YouTube-Client-Name'] = '44';
        headers['X-YouTube-Client-Version'] = '7.20260101.00.00';
    } else {
        headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
        headers['X-YouTube-Client-Name'] = '56';
        headers['X-YouTube-Client-Version'] = '1.20260101.00.00';
    }

    try {
        const ytRes = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}`, {
            method: 'POST',
            headers,
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
