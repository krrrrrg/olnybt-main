function formatNumber(number) {
  if (number >= 1000000) {
    return (number / 1000000).toFixed(2) + "M";
  } else if (number >= 1000) {
    return (number / 1000).toFixed(1) + "K";
  }
  return number.toLocaleString();
}

document.addEventListener("DOMContentLoaded", async function () {
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
    kimchiPremium: document.getElementById("kimchi-premium"),
    btcMined: document.getElementById("btc-mined"),
    btcRemaining: document.getElementById("btc-remaining"),
  };

  class CacheManager {
    constructor() {
      this.cache = {};
      this.duration = {
        exchangeRate: 30 * 60 * 1000,
        fearGreed: 60 * 60 * 1000,
      };
      this.loadFromLocalStorage();
    }

    loadFromLocalStorage() {
      try {
        const saved = localStorage.getItem("bitcoinMonitorCache");
        if (saved) {
          const parsed = JSON.parse(saved);
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

  const API_ENDPOINTS = {
    upbit: {
      url: "https://api.upbit.com/v1/ticker?markets=KRW-BTC",
      proxy: "https://api.allorigins.win/raw?url=",
    },
    binance: {
      url: "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
      proxy: "https://api.allorigins.win/raw?url=",
    },
    exchangeRate: {
      url: "https://open.er-api.com/v6/latest/USD",
      proxy: "",
    },
    totalBtc: {
      url: "https://blockchain.info/q/totalbc",
      proxy: "https://api.allorigins.win/raw?url=",
    },
  };

  const UPDATE_INTERVALS = {
    price: 5000,
    volume: 60000,
    other: 300000,
  };

  let previousPrices = {
    upbit: 0,
    binance: 0,
  };

  function updatePriceWithAnimation(element, newPrice, previousPrice) {
    if (previousPrice > 0) {
      element.classList.remove("price-up", "price-down");
      if (newPrice > previousPrice) {
        element.classList.add("price-up");
      } else if (newPrice < previousPrice) {
        element.classList.add("price-down");
      }

      setTimeout(() => {
        element.classList.remove("price-up", "price-down");
      }, 500);
    }

    element.textContent = newPrice.toLocaleString();
  }

  async function fetchWithRetry(endpoint, options = {}) {
    const {
      retries = 3,
      delay = 1000,
      cacheKey = null,
      timeout = 5000,
    } = options;
    const { url, proxy } =
      typeof endpoint === "string" ? { url: endpoint, proxy: "" } : endpoint;

    if (cacheKey) {
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;
    }

    let lastError;
    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const finalUrl = proxy ? `${proxy}${encodeURIComponent(url)}` : url;
        const response = await fetch(finalUrl, {
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            Origin: window.location.origin,
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`API ${url} failed: ${response.status}`);
        }

        const rawData = await response.json();
        let data;
        if (url.includes("api.upbit.com")) {
          data = Array.isArray(rawData)
            ? {
                trade_price: rawData[0].trade_price,
                high_price: rawData[0].high_price,
                low_price: rawData[0].low_price,
                acc_trade_volume_24h:
                  rawData[0].acc_trade_volume_24h ||
                  rawData[0].acc_trade_volume ||
                  0,
              }
            : rawData;
        } else if (url.includes("blockchain.info")) {
          data = parseInt(rawData);
        } else if (url.includes("binance.com")) {
          data = rawData;
        } else {
          data = rawData;
        }

        if (cacheKey) cacheManager.set(cacheKey, data);
        return data;
      } catch (error) {
        lastError = error;
        console.warn(`Retry ${i + 1}/${retries} failed for ${url}:`, error);
        if (i < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)));
        }
      }
    }

    throw lastError;
  }

  async function fetchData() {
    try {
      const [
        upbitDataRaw,
        binanceDataRaw,
        exchangeRateRaw,
        fearGreedRaw,
        totalBtcRaw,
      ] = await Promise.all([
        fetchWithRetry(API_ENDPOINTS.upbit),
        fetchWithRetry(API_ENDPOINTS.binance),
        fetchWithRetry(API_ENDPOINTS.exchangeRate, {
          cacheKey: "exchangeRate",
        }),
        fetch("https://api.alternative.me/fng/").then((r) => r.json()),
        fetchWithRetry(API_ENDPOINTS.totalBtc),
      ]);

      const upbitData = Array.isArray(upbitDataRaw)
        ? upbitDataRaw[0]
        : upbitDataRaw;
      const binanceData = binanceDataRaw;

      const upbitPrice = upbitData?.trade_price || 0;
      const binancePrice = parseFloat(binanceData.price || "0");
      const usdKrwRate = exchangeRateRaw?.rates?.KRW || 1300;
      const fearGreedValue = fearGreedRaw?.data?.[0]?.value || "0";

      const minedBtc = parseInt(totalBtcRaw) / 100000000;
      const remainingBtc = 21000000 - minedBtc;

      updatePrices(upbitPrice, binancePrice, usdKrwRate, fearGreedValue);
      updateDetails(upbitData, binanceData);
      updateKimchiPremium(upbitPrice, binancePrice, usdKrwRate);
      updateMiningInfo(minedBtc, remainingBtc);
    } catch (error) {
      console.error("데이터 가져오기 오류:", error);
      handleError(error);
    }
  }

  function updatePrices(upbitPrice, binancePrice, usdKrwRate, fearGreedValue) {
    elements.upbitPrice.textContent = upbitPrice.toLocaleString();
    elements.binancePrice.textContent = binancePrice.toLocaleString();
    elements.exchangeRate.textContent = usdKrwRate.toLocaleString();
    elements.fearGreed.textContent = fearGreedValue;
    elements.satoshiUsd.textContent = `$${(binancePrice / 100000000).toFixed(
      8
    )}`;
    elements.satoshiKrw.textContent = `₩${(upbitPrice / 100000000).toFixed(4)}`;
  }

  function updateDetails(upbitData, binanceData) {
    if (upbitData) {
      elements.upbitHigh.textContent = formatNumber(upbitData.high_price || 0);
      elements.upbitLow.textContent = formatNumber(upbitData.low_price || 0);
      elements.upbitVolume.textContent = `${formatNumber(
        upbitData.acc_trade_volume_24h || 0
      )} BTC`;
    }

    if (binanceData) {
      const price = parseFloat(binanceData.price || "0");
      elements.binanceHigh.textContent = formatNumber(price);
      elements.binanceLow.textContent = formatNumber(price);
      elements.binanceVolume.textContent = `${formatNumber(
        parseFloat(binanceData.volume || "0")
      )} BTC`;
    }
  }

  function updateKimchiPremium(upbitPrice, binancePrice, usdKrwRate) {
    const kimchiPremiumValue = (
      (upbitPrice / (binancePrice * usdKrwRate) - 1) *
      100
    ).toFixed(2);
    elements.kimchiPremium.textContent = `${kimchiPremiumValue}%`;
    elements.kimchiPremium.classList.toggle(
      "premium-high",
      parseFloat(kimchiPremiumValue) >= 3
    );
  }

  function updateMiningInfo(minedBtc, remainingBtc) {
    elements.btcMined.textContent = `${minedBtc.toLocaleString()} BTC`;
    elements.btcRemaining.textContent = `${remainingBtc.toLocaleString()} BTC`;
  }

  function handleError(error) {
    const errorMessage = (() => {
      if (error.name === "AbortError") return "연결 시간 초과";
      if (error.message.includes("Failed to fetch")) return "네트워크 오류";
      if (error.message.includes("JSON")) return "데이터 형식 오류";
      if (error.message.includes("403")) return "API 접근 제한";
      if (error.message.includes("429")) return "요청 한도 초과";
      if (error.message.includes("404")) return "데이터 없음";
      if (error.message.includes("500")) return "서버 오류";
      if (error.message.includes("undefined")) return "데이터 로드 중...";
      if (error.message.includes("aborted")) return "요청 취소됨";
      return "일시적 오류";
    })();

    const retryDelay = error.message.includes("429") ? 5000 : 3000;

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

    setTimeout(() => {
      Object.values(elements).forEach((element) => {
        element?.classList.remove("error");
      });
      fetchData();
    }, retryDelay);
  }

  async function fetchPriceData() {
    try {
      const [upbitDataRaw, binanceDataRaw, exchangeRateRaw] = await Promise.all(
        [
          fetchWithRetry(API_ENDPOINTS.upbit),
          fetchWithRetry(API_ENDPOINTS.binance),
          fetchWithRetry(API_ENDPOINTS.exchangeRate, {
            cacheKey: "exchangeRate",
          }),
        ]
      );

      const upbitData = Array.isArray(upbitDataRaw)
        ? upbitDataRaw[0]
        : upbitDataRaw;
      const binanceData = binanceDataRaw;

      const upbitPrice = upbitData?.trade_price || 0;
      const binancePrice = parseFloat(binanceData.price || "0");
      const usdKrwRate = exchangeRateRaw?.rates?.KRW || 1300;

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

      elements.exchangeRate.textContent = usdKrwRate.toLocaleString();

      elements.satoshiUsd.textContent = `$${(binancePrice / 100000000).toFixed(
        8
      )}`;
      elements.satoshiKrw.textContent = `₩${(upbitPrice / 100000000).toFixed(
        4
      )}`;

      const kimchiPremiumValue = (
        (upbitPrice / (binancePrice * usdKrwRate) - 1) *
        100
      ).toFixed(2);
      elements.kimchiPremium.textContent = `${kimchiPremiumValue}%`;
      elements.kimchiPremium.classList.toggle(
        "premium-high",
        parseFloat(kimchiPremiumValue) >= 3
      );

      previousPrices.upbit = upbitPrice;
      previousPrices.binance = binancePrice;
    } catch (error) {
      console.error("가격 데이터 가져오기 오류:", error);
      handleError(error);
    }
  }

  fetchData();
  fetchPriceData();

  let priceTimer = setInterval(fetchPriceData, UPDATE_INTERVALS.price);
  let dataTimer = setInterval(fetchData, UPDATE_INTERVALS.volume);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearInterval(priceTimer);
      clearInterval(dataTimer);
    } else {
      fetchPriceData();
      fetchData();
      priceTimer = setInterval(fetchPriceData, UPDATE_INTERVALS.price);
      dataTimer = setInterval(fetchData, UPDATE_INTERVALS.volume);
    }
  });
});
