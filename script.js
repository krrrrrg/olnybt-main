// API 엔드포인트
const BINANCE_API =
  "https://api1.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT";
const UPBIT_API =
  "https://crix-api-endpoint.upbit.com/v1/crix/candles/minutes/1?code=CRIX.UPBIT.KRW-BTC&count=1";
// 무료 환율 API로 변경
const EXCHANGE_RATE_API = "https://open.er-api.com/v6/latest/USD";
const FEAR_GREED_API = "https://api.alternative.me/fng/";
const BLOCKCHAIN_INFO_API = "https://mempool.space/api/v1/blocks/tip/height";

// 프록시 서버 설정 수정
const PROXY_URLS = [
  "https://api.allorigins.win/raw?url=",
  "https://api.codetabs.com/v1/proxy?quest=",
  "https://corsproxy.io/?",
];

let currentProxyIndex = 0;

// 프록시 URL 순환 함수
function getNextProxy() {
  const proxy = PROXY_URLS[currentProxyIndex];
  currentProxyIndex = (currentProxyIndex + 1) % PROXY_URLS.length;
  return proxy;
}

// 데이터 업데이트 간격 조정
const UPDATE_INTERVAL = 15000;

// 숫자 포맷팅 함수
const formatNumber = (number, decimals = 2) => {
  return Number(number).toLocaleString("ko-KR", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
};

// API 호출 함수 수정
async function fetchData(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        ...options.headers,
      },
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`API 호출 실패 (${url}):`, error);
    return null;
  }
}

// Binance 데이터 가져오기
async function fetchBinanceData() {
  const data = await fetchData(BINANCE_API);
  if (data?.lastPrice) {
    document.getElementById("binance-price").textContent = `$${formatNumber(
      data.lastPrice
    )}`;
    document.getElementById("binance-24h-high").textContent = `$${formatNumber(
      data.highPrice
    )}`;
    document.getElementById("binance-24h-low").textContent = `$${formatNumber(
      data.lowPrice
    )}`;
    document.getElementById("binance-24h-volume").textContent = `${formatNumber(
      data.volume,
      1
    )} BTC`;
    return parseFloat(data.lastPrice);
  } else {
    document.getElementById("binance-price").textContent = "일시적 오류";
    return null;
  }
}

// Upbit 데이터 가져오기
async function fetchUpbitData() {
  const data = await fetchData(UPBIT_API);
  if (data?.[0]?.tradePrice) {
    document.getElementById("upbit-price").textContent = `₩${formatNumber(
      data[0].tradePrice
    )}`;
    document.getElementById("upbit-24h-high").textContent = `₩${formatNumber(
      data[0].highPrice
    )}`;
    document.getElementById("upbit-24h-low").textContent = `₩${formatNumber(
      data[0].lowPrice
    )}`;
    document.getElementById("upbit-24h-volume").textContent = `${formatNumber(
      data[0].tradeVolume,
      1
    )} BTC`;
    return parseFloat(data[0].tradePrice);
  } else {
    document.getElementById("upbit-price").textContent = "일시적 오류";
    return null;
  }
}

// 환율 데이터 가져오기
async function fetchExchangeRate() {
  try {
    const response = await fetch(EXCHANGE_RATE_API);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    const rate = data.rates.KRW;

    document.getElementById("exchange-rate").textContent = `${formatNumber(
      rate
    )}`;
    return rate;
  } catch (error) {
    console.error("환율 데이터 조회 실패:", error);
    document.getElementById("exchange-rate").textContent = "일시적 오류";
    return null;
  }
}

// 공포/탐욕 지수 가져오기
async function fetchFearGreedIndex() {
  try {
    const response = await fetch(FEAR_GREED_API);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const value = data.data[0].value;
    const classification = getFearGreedClassification(value);

    document.getElementById(
      "fear-greed"
    ).textContent = `${value} (${classification})`;
  } catch (error) {
    console.error("공포/탐욕 지수 조회 실패:", error);
  }
}

// 공포/탐욕 지수 분류
function getFearGreedClassification(value) {
  if (value <= 20) return "극도의 공포";
  if (value <= 40) return "공포";
  if (value <= 60) return "중립";
  if (value <= 80) return "탐욕";
  return "극도의 탐욕";
}

