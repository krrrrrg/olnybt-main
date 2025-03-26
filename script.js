// API 엔드포인트 정리
const ENDPOINTS = {
  BINANCE: "https://api1.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT",
  EXCHANGE_RATE:
    "https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?interval=1m&range=1d",
  FEAR_GREED: "https://api.alternative.me/fng/",
  BLOCKCHAIN: "https://mempool.space/api/blocks/tip/height",
  BINANCE_WS: "wss://stream.binance.com/stream?streams=btcusdt@miniTicker",
  UPBIT_WS: "wss://api.upbit.com/websocket/v1",
  MEMPOOL_WS: "wss://mempool.space/api/v1/ws",
  // https://chainlist.org 에서 작동 가능한 노드 찾을 수 있음
  ETH_RPC: "https://rpc.mevblocker.io",
};

const promises = {
  binancePromise: null,
  upbitPromise: null,
};

// https://data.chain.link/feeds/ethereum/mainnet/krw-usd
const CHAINLINK_KRW_FEED = "0x01435677FB11763550905594A16B645847C1d0F3";

// 비트코인 전송당 바이트 (세그윗 기준)
const VBYTES_PER_TX = 144;

// CORS 프록시 설정
const CORS_PROXY = "https://corsproxy.io/?";
const PROXY_API_KEY = "temp_d89c2c8b46d96b86aa0c11ddd3dd"; // 임시 키, 나중에 변경 필요

// 불필요한 프록시 관련 코드 제거
const UPDATE_INTERVAL = 300000;

// 바이낸스 API용 프록시
const BINANCE_PROXY = "https://api.allorigins.win/raw?url=";

