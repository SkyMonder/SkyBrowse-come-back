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

// Список надёжных публичных серверов SearXNG (с запасными вариантами)
// Взято из открытых источников, например: https://github.com/pwilkin/mcp-searxng-public
const SEARXNG_INSTANCES = [
    'https://metacat.online',
    'https://nyc1.sx.ggtyler.dev',
    'https://ooglester.com',
    'https://search.080609.xyz',
    'https://search.canine.tools',
    'https://search.catboy.house',
    'https://search.citw.lgbt',
    'https://search.einfachzocken.eu',
    'https://search.federicociro.com',
    'https://search.hbubli.cc',
    'https://search.im-in.space',
    'https://search.indst.eu'
];

// Функция для парсинга HTML-кода и извлечения результатов
function parseSearchResults(html) {
    const $ = cheerio.load(html);
    const results = [];

    // Ищем все статьи с результатами (основной селектор для SearXNG)
    $('article.result').each((i, el) => {
        const titleElement = $(el).find('h3 a').first();
        const link = titleElement.attr('href');
        const title = titleElement.text().trim();
        const snippet = $(el).find('.content, .result-content, p').first().text().trim();

        if (title && link) {
            results.push({
                title: title,
                link: link,
                snippet: snippet || ''
            });
        }
    });

    // Запасной вариант: если <article> не найдены, ищем более старые версии вёрстки
    if (results.length === 0) {
        $('.result-default, .result').each((i, el) => {
            const titleElement = $(el).find('h3 a, .result-title a').first();
            const link = titleElement.attr('href');
            const title = titleElement.text().trim();
            const snippet = $(el).find('.result-snippet, .content').first().text().trim();

            if (title && link) {
                results.push({
                    title: title,
                    link: link,
                    snippet: snippet || ''
                });
            }
        });
    }

    return results;
}

// Поиск с перебором серверов и парсингом HTML
async function searchSearXNG(query) {
    for (const instance of SEARXNG_INSTANCES) {
        try {
            const url = `${instance}/search?q=${encodeURIComponent(query)}`;
            console.log(`Пробуем сервер: ${instance}`);
            
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
                }
            });

            if (!response.ok) {
                console.log(`Сервер ${instance} ответил ошибкой: ${response.status}`);
                continue;
            }

            const html = await response.text();
            const results = parseSearchResults(html);
            
            if (results.length > 0) {
                console.log(`Найдено ${results.length} результатов на сервере ${instance}`);
                return results;
            } else {
                console.log(`Сервер ${instance} не вернул результатов.`);
            }
        } catch (error) {
            console.log(`Ошибка при запросе к ${instance}: ${error.message}`);
        }
    }
    return []; // Ни один сервер не ответил
}

app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Missing query' });

    try {
        const results = await searchSearXNG(query);
        res.json({ results: results.slice(0, 10) }); // Ограничим 10 результатами
    } catch (error) {
        console.error('Ошибка поиска:', error);
        res.status(500).json({ error: 'Не удалось выполнить поиск' });
    }
});

app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => console.log(`SkyBrowse home running on port ${PORT}`));
