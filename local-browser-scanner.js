const http = require("http");
const { execFile } = require("child_process");

const PORT = Number(process.env.LOCAL_BROWSER_SCANNER_PORT || 8787);
const MAX_URLS = 6;
const SCAN_TIMEOUT_MS = Number(process.env.LOCAL_BROWSER_SCANNER_TIMEOUT_MS || 22000);
const PREFLIGHT_TIMEOUT_MS = 3000;

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("REQUEST_TOO_LARGE"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function appleString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

function jsScannerSource(marketHint) {
  return `
(() => {
  const clean = (value, max = 1800) => String(value || "")
    .replace(/<script[\\s\\S]*?<\\/script>/gi, " ")
    .replace(/<style[\\s\\S]*?<\\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\\s+/g, " ")
    .trim()
    .slice(0, max);
  const uniq = (items, keyFn) => {
    const seen = new Set();
    return items.filter((item) => {
      const key = keyFn(item);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const meta = (name) => document.querySelector(\`meta[property="\${name}"], meta[name="\${name}"]\`)?.content || "";
  const normalizeAmazonImage = (src) => String(src || "")
    .replace(/\\._AC_[^./]+_\\./, ".")
    .replace(/\\._SX\\d+_[^./]*\\./, ".")
    .replace(/\\._SY\\d+_[^./]*\\./, ".")
    .replace(/\\._SR\\d+,\\d+_\\./, ".")
    .replace(/\\._[A-Z0-9_,]+_\\./, ".");
  const imageFromDynamic = (element) => {
    const dynamic = element.getAttribute("data-a-dynamic-image") || "";
    const match = dynamic.match(/https?:[^"\\\\]+/i);
    return match ? match[0] : "";
  };
  const imageSelectors = [
    "#landingImage",
    "#altImages img",
    "#main-image-container img",
    "#imageBlock img",
    "li.image.item img",
    "#aplus img",
    ".aplus-v2 img",
    "#dpx-aplus-product-description_feature_div img",
    "[cel_widget_id*=aplus] img",
    "[class*=aplus] img",
    "img"
  ].join(",");
  const rawImages = Array.from(document.querySelectorAll(imageSelectors))
    .map((img) => {
      const rawSrc = imageFromDynamic(img) || img.getAttribute("data-old-hires") || img.currentSrc || img.src || "";
      const src = normalizeAmazonImage(rawSrc);
      const alt = clean(img.alt || img.title || "", 180);
      const source = [img.id, img.className, img.closest("#aplus,.aplus-v2,[cel_widget_id*=aplus]") ? "aplus" : "", src, alt].join(" ").toLowerCase();
      const isDetail = /aplus|a-plus|detail|module|feature|lifestyle|hero|comparison|spec/.test(source);
      const isMain = /landingimage|altimages|main-image|imageblock|product|produto/.test(source);
      const bad = /transparent|grey-pixel|sprite|captcha|\\/error\\/|\\/oc-csi\\/|fls-na\\.amazon|logo\\._|pixel\\.gif|360_icon/i.test(src);
      const score = (isMain ? 5 : 0) + (isDetail ? 4 : 0) + (src.includes("m.media-amazon.com") ? 2 : 0) + (src.length > 60 ? 1 : 0);
      return {
        type: isDetail ? "detail-page-image" : (isMain ? "product-image" : "page-image"),
        src,
        alt,
        score,
        width: img.naturalWidth || img.width || 0,
        height: img.naturalHeight || img.height || 0,
        bad
      };
    })
    .filter((image) => image.src && !image.bad)
    .filter((image) => image.width >= 30 || image.height >= 30 || image.src.includes("m.media-amazon.com"));
  const image_candidates = uniq(rawImages, (image) => image.src)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, 18)
    .map(({ bad, ...image }) => image);
  const headingNodes = Array.from(document.querySelectorAll("h1,h2,h3,h4,[id*=title],[class*=title]")).slice(0, 30);
  const headings = headingNodes
    .map((node) => ({ level: Number(String(node.tagName || "H4").replace(/\\D/g, "")) || 4, text: clean(node.textContent, 180) }))
    .filter((item) => item.text)
    .slice(0, 10);
  const productTitle = clean(document.querySelector("#productTitle, [data-automation-id='product-title'], h1")?.textContent || "", 240);
  const title = productTitle || clean(document.title, 240);
  const description = clean(meta("description") || meta("og:description") || document.querySelector("#feature-bullets, #productDescription, [data-feature-name='productDescription']")?.textContent || "", 500);
  const ratingText = clean(document.querySelector("#acrPopover, [data-hook='rating-out-of-text'], .reviewCountTextLinkedHistogram")?.textContent || "", 120);
  const reviewCountText = clean(document.querySelector("#acrCustomerReviewText, [data-hook='total-review-count'], #reviewsMedley .a-size-base")?.textContent || "", 120);
  const ratingMatch = ratingText.match(/([0-5](?:[.,]\\d+)?)/);
  const reviewCountMatch = reviewCountText.match(/[\\d.,]+/);
  const snippets = uniq(Array.from(document.querySelectorAll("[data-hook='review-body'], [data-hook='review-title'], .review-text-content, .cr-original-review-text, [class*=review]"))
    .map((node) => clean(node.textContent, 300))
    .filter((text) => text.length >= 18), (text) => text)
    .slice(0, 10);
  const reviewText = snippets.join(" ").toLowerCase();
  const countTerms = (terms) => terms
    .map((term) => ({ term, count: (reviewText.match(new RegExp(term, "gi")) || []).length }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const rating = ratingMatch ? Number(ratingMatch[1].replace(",", ".")) : null;
  const review_count = reviewCountMatch ? Number(reviewCountMatch[0].replace(/[^\\d]/g, "")) || null : null;
  const review_insights = rating || review_count || snippets.length ? {
    rating,
    review_count,
    snippets,
    positive_terms: countTerms(["quality", "easy", "durable", "recommend", "excellent", "good", "qualidade", "fácil", "durável", "recomendo", "excelente", "bom", "boa"]),
    negative_terms: countTerms(["small", "large", "size", "broken", "hard", "difficult", "shipping", "delivery", "pequeno", "grande", "tamanho", "quebrado", "difícil", "entrega", "ruim"]),
    scene_terms: countTerms(["home", "office", "travel", "daily", "family", "work", "casa", "escritório", "viagem", "dia a dia", "família", "trabalho"])
  } : null;
  const bodyText = clean(document.body?.innerText || "", 2000);
  const blocked = /continue shopping|continuar comprando|robot check|captcha|automated access|enter the characters|verify you are human|getting things ready/i.test([bodyText, document.title, location.href].join(" "));
  return JSON.stringify({
    url: location.href,
    final_url: location.href,
    market_hint: ${JSON.stringify(marketHint || null)},
    ok: !blocked && Boolean(title || image_candidates.length || review_insights),
    status: 200,
    error: blocked ? "BROWSER_SCAN_BLOCKED" : undefined,
    message: blocked ? "本机浏览器也遇到平台验证页，请在 Chrome 中完成验证后重试。" : "本机浏览器扫描完成。",
    scanner: "local-browser",
    title,
    description,
    image_candidates,
    headings,
    review_insights,
    page_text_sample: bodyText.slice(0, 900)
  });
})()
`;
}

function appleScriptForScan(url, marketHint) {
  const extractor = jsScannerSource(marketHint);
  return `
set targetUrl to "${appleString(url)}"
set extractorJs to "${appleString(extractor)}"
set scrollJs to "window.scrollBy(0, Math.max(700, window.innerHeight)); 'ok';"
tell application "Google Chrome"
  activate
  if (count of windows) = 0 then make new window
  set scanTab to make new tab at end of tabs of front window with properties {URL:targetUrl}
  set active tab index of front window to (count of tabs of front window)
  delay 4
  repeat 2 times
    try
      execute scanTab javascript scrollJs
    end try
    delay 1
  end repeat
  set scanResult to execute scanTab javascript extractorJs
  try
    if scanResult does not contain "BROWSER_SCAN_BLOCKED" then close scanTab
  end try
  return scanResult
end tell
`;
}

function summarizeAppleScriptError(error, stderr) {
  const raw = String(stderr || error?.message || "");
  if (error?.killed) {
    return "本机 Chrome 自动化超时。请确认 Chrome 已打开，并开启 Chrome 菜单 View -> Developer -> Allow JavaScript from Apple Events。";
  }
  if (/not authorized|not allowed|not permitted|(-1743)|(-10004)/i.test(raw)) {
    return "macOS 阻止了本机助手控制 Chrome。请在系统设置隐私与安全性中允许 Terminal/Code 控制 Google Chrome，并开启 Allow JavaScript from Apple Events。";
  }
  return raw.slice(0, 500) || "本机浏览器扫描失败。请确认 Chrome 已打开，并允许 Apple Events 执行 JavaScript。";
}

function preflightChromeAutomation() {
  return new Promise((resolve) => {
    const script = 'tell application "Google Chrome" to return "ok"';
    execFile("osascript", ["-e", script], { timeout: PREFLIGHT_TIMEOUT_MS, maxBuffer: 1024 * 64 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, message: summarizeAppleScriptError(error, stderr) });
        return;
      }
      resolve({ ok: String(stdout || "").toLowerCase().includes("ok") });
    });
  });
}