// 숫자 포맷팅 함수 수정
const formatNumber = (number, decimals = 2, isKRW = false) => {
  return Number(number).toLocaleString("ko-KR", {
    maximumFractionDigits: isKRW ? 0 : decimals,
    minimumFractionDigits: isKRW ? 0 : decimals,
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

// 브라우저 탭 타이틀 업데이트 함수
function updatePageTitle(binancePrice, upbitPrice) {
  if (binancePrice && upbitPrice) {
    document.title = `₿ $${formatNumber(binancePrice)} | ₩${formatNumber(
      upbitPrice
    )}`;
  }
}

// Binance 데이터 가져오기 함수 수정
async function fetchBinanceData() {
  try {
    const response = await fetch(CORS_PROXY + ENDPOINTS.BINANCE);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();

    const { lastPrice, highPrice, lowPrice, volume } = data || {};

    if (lastPrice) {
      const price = parseFloat(lastPrice);
      document.getElementById("binance-price").textContent = `$${formatNumber(
        price
      )}`;
      document.getElementById(
        "binance-24h-high"
      ).textContent = `$${formatNumber(highPrice)}`;
      document.getElementById("binance-24h-low").textContent = `$${formatNumber(
        lowPrice
      )}`;
      document.getElementById(
        "binance-24h-volume"
      ).textContent = `${formatNumber(volume, 1)} BTC`;

      // 전역 변수에 저장
      window.binancePrice = price;
      // 타이틀 업데이트
      updatePageTitle(window.binancePrice, window.upbitPrice);
      return price;
    }
  } catch (error) {
    console.error("Binance 데이터 조회 실패:", error);
  }

  document.getElementById("binance-price").textContent = "일시적 오류";
  return null;
}

// 바이낸스 웹소켓 연결
function setupBinanceWebSocket() {
  const ws = new WebSocket(ENDPOINTS.BINANCE_WS);

  ws.onopen = () => {
    console.log("Binance 웹소켓과 연결됨");
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)?.data;

      if (!data?.c) {
        return;
      }

      const { c: lastPrice, h: highPrice, l: lowPrice, v: volume } = data;

      const price = parseFloat(lastPrice);
      document.getElementById("binance-price").textContent = `$${formatNumber(
        price
      )}`;
      document.getElementById(
        "binance-24h-high"
      ).textContent = `$${formatNumber(highPrice)}`;
      document.getElementById("binance-24h-low").textContent = `$${formatNumber(
        lowPrice
      )}`;
      document.getElementById(
        "binance-24h-volume"
      ).textContent = `${formatNumber(volume, 1)} BTC`;

      const satoshiUSD = price / 100000000;
      document.getElementById("satoshi-usd").textContent = `$${formatNumber(
        satoshiUSD,
        6
      )}`;

      // 전역 변수에 저장
      window.binancePrice = price;
      // 타이틀 업데이트
      updatePageTitle(window.binancePrice, window.upbitPrice);

      if (typeof promises.binancePromise == "function") {
        promises.binancePromise(price);

        promises.binancePromise = null;
      }

      return price;
    } catch (error) {
      console.error("Binance 웹소켓 데이터 처리 실패:", error);
    }
  };

  ws.onerror = (error) => {
    console.error("Binance 웹소켓 에러:", error);
  };

  ws.onclose = () => {
    console.log("Binance 웹소켓 연결 종료");
    setTimeout(setupBinanceWebSocket, 3000);
  };
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
    console.log("Upbit 웹소켓과 연결됨");
  };

  ws.onmessage = (event) => {
    try {
      const enc = new TextDecoder("utf-8");
      const data = JSON.parse(enc.decode(event.data));

      if (!data?.trade_price) {
        return;
      }

      const { trade_price, high_price, low_price, acc_trade_volume_24h } = data;

      document.getElementById("upbit-price").textContent = `₩${formatNumber(
        trade_price,
        0
      )}`;
      document.getElementById("upbit-24h-high").textContent = `₩${formatNumber(
        high_price,
        0
      )}`;
      document.getElementById("upbit-24h-low").textContent = `₩${formatNumber(
        low_price,
        0
      )}`;
      document.getElementById("upbit-24h-volume").textContent = `${formatNumber(
        acc_trade_volume_24h,
        1
      )} BTC`;

      const satoshiKRW = trade_price / 100000000;
      document.getElementById("satoshi-krw").textContent = `₩${formatNumber(
        satoshiKRW,
        2
      )}`;

      // 전역 변수에 저장
      window.upbitPrice = trade_price;
      window.upbitSat = satoshiKRW;
      // 타이틀 업데이트
      updatePageTitle(window.binancePrice, window.upbitPrice);

      if (typeof promises.upbitPromise == "function") {
        promises.upbitPromise(trade_price);

        promises.upbitPromise = null;
      }

      // 김치프리미엄 계산 추가
      calculateKimchiPremium(
        window.upbitPrice,
        window.binancePrice,
        window.exchangeRate
      );
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

// 실시간 비트코인 블록 / 수수료 / 채굴 데이터 수집
function setupMempoolWebSocket() {
  const ws = new WebSocket(ENDPOINTS.MEMPOOL_WS);

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        action: "want",
        data: ["stats"],
      })
    );
    console.log("Mempool 웹소켓과 연결됨");
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (!data?.da?.nextRetargetHeight) {
        return;
      }

      const {
        da: { nextRetargetHeight, remainingBlocks },
        fees: { fastestFee },
      } = data;

      const blockHeight = nextRetargetHeight - remainingBlocks;
      const halvings = Math.floor(blockHeight / 210000);
      let totalMinedBTC = 0;
      let count = 0;
      let coins = 50;

      while (halvings >= count) {
        const blocks = halvings > count ? 210000 : blockHeight % 210000;

        totalMinedBTC += coins * blocks;
        coins = coins / 2;
        count++;
      }
      coins = coins * 2;

      const issuancePerYear = (210000 * coins) / 4;
      const currentInflation = (issuancePerYear * 100) / totalMinedBTC;
      const remainingBTC = 21000000 - totalMinedBTC;

      document.getElementById("btc-height").textContent = `${formatNumber(
        blockHeight,
        0
      )}`;
      document.getElementById("btc-fees").textContent = `${fastestFee} sat/vB ${
        window.upbitSat
          ? `
        ( ₩${formatNumber(fastestFee * VBYTES_PER_TX * window.upbitSat, 0)} )
      `
          : ""
      }`;
      document.getElementById("btc-mined").textContent = `${formatNumber(
        totalMinedBTC,
        0
      )} BTC`;
      document.getElementById("btc-remaining").textContent = `${formatNumber(
        remainingBTC,
        0
      )} BTC`;
      document.getElementById("btc-inflation").textContent = `${formatNumber(
        currentInflation,
        2
      )}% ( ${formatNumber(coins, 2)} BTC )`;
    } catch (error) {
      console.error("Mempool 웹소켓 데이터 처리 실패:", error);
    }
  };

  ws.onerror = (error) => {
    console.error("Mempool 웹소켓 에러:", error);
  };

  ws.onclose = () => {
    console.log("Mempool 웹소켓 연결 종료");
    setTimeout(setupMempoolWebSocket, 3000);
  };

  return ws;
}

