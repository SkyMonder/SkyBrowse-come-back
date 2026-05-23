const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Используем публичный SearXNG (JSON API)
const SEARXNG_URL = 'https://searx.be/search';

app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Missing query' });

    try {
        const apiUrl = `${SEARXNG_URL}?q=${encodeURIComponent(query)}&format=json&categories=general`;
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SkyBrowse/1.0)'
            }
        });
        if (!response.ok) throw new Error(`SearXNG responded with ${response.status}`);
        const data = await response.json();

        // Приводим к нужному формату
        const results = (data.results || []).map(r => ({
            title: r.title || 'Без названия',
            link: r.url,
            snippet: r.content || r.snippet || ''
        }));

        res.json({ results: results.slice(0, 10) });
    } catch (error) {
        console.error('SearXNG error:', error);
        // fallback: можно попробовать другой инстанс, но пока вернём ошибку
        res.status(500).json({ error: 'Поисковый сервис временно недоступен' });
    }
});

app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => console.log(`SkyBrowse home running on port ${PORT}`));
