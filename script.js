// 숫자 포맷팅 함수
function formatNumber(number) {
  if (number >= 1000000) {
    return (number / 1000000).toFixed(2) + "M";
  } else if (number >= 1000) {
    return (number / 1000).toFixed(1) + "K";
  }
  return number.toLocaleString();
}

document.addEventListener("DOMContentLoaded", async function () {
  // DOM 요소
  const elements = {
    upbitPrice: document.getElementById("upbit-price"),
    binancePrice: document.getElementById("binance-price"),
    exchangeRate: document.getElementById("exchange-rate"),
    fearGreed: document.getElementById("fear-greed"),
    upbitHigh: document.getElementById("upbit-24h-high"),
    upbitLow: document.getElementById("upbit-24h-low"),
    upbitVolume: document.getElementById("upbit-24h-volume"),
    binanceHigh: document.getElementById("binance-24h-high"),
    binanceLow: document.getElementById("binance-24h-low"),
    binanceVolume: document.getElementById("binance-24h-volume"),
    satoshiUsd: document.getElementById("satoshi-usd"),
    satoshiKrw: document.getElementById("satoshi-krw"),
    btcMined: document.getElementById("btc-mined"),
    btcRemaining: document.getElementById("btc-remaining"),
    kimchiPremium: document.getElementById("kimchi-premium"),
  };

  // 이전 가격 저장용 변수
  let previousPrices = {
    upbit: 0,
    binance: 0,
  };

  // 가격 변경 애니메이션 함수
  function updatePriceWithAnimation(element, newPrice, previousPrice) {
    element.classList.remove("price-up", "price-down");
    if (newPrice > previousPrice) {
      element.classList.add("price-up");
    } else if (newPrice < previousPrice) {
      element.classList.add("price-down");
    }
    setTimeout(() => {
      element.classList.remove("price-up", "price-down");
    }, 300);
  }

  // 캐싱 추가
  const CACHE_DURATION = 5 * 60 * 1000; // 5분
  let priceCache = {
    timestamp: 0,
    data: null,
  };

  async function getPriceData() {
    // 캐시가 유효한 경우
    if (Date.now() - priceCache.timestamp < CACHE_DURATION) {
      return priceCache.data;
    }

    try {
      const response = await fetch("API_URL");
      const data = await response.json();

      // 캐시 업데이트
      priceCache.data = data;
      priceCache.timestamp = Date.now();

      return data;
    } catch (error) {
      console.error("가격 데이터 가져오기 실패:", error);
      return null;
    }
  }

  // 캐시 관리 클래스
  class CacheManager {
    constructor() {
      this.cache = {};
      this.duration = {
        exchangeRate: 60 * 60 * 1000, // 1시간
        fearGreed: 60 * 60 * 1000, // 1시간
        totalBtc: 30 * 60 * 1000, // 30분
      };
      this.loadFromLocalStorage();
    }

    loadFromLocalStorage() {
      try {
        const saved = localStorage.getItem("bitcoinMonitorCache");
        if (saved) {
          const parsed = JSON.parse(saved);
          // 유효한 캐시만 불러오기
          Object.keys(parsed).forEach((key) => {
            if (this.isValid(key, parsed[key])) {
              this.cache[key] = parsed[key];
            }
          });
        }
      } catch (e) {
        console.warn("캐시 로드 오류:", e);
      }
    }

    saveToLocalStorage() {
      try {
        localStorage.setItem("bitcoinMonitorCache", JSON.stringify(this.cache));
      } catch (e) {
        console.warn("캐시 저장 오류:", e);
      }
    }

    isValid(key, data) {
      return (
        data &&
        data.timestamp &&
        Date.now() - data.timestamp < this.duration[key]
      );
    }

    get(key) {
      return this.isValid(key, this.cache[key]) ? this.cache[key].data : null;
    }

    set(key, data) {
      this.cache[key] = {
        data,
        timestamp: Date.now(),
      };
      this.saveToLocalStorage();
    }
  }

  const cacheManager = new CacheManager();

  // CORS 프록시 URL 업데이트
  const corsProxies = [
    "https://cors-anywhere.herokuapp.com/",
    "https://api.allorigins.win/raw?url=",
  ];

  // API 요청 함수
  async function fetchWithRetry(url, options = {}) {
    const {
      retries = 3,
      delay = 1000,
      cacheKey = null,
      timeout = 5000,
    } = options;

    // 캐시 확인
    if (cacheKey) {
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;
    }

    let lastError;
    for (let i = 0; i < retries; i++) {
      for (let proxy of corsProxies) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          const response = await fetch(proxy + encodeURIComponent(url), {
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`API ${url} failed: ${response.status}`);
          }

          const data = await response.json();
          if (cacheKey) cacheManager.set(cacheKey, data);
          return data;
        } catch (error) {
          lastError = error;
          console.warn(
            `Retry ${i + 1}/${retries} failed for ${proxy}${url}:`,
            error
          );
          continue;
        }
      }

      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
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
      // 업비트 API
      const upbitDataRaw = await fetchWithRetry(
        "https://api.upbit.com/v1/ticker?markets=KRW-BTC",
        {
          retries: 3,
          delay: 1000,
          timeout: 5000,
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      // 바이낸스 API
      const binanceDataRaw = await fetchWithRetry(
        "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT",
        {
          retries: 3,
          delay: 1000,
          timeout: 5000,
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 500));

      // 환율 API - 더 안정적인 API로 변경
      const exchangeRateRaw = await fetchWithRetry(
        "https://open.er-api.com/v6/latest/USD",
        {
          retries: 2,
          delay: 1000,
          cacheKey: "exchangeRate",
          timeout: 5000,
        }
      );

      // Fear & Greed Index API
      const fearGreedRaw = await fetch("https://api.alternative.me/fng/")
        .then((response) => response.json())
        .catch(() => ({ data: [{ value: "0" }] }));

      // 디버깅용 로그
      console.log("API 응답:", {
        upbit: upbitDataRaw,
        binance: binanceDataRaw,
        exchangeRate: exchangeRateRaw,
        fearGreed: fearGreedRaw,
      });

      // 데이터 처리 로직
      const upbitPrice = upbitDataRaw?.[0]?.trade_price || 0;
      const binancePrice = parseFloat(binanceDataRaw?.lastPrice || "0");
      const usdKrwRate = exchangeRateRaw?.rates?.KRW || 1300;
      const fearGreedValue = fearGreedRaw?.data?.[0]?.value || "0";

      // DOM 업데이트
      elements.upbitPrice.textContent = upbitPrice.toLocaleString();
      elements.binancePrice.textContent = binancePrice.toLocaleString();
      elements.exchangeRate.textContent = usdKrwRate.toLocaleString();
      elements.fearGreed.textContent = fearGreedValue;

      // 김치프리미엄 계산
      const kimchiPremiumValue = (
        (upbitPrice / (binancePrice * usdKrwRate) - 1) *
        100
      ).toFixed(2);

      // 가격 업데이트 및 애니메이션
      updatePriceWithAnimation(
        elements.upbitPrice,
        upbitPrice,
        previousPrices.upbit
      );
      updatePriceWithAnimation(
        elements.binancePrice,
        binancePrice,
        previousPrices.binance
      );

      // 이전 가격 업데이트
      previousPrices.upbit = upbitPrice;
      previousPrices.binance = binancePrice;

      // DOM 업데이트
      elements.upbitHigh.textContent = formatNumber(upbitDataRaw[0].high_price);
      elements.upbitLow.textContent = formatNumber(upbitDataRaw[0].low_price);
      elements.upbitVolume.textContent = `${formatNumber(
        upbitDataRaw[0].acc_trade_volume_24h
      )} BTC`;
      elements.binanceHigh.textContent = formatNumber(
        parseFloat(binanceDataRaw.highPrice)
      );
      elements.binanceLow.textContent = formatNumber(
        parseFloat(binanceDataRaw.lowPrice)
      );
      elements.binanceVolume.textContent = `${formatNumber(
        parseFloat(binanceDataRaw.volume)
      )} BTC`;
      elements.satoshiUsd.textContent = `$${(binancePrice / 100000000).toFixed(
        8
      )}`;
      elements.satoshiKrw.textContent = `₩${(upbitPrice / 100000000).toFixed(
        4
      )}`;

      // 김치프리미엄 업데이트
      elements.kimchiPremium.textContent = `${kimchiPremiumValue}%`;
      elements.kimchiPremium.classList.toggle(
        "premium-high",
        parseFloat(kimchiPremiumValue) >= 3
      );

      // 브라우저 타이틀 업데이트
      document.title = `BTC ₩${upbitPrice.toLocaleString()} | $${binancePrice.toLocaleString()}`;
    } catch (error) {
      console.error("데이터 가져오기 오류:", error);

      // 더 구체적인 에러 메시지
      const errorMessage = (() => {
        if (error.name === "AbortError") return "연결 시간 초과";
        if (error.message.includes("Failed to fetch")) return "네트워크 오류";
        if (error.message.includes("JSON")) return "데이터 형식 오류";
        return `일시적 오류`;
      })();

      // 에러 상태 표시 개선
      Object.entries(elements).forEach(([key, element]) => {
        if (!element) return;

        if (key.includes("price")) {
          element.textContent = errorMessage;
          element.classList.add("error");
        } else if (key.includes("volume")) {
          element.textContent = "0 BTC";
        } else {
          element.textContent = "---";
        }
      });

      // 에러 복구 시도
      setTimeout(() => {
        Object.values(elements).forEach((element) => {
          element?.classList.remove("error");
        });
        fetchData();
      }, 3000);
    }
  }

  // 초기 데이터 가져오기
  fetchData();

  // 1분마다 데이터 갱신
  setInterval(fetchData, 60000);
});
