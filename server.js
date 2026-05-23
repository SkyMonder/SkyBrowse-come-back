const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Явный обработчик корня
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Поиск через парсинг HTML DuckDuckGo
app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Missing query' });

    try {
        // DuckDuckGo HTML-поиск (не API, чтобы получать органические результаты)
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const response = await fetch(ddgUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const html = await response.text();
        const $ = cheerio.load(html);

        const results = [];
        $('.result').each((i, el) => {
            const titleEl = $(el).find('.result__title a');
            const snippetEl = $(el).find('.result__snippet');
            const linkEl = $(el).find('.result__url');

            const title = titleEl.text().trim();
            const snippet = snippetEl.text().trim();
            let link = linkEl.text().trim() || titleEl.attr('href') || '';

            // Чистим ссылку (DuckDuckGo оборачивает в редирект)
            if (link && link.startsWith('//')) link = 'https:' + link;
            if (link && link.includes('uddg=')) {
                const match = link.match(/uddg=([^&]+)/);
                if (match) link = decodeURIComponent(match[1]);
            }

            if (title && link) {
                results.push({ title, snippet, link });
            }
        });

        res.json({ results: results.slice(0, 10) });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => console.log(`SkyBrowse home running on port ${PORT}`));
