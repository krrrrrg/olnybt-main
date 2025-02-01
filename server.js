const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const NodeCache = require('node-cache');
const path = require('path');

const app = express();
const cache = new NodeCache();

// 캐시 설정
const CACHE_DURATION = {
    EXCHANGE_RATE: 3600, // 1시간
    FEAR_GREED: 3600,   // 1시간
    TOTAL_BTC: 1800     // 30분
};

// CORS 및 정적 파일 설정
app.use(cors());
app.use(express.static(path.join(__dirname)));

// 업비트 API
app.get('/api/upbit', async (req, res) => {
    try {
        const response = await fetch('https://api.upbit.com/v1/ticker?markets=KRW-BTC');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 바이낸스 API
app.get('/api/binance', async (req, res) => {
    try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fear & Greed Index API (캐시 적용)
app.get('/api/fear-greed', async (req, res) => {
    const cached = cache.get('fearGreed');
    if (cached) {
        return res.json(cached);
    }

    try {
        const response = await fetch('https://api.alternative.me/fng/?limit=1');
        const data = await response.json();
        cache.set('fearGreed', data, CACHE_DURATION.FEAR_GREED);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 환율 API (캐시 적용)
app.get('/api/exchange-rate', async (req, res) => {
    const cached = cache.get('exchangeRate');
    if (cached) {
        return res.json(cached);
    }

    try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await response.json();
        cache.set('exchangeRate', data, CACHE_DURATION.EXCHANGE_RATE);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 총 채굴된 BTC API (캐시 적용)
app.get('/api/total-btc', async (req, res) => {
    const cached = cache.get('totalBtc');
    if (cached) {
        return res.json(cached);
    }

    try {
        const response = await fetch('https://blockchain.info/q/totalbc');
        const data = await response.text();
        cache.set('totalBtc', data, CACHE_DURATION.TOTAL_BTC);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 메인 페이지
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
