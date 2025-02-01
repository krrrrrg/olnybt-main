// 숫자 포맷팅 함수
function formatNumber(number) {
    if (number >= 1000000) {
        return (number / 1000000).toFixed(2) + 'M';
    } else if (number >= 1000) {
        return (number / 1000).toFixed(1) + 'K';
    }
    return number.toLocaleString();
}

document.addEventListener('DOMContentLoaded', async function() {
    // DOM 요소
    const elements = {
        upbitPrice: document.getElementById('upbit-price'),
        binancePrice: document.getElementById('binance-price'),
        exchangeRate: document.getElementById('exchange-rate'),
        fearGreed: document.getElementById('fear-greed'),
        upbitHigh: document.getElementById('upbit-24h-high'),
        upbitLow: document.getElementById('upbit-24h-low'),
        upbitVolume: document.getElementById('upbit-24h-volume'),
        binanceHigh: document.getElementById('binance-24h-high'),
        binanceLow: document.getElementById('binance-24h-low'),
        binanceVolume: document.getElementById('binance-24h-volume'),
        satoshiUsd: document.getElementById('satoshi-usd'),
        satoshiKrw: document.getElementById('satoshi-krw'),
        btcMined: document.getElementById('btc-mined'),
        btcRemaining: document.getElementById('btc-remaining'),
        kimchiPremium: document.getElementById('kimchi-premium')
    };

    // 이전 가격 저장용 변수
    let previousPrices = {
        upbit: 0,
        binance: 0
    };

    // 가격 변경 애니메이션 함수
    function updatePriceWithAnimation(element, newPrice, previousPrice) {
        element.classList.remove('price-up', 'price-down');
        if (newPrice > previousPrice) {
            element.classList.add('price-up');
        } else if (newPrice < previousPrice) {
            element.classList.add('price-down');
        }
        setTimeout(() => {
            element.classList.remove('price-up', 'price-down');
        }, 300);
    }

    // 캐시 관리 클래스
    class CacheManager {
        constructor() {
            this.cache = {};
            this.duration = {
                exchangeRate: 60 * 60 * 1000,  // 1시간
                fearGreed: 60 * 60 * 1000,    // 1시간
                totalBtc: 30 * 60 * 1000      // 30분
            };
            this.loadFromLocalStorage();
        }

        loadFromLocalStorage() {
            try {
                const saved = localStorage.getItem('bitcoinMonitorCache');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    // 유효한 캐시만 불러오기
                    Object.keys(parsed).forEach(key => {
                        if (this.isValid(key, parsed[key])) {
                            this.cache[key] = parsed[key];
                        }
                    });
                }
            } catch (e) {
                console.warn('캐시 로드 오류:', e);
            }
        }

        saveToLocalStorage() {
            try {
                localStorage.setItem('bitcoinMonitorCache', JSON.stringify(this.cache));
            } catch (e) {
                console.warn('캐시 저장 오류:', e);
            }
        }

        isValid(key, data) {
            return data && 
                   data.timestamp && 
                   (Date.now() - data.timestamp) < this.duration[key];
        }

        get(key) {
            return this.isValid(key, this.cache[key]) ? this.cache[key].data : null;
        }

        set(key, data) {
            this.cache[key] = {
                data,
                timestamp: Date.now()
            };
            this.saveToLocalStorage();
        }
    }

    const cacheManager = new CacheManager();

    // API 요청 함수
    async function fetchWithCache(url, cacheKey) {
        if (cacheKey) {
            const cached = cacheManager.get(cacheKey);
            if (cached) return cached;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error(`API ${url} failed: ${response.status}`);
        
        const data = cacheKey ? await response.json() : await response.text();
        if (cacheKey) cacheManager.set(cacheKey, data);
        
        return data;
    }

    // 데이터 가져오기
    async function fetchData() {
        try {
            // 모든 API 요청 동시 실행
            const [
                upbitData,
                binanceData,
                fearGreed,
                exchangeRate,
                totalBtc
            ] = await Promise.all([
                fetchWithCache('https://api.upbit.com/v1/ticker?markets=KRW-BTC'),
                fetchWithCache('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT'),
                fetchWithCache('https://api.alternative.me/fng/?limit=1', 'fearGreed'),
                fetchWithCache('https://open.er-api.com/v6/latest/USD', 'exchangeRate'),
                fetchWithCache('https://blockchain.info/q/totalbc', 'totalBtc')
            ]);

            // 응답 확인
            responses.forEach((response, index) => {
                if (!response.ok) {
                    throw new Error(`API ${index + 1} failed: ${response.status}`);
                }
            });

            // 데이터 추출 및 캐시 업데이트
            const [upbitData, binanceData, fearGreed, exchangeRate, totalBtc] = await Promise.all([
                responses[0].json(),
                responses[1].json(),
                responses[2].json(),
                responses[3].json(),
                responses[4].text()
            ]);


            // 값 추출 및 계산
            const upbitPrice = upbitData[0].trade_price;
            const binancePrice = parseFloat(binanceData.lastPrice);
            const usdKrwRate = exchangeRate.rates.KRW;
            const minedBtc = parseInt(totalBtc) / 100000000;
            const remainingBtc = 21000000 - minedBtc;
            
            // 김치프리미엄 계산
            const kimchiPremiumValue = ((upbitPrice / (binancePrice * usdKrwRate) - 1) * 100).toFixed(2);
            
            // 가격 업데이트 및 애니메이션
            updatePriceWithAnimation(elements.upbitPrice, upbitPrice, previousPrices.upbit);
            updatePriceWithAnimation(elements.binancePrice, binancePrice, previousPrices.binance);

            // 이전 가격 업데이트
            previousPrices.upbit = upbitPrice;
            previousPrices.binance = binancePrice;
            
            // 브라우저 탭 타이틀 업데이트
            document.title = `BTC $${binancePrice.toLocaleString()} | ₩${upbitPrice.toLocaleString()}`;

            // DOM 업데이트
            elements.upbitPrice.textContent = `${upbitPrice.toLocaleString()}`;
            elements.binancePrice.textContent = `${binancePrice.toLocaleString()}`;
            elements.upbitHigh.textContent = `${formatNumber(upbitData[0].high_price)}`;
            elements.upbitLow.textContent = `${formatNumber(upbitData[0].low_price)}`;
            elements.upbitVolume.textContent = `${formatNumber(upbitData[0].acc_trade_volume_24h)} BTC`;
            elements.binanceHigh.textContent = `${formatNumber(parseFloat(binanceData.highPrice))}`;
            elements.binanceLow.textContent = `${formatNumber(parseFloat(binanceData.lowPrice))}`;
            elements.binanceVolume.textContent = `${formatNumber(parseFloat(binanceData.volume))} BTC`;
            elements.exchangeRate.textContent = `${usdKrwRate.toLocaleString(undefined, {maximumFractionDigits: 2})}`;
            elements.fearGreed.textContent = fearGreed.data[0].value;
            elements.btcMined.textContent = `${minedBtc.toLocaleString()} BTC`;
            elements.btcRemaining.textContent = `${remainingBtc.toLocaleString()} BTC`;
            
            // 사토시 가격 계산 및 업데이트
            const satoshiUsd = binancePrice / 100000000;
            const satoshiKrw = upbitPrice / 100000000;
            elements.satoshiUsd.textContent = `$${satoshiUsd.toFixed(8)}`;
            elements.satoshiKrw.textContent = `₩${satoshiKrw.toFixed(4)}`;

            // 김치프리미엄 업데이트
            elements.kimchiPremium.textContent = `${kimchiPremiumValue}%`;
            elements.kimchiPremium.classList.toggle('premium-high', parseFloat(kimchiPremiumValue) >= 3);

            // 브라우저 타이틀 업데이트
            document.title = `BTC ₩${upbitPrice.toLocaleString()} | $${binancePrice.toLocaleString()}`;

        } catch (error) {
            console.error('데이터 가져오기 오류:', error);
            // 5초 후 재시도
            setTimeout(fetchData, 5000);
        }
    }

    // 초기 데이터 가져오기
    fetchData();
    
    // 5초마다 데이터 갱신
    setInterval(fetchData, 5000);
});
