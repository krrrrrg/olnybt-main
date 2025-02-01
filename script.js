document.addEventListener('DOMContentLoaded', function () {
    const upbitPriceEl = document.getElementById('upbit-price');
    const binancePriceEl = document.getElementById('binance-price');
    const exchangeRateEl = document.getElementById('exchange-rate');
    const kimchiPremiumEl = document.getElementById('kimchi-premium');
    const btcMinedEl = document.getElementById('btc-mined');
    const btcRemainingEl = document.getElementById('btc-remaining');
    const btcDominanceEl = document.getElementById('btc-dominance');
    const fearGreedIndexEl = document.getElementById('fear-greed-score');
    const fearGreedImageEl = document.getElementById('fear-greed-image');
    const toggleModeBtn = document.getElementById('toggle-mode');
    const tradingviewChart = document.getElementById('tradingview-chart');
    const originalTitle = document.title;


// 기본 :  아작스  > 패치 말고 > 제이쿼리 아작스 > 리액트 엑시오스



    // 기본 모드는 다크 모드
    if (document.body.classList.contains('dark-mode')) {
        toggleModeBtn.textContent = '라이트 모드';
    } else {
        toggleModeBtn.textContent = '다크 모드';
    }

    function setLoading(isLoading) {
        const elements = document.querySelectorAll('.price-info span');
        elements.forEach(el => {
            el.textContent = isLoading ? '로딩 중...' : el.textContent;
        });
    }

    async function fetchData() {
        setLoading(true);
        try {
            const upbitResponse = await fetch('https://api.upbit.com/v1/ticker?markets=KRW-BTC');
            const binanceResponse = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
            const exchangeRateResponse = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            const btcInfoResponse = await fetch('https://api.blockchain.info/q/totalbc');
            const btcDominanceResponse = await fetch('https://api.coingecko.com/api/v3/global');
            const fearGreedResponse = await fetch('https://api.alternative.me/fng/?limit=1');

            if (!upbitResponse.ok || !binanceResponse.ok || !exchangeRateResponse.ok || !btcInfoResponse.ok || !btcDominanceResponse.ok || !fearGreedResponse.ok) {
                throw new Error('API 요청 실패');
            }

            const upbitData = await upbitResponse.json();
            const binanceData = await binanceResponse.json();
            const exchangeRateData = await exchangeRateResponse.json();
            const btcInfoData = await btcInfoResponse.json();
            const btcDominanceData = await btcDominanceResponse.json();
            const fearGreedData = await fearGreedResponse.json();

            const upbitPrice = upbitData[0].trade_price;
            const binancePrice = binanceData.price;
            const exchangeRate = exchangeRateData.rates.KRW;

            const kimchiPremium = ((upbitPrice / (binancePrice * exchangeRate)) - 1) * 100;

            const totalBtcMined = btcInfoData / 100000000;
            const totalBtcSupply = 21000000;
            const btcRemaining = totalBtcSupply - totalBtcMined;

            const btcDominance = btcDominanceData.data.market_cap_percentage.btc.toFixed(2);
            const fearGreedIndex = fearGreedData.data[0].value;

            const fearGreedImage = `https://alternative.me/crypto/fear-and-greed-index.png?${new Date().getTime()}`;

            upbitPriceEl.textContent = `${upbitPrice.toLocaleString()} KRW`;
            binancePriceEl.textContent = `${parseFloat(binancePrice).toFixed(2)} USD`;
            exchangeRateEl.textContent = exchangeRate.toFixed(2);
            kimchiPremiumEl.textContent = `${kimchiPremium.toFixed(2)}%`;
            btcMinedEl.textContent = `${totalBtcMined.toLocaleString()} BTC`;
            btcRemainingEl.textContent = `${btcRemaining.toLocaleString()} BTC`;
            btcDominanceEl.textContent = `${btcDominance}%`;
            fearGreedIndexEl.textContent = `${fearGreedIndex} (탐욕지수)`;
            fearGreedImageEl.src = fearGreedImage;

            // 브라우저 타이틀 업데이트
            document.title = `BTC $${parseFloat(binancePrice).toLocaleString()} | ₩${upbitPrice.toLocaleString()} | ${originalTitle}`;

            // 다크 모드일 경우 이미지 색상 반전
            if (document.body.classList.contains('dark-mode')) {
                fearGreedImageEl.style.filter = 'invert(1)';
            } else {
                fearGreedImageEl.style.filter = 'invert(0)';
            }

        } catch (error) {
            console.error('데이터 가져오기 오류:', error);
            const errorMessage = '데이터 로드 실패';
            [upbitPriceEl, binancePriceEl, exchangeRateEl, kimchiPremiumEl, 
             btcMinedEl, btcRemainingEl, btcDominanceEl, fearGreedIndexEl
            ].forEach(el => el.textContent = errorMessage);
        } finally {
            setLoading(false);
        }
        }
    }

    fetchData();
    setInterval(fetchData, 10000); // 10초마다 데이터 갱신

    toggleModeBtn.addEventListener('click', function () {
        const body = document.body;
        const isDarkMode = body.classList.contains('dark-mode');
        
        if (isDarkMode) {
            body.classList.remove('dark-mode');
            body.classList.add('light-mode');
            toggleModeBtn.textContent = '다크 모드';
        } else {
            body.classList.remove('light-mode');
            body.classList.add('dark-mode');
            toggleModeBtn.textContent = '라이트 모드';
        }

        if (body.classList.contains('dark-mode')) {
            toggleModeBtn.textContent = '라이트 모드';
            tradingviewChart.src = tradingviewChart.src.replace("theme=light", "theme=dark");
            fearGreedImageEl.style.filter = 'invert(1)';
        } else {
            toggleModeBtn.textContent = '다크 모드';
            tradingviewChart.src = tradingviewChart.src.replace("theme=dark", "theme=light");
            fearGreedImageEl.style.filter = 'invert(0)';
        }
    });
});