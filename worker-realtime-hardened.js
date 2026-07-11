/**
 * Cloudflare Worker - FinTrack AI TWSE Gateway
 * V3.2：批次查詢 + Worker 層級 5 秒快取 + 標準化 JSON 輸出
 *       + 防快取時間戳 + 逐檔失敗重試(3次/漸進backoff) + 失敗 logging + 舊端點 retry 保護
 */

const TWSE_BASE = "https://mis.twse.com.tw";
const ALLOWED_ORIGINS = ["*"];
const CACHE_TTL = 5;
const RETRY_DELAYS = [0, 600, 1200]; // 3 次嘗試，間隔漸進拉長

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/realtime") {
      return handleRealtimeBatch(request, url, ctx);
    }

    const allowedPaths = [
      "/stock/api/getStockInfo.jsp",
      "/stock/api/getStockPrice.jsp",
    ];
    const isAllowed = allowedPaths.some((p) =>
      url.pathname.startsWith(p.split("?")[0])
    );
    if (!isAllowed) {
      return new Response(
        JSON.stringify({ error: "Path not allowed", path: url.pathname }),
        { status: 403, headers: corsHeaders(request) }
      );
    }
    return forwardToTWSE(request, url);
  },
};

async function handleRealtimeBatch(request, url, ctx) {
  const exCh = url.searchParams.get("ex_ch");
  if (!exCh) {
    return new Response(JSON.stringify({ error: "Missing ex_ch param" }), {
      status: 400,
      headers: corsHeaders(request),
    });
  }

  const stocks = exCh.split("|").map((s) => s.trim()).filter(Boolean);
  if (stocks.length === 0) {
    return new Response(JSON.stringify([]), {
      headers: { ...corsHeaders(request), "Content-Type": "application/json" },
    });
  }

  const cache = caches.default;
  const resultMap = {};
  let uncached = [];

  for (const stock of stocks) {
    const cacheKey = new Request(`https://cache.fintrack-ai/v1/${stock}`);
    const cached = await cache.match(cacheKey);
    if (cached) {
      resultMap[stock] = await cached.json();
    } else {
      uncached.push(stock);
    }
  }

  for (let attempt = 0; attempt < RETRY_DELAYS.length && uncached.length > 0; attempt++) {
    if (RETRY_DELAYS[attempt] > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
    }

    const batchExCh = uncached.join("|") + "|";
    // 加上時間戳避免中間層快取/去重造成的異常回應
    const targetUrl = `${TWSE_BASE}/stock/api/getStockInfo.jsp?ex_ch=${batchExCh}&json=1&delay=0&_=${Date.now()}`;

    let msgArray = [];
    try {
      const res = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json, text/plain, */*",
          Referer: "https://mis.twse.com.tw/",
        },
      });

      if (!res.ok) {
        console.error(`[TWSE] HTTP ${res.status} attempt=${attempt} ex_ch=${batchExCh}`);
        continue;
      }

      const json = await res.json();
      msgArray = json?.msgArray || [];

      if (msgArray.length === 0) {
        console.warn(`[TWSE] empty msgArray attempt=${attempt} uncached=${uncached.join(",")}`);
        continue;
      }
    } catch (err) {
      console.error(`[TWSE] fetch error attempt=${attempt}: ${err.message}`);
      continue;
    }

    const stillMissing = [];
    for (const stock of uncached) {
      const info = msgArray.find((m) => `${m.ex}_${m.c}.tw` === stock);
      const normalized = normalizeStock(info);
      if (!normalized) {
        stillMissing.push(stock);
        continue;
      }

      resultMap[stock] = normalized;
      const cacheKey = new Request(`https://cache.fintrack-ai/v1/${stock}`);
      const cacheRes = new Response(JSON.stringify(normalized), {
        headers: { "Cache-Control": `public, max-age=${CACHE_TTL}` },
      });
      ctx.waitUntil(cache.put(cacheKey, cacheRes));
    }

    if (stillMissing.length > 0) {
      console.warn(`[TWSE] no usable price attempt=${attempt} missing=${stillMissing.join(",")}`);
    }
    uncached = stillMissing;
  }

  if (uncached.length > 0) {
    console.error(`[TWSE] gave up after ${RETRY_DELAYS.length} attempts, still missing=${uncached.join(",")}`);
  }

  const output = stocks.map((s) => resultMap[s]).filter(Boolean);

  return new Response(JSON.stringify(output), {
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json",
    },
  });
}

function normalizeStock(info) {
  if (!info) return null;
  const price = extractPrice(info);
  if (!price) return null;

  const prevClose = info.y && info.y !== "-" ? parseFloat(info.y) : null;
  const change = prevClose !== null ? Math.round((price - prevClose) * 100) / 100 : null;
  const changePercent = prevClose !== null
    ? Math.round(((price - prevClose) / prevClose) * 10000) / 100
    : null;
  const volume = info.v && info.v !== "-" ? parseInt(info.v, 10) : null;

  return {
    stockNo: info.c,
    name: info.n || "",
    price,
    change,
    changePercent,
    volume,
  };
}

function extractPrice(info) {
  const z = info.z;
  if (z && z !== "-") return parseFloat(z);

  const bestBid = info.b?.split("_")[0];
  const bestAsk = info.a?.split("_")[0];
  const bid = bestBid && bestBid !== "-" ? parseFloat(bestBid) : null;
  const ask = bestAsk && bestAsk !== "-" ? parseFloat(bestAsk) : null;
  if (bid && ask) return (bid + ask) / 2;
  if (bid) return bid;
  if (ask) return ask;

  const open = info.o;
  if (open && open !== "-") return parseFloat(open);
  return null;
}

async function forwardToTWSE(request, url) {
  const targetUrl = TWSE_BASE + url.pathname + url.search + (url.search ? "&" : "?") + `_=${Date.now()}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 800));
    }

    try {
      const res = await fetch(targetUrl, {
        method: request.method,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json, text/plain, */*",
          Referer: "https://mis.twse.com.tw/",
        },
        ...(request.method !== "GET" && { body: request.body }),
      });

      if (!res.ok) {
        console.error(`[TWSE-legacy] HTTP ${res.status} attempt=${attempt} url=${targetUrl}`);
        if (attempt < 1) continue;
        return new Response(
          JSON.stringify({ error: "TWSE upstream error", status: res.status }),
          { status: 502, headers: corsHeaders(request) }
        );
      }

      const data = await res.text();
      return new Response(data, {
        status: 200,
        headers: {
          ...corsHeaders(request),
          "Content-Type": res.headers.get("Content-Type") || "application/json",
          "Cache-Control": "public, max-age=10",
        },
      });
    } catch (err) {
      console.error(`[TWSE-legacy] fetch error attempt=${attempt}: ${err.message}`);
      if (attempt < 1) continue;
      return new Response(
        JSON.stringify({ error: "Proxy fetch failed", message: err.message }),
        { status: 502, headers: corsHeaders(request) }
      );
    }
  }
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin") || "*";
  const allowOrigin =
    ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)
      ? origin
      : "null";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}
