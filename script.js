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
    async function fetchWithRetry(url, options = {}) {
        const {
            retries = 3,
            delay = 1000,
            cacheKey = null,
            timeout = 5000
        } = options;

        // 캐시 확인
        if (cacheKey) {
            const cached = cacheManager.get(cacheKey);
            if (cached) return cached;
        }

        let lastError;
        for (let i = 0; i < retries; i++) {
            try {
                // 타임아웃 추가
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`API ${url} failed: ${response.status}`);
                }

                const data = await response.json();
                if (cacheKey) cacheManager.set(cacheKey, data);
                return data;
            } catch (error) {
                lastError = error;
                console.warn(`Retry ${i + 1}/${retries} failed for ${url}:`, error);
                if (i < retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
                }
            }
        }

        // 모든 재시도 실패 시 캐시된 데이터 반환 (오래되었어도 낫음)
        if (cacheKey) {
            const cached = cacheManager.get(cacheKey);
            if (cached) {
                console.warn(`Using cache for ${url}`);
                return cached;
            }
        }

        throw lastError;
    }

    // 데이터 가져오기
    async function fetchData() {
        try {
            // 모든 API 요청 동시 실행
            const [
                upbitDataRaw,
                binanceDataRaw,
                fearGreedRaw,
                exchangeRateRaw,
                totalBtcRaw
            ] = await Promise.all([
                fetchWithRetry('https://corsproxy.io/?https://api.upbit.com/v1/ticker?markets=KRW-BTC', {
                    retries: 3,
                    delay: 1000,
                    timeout: 5000
                }),
                fetchWithRetry('https://corsproxy.io/?https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT', {
                    retries: 3,
                    delay: 1000,
                    timeout: 5000
                }),
                fetchWithRetry('https://corsproxy.io/?https://api.alternative.me/fng/?limit=1', {
                    retries: 2,
                    delay: 2000,
                    cacheKey: 'fearGreed',
                    timeout: 8000
                }),
                fetchWithRetry('https://corsproxy.io/?https://open.er-api.com/v6/latest/USD', {
                    retries: 2,
                    delay: 2000,
                    cacheKey: 'exchangeRate',
                    timeout: 8000
                }),
                fetchWithRetry('https://corsproxy.io/?https://blockchain.info/q/totalbc', {
                    retries: 2,
                    delay: 2000,
                    cacheKey: 'totalBtc',
                    timeout: 8000
                })
            ]);

            // 디버깅용 로그
            console.log('Raw API responses:', {
                upbitDataRaw,
                binanceDataRaw,
                fearGreedRaw,
                exchangeRateRaw,
                totalBtcRaw
            });

            // 값 추출 및 계산
            const upbitData = Array.isArray(upbitDataRaw) ? upbitDataRaw[0] : upbitDataRaw;
            const binanceData = binanceDataRaw;
            const fearGreed = fearGreedRaw;
            const exchangeRate = exchangeRateRaw;
            // totalBtc가 문자열인 경우 처리
            const totalBtc = typeof totalBtcRaw === 'string' ? parseInt(totalBtcRaw) : totalBtcRaw;

            console.log('Parsed data:', {
                upbitData,
                binanceData,
                fearGreed,
                exchangeRate,
                totalBtc,
                totalBtcRaw
            });

            // 안전한 값 추출
            const upbitPrice = upbitData?.trade_price || 0;
            const binancePrice = parseFloat(binanceData?.lastPrice || '0');
            const usdKrwRate = exchangeRate?.rates?.KRW || 0;
            const minedBtc = (totalBtc || 0) / 100000000;
            const remainingBtc = 21000000 - minedBtc;
            
            // 김치프리미엄 계산
            const kimchiPremiumValue = ((upbitPrice / (binancePrice * usdKrwRate) - 1) * 100).toFixed(2);
            
            // 가격 업데이트 및 애니메이션
            updatePriceWithAnimation(elements.upbitPrice, upbitPrice, previousPrices.upbit);
            updatePriceWithAnimation(elements.binancePrice, binancePrice, previousPrices.binance);

            // 이전 가격 업데이트
            previousPrices.upbit = upbitPrice;
            previousPrices.binance = binancePrice;
            
            // DOM 업데이트
            elements.upbitPrice.textContent = upbitPrice.toLocaleString();
            elements.binancePrice.textContent = binancePrice.toLocaleString();
            elements.upbitHigh.textContent = formatNumber(upbitData.high_price);
            elements.upbitLow.textContent = formatNumber(upbitData.low_price);
            elements.upbitVolume.textContent = `${formatNumber(upbitData.acc_trade_volume_24h)} BTC`;
            elements.binanceHigh.textContent = formatNumber(parseFloat(binanceData.highPrice));
            elements.binanceLow.textContent = formatNumber(parseFloat(binanceData.lowPrice));
            elements.binanceVolume.textContent = `${formatNumber(parseFloat(binanceData.volume))} BTC`;
            elements.exchangeRate.textContent = usdKrwRate.toLocaleString(undefined, {maximumFractionDigits: 2});
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
            // 에러 메시지 표시
            const errorMessage = error.name === 'AbortError' ? '연결 지연' : '에러 발생';
            Object.values(elements).forEach(element => {
                if (element) element.textContent = errorMessage;
            });
            // 5초 후 재시도
            setTimeout(fetchData, 5000);
        }
    }

    // 초기 데이터 가져오기
    fetchData();
    
    // 5초마다 데이터 갱신
    setInterval(fetchData, 5000);
});
