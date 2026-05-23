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

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Основной поиск через DuckDuckGo HTML
async function searchDuckDuckGo(query) {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
        }
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    // Актуальные селекторы на 2026 год
    $('.result__body').each((i, el) => {
        const a = $(el).find('a.result__a');
        const snippet = $(el).find('.result__snippet');

        if (a.length) {
            let link = a.attr('href') || '';
            // Декодируем редирект-ссылку DuckDuckGo
            const uddgMatch = link.match(/uddg=([^&]+)/);
            if (uddgMatch) {
                try {
                    link = decodeURIComponent(uddgMatch[1]);
                } catch {}
            } else if (link.startsWith('//')) {
                link = 'https:' + link;
            }
            results.push({
                title: a.text().trim(),
                link: link,
                snippet: snippet.text().trim()
            });
        }
    });
    return results;
}

// Резервный поиск через публичный SearXNG
async function searchSearXNG(query) {
    try {
        const url = `https://searx.be/search?q=${encodeURIComponent(query)}&format=json&categories=general`;
        const response = await fetch(url);
        const data = await response.json();
        return (data.results || []).map(r => ({
            title: r.title,
            link: r.url,
            snippet: r.content || ''
        }));
    } catch {
        return [];
    }
}

app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Missing query' });

    try {
        let results = await searchDuckDuckGo(query);
        if (results.length === 0) {
            // Если DuckDuckGo не дал результатов – включаем резерв
            console.log('DuckDuckGo empty, fallback to SearXNG');
            results = await searchSearXNG(query);
        }
        res.json({ results: results.slice(0, 10) });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => console.log(`SkyBrowse home running on port ${PORT}`));
