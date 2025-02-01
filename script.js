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
            const [upbitResponse, binanceResponse] = await Promise.allSettled([
                fetch('https://api.upbit.com/v1/ticker?markets=KRW-BTC'),
                fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT')
            ]);

            // 업비트 데이터 처리
            let upbitPrice = null;
            if (upbitResponse.status === 'fulfilled') {
                if (upbitResponse.value.ok) {
                    const upbitData = await upbitResponse.value.json();
                    upbitPrice = upbitData[0].trade_price;
                } else {
                    const errorText = await upbitResponse.value.text();
                    console.error('Upbit API error:', upbitResponse.value.status, errorText);
                    elements.upbitPrice.textContent = '로딩 실패';
                }
            } else {
                console.error('Upbit API failed:', upbitResponse.reason);
                elements.upbitPrice.textContent = '로딩 실패';
            }

            // 바이낸스 데이터 처리
            let binancePrice = null;
            if (binanceResponse.status === 'fulfilled') {
                if (binanceResponse.value.ok) {
                    const binanceData = await binanceResponse.value.json();
                    binancePrice = parseFloat(binanceData.lastPrice);
                } else {
                    const errorText = await binanceResponse.value.text();
                    console.error('Binance API error:', binanceResponse.value.status, errorText);
                    elements.binancePrice.textContent = '로딩 실패';
                }
            } else {
                console.error('Binance API failed:', binanceResponse.reason);
                elements.binancePrice.textContent = '로딩 실패';
            }

            // 둘 다 실패한 경우 종료
            if (!upbitPrice && !binancePrice) {
                throw new Error('Both APIs failed');
            }

            // 가격 업데이트 및 애니메이션
            updatePriceWithAnimation(elements.upbitPrice, upbitPrice, previousPrices.upbit);
            updatePriceWithAnimation(elements.binancePrice, binancePrice, previousPrices.binance);

            // 브라우저 탭 타이틀 업데이트
            document.title = `\$${binancePrice.toLocaleString()} / ₩${upbitPrice.toLocaleString()}`;

            // 이전 가격 업데이트
            previousPrices.upbit = upbitPrice;
            previousPrices.binance = binancePrice;

            // DOM 업데이트
            elements.upbitPrice.textContent = `${upbitPrice.toLocaleString()}`;
            elements.binancePrice.textContent = `${binancePrice.toLocaleString()}`;

            // 부가 데이터 가져오기
            try {
                const [fearGreedResponse, exchangeRateResponse, totalBtcResponse] = await Promise.allSettled([
                    fetch('https://api.alternative.me/fng/?limit=1'),
                    fetch('https://open.er-api.com/v6/latest/USD'),
                    fetch('https://blockchain.info/q/totalbc')
                ]);

                let fearGreed, exchangeRate, totalBtc;

                // 각 API 응답 처리
                if (fearGreedResponse.status === 'fulfilled' && fearGreedResponse.value.ok) {
                    fearGreed = await fearGreedResponse.value.json();
                }

                if (exchangeRateResponse.status === 'fulfilled' && exchangeRateResponse.value.ok) {
                    exchangeRate = await exchangeRateResponse.value.json();
                }

                if (totalBtcResponse.status === 'fulfilled' && totalBtcResponse.value.ok) {
                    totalBtc = await totalBtcResponse.value.text();
                }

                // 각 데이터 처리
                if (exchangeRate && upbitPrice && binancePrice) {
                    const usdKrwRate = exchangeRate.rates.KRW;
                    const kimchiPremiumValue = ((upbitPrice / (binancePrice * usdKrwRate) - 1) * 100).toFixed(2);
                    elements.kimchiPremium.textContent = `${kimchiPremiumValue}%`;
                } else {
                    elements.kimchiPremium.textContent = '로딩 실패';
                }

                if (totalBtc) {
                    const minedBtc = parseInt(totalBtc) / 100000000;
                    const remainingBtc = 21000000 - minedBtc;
                    elements.btcMined.textContent = `${formatNumber(minedBtc)} BTC`;
                    elements.btcRemaining.textContent = `${formatNumber(remainingBtc)} BTC`;
                } else {
                    elements.btcMined.textContent = '로딩 실패';
                    elements.btcRemaining.textContent = '로딩 실패';
                }

                if (fearGreed) {
                    elements.fearGreed.textContent = fearGreed.data[0].value;
                } else {
                    elements.fearGreed.textContent = '로딩 실패';
                }
                // 거래소 부가 데이터 처리
                if (upbitResponse.status === 'fulfilled' && upbitResponse.value.ok) {
                    const upbitData = await upbitResponse.value.json();
                    elements.upbitHigh.textContent = `${formatNumber(upbitData[0].high_price)}`;
                    elements.upbitLow.textContent = `${formatNumber(upbitData[0].low_price)}`;
                    elements.upbitVolume.textContent = `${formatNumber(upbitData[0].acc_trade_volume_24h)} BTC`;
                } else {
                    elements.upbitHigh.textContent = '로딩 실패';
                    elements.upbitLow.textContent = '로딩 실패';
                    elements.upbitVolume.textContent = '로딩 실패';
                }

                if (binanceResponse.status === 'fulfilled' && binanceResponse.value.ok) {
                    const binanceData = await binanceResponse.value.json();
                    elements.binanceHigh.textContent = `${formatNumber(parseFloat(binanceData.highPrice))}`;
                    elements.binanceLow.textContent = `${formatNumber(parseFloat(binanceData.lowPrice))}`;
                    elements.binanceVolume.textContent = `${formatNumber(parseFloat(binanceData.volume))} BTC`;
                } else {
                    elements.binanceHigh.textContent = '로딩 실패';
                    elements.binanceLow.textContent = '로딩 실패';
                    elements.binanceVolume.textContent = '로딩 실패';
                }

                // 사토시 가격 계산
                if (binancePrice && exchangeRate) {
                    elements.satoshiUsd.textContent = `$${(binancePrice / 100000000).toFixed(8)}`;
                    elements.satoshiKrw.textContent = `₩${((binancePrice * exchangeRate.rates.KRW) / 100000000).toFixed(8)}`;
                } else {
                    elements.satoshiUsd.textContent = '로딩 실패';
                    elements.satoshiKrw.textContent = '로딩 실패';
                }
            } catch (error) {
                console.error('Error fetching additional data:', error);
            }
        } catch (error) {
            console.error('Error fetching price data:', error);
            if (!elements.upbitPrice.textContent || elements.upbitPrice.textContent === '로딩 중...') {
                elements.upbitPrice.textContent = '로딩 실패';
            }
            if (!elements.binancePrice.textContent || elements.binancePrice.textContent === '로딩 중...') {
                elements.binancePrice.textContent = '로딩 실패';
            }
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