async function scanWithChrome(url, marketHint) {
  const preflight = await preflightChromeAutomation();
  if (!preflight.ok) {
    return {
      url,
      market_hint: marketHint || null,
      ok: false,
      error: "LOCAL_BROWSER_AUTOMATION_UNAVAILABLE",
      message: preflight.message || "本机 Chrome 自动化不可用。"
    };
  }
  return new Promise((resolve) => {
    const script = appleScriptForScan(url, marketHint);
    execFile("osascript", ["-e", script], { timeout: SCAN_TIMEOUT_MS, maxBuffer: 1024 * 1024 * 4 }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          url,
          market_hint: marketHint || null,
          ok: false,
          error: error.killed ? "LOCAL_BROWSER_SCAN_TIMEOUT" : "LOCAL_BROWSER_SCAN_FAILED",
          message: summarizeAppleScriptError(error, stderr)
        });
        return;
      }
      try {
        resolve(JSON.parse(String(stdout || "").trim()));
      } catch (parseError) {
        resolve({
          url,
          market_hint: marketHint || null,
          ok: false,
          error: "LOCAL_BROWSER_SCAN_PARSE_FAILED",
          message: parseError.message,
          page_text_sample: String(stdout || "").slice(0, 900)
        });
      }
    });
  });
}

async function scanUrls(payload) {
  const urls = Array.isArray(payload.urls) ? payload.urls.filter(Boolean).slice(0, MAX_URLS) : [];
  const markets = Array.isArray(payload.markets) ? payload.markets : [];
  const results = [];
  for (let index = 0; index < urls.length; index += 1) {
    results.push(await scanWithChrome(urls[index], markets[index] || null));
  }
  return results;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return sendJson(res, 200, { ok: true });
  const url = new URL(req.url, "http://127.0.0.1");
  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, { ok: true, service: "vision-brzazil-local-browser-scanner", port: PORT });
  }
  if (req.method === "POST" && url.pathname === "/scan") {
    try {
      const payload = await readJson(req);
      const results = await scanUrls(payload);
      return sendJson(res, 200, { ok: true, scanner: "local-browser", results });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: "LOCAL_BROWSER_SCANNER_FAILED", message: error.message });
    }
  }
  return sendJson(res, 404, { ok: false, error: "NOT_FOUND" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`VISION BRZAZIL local browser scanner listening on http://127.0.0.1:${PORT}`);
  console.log("Keep Chrome open. If scanning fails, enable Chrome: View > Developer > Allow JavaScript from Apple Events.");
});
