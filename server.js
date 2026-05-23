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

// === НАСТРОЙКИ РЕГИОНА ===
// Меняйте эти параметры, чтобы получать результаты из нужной страны
const REGION_CONFIG = {
    // 1. DuckDuckGo: 'wt-wt' (весь мир), 'ru-ru' (Россия), 'uk-en' (Украина) и т.д.
    duckduckgo_region: 'ru-ru', 
    // 2. Яндекс: ID региона. Например, 225 (Россия), 149 (Беларусь), 187 (Украина), 159 (Казахстан)
    yandex_lr: 225, // Россия
    // Для примера, ID других стран:
    // yandex_lr: 149, // Беларусь
    // yandex_lr: 187, // Украина
    // yandex_lr: 159, // Казахстан
};

// --- Функция поиска через DuckDuckGo ---
async function searchDuckDuckGo(query) {
    const region = REGION_CONFIG.duckduckgo_region;
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&region=${region}`;
    
    console.log(`Ищем через DuckDuckGo (регион: ${region}): ${url}`);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });
        const html = await response.text();
        const $ = cheerio.load(html);
        const results = [];

        $('.result__body').each((i, el) => {
            const a = $(el).find('a.result__a');
            const snippet = $(el).find('.result__snippet');
            if (a.length) {
                let link = a.attr('href') || '';
                const uddgMatch = link.match(/uddg=([^&]+)/);
                if (uddgMatch) {
                    try { link = decodeURIComponent(uddgMatch[1]); } catch {}
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
    } catch (error) {
        console.error('Ошибка DuckDuckGo:', error);
        return [];
    }
}

// --- Функция поиска через Яндекс ---
async function searchYandex(query) {
    const lr = REGION_CONFIG.yandex_lr;
    // Используем XML-поиск Яндекса, который хорошо принимает параметр lr
    const url = `https://yandex.com/search/xml?query=${encodeURIComponent(query)}&lr=${lr}&groupby=attr%3Dd.mode%3Ddeep.groups-on-page%3D5.docs-in-group%3D1&maxpassages=1`;

    console.log(`Ищем через Яндекс (регион: ${lr}): ${url}`);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Language': 'ru-RU,ru;q=0.9'
            }
        });
        const xml = await response.text();
        const $ = cheerio.load(xml, { xmlMode: true });
        const results = [];

        $('group').each((i, el) => {
            const title = $(el).find('title').text();
            const link = $(el).find('url').text();
            const snippet = $(el).find('passages').text();
            if (title && link) {
                results.push({ title, link, snippet });
            }
        });
        return results;
    } catch (error) {
        console.error('Ошибка Яндекса:', error);
        return [];
    }
}

// --- Основной маршрут поиска ---
app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Missing query' });

    try {
        // Запускаем оба поиска параллельно
        const [ddgResults, yandexResults] = await Promise.all([
            searchDuckDuckGo(query),
            searchYandex(query)
        ]);

        // Объединяем и удаляем дубликаты по ссылке
        const allResults = [...ddgResults, ...yandexResults];
        const uniqueLinks = new Set();
        const mergedResults = allResults.filter(r => {
            if (uniqueLinks.has(r.link)) return false;
            uniqueLinks.add(r.link);
            return true;
        });

        console.log(`Найдено: DuckDuckGo (${ddgResults.length}), Яндекс (${yandexResults.length}), Всего уникальных (${mergedResults.length})`);
        res.json({ results: mergedResults.slice(0, 10) });
    } catch (error) {
        console.error('Ошибка поиска:', error);
        res.status(500).json({ error: 'Не удалось выполнить поиск' });
    }
});

app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => console.log(`SkyBrowse home running on port ${PORT}`));