// 김치프리미엄 계산
function calculateKimchiPremium(upbitPrice, binancePrice, exchangeRate) {
  if (!upbitPrice || !binancePrice || !exchangeRate) return;

  const binanceKRW = binancePrice * exchangeRate;
  const premium = ((upbitPrice - binanceKRW) / binanceKRW) * 100;
  document.getElementById("kimchi-premium").textContent = `${formatNumber(
    premium
  )}%`;
}

// 사토시 가치 계산 함수 수정
function updateSatoshiValue(binancePrice, upbitPrice) {
  // binancePrice가 있으면 USD 계산
  if (binancePrice) {
    const satoshiUSD = binancePrice / 100000000;
    document.getElementById("satoshi-usd").textContent = `$${formatNumber(
      satoshiUSD,
      6
    )}`;
  }

  // upbitPrice가 있으면 KRW 계산
  if (upbitPrice) {
    const satoshiKRW = upbitPrice / 100000000;
    document.getElementById("satoshi-krw").textContent = `₩${formatNumber(
      satoshiKRW,
      2
    )}`;
  }
}

// 채굴 데이터 가져오기
async function fetchMiningData() {
  try {
    // 총 채굴된 비트코인 조회
    const totalMinedResponse = await fetch(BLOCKCHAIN_INFO_API);

    if (!totalMinedResponse.ok) {
      throw new Error("Blockchain API 응답 오류");
    }

    const totalMined = await totalMinedResponse.text();

    // satoshi to BTC conversion (1 BTC = 100,000,000 satoshi)
    const totalBTC = parseInt(totalMined) / 100000000;
    const remainingBTC = 21000000 - totalBTC;

    // 채굴된 비트코인과 남은 채굴량 표시
    document.getElementById("btc-mined").textContent = `${formatNumber(
      totalBTC,
      0
    )} BTC`;
    document.getElementById("btc-remaining").textContent = `${formatNumber(
      remainingBTC,
      0
    )} BTC`;
  } catch (error) {
    console.error("채굴 데이터 조회 실패:", error);
    document.getElementById("btc-mined").textContent = "일시적 오류";
    document.getElementById("btc-remaining").textContent = "일시적 오류";
  }
}

// 데이터 업데이트 함수 수정
async function updateAllData() {
  try {
    const [binancePrice, upbitPrice, exchangeRate] = await Promise.all([
      fetchBinanceData().catch(() => null),
      fetchUpbitData().catch(() => null),
      fetchExchangeRate().catch(() => null),
    ]);

    // 사토시 가치 업데이트
    updateSatoshiValue(binancePrice, upbitPrice);

    // 김치프리미엄 계산
    if (binancePrice && upbitPrice && exchangeRate) {
      calculateKimchiPremium(upbitPrice, binancePrice, exchangeRate);
    }

    // 채굴 데이터 업데이트 (1분에 한 번)
    if (
      !window.lastMiningUpdate ||
      Date.now() - window.lastMiningUpdate > 60000
    ) {
      await fetchMiningData();
      window.lastMiningUpdate = Date.now();
    }

    // 공포/탐욕 지수 업데이트 (5분에 한 번)
    if (
      !window.lastFearGreedUpdate ||
      Date.now() - window.lastFearGreedUpdate > 300000
    ) {
      await fetchFearGreedIndex();
      window.lastFearGreedUpdate = Date.now();
    }
  } catch (error) {
    console.error("데이터 업데이트 실패:", error);
  }
}

// TradingView 위젯 오류 핸들링
window.addEventListener(
  "error",
  function (e) {
    if (
      e.message.includes("tradingview") ||
      e.filename.includes("tradingview")
    ) {
      // 오류 무시
      e.preventDefault();
      return true;
    }
  },
  true
);

// DOMContentLoaded 이벤트 리스너 내부
document.addEventListener("DOMContentLoaded", () => {
  console.log("데이터 로딩 시작...");

  // 다른 데이터 업데이트
  updateAllData();
  setInterval(updateAllData, UPDATE_INTERVAL);
});