const FeedABI = [
  {
    inputs: [],
    name: "latestAnswer",
    outputs: [{ internalType: "int256", name: "", type: "int256" }],
    stateMutability: "view",
    type: "function",
  },
];

// 체인링크 온체인 환율 (0.15% 마다 업데이트)
async function fetchChainlinkKRW() {
  try {
    const staticNetwork = new ethers.Network("eth", 1);

    const provider = new ethers.JsonRpcProvider(
      ENDPOINTS.ETH_RPC,
      staticNetwork,
      {
        staticNetwork,
      }
    );

    const krwDataFeed = new ethers.BaseContract(
      CHAINLINK_KRW_FEED,
      FeedABI,
      provider
    );

    const answer = await krwDataFeed.latestAnswer();

    if (!answer) {
      throw new Error("Invalid feed data");
    }

    const rate = 10 ** 8 / Number(answer);

    document.getElementById("exchange-rate").textContent = `₩${formatNumber(
      rate
    )}`;
    window.exchangeRate = rate;

    // 환율 업데이트 시 김치프리미엄 재계산
    calculateKimchiPremium(
      window.upbitPrice,
      window.binancePrice,
      window.exchangeRate
    );

    return rate;
  } catch (error) {
    console.error("환율 데이터 조회 실패:", error);
    if (!window.exchangeRate) {
      document.getElementById("exchange-rate").textContent = "일시적 오류";
    }
    return null;
  }
}

