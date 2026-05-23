const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Включаем CORS для всех маршрутов (на случай прямых API-запросов)
app.use(cors());
app.use(express.json());

// Раздача статики (главная страница)
app.use(express.static(path.join(__dirname, 'public')));

// Прокси для поиска – обходит CORS на внешние ресурсы
app.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Missing query' });

    try {
        // Используем DuckDuckGo Instant Answer API (не требует ключа, нет жёстких CORS)
        const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        // Если DuckDuckGo недоступен, можно переправить на Google (но Google блокирует парсинг)
        res.redirect(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
    }
});

// Здоровье
app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => console.log(`SkyBrowse home running on port ${PORT}`));
