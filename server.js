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

// Актуальный список публичных инстансов SearXNG с высоким аптаймом
// Взят с https://searx.space на 23.05.2026
const SEARXNG_INSTANCES = [
    'https://searxng.website',
    'https://search.ctq.ro',
    'https://search.datenkrake.ch',
    'https://search.rhscz.eu',
    'https://search.hbubli.cc',
    'https://searx.tiekoetter.com',
    'https://searxng.site',
];

/**
 * Парсит HTML-код страницы с результатами поиска SearXNG
 * и извлекает заголовки, ссылки и описания.
 */
function parseSearchResults(html) {
    const $ = cheerio.load(html);
    const results = [];

    // Ищем статьи с результатами (основной селектор)
    $('article.result').each((i, el) => {
        const titleElement = $(el).find('h3 a').first();
        const link = titleElement.attr('href');
        const title = titleElement.text().trim();
        const snippet = $(el).find('.content, .result-content, p').first().text().trim();

        if (title && link) {
            results.push({ title, link, snippet: snippet || '' });
        }
    });

    // Запасной селектор для старых версий SearXNG
    if (results.length === 0) {
        $('.result-default, .result').each((i, el) => {
            const titleElement = $(el).find('h3 a, .result-title a').first();
            const link = titleElement.attr('href');
            const title = titleElement.text().trim();
            const snippet = $(el).find('.result-snippet, .content').first().text().trim();
            if (title && link) results.push({ title, link, snippet: snippet || '' });
        });
    }

    return results;
}

/**
 * Гибридный поиск: сначала пробует JSON API,
 * при неудаче парсит HTML-версию страницы.
 */
async function searchSearXNG(query) {
    for (const instance of SEARXNG_INSTANCES) {
        try {
            console.log(`Пробуем сервер: ${instance}`);

            // --- Попытка 1: запросить JSON (быстрый и чистый метод) ---
            try {
                const jsonUrl = `${instance}/search?q=${encodeURIComponent(query)}&format=json`;
                const jsonResponse = await fetch(jsonUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });

                if (jsonResponse.ok) {
                    const data = await jsonResponse.json();
                    const results = (data.results || []).map(r => ({
                        title: r.title || 'Без названия',
                        link: r.url,
                        snippet: r.content || r.snippet || ''
                    }));
                    if (results.length > 0) {
                        console.log(`Найдено ${results.length} результатов через JSON API на ${instance}`);
                        return results;
                    }
                } else if (jsonResponse.status === 403) {
                    console.log(`JSON API отключён на ${instance}, пробуем парсить HTML...`);
                } else {
                    console.log(`Сервер ${instance} ответил ошибкой: ${jsonResponse.status}`);
                }
            } catch (jsonError) {
                console.log(`Ошибка JSON-запроса к ${instance}: ${jsonError.message}`);
            }

            // --- Попытка 2: парсинг HTML (если JSON не сработал) ---
            const htmlUrl = `${instance}/search?q=${encodeURIComponent(query)}`;
            const htmlResponse = await fetch(htmlUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
                }
            });

            if (htmlResponse.ok) {
                const html = await htmlResponse.text();
                const results = parseSearchResults(html);
                if (results.length > 0) {
                    console.log(`Найдено ${results.length} результатов через парсинг HTML на ${instance}`);
                    return results;
                } else {
                    console.log(`Сервер ${instance} не вернул результатов в HTML.`);
                }
            }
        } catch (error) {
            console.log(`Критическая ошибка при работе с ${instance}: ${error.message}`);
        }
    }
    return []; // Ни один сервер не ответил
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