// 환율 데이터 가져오기
async function fetchExchangeRate() {
  try {
    const response = await fetch(CORS_PROXY + ENDPOINTS.EXCHANGE_RATE);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    if (data?.chart?.result?.[0]?.meta?.regularMarketPrice) {
      const rate = data.chart.result[0].meta.regularMarketPrice;
      document.getElementById("exchange-rate").textContent = `₩${formatNumber(
        rate
      )}`;
      window.exchangeRate = rate;

      // 환율 업데이트 시 김치프리미엄 재계산
      calculateKimchiPremium(
        window.upbitPrice,
        window.binancePrice,
        window.exchangeRate
      );
      return rate;
    }
    throw new Error("Invalid exchange rate data");
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
  if (!upbitPrice || !binancePrice || !exchangeRate) {
    document.getElementById("kimchi-premium").textContent = "로딩 중...";
    return;
  }

  try {
    // 바이낸스 가격을 원화로 변환
    const binanceKRW = binancePrice * exchangeRate;
    // 프리미엄 계산: ((업비트가격 - 바이낸스원화가격) / 바이낸스원화가격) * 100
    const premium = ((upbitPrice - binanceKRW) / binanceKRW) * 100;

    document.getElementById("kimchi-premium").textContent = `${formatNumber(
      premium,
      2
    )}%`;
  } catch (error) {
    console.error("김치프리미엄 계산 실패:", error);
    document.getElementById("kimchi-premium").textContent = "계산 오류";
  }
}

// 사토시 가치 업데이트 함수 단순화
function updateSatoshiValue(binancePrice, upbitPrice) {
  // USD 사토시 가치
  if (binancePrice) {
    const satoshiUSD = binancePrice / 100000000;
    document.getElementById("satoshi-usd").textContent = `$${formatNumber(
      satoshiUSD,
      6
    )}`;
  }

  // KRW 사토시 가치
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

    const blockHeight = parseInt(await response.text());
    const halvings = Math.floor(blockHeight / 210000);
    let totalMinedBTC = 0;
    let count = 0;
    let coins = 50;

    while (halvings >= count) {
      const blocks = halvings > count ? 210000 : blockHeight % 210000;

      totalMinedBTC += coins * blocks;
      coins = coins / 2;
      count++;
    }

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
    /**
    const [binancePrice, exchangeRate] = await Promise.all([
      fetchBinanceData().catch(() => null),
      fetchExchangeRate().catch(() => null),
    ]);

    // binancePrice와 exchangeRate를 전역 변수로 저장
    window.binancePrice = binancePrice;
    window.exchangeRate = exchangeRate;

    // 사토시 가치 업데이트 (upbitPrice는 웹소켓에서 업데이트)
    updateSatoshiValue(window.binancePrice, window.upbitPrice);

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
    **/
    await Promise.all([fetchChainlinkKRW(), fetchFearGreedIndex()]);
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

// 업비트 초기 가격 조회 함수 추가
async function getInitialUpbitPrice() {
  try {
    const response = await fetch(
      "https://api.upbit.com/v1/ticker?markets=KRW-BTC"
    );
    const [data] = await response.json();
    if (data?.trade_price) {
      const price = data.trade_price;
      document.getElementById("upbit-price").textContent = `₩${formatNumber(
        price,
        0
      )}`;
      document.getElementById("upbit-24h-high").textContent = `₩${formatNumber(
        data.high_price,
        0
      )}`;
      document.getElementById("upbit-24h-low").textContent = `₩${formatNumber(
        data.low_price,
        0
      )}`;
      document.getElementById("upbit-24h-volume").textContent = `${formatNumber(
        data.acc_trade_volume_24h,
        1
      )} BTC`;

      window.upbitPrice = price;
      // 초기 김치프리미엄 계산
      calculateKimchiPremium(
        window.upbitPrice,
        window.binancePrice,
        window.exchangeRate
      );
      return price;
    }
  } catch (error) {
    console.error("업비트 초기 가격 조회 실패:", error);
  }
  return null;
}

// DOMContentLoaded 이벤트 리스너 수정
document.addEventListener("DOMContentLoaded", async () => {
  console.log("데이터 로딩 시작...");

  // 초기 업비트 가격 조회
  // 웹소캣 연결을 막는 것 같아 비활성화
  // await getInitialUpbitPrice();

  const upbitPromise = new Promise(
    (resolve) => (promises.upbitPromise = resolve)
  );
  const binancePromise = new Promise(
    (resolve) => (promises.binancePromise = resolve)
  );

  // Upbit 웹소켓 연결
  const upbitWs = setupUpbitWebSocket();
  const bnbWs = setupBinanceWebSocket();

  await Promise.all([upbitPromise, binancePromise]);

  const mempoolWs = setupMempoolWebSocket();

  // 다른 데이터 업데이트
  updateAllData();
  setInterval(updateAllData, UPDATE_INTERVAL);

  // 페이지 언로드 시 웹소켓 연결 종료
  window.addEventListener("beforeunload", () => {
    upbitWs.close();
    bnbWs.close();
    mempoolWs.close();
  });
});

// 비트코인 순위 확인 함수
function checkRanking() {
  const amount = parseFloat(document.getElementById("btc-amount").value);

  if (isNaN(amount) || amount < 0) {
    alert("올바른 비트코인 수량을 입력하세요.");
    return;
  }

  // 2024년 2월 현재 데이터 (BitInfoCharts)
  const totalAddresses = 52_640_000;
  let percent, rank;

  // 실제 분포 데이터 기반
  if (amount >= 100) {
    percent = 0.01;
    rank = 5_264;
  } else if (amount >= 10) {
    percent = 0.13;
    rank = 68_432;
  } else if (amount >= 1) {
    percent = 1.92;
    rank = 1_010_688;
  } else if (amount >= 0.1) {
    percent = 5.76;
    rank = 3_032_064;
  } else if (amount >= 0.01) {
    percent = 14.12;
    rank = 7_432_768;
  } else if (amount >= 0.001) {
    percent = 33.67;
    rank = 17_723_888;
  } else {
    percent = 100;
    rank = totalAddresses;
  }

  document.getElementById("btc-percent").textContent = `상위 ${percent.toFixed(
    2
  )}% 이내`;
  document.getElementById("btc-rank").textContent = `${formatNumber(
    rank,
    0
  )}위 이내`;
}
