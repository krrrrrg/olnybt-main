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

    // 데이터 가져오기
    async function fetchData() {
        try {
            // 주요 가격 데이터 먼저 가져오기
            const [upbitResponse, binanceResponse] = await Promise.all([
                fetch('https://api.upbit.com/v1/ticker?markets=KRW-BTC'),
                fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT')
            ]);

            if (!upbitResponse.ok || !binanceResponse.ok) {
                throw new Error('Price API failed');
            }

            const [upbitData, binanceData] = await Promise.all([
                upbitResponse.json(),
                binanceResponse.json()
            ]);

            const upbitPrice = upbitData[0].trade_price;
            const binancePrice = parseFloat(binanceData.lastPrice);

            // 가격 업데이트 및 애니메이션
            updatePriceWithAnimation(elements.upbitPrice, upbitPrice, previousPrices.upbit);
            updatePriceWithAnimation(elements.binancePrice, binancePrice, previousPrices.binance);

            // 브라우저 탭 타이틀 업데이트
            document.title = `$${binancePrice.toLocaleString()} | ₩${upbitPrice.toLocaleString()} BTC`;

            // 이전 가격 업데이트
            previousPrices.upbit = upbitPrice;
            previousPrices.binance = binancePrice;

            // DOM 업데이트
            elements.upbitPrice.textContent = `${upbitPrice.toLocaleString()}`;
            elements.binancePrice.textContent = `${binancePrice.toLocaleString()}`;

            // 부가 데이터 가져오기
            try {
                const [fearGreedResponse, exchangeRateResponse, totalBtcResponse] = await Promise.all([
                    fetch('https://api.alternative.me/fng/?limit=1'),
                    fetch('https://open.er-api.com/v6/latest/USD'),
                    fetch('https://blockchain.info/q/totalbc')
                ]);

                const [fearGreed, exchangeRate, totalBtc] = await Promise.all([
                    fearGreedResponse.json(),
                    exchangeRateResponse.json(),
                    totalBtcResponse.text()
                ]);

                const usdKrwRate = exchangeRate.rates.KRW;
                const minedBtc = parseInt(totalBtc) / 100000000;
                const remainingBtc = 21000000 - minedBtc;
                
                // 김치프리미엄 계산
                const kimchiPremiumValue = ((upbitPrice / (binancePrice * usdKrwRate) - 1) * 100).toFixed(2);
            
                // 부가 데이터 DOM 업데이트
                elements.upbitHigh.textContent = `${formatNumber(upbitData[0].high_price)}`;
                elements.upbitLow.textContent = `${formatNumber(upbitData[0].low_price)}`;
                elements.upbitVolume.textContent = `${formatNumber(upbitData[0].acc_trade_volume_24h)} BTC`;
                
                elements.binanceHigh.textContent = `${formatNumber(parseFloat(binanceData.highPrice))}`;
                elements.binanceLow.textContent = `${formatNumber(parseFloat(binanceData.lowPrice))}`;
                elements.binanceVolume.textContent = `${formatNumber(parseFloat(binanceData.volume))} BTC`;
                
                elements.satoshiUsd.textContent = `$${(binancePrice / 100000000).toFixed(8)}`;
                elements.satoshiKrw.textContent = `₩${((binancePrice * usdKrwRate) / 100000000).toFixed(8)}`;
                
                elements.btcMined.textContent = `${formatNumber(minedBtc)} BTC`;
                elements.btcRemaining.textContent = `${formatNumber(remainingBtc)} BTC`;
                
                elements.kimchiPremium.textContent = `${kimchiPremiumValue}%`;
                elements.fearGreed.textContent = fearGreed.data[0].value;
            } catch (error) {
                console.error('Error fetching additional data:', error);
            }(upbitData[0].high_price)}`;
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
