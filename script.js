// API 엔드포인트
const BINANCE_API = "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT";
const UPBIT_API = "https://api.upbit.com/v1/ticker?markets=KRW-BTC";
const EXCHANGE_RATE_API = "https://api.exchangerate-api.com/v4/latest/USD";
const FEAR_GREED_API = "https://api.alternative.me/fng/";

// CORS 프록시 URL (여러 옵션 제공)
const CORS_PROXIES = [
  "https://cors-anywhere.herokuapp.com/",
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
];

// 현재 사용할 프록시 인덱스
let currentProxyIndex = 0;

// 프록시 URL 가져오기 함수
function getNextProxy() {
  const proxy = CORS_PROXIES[currentProxyIndex];
  currentProxyIndex = (currentProxyIndex + 1) % CORS_PROXIES.length;
  return proxy;
}

// 데이터 업데이트 간격 (밀리초)
const UPDATE_INTERVAL = 10000;

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
    const response = await fetch(BINANCE_API, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        // Binance API 요청에 필요한 추가 헤더
      },
      mode: "cors", // CORS 모드 명시
    });

    const data = await response.json();

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
  } catch (error) {
    // 첫 번째 시도 실패시 프록시 사용 시도
    try {
      const proxy = getNextProxy();
      const response = await fetch(proxy + encodeURIComponent(BINANCE_API));
      const data = await response.json();

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
    } catch (proxyError) {
      console.error("Binance 데이터 조회 실패:", proxyError);
      return null;
    }
  }
}

// Upbit 데이터 가져오기
async function fetchUpbitData() {
  try {
    const response = await fetch(UPBIT_API);
    const [data] = await response.json();

    document.getElementById("upbit-price").textContent = `₩${formatNumber(
      data.trade_price
    )}`;
    document.getElementById("upbit-24h-high").textContent = `₩${formatNumber(
      data.high_price
    )}`;
    document.getElementById("upbit-24h-low").textContent = `₩${formatNumber(
      data.low_price
    )}`;
    document.getElementById("upbit-24h-volume").textContent = `${formatNumber(
      data.acc_trade_volume_24h,
      1
    )} BTC`;

    return parseFloat(data.trade_price);
  } catch (error) {
    console.error("Upbit 데이터 조회 실패:", error);
    return null;
  }
}

// 환율 데이터 가져오기
async function fetchExchangeRate() {
  try {
    const response = await fetch(EXCHANGE_RATE_API);
    const data = await response.json();
    const rate = data.rates.KRW;

    document.getElementById("exchange-rate").textContent = `${formatNumber(
      rate
    )}`;
    return rate;
  } catch (error) {
    console.error("환율 데이터 조회 실패:", error);
    return null;
  }
}

// 공포/탐욕 지수 가져오기
async function fetchFearGreedIndex() {
  try {
    const response = await fetch(FEAR_GREED_API);
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

// 사토시 가치 계산
function updateSatoshiValue(binancePrice, exchangeRate) {
  if (!binancePrice || !exchangeRate) return;

  const satoshiUSD = binancePrice / 100000000;
  const satoshiKRW = satoshiUSD * exchangeRate;

  document.getElementById("satoshi-usd").textContent = `$${formatNumber(
    satoshiUSD,
    6
  )}`;
  document.getElementById("satoshi-krw").textContent = `₩${formatNumber(
    satoshiKRW,
    2
  )}`;
}

// 모든 데이터 업데이트
async function updateAllData() {
  const [binancePrice, upbitPrice, exchangeRate] = await Promise.all([
    fetchBinanceData(),
    fetchUpbitData(),
    fetchExchangeRate(),
  ]);

  calculateKimchiPremium(upbitPrice, binancePrice, exchangeRate);
  updateSatoshiValue(binancePrice, exchangeRate);
  fetchFearGreedIndex();
}

// TradingView 위젯 오류 핸들링
window.addEventListener(
  "error",
  function (e) {
    if (
      e.message.includes("tradingview") ||
      e.filename.includes("tradingview")
    ) {
      console.warn("TradingView 위젯 경고:", e.message);
      return false; // 콘솔에 오류 표시 방지
    }
  },
  true
);

// DOMContentLoaded 이벤트 리스너 내부
document.addEventListener("DOMContentLoaded", () => {
  updateAllData();
  setInterval(updateAllData, UPDATE_INTERVAL);

  // TradingView 위젯 로드 상태 체크
  const tvScript = document.querySelector('script[src*="tradingview"]');
  if (tvScript) {
    tvScript.addEventListener("load", () => {
      console.log("TradingView 위젯 로드 완료");
    });
    tvScript.addEventListener("error", () => {
      console.warn("TradingView 위젯 로드 실패");
    });
  }
});
