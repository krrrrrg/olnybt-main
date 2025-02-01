// API 엔드포인트
const BINANCE_API = "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT";
const UPBIT_API = "https://api.upbit.com/v1/ticker?markets=KRW-BTC";
const EXCHANGE_RATE_API =
  "https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/usd/krw.json";
const FEAR_GREED_API = "https://api.alternative.me/fng/";

// 채굴 관련 API 추가
const BLOCKCHAIN_INFO_API = "https://blockchain.info/q/";

// 프록시 서버 설정
const PROXY_URLS = [
  "https://cors.bridged.cc/",
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
];

let currentProxyIndex = 0;

// 프록시 URL 순환
function getNextProxy() {
  const proxy = PROXY_URLS[currentProxyIndex];
  currentProxyIndex = (currentProxyIndex + 1) % PROXY_URLS.length;
  return proxy;
}

// API 호출 함수
async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const proxy = getNextProxy();
      const response = await fetch(proxy + encodeURIComponent(url), options);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
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

// Binance 데이터 가져오기
async function fetchBinanceData() {
  try {
    const data = await fetchWithRetry(BINANCE_API);
    if (data && data.lastPrice) {
      document.getElementById("binance-price").textContent = `$${formatNumber(
        data.lastPrice
      )}`;
      document.getElementById(
        "binance-24h-high"
      ).textContent = `$${formatNumber(data.highPrice)}`;
      document.getElementById("binance-24h-low").textContent = `$${formatNumber(
        data.lowPrice
      )}`;
      document.getElementById(
        "binance-24h-volume"
      ).textContent = `${formatNumber(data.volume, 1)} BTC`;
      return parseFloat(data.lastPrice);
    }
    return null;
  } catch (error) {
    console.error("Binance 데이터 조회 실패:", error);
    document.getElementById("binance-price").textContent = "일시적 오류";
    return null;
  }
}

// Upbit 데이터 가져오기
async function fetchUpbitData() {
  try {
    const data = await fetchWithRetry(UPBIT_API);
    if (data && data[0]) {
      const ticker = data[0];
      document.getElementById("upbit-price").textContent = `₩${formatNumber(
        ticker.trade_price
      )}`;
      document.getElementById("upbit-24h-high").textContent = `₩${formatNumber(
        ticker.high_price
      )}`;
      document.getElementById("upbit-24h-low").textContent = `₩${formatNumber(
        ticker.low_price
      )}`;
      document.getElementById("upbit-24h-volume").textContent = `${formatNumber(
        ticker.acc_trade_volume_24h,
        1
      )} BTC`;
      return parseFloat(ticker.trade_price);
    }
    return null;
  } catch (error) {
    console.error("Upbit 데이터 조회 실패:", error);
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
    const rate = data.krw;

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
    const [totalBTC, remainingBTC] = await Promise.all([
      fetch(BLOCKCHAIN_INFO_API + "totalbc").then((res) => res.text()),
      fetch(BLOCKCHAIN_INFO_API + "totalmined").then((res) => res.text()),
    ]);

    const total = parseInt(totalBTC) / 100000000;
    const mined = parseInt(remainingBTC) / 100000000;
    const remaining = 21000000 - mined;

    document.getElementById("btc-mined").textContent = `${formatNumber(
      mined,
      0
    )} BTC`;
    document.getElementById("btc-remaining").textContent = `${formatNumber(
      remaining,
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
    // 기존 데이터 업데이트
    const [binancePrice, upbitPrice] = await Promise.all([
      fetchBinanceData().catch(() => null),
      fetchUpbitData().catch(() => null),
    ]);

    // 사토시 가치 업데이트
    updateSatoshiValue(binancePrice, upbitPrice);

    // 환율과 김치프리미엄
    const exchangeRate = await fetchExchangeRate().catch(() => null);
    if (binancePrice && upbitPrice && exchangeRate) {
      calculateKimchiPremium(upbitPrice, binancePrice, exchangeRate);
    }

    // 채굴 데이터는 1분에 한 번만 업데이트
    if (
      !window.lastMiningUpdate ||
      Date.now() - window.lastMiningUpdate > 60000
    ) {
      await fetchMiningData();
      window.lastMiningUpdate = Date.now();
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
  updateAllData();
  setInterval(updateAllData, UPDATE_INTERVAL);
});
