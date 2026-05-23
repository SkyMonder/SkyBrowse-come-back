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

// === НАСТРОЙКИ ===
const SEARXNG_INSTANCES = [
    'https://search.rhscz.eu',       // Стабильный, Европа
    'https://searxng.website',       // Работает
    'https://search.hbubli.cc',      // Часто живой
    'https://searx.tiekoetter.com',  // Надёжный
    'https://search.datenkrake.ch',  // Швейцария
    'https://searxng.site'           // Новый
];
const LOCALE = 'ru-RU'; // Язык интерфейса и предпочтение результатов

/**
 * Парсит HTML-страницу SearXNG и достаёт результаты.
 */
function parseHTMLResults(html) {
    const $ = cheerio.load(html);
    const results = [];
    $('article.result').each((i, el) => {
        const titleEl = $(el).find('h3 a').first();
        const link = titleEl.attr('href');
        const title = titleEl.text().trim();
        const snippet = $(el).find('.content, .result-content, p').first().text().trim();
        if (title && link) results.push({ title, link, snippet: snippet || '' });
    });
    if (results.length === 0) {
        // запасной вариант для старых тем
        $('.result-default, .result').each((i, el) => {
            const a = $(el).find('h3 a, .result-title a').first();
            const link = a.attr('href');
            const title = a.text().trim();
            const snippet = $(el).find('.result-snippet, .content').first().text().trim();
            if (title && link) results.push({ title, link, snippet: snippet || '' });
        });
    }
    return results;
}

async function searchSearXNG(query) {
    for (const instance of SEARXNG_INSTANCES) {
        try {
            console.log(`Пробуем сервер: ${instance}`);

            // 1) Пробуем JSON API
            let jsonUrl = `${instance}/search?q=${encodeURIComponent(query)}&format=json&language=${LOCALE}&categories=general`;
            try {
                const resp = await fetch(jsonUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
                if (resp.ok) {
                    const data = await resp.json();
                    const results = (data.results || []).map(r => ({
                        title: r.title || 'Без названия',
                        link: r.url,
                        snippet: r.content || r.snippet || ''
                    }));
                    if (results.length > 0) {
                        console.log(`JSON OK: ${instance} -> ${results.length} результатов`);
                        return results;
                    }
                } else if (resp.status === 403) {
                    console.log(`JSON API запрещён на ${instance}, пробуем HTML...`);
                }
            } catch (e) {
                console.log(`Ошибка JSON на ${instance}: ${e.message}`);
            }

            // 2) Парсинг HTML с теми же параметрами
            let htmlUrl = `${instance}/search?q=${encodeURIComponent(query)}&language=${LOCALE}&categories=general`;
            const htmlResp = await fetch(htmlUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept-Language': 'ru-RU,ru;q=0.9'
                }
            });
            if (htmlResp.ok) {
                const html = await htmlResp.text();
                const results = parseHTMLResults(html);
                if (results.length > 0) {
                    console.log(`HTML OK: ${instance} -> ${results.length} результатов`);
                    return results;
                }
            }
            console.log(`Нет результатов на ${instance}`);
        } catch (err) {
            console.log(`Сервер ${instance} недоступен: ${err.message}`);
        }
    }
    return [];
}

app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Missing query' });

    try {
        const results = await searchSearXNG(query);
        res.json({ results: results.slice(0, 10) });
    } catch (error) {
        console.error('Ошибка поиска:', error);
        res.status(500).json({ error: 'Не удалось выполнить поиск' });
    }
});

app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => console.log(`SkyBrowse home running on port ${PORT}`));
