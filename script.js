// API 엔드포인트 정리
const ENDPOINTS = {
  BINANCE: "https://api1.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT",
  EXCHANGE_RATE: "https://api.exchangerate-api.com/v4/latest/USD",
  FEAR_GREED: "https://api.alternative.me/fng/",
  BLOCKCHAIN: "https://mempool.space/api/blocks/tip/height",
  UPBIT_WS: "wss://api.upbit.com/websocket/v1",
};

// CORS 프록시 설정
const CORS_PROXY = "https://corsproxy.io/?";
const PROXY_API_KEY = "temp_d89c2c8b46d96b86aa0c11ddd3dd"; // 임시 키, 나중에 변경 필요

// 불필요한 프록시 관련 코드 제거
const UPDATE_INTERVAL = 15000;

// 바이낸스 API용 프록시
const BINANCE_PROXY = "https://api.allorigins.win/raw?url=";

// 숫자 포맷팅 함수
const formatNumber = (number, decimals = 2) => {
  return Number(number).toLocaleString("ko-KR", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  });
};

// API 호출 함수 수정
async function fetchData(url) {
  const retries = 3;
  let lastError;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(CORS_PROXY + url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "x-cors-api-key": PROXY_API_KEY,
        },
      });

      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  console.error(`API 호출 실패 (${url}):`, lastError);
  return null;
}

// Binance 데이터 가져오기 수정
async function fetchBinanceData() {
  try {
    const response = await fetch(CORS_PROXY + ENDPOINTS.BINANCE);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    if (data?.lastPrice) {
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
  } catch (error) {
    console.error("Binance 데이터 조회 실패:", error);
  }

  document.getElementById("binance-price").textContent = "일시적 오류";
  return null;
}

// Upbit 웹소켓 설정 수정
function setupUpbitWebSocket() {
  const ws = new WebSocket(ENDPOINTS.UPBIT_WS);

  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    const message = JSON.stringify([
      { ticket: "UNIQUE_TICKET" },
      { type: "ticker", codes: ["KRW-BTC"] },
    ]);
    ws.send(message);
  };

  ws.onmessage = (event) => {
    try {
      const enc = new TextDecoder("utf-8");
      const data = JSON.parse(enc.decode(event.data));

      if (data?.trade_price) {
        document.getElementById("upbit-price").textContent = `₩${formatNumber(
          data.trade_price
        )}`;
        document.getElementById(
          "upbit-24h-high"
        ).textContent = `₩${formatNumber(data.high_price)}`;
        document.getElementById("upbit-24h-low").textContent = `₩${formatNumber(
          data.low_price
        )}`;
        document.getElementById(
          "upbit-24h-volume"
        ).textContent = `${formatNumber(data.acc_trade_volume_24h, 1)} BTC`;

        // 김치프리미엄 계산을 위해 가격 저장
        window.upbitPrice = data.trade_price;
        if (window.binancePrice && window.exchangeRate) {
          calculateKimchiPremium(
            window.upbitPrice,
            window.binancePrice,
            window.exchangeRate
          );
        }
      }
    } catch (error) {
      console.error("Upbit 웹소켓 데이터 처리 실패:", error);
    }
  };

  ws.onerror = (error) => {
    console.error("Upbit 웹소켓 에러:", error);
  };

  ws.onclose = () => {
    console.log("Upbit 웹소켓 연결 종료");
    setTimeout(setupUpbitWebSocket, 3000);
  };

  return ws;
}

// 환율 데이터 가져오기
async function fetchExchangeRate() {
  try {
    const response = await fetch(ENDPOINTS.EXCHANGE_RATE);
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
    const response = await fetch(ENDPOINTS.FEAR_GREED);

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

// 채굴 데이터 가져오기 함수 수정
async function fetchMiningData() {
  try {
    const response = await fetch(ENDPOINTS.BLOCKCHAIN);
    if (!response.ok) throw new Error("Blockchain API 응답 오류");

    const blockHeight = await response.text();
    const totalMinedBTC = parseInt(blockHeight) * 6.25 + 7500000; // 초기 채굴량 포함
    const remainingBTC = 21000000 - totalMinedBTC;

    document.getElementById("btc-mined").textContent = `${formatNumber(
      totalMinedBTC,
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
    const [binancePrice, exchangeRate] = await Promise.all([
      fetchBinanceData().catch(() => null),
      fetchExchangeRate().catch(() => null),
    ]);

    // binancePrice와 exchangeRate를 전역 변수로 저장
    window.binancePrice = binancePrice;
    window.exchangeRate = exchangeRate;

    // 사토시 가치 업데이트 (upbitPrice는 웹소켓에서 업데이트)
    updateSatoshiValue(binancePrice, window.upbitPrice);

    // 김치프리미엄은 웹소켓에서 계산됨

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

  // Upbit 웹소켓 연결
  const upbitWs = setupUpbitWebSocket();

  // 다른 데이터 업데이트
  updateAllData();
  setInterval(updateAllData, UPDATE_INTERVAL);

  // 페이지 언로드 시 웹소켓 연결 종료
  window.addEventListener("beforeunload", () => {
    upbitWs.close();
  });
});
