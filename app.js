const platformProfiles = {
  amazon: {
    label: "Amazon Brasil",
    tone: "可信、清晰、合规，强调搜索关键词和购买转化",
    imageRules: [
      "主图白底，产品占画面约 85%，避免文字、徽章、水印和无关道具。",
      "建议输出 7 张图：主图、卖点信息图、尺寸图、场景图、对比图、包装图、细节图。",
      "详情页用葡萄牙语，标题自然包含核心关键词，避免夸大医疗、收益或绝对化承诺。"
    ],
    detailShape: ["SEO 标题", "5 条 Bullet Points", "产品描述", "A+ 模块脚本", "后台搜索词"]
  },
  mercado: {
    label: "Mercado Livre",
    tone: "直给、价格敏感、重视发货速度和售后信任",
    imageRules: [
      "主图保持干净背景，只展示售卖产品，避免水印、促销文字和过度拼贴。",
      "强调真实材质、规格、包含配件和使用场景，适合巴西消费者快速比价。",
      "详情页突出 Produto novo、Garantia、Envio、Compatibilidade 和 Perguntas frequentes。"
    ],
    detailShape: ["标题", "Ficha tecnica", "Descricao", "FAQ", "售后与发货说明"]
  },
  tiktok: {
    label: "TikTok Shop",
    tone: "短视频转化、场景感强、前三秒抓注意力",
    imageRules: [
      "建议至少 5 张、最多 9 张方图，首图白底突出产品本体。",
      "附加图要有强场景、动作感和问题解决前后对比，但避免误导性承诺。",
      "文案适合口播、短视频标题和直播间商品卡。"
    ],
    detailShape: ["短视频 Hook", "直播卖点", "商品标题", "5 条详情卖点", "风险提示"]
  },
  shopee: {
    label: "Shopee Brasil",
    tone: "移动端浏览、促销友好、信息密度高",
    imageRules: [
      "避免水印、夸张促销词、拼贴过多和低清晰度图片。",
      "首图清楚展示产品，副图解释尺寸、材质、适用场景和套装内容。",
      "详情页适合手机端短段落，突出 beneficio、conteudo da embalagem、modo de uso。"
    ],
    detailShape: ["移动端标题", "短卖点", "规格表", "包装清单", "常见问题"]
  },
  all: {
    label: "四平台通用方案",
    tone: "可迁移、合规优先、适配巴西葡语电商语境",
    imageRules: [
      "先产出 Amazon 合规白底主图，再生成 Mercado Livre、TikTok Shop、Shopee 可复用副图。",
      "统一使用巴西葡萄牙语，不出现水印、平台 Logo、虚假折扣、医疗或绝对化承诺。",
      "主图突出产品本体，副图覆盖场景、尺寸、对比、包装、细节和使用步骤。"
    ],
    detailShape: ["跨平台标题矩阵", "核心卖点", "图片脚本", "详情页葡语文案", "平台差异化修改建议"]
  }
};

const modelProfiles = {
  openai: {
    label: "ChatGPT 5.5 Pro 最高级模型",
    endpoint: "/api/generate/openai",
    model: "gpt-5.5-pro",
    imageModel: "gpt-5.5",
    payload: "links[] + image[] + corrected_keywords + product_brief + platform_profile + prompt_pack"
  },
  gemini: {
    label: "Google Gemini",
    endpoint: "/api/generate/gemini",
    model: "gemini-latest",
    imageModel: "gemini-image",
    payload: "files[] + text_prompt + market_constraints"
  },
  claude: {
    label: "Claude + 外部生图",
    endpoint: "/api/generate/anthropic",
    model: "claude-latest",
    imageModel: "external-image-model",
    payload: "vision_analysis + copy_generation + image_prompt_for_third_party"
  },
  local: {
    label: "本地模型 / ComfyUI",
    endpoint: "http://127.0.0.1:8188/prompt",
    model: "local-llm",
    imageModel: "comfyui-workflow",
    payload: "workflow_json + positive_prompt + negative_prompt + input_image_path"
  },
  manual: {
    label: "仅生成提示词",
    endpoint: "无需 API",
    model: "manual",
    imageModel: "manual",
    payload: "复制输出到任意生图或文案模型"
  }
};

const defaultAccounts = [
  {
    id: "admin",
    username: "admin",
    password: "admin123",
    name: "主管理员",
    role: "owner",
    status: "active",
    quota: 9999,
    used: 128,
    platforms: ["amazon", "mercado", "tiktok", "shopee", "all"],
    models: ["openai", "gemini", "claude", "local", "manual"]
  },
  {
    id: "creative-a",
    username: "creative-a",
    password: "design123",
    name: "设计子账号 A",
    role: "designer",
    status: "active",
    quota: 300,
    used: 74,
    platforms: ["amazon", "mercado", "all"],
    models: ["openai", "manual"]
  },
  {
    id: "ops-b",
    username: "ops-b",
    password: "ops123",
    name: "运营子账号 B",
    role: "operator",
    status: "active",
    quota: 180,
    used: 106,
    platforms: ["mercado", "shopee", "tiktok", "all"],
    models: ["openai", "gemini", "manual"]
  },
  {
    id: "review-c",
    username: "review-c",
    password: "review123",
    name: "审核子账号 C",
    role: "reviewer",
    status: "paused",
    quota: 90,
    used: 88,
    platforms: ["amazon", "all"],
    models: ["openai", "manual"]
  }
];

const defaultUsageLogs = [
  {
    id: "log-001",
    accountId: "creative-a",
    type: "generate",
    action: "生成主图提示词",
    platform: "amazon",
    model: "openai",
    units: 3,
    tokens: 1850,
    success: true,
    createdAt: "2026-05-25 09:18"
  },
  {
    id: "log-002",
    accountId: "ops-b",
    type: "edit",
    action: "拆解 Mercado Livre 链接",
    platform: "mercado",
    model: "gemini",
    units: 2,
    tokens: 640,
    success: true,
    createdAt: "2026-05-25 09:36"
  },
  {
    id: "log-003",
    accountId: "admin",
    type: "generate",
    action: "生成四平台详情页",
    platform: "all",
    model: "openai",
    units: 5,
    tokens: 3120,
    success: true,
    createdAt: "2026-05-25 10:04"
  }
];

const demoCredentials = {
  admin: { username: "admin", password: "admin123" },
  "creative-a": { username: "creative-a", password: "design123" },
  "ops-b": { username: "ops-b", password: "ops123" },
  "review-c": { username: "review-c", password: "review123" }
};

const state = {
  images: [],
  latestPrompt: "",
  latestRemoteResult: null,
  latestRemoteStatus: "",
  authToken: localStorage.getItem("commerceStudio.authToken") || "",
  cloudMode: false,
  accounts: loadStoredJson("commerceStudio.accounts", defaultAccounts),
  usageLogs: loadStoredJson("commerceStudio.usageLogs", defaultUsageLogs),
  currentAccountId: localStorage.getItem("commerceStudio.sessionAccountId") || "",
  lastEditLoggedAt: 0,
  selectedDetailAccountId: ""
};
state.accounts = normalizeAccounts(state.accounts);
state.usageLogs = normalizeUsageLogs(state.usageLogs);
localStorage.setItem("commerceStudio.accounts", JSON.stringify(state.accounts));
localStorage.setItem("commerceStudio.usageLogs", JSON.stringify(state.usageLogs));

const els = {
  loginView: document.querySelector("#loginView"),
  appShell: document.querySelector("#appShell"),
  loginForm: document.querySelector("#loginForm"),
  loginUsername: document.querySelector("#loginUsername"),
  loginPassword: document.querySelector("#loginPassword"),
  loginError: document.querySelector("#loginError"),
  logoutBtn: document.querySelector("#logoutBtn"),
  sessionCard: document.querySelector("#sessionCard"),
  accountSummary: document.querySelector("#accountSummary"),
  imageInput: document.querySelector("#imageInput"),
  uploadZone: document.querySelector("#uploadZone"),
  previewStrip: document.querySelector("#previewStrip"),
  productUrl: document.querySelector("#productUrl"),
  productName: document.querySelector("#productName"),
  platform: document.querySelector("#platform"),
  modelProvider: document.querySelector("#modelProvider"),
  sellingPoints: document.querySelector("#sellingPoints"),
  manualKeywords: document.querySelector("#manualKeywords"),
  generateBtn: document.querySelector("#generateBtn"),
  copyBtn: document.querySelector("#copyBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  briefOutput: document.querySelector("#briefOutput"),
  imageOutput: document.querySelector("#imageOutput"),
  detailOutput: document.querySelector("#detailOutput"),
  apiOutput: document.querySelector("#apiOutput"),
  adminOutput: document.querySelector("#adminOutput"),
  adminTab: document.querySelector("#adminTab"),
  tabs: document.querySelectorAll(".tab")
};

function loadStoredJson(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function normalizeAccounts(accounts) {
  return accounts.map((account) => {
    const defaults = defaultAccounts.find((item) => item.id === account.id);
    return {
      ...account,
      username: account.username || defaults?.username || account.id,
      password: account.password || defaults?.password || "123456",
      platforms: account.platforms?.length ? account.platforms : defaults?.platforms || ["amazon", "mercado", "all"],
      models: account.models?.length ? account.models : defaults?.models || ["openai"]
    };
  });
}

function normalizeUsageLogs(logs) {
  return logs.map((log) => ({
    ...log,
    type: log.type || "generate",
    tokens: Number(log.tokens || log.units * 650 || 0),
    success: log.success !== false
  }));
}

function persistAccountState() {
  localStorage.setItem("commerceStudio.accounts", JSON.stringify(state.accounts));
  localStorage.setItem("commerceStudio.usageLogs", JSON.stringify(state.usageLogs));
  if (state.authToken) {
    localStorage.setItem("commerceStudio.authToken", state.authToken);
  } else {
    localStorage.removeItem("commerceStudio.authToken");
  }
  if (state.currentAccountId) {
    localStorage.setItem("commerceStudio.sessionAccountId", state.currentAccountId);
  } else {
    localStorage.removeItem("commerceStudio.sessionAccountId");
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.authToken ? { Authorization: `Bearer ${state.authToken}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || data.error || "API 请求失败");
    error.payload = data;
    throw error;
  }
  return data;
}

function getCurrentAccount() {
  return state.accounts.find((account) => account.id === state.currentAccountId);
}

function getAccountById(accountId) {
  return state.accounts.find((account) => account.id === accountId);
}

function canUseSelection(account, platform, modelProvider) {
  if (!account || account.status !== "active") return false;
  if (account.used >= account.quota) return false;
  if (!account.platforms.includes(platform)) return false;
  if (!account.models.includes(modelProvider)) return false;
  return true;
}

function estimateUsageUnits(pack) {
  const imageUnits = Math.max(1, state.images.length);
  const platformUnits = els.platform.value === "all" ? 2 : 1;
  const modelUnits = els.modelProvider.value === "manual" ? 1 : 2;
  const keywordUnits = pack.keywords.length > 12 ? 1 : 0;
  return imageUnits + platformUnits + modelUnits + keywordUnits;
}

function estimateTokenUsage(pack) {
  const promptSize = `${pack.imagePrompt}\n${pack.detailPrompt}`.length;
  const imageCost = Math.max(1, state.images.length) * 420;
  const modelMultiplier = els.modelProvider.value === "manual" ? 0.35 : 1;
  return Math.round((promptSize * 0.75 + imageCost + pack.keywords.length * 35) * modelMultiplier);
}

function getUsageStats(accountId) {
  const logs = state.usageLogs.filter((log) => !accountId || log.accountId === accountId);
  return logs.reduce(
    (stats, log) => {
      stats.usageCount += 1;
      stats.editCount += log.type === "edit" ? 1 : 0;
      stats.successCount += log.success ? 1 : 0;
      stats.tokenCost += Number(log.tokens || 0);
      return stats;
    },
    { usageCount: 0, editCount: 0, successCount: 0, tokenCost: 0 }
  );
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function renderSession() {
  const account = getCurrentAccount();
  const isLoggedIn = Boolean(account);
  els.loginView.classList.toggle("is-hidden", isLoggedIn);
  els.appShell.classList.toggle("is-hidden", !isLoggedIn);

  if (!isLoggedIn) {
    return;
  }

  els.adminTab.classList.toggle("is-hidden", account.role !== "owner");
  if (account.role !== "owner" && els.adminOutput.classList.contains("active")) {
    activateTab("brief");
  }

  renderOutputs();
}

function authenticate(username, password) {
  return state.accounts.find(
    (account) => account.username === username && account.password === password && account.status === "active"
  );
}

async function authenticateRemote(username, password) {
  const data = await apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password })
  });
  state.authToken = data.token;
  state.cloudMode = true;
  upsertAccount(data.account);
  state.currentAccountId = data.account.id;
  await refreshCloudData();
  persistAccountState();
  return data.account;
}

async function refreshSessionFromCloud() {
  if (!state.authToken) return false;
  try {
    const data = await apiRequest("/api/auth/session");
    state.cloudMode = true;
    upsertAccount(data.account);
    state.currentAccountId = data.account.id;
    await refreshCloudData();
    persistAccountState();
    return true;
  } catch {
    state.authToken = "";
    state.cloudMode = false;
    persistAccountState();
    return false;
  }
}

async function refreshCloudData() {
  if (!state.authToken) return;
  const account = getCurrentAccount();
  const usageData = await apiRequest("/api/usage");
  if (usageData.account) upsertAccount(usageData.account);
  state.usageLogs = usageData.usageLogs || state.usageLogs;

  if (account?.role === "owner") {
    const accountData = await apiRequest("/api/admin/accounts");
    state.accounts = accountData.accounts || state.accounts;
  }
  persistAccountState();
}

function upsertAccount(account) {
  if (!account) return;
  const index = state.accounts.findIndex((item) => item.id === account.id || item.username === account.username);
  const normalized = {
    ...account,
    password: "",
    platforms: account.platforms || ["amazon", "mercado", "all"],
    models: account.models || ["openai"]
  };
  if (index >= 0) {
    state.accounts[index] = { ...state.accounts[index], ...normalized };
  } else {
    state.accounts.push(normalized);
  }
}

function parseProductUrl(rawUrl) {
  if (!rawUrl.trim()) {
    return {
      domain: "未提供",
      platformGuess: "manual",
      market: "未提供",
      marketGroup: "unknown",
      slugTerms: [],
      ids: [],
      queryTerms: []
    };
  }

  try {
    const url = new URL(rawUrl.trim());
    const pathParts = url.pathname
      .split("/")
      .filter(Boolean)
      .map((part) => decodeURIComponent(part));
    const slugTerms = pathParts
      .join(" ")
      .replace(/[-_+]/g, " ")
      .replace(/\b(dp|gp|product|produto|item|mlb|br|itm)\b/gi, " ")
      .split(/\s+/)
      .filter((term) => term.length > 2 && !/^[A-Z0-9]{8,}$/i.test(term))
      .slice(0, 18);
    const ids = pathParts.filter((part) => /(^B[A-Z0-9]{9}$)|(^MLB-?\d+)|(^\d{8,}$)/i.test(part));
    const queryTerms = Array.from(url.searchParams.entries())
      .flatMap(([key, value]) => [key, value])
      .join(" ")
      .replace(/[-_+]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length > 3)
      .slice(0, 12);

    return {
      domain: url.hostname.replace(/^www\./, ""),
      platformGuess: guessPlatform(url.hostname),
      market: guessMarket(url.hostname),
      marketGroup: guessMarketGroup(url.hostname),
      slugTerms,
      ids,
      queryTerms
    };
  } catch {
    return {
      domain: "链接格式待修正",
      platformGuess: "unknown",
      market: "未知市场",
      marketGroup: "unknown",
      slugTerms: rawUrl.split(/\s+/).filter(Boolean).slice(0, 12),
      ids: [],
      queryTerms: []
    };
  }
}

function parseProductLinks(rawText) {
  const links = rawText
    .split(/[\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(parseProductUrl);
  const parsedLinks = links.length ? links : [parseProductUrl("")];
  const sourceGroups = parsedLinks.reduce(
    (groups, item) => {
      groups[item.marketGroup].push(item);
      return groups;
    },
    { us: [], br: [], other: [], unknown: [] }
  );
  const allTerms = parsedLinks.flatMap((item) => [...item.slugTerms, ...item.queryTerms]);
  const allIds = parsedLinks.flatMap((item) => item.ids);

  return {
    links: parsedLinks,
    providedCount: links.length,
    sourceGroups,
    domains: [...new Set(parsedLinks.map((item) => item.domain))],
    platformGuesses: [...new Set(parsedLinks.map((item) => item.platformGuess))],
    slugTerms: [...new Set(allTerms)].slice(0, 32),
    ids: [...new Set(allIds)],
    summary: buildLinkStrategySummary(sourceGroups)
  };
}

function buildLinkStrategySummary(sourceGroups) {
  const parts = [];
  if (sourceGroups.us.length) {
    parts.push("美国链接：提炼竞品卖点、视觉设计、主图构图、详情页模块和英文关键词。");
  }
  if (sourceGroups.br.length) {
    parts.push("巴西链接：判断当地平台语境、消费者需求、葡语表达、价格敏感点和本地化信任要素。");
  }
  if (sourceGroups.other.length) {
    parts.push("其他市场链接：补充跨市场趋势、使用场景和差异化表达。");
  }
  return parts.join(" ") || "未提供链接：以产品图和卖点文字生成基础方案。";
}

function guessPlatform(hostname) {
  const host = hostname.toLowerCase();
  if (host.includes("amazon")) return "Amazon";
  if (host.includes("mercadolivre") || host.includes("mercadolibre")) return "Mercado Livre";
  if (host.includes("tiktok")) return "TikTok Shop";
  if (host.includes("shopee")) return "Shopee";
  return "外部来源";
}

function guessMarket(hostname) {
  const host = hostname.toLowerCase();
  if (host.includes(".com.br") || host.includes("mercadolivre.com.br") || host.includes("shopee.com.br")) return "Brazil";
  if (host.includes("amazon.com") || host.includes("walmart.com") || host.includes("target.com")) return "United States";
  if (host.includes(".com.mx")) return "Mexico";
  if (host.includes(".co.uk")) return "United Kingdom";
  return "Other";
}

function guessMarketGroup(hostname) {
  const market = guessMarket(hostname);
  if (market === "Brazil") return "br";
  if (market === "United States") return "us";
  if (market === "未提供" || market === "未知市场") return "unknown";
  return "other";
}

function tokenizeSellingPoints(text) {
  return text
    .split(/[\n,，;；。.!]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 18);
}

function tokenizeManualKeywords(text) {
  return text
    .split(/[\n,，;；]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 32);
}

function buildKeywordSignals(urlInfo, sellingPoints, productName) {
  const base = [
    productName,
    ...urlInfo.slugTerms,
    ...sellingPoints
  ]
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2);

  const stopwords = new Set(["com", "para", "the", "and", "uma", "das", "dos", "por", "sem", "que", "sku"]);
  const counts = new Map();
  for (const term of base) {
    if (!stopwords.has(term)) counts.set(term, (counts.get(term) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term]) => term)
    .slice(0, 20);
}

function buildPromptPack() {
  if (!getCurrentAccount()) {
    return emptyPromptPack();
  }

  const urlInfo = parseProductLinks(els.productUrl.value);
  const platform = platformProfiles[els.platform.value];
  const model = modelProfiles[els.modelProvider.value];
  const sellingPoints = tokenizeSellingPoints(els.sellingPoints.value);
  const productName = els.productName.value.trim() || inferName(urlInfo, sellingPoints);
  const autoKeywords = buildKeywordSignals(urlInfo, sellingPoints, productName);
  const manualKeywords = tokenizeManualKeywords(els.manualKeywords.value);
  const keywords = manualKeywords.length ? manualKeywords : autoKeywords;
  const imageCount = Math.max(state.images.length, 1);

  const imagePrompt = [
    `角色：你是巴西电商视觉总监和葡语转化文案专家。`,
    `模型优先级：默认第一优先级使用 ChatGPT 5.5 Pro 最高级模型（API 模型标识：gpt-5.5-pro）进行链接拆解、关键词判断、图片提示词和详情页生成；其他 API 仅作为备用或人工指定。`,
    `目标：基于上传的 ${imageCount} 张产品参考图，生成符合 ${platform.label} 的产品图片方案。`,
    `产品：${productName}`,
    `巴西市场定位：重视价格感、耐用性、清晰规格、快速理解和真实使用场景。`,
    `链接拆解来源：${urlInfo.domains.join(", ")}；平台线索：${urlInfo.platformGuesses.join(", ")}；ID 线索：${urlInfo.ids.join(", ") || "无"}`,
    `跨市场参考策略：${urlInfo.summary}`,
    `美国竞品参考：提取高频卖点、视觉结构、主图卖点表达、详情页模块顺序和消费者痛点。`,
    `巴西本地化优化：结合巴西链接判断当地需求、葡语短句、价格敏感点、信任背书、配送/售后表达和平台规则。`,
    `关键词信号：${keywords.join(", ") || "待补充"}${manualKeywords.length ? "（人工修正关键词，优先级最高）" : "（自动拆解关键词）"}`,
    `核心卖点：${sellingPoints.join("；") || "请根据产品图识别材质、功能、使用场景和差异化优势"}`,
    `图片规则：${platform.imageRules.join(" ")}`,
    `输出图片：1 张平台合规主图 + 4-8 张副图，覆盖细节、尺寸、使用场景、包装清单、对比和痛点解决。`,
    `视觉要求：真实产品比例，巴西葡萄牙语短文案，手机端可读，避免水印、平台 Logo、虚假折扣、医疗功效、绝对化承诺。`,
    `负面提示词：blurry, distorted product, wrong logo, watermark, unreadable text, fake discount badge, medical claim, exaggerated guarantee, extra accessories not included.`
  ].join("\n");

  const detailPrompt = [
    `模型优先级：默认第一优先级使用 ChatGPT 5.5 Pro 最高级模型（API 模型标识：gpt-5.5-pro）；其他 API 仅作为备用或人工指定。`,
    `请为 ${platform.label} 生成巴西葡萄牙语商品详情页。`,
    `语气：${platform.tone}`,
    `结构：${platform.detailShape.join(" / ")}`,
    `必须包含：标题、5 个核心卖点、规格参数、包装清单、使用场景、FAQ、合规风险提醒、可用于图片的信息图短句。`,
    `关键词自然融入：${keywords.join(", ") || "根据产品类型自动补全"}`,
    `中文运营备注：指出哪些内容适合主图，哪些适合详情页，哪些词应避免。`
  ].join("\n");

  return {
    urlInfo,
    platform,
    model,
    sellingPoints,
    productName,
    autoKeywords,
    manualKeywords,
    keywords,
    imagePrompt,
    detailPrompt
  };
}

function emptyPromptPack() {
  return {
    urlInfo: {
      links: [],
      providedCount: 0,
      sourceGroups: { us: [], br: [], other: [], unknown: [] },
      domains: ["未登录"],
      platformGuesses: ["login"],
      slugTerms: [],
      ids: [],
      summary: "请先登录。"
    },
    platform: platformProfiles.amazon,
    model: modelProfiles.openai,
    sellingPoints: [],
    productName: "待登录",
    keywords: [],
    imagePrompt: "",
    detailPrompt: ""
  };
}

function inferName(urlInfo, sellingPoints) {
  if (urlInfo.slugTerms.length) return titleCase(urlInfo.slugTerms.slice(0, 5).join(" "));
  if (sellingPoints.length) return sellingPoints[0].slice(0, 36);
  return "待命名产品";
}

function titleCase(text) {
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderOutputs() {
  if (!getCurrentAccount()) return;
  const pack = buildPromptPack();
  renderAccountControls(pack);
  state.latestPrompt = `${pack.imagePrompt}\n\n--- DETAILS ---\n${pack.detailPrompt}`;

  els.briefOutput.innerHTML = `
    <h2>链接拆解结果</h2>
    <div class="signal-grid">
      <div class="signal"><b>链接数量</b><span>${pack.urlInfo.providedCount} 条</span></div>
      <div class="signal"><b>来源域名</b><span>${escapeHtml(pack.urlInfo.domains.join(" · "))}</span></div>
      <div class="signal"><b>美国竞品参考</b><span>${pack.urlInfo.sourceGroups.us.length} 条</span></div>
      <div class="signal"><b>巴西本地参考</b><span>${pack.urlInfo.sourceGroups.br.length} 条</span></div>
      <div class="signal"><b>产品名称</b><span>${escapeHtml(pack.productName)}</span></div>
      <div class="signal"><b>图片数量</b><span>${state.images.length || 0} 张已上传</span></div>
    </div>
    <h3>跨市场拆解策略</h3>
    <p>${escapeHtml(pack.urlInfo.summary)}</p>
    <h3>关键提示词</h3>
    <p>${escapeHtml(pack.keywords.join(" · ") || "等待输入产品链接或卖点描述")}</p>
    <div class="keyword-review">
      <div><b>自动拆解关键词</b><span>${escapeHtml(pack.autoKeywords.join(" · ") || "暂无")}</span></div>
      <div><b>人工修正关键词</b><span>${escapeHtml(pack.manualKeywords.join(" · ") || "未填写，当前使用自动关键词")}</span></div>
    </div>
    <h3>链接路径词</h3>
    <p>${escapeHtml(pack.urlInfo.slugTerms.join(" · ") || "未解析到有效路径词")}</p>
    <h3>逐条链接分析</h3>
    <div class="link-analysis-list">${renderLinkAnalysis(pack.urlInfo.links)}</div>
    <h3>主图与详情页方向</h3>
    <div class="direction-grid">
      <div><b>美国链接拆分</b><span>提取竞品卖点、设计风格、主图构图、场景表达、详情页模块顺序。</span></div>
      <div><b>巴西链接本地化</b><span>校准葡语表达、当地痛点、价格敏感度、物流售后信任、平台页面习惯。</span></div>
      <div><b>主图方向</b><span>产品主体清晰，首图合规；副图用葡语短句表达功能、规格、场景和包装内容。</span></div>
      <div><b>详情页方向</b><span>按巴西消费者决策路径组织：痛点、利益点、规格、使用方法、FAQ、保障。</span></div>
    </div>
  `;

  els.imageOutput.innerHTML = `
    <h2>图片生成提示词</h2>
    <div class="prompt-block">${escapeHtml(pack.imagePrompt)}</div>
    <h3>建议出图队列</h3>
    <ol>
      <li>白底主图：只展示产品本体，清晰、无文字、无水印。</li>
      <li>场景图：巴西家庭、办公室、出行或户外语境，突出真实使用。</li>
      <li>信息图：用葡语短句表达 3-5 个最强卖点。</li>
      <li>尺寸与细节图：材质、接口、容量、规格、包装内容。</li>
      <li>对比图：与普通方案对比，但不攻击竞品品牌。</li>
    </ol>
  `;

  els.detailOutput.innerHTML = `
    <h2>详情页生成提示词</h2>
    <div class="prompt-block">${escapeHtml(pack.detailPrompt)}</div>
    <h3>葡语详情页骨架</h3>
    ${renderDetailSkeleton(pack)}
  `;

  els.apiOutput.innerHTML = `
    <h2>模型接口预留</h2>
    <div class="signal-grid">
      <div class="signal"><b>当前模型</b><span>${escapeHtml(pack.model.label)}</span></div>
      <div class="signal"><b>建议接口</b><span>${escapeHtml(pack.model.endpoint)}</span></div>
      <div class="signal"><b>Payload</b><span>${escapeHtml(pack.model.payload)}</span></div>
      <div class="signal"><b>市场</b><span>Brazil / pt-BR</span></div>
    </div>
    ${renderRemoteResult()}
    <h3>后端请求草案</h3>
    <div class="data-block">${escapeHtml(JSON.stringify(buildApiDraft(pack), null, 2))}</div>
  `;

  renderAdminOutput(pack);
}

function renderRemoteResult() {
  if (!state.latestRemoteStatus && !state.latestRemoteResult) return "";
  return `
    <h3>真实 API 返回</h3>
    <p>${escapeHtml(state.latestRemoteStatus || "已连接后端接口")}</p>
    <div class="data-block">${escapeHtml(JSON.stringify(state.latestRemoteResult || {}, null, 2))}</div>
  `;
}

function renderAccountControls(pack = buildPromptPack()) {
  const currentAccount = getCurrentAccount();
  if (!currentAccount) return;
  const isAllowed = canUseSelection(currentAccount, els.platform.value, els.modelProvider.value);
  const remaining = Math.max(0, currentAccount.quota - currentAccount.used);
  const visibleLogs = getVisibleUsageLogs();

  els.sessionCard.innerHTML = `
    <b>${escapeHtml(currentAccount.name)}</b>
    <span>${escapeHtml(currentAccount.username)} · ${escapeHtml(roleLabel(currentAccount.role))}</span>
    <span>${currentAccount.role === "owner" ? "全局管理权限" : "子账号隔离空间"} · ${state.cloudMode ? "云端同步" : "本地演示"}</span>
  `;

  els.accountSummary.innerHTML = `
    <div>
      <b>${escapeHtml(statusLabel(currentAccount.status))}</b>
      <span>登录状态</span>
    </div>
    <div>
      <b>${remaining}</b>
      <span>剩余额度 / 本次预计 ${estimateUsageUnits(pack)}</span>
    </div>
    <div>
      <b>${visibleLogs.length}</b>
      <span>${currentAccount.role === "owner" ? "全局使用记录" : "我的使用记录"}</span>
    </div>
    <div>
      <b>${isAllowed ? "可生成" : "受限"}</b>
      <span>${escapeHtml(accountLimitReason(currentAccount))}</span>
    </div>
  `;

  els.generateBtn.disabled = !isAllowed;
  els.generateBtn.title = isAllowed ? "" : accountLimitReason(currentAccount);
}

function renderLinkAnalysis(links) {
  if (!links.length || links[0].domain === "未提供") {
    return `<p>请粘贴美国竞品链接和巴西本地链接，每行一条。</p>`;
  }

  return links
    .map(
      (link, index) => `
        <article class="link-analysis-card">
          <b>#${index + 1} ${escapeHtml(link.domain)}</b>
          <span>${escapeHtml(link.market)} · ${escapeHtml(link.platformGuess)} · ${escapeHtml(link.ids.join(", ") || "无 ID")}</span>
          <p>${escapeHtml(link.slugTerms.slice(0, 10).join(" · ") || "未解析到明显关键词")}</p>
        </article>
      `
    )
    .join("");
}

function renderAdminOutput(pack = buildPromptPack()) {
  const currentAccount = getCurrentAccount();
  if (!currentAccount || currentAccount.role !== "owner") {
    els.adminOutput.innerHTML = `
      <h2>权限受限</h2>
      <p>当前账号只能查看自己的生成工作台和用量记录。Dashboard 由主管理员统一管理。</p>
    `;
    return;
  }

  const usageTotals = getUsageStats();
  const totals = state.accounts.reduce(
    (acc, account) => {
      acc.quota += account.quota;
      acc.used += account.used;
      if (account.status === "active") acc.active += 1;
      if (account.used / account.quota >= 0.85) acc.risky += 1;
      return acc;
    },
    { quota: 0, used: 0, active: 0, risky: 0 }
  );
  const adminControls = currentAccount.role === "owner";
  const recentLogs = getVisibleUsageLogs().slice(0, 8);

  els.adminOutput.innerHTML = `
    <h2>主管理员 Dashboard</h2>
    <div class="admin-kpis">
      <div class="kpi"><b>${state.accounts.length}</b><span>账号总数</span></div>
      <div class="kpi"><b>${formatNumber(usageTotals.usageCount)}</b><span>使用次数</span></div>
      <div class="kpi"><b>${formatNumber(usageTotals.successCount)}</b><span>成功生成次数</span></div>
      <div class="kpi"><b>${formatNumber(usageTotals.tokenCost)}</b><span>消耗 token</span></div>
    </div>
    <div class="admin-kpis compact-kpis">
      <div class="kpi"><b>${totals.active}</b><span>启用中</span></div>
      <div class="kpi"><b>${totals.used}</b><span>已用额度</span></div>
      <div class="kpi"><b>${formatNumber(usageTotals.editCount)}</b><span>修改次数</span></div>
      <div class="kpi"><b>${totals.risky}</b><span>高用量账号</span></div>
    </div>
    ${renderCreateAccountPanel(adminControls)}
    <h3>账号列表</h3>
    <div class="account-table">
      ${state.accounts.map((account) => renderAccountRow(account, adminControls)).join("")}
    </div>
    <div id="accountDetailPanel">
      ${renderAccountDetailPanel()}
    </div>
    <h3>最近使用记录</h3>
    <div class="usage-list">
      ${recentLogs.map(renderUsageLog).join("") || "<p>暂无记录</p>"}
    </div>
    <h3>后端权限模型草案</h3>
    <div class="data-block">${escapeHtml(JSON.stringify(buildAdminApiDraft(pack), null, 2))}</div>
  `;
}

function renderCreateAccountPanel(adminControls) {
  return `
    <section class="admin-create-panel">
      <div>
        <h3>创建子账号</h3>
        <p>主管理员可设置角色、额度、平台权限和模型权限。</p>
      </div>
      <div class="create-account-grid">
        <input id="newAccountName" type="text" placeholder="子账号名称" ${adminControls ? "" : "disabled"} />
        <input id="newAccountUsername" type="text" placeholder="登录账号" ${adminControls ? "" : "disabled"} />
        <input id="newAccountPassword" type="text" placeholder="初始密码" ${adminControls ? "" : "disabled"} />
        <select id="newAccountRole" ${adminControls ? "" : "disabled"}>
          <option value="designer">设计子账号</option>
          <option value="operator">运营子账号</option>
          <option value="reviewer">审核子账号</option>
        </select>
        <input id="newAccountQuota" type="number" min="10" step="10" value="120" ${adminControls ? "" : "disabled"} />
        <button class="primary-btn" data-action="create-account" ${adminControls ? "" : "disabled"} type="button">新增账号</button>
        <button class="ghost-btn" data-action="reset-accounts" ${adminControls ? "" : "disabled"} type="button">重置模拟数据</button>
      </div>
    </section>
  `;
}

function renderAccountRow(account, adminControls) {
  const usedPercent = Math.min(100, Math.round((account.used / account.quota) * 100));
  const statusClass = account.status === "active" ? "status-active" : "status-paused";
  const disabled = adminControls && account.role !== "owner" ? "" : "disabled";
  const stats = getUsageStats(account.id);

  return `
    <article class="account-row">
      <div>
        <b>${escapeHtml(account.name)}</b>
        <span>${escapeHtml(account.username)} · ${escapeHtml(roleLabel(account.role))} · <mark class="${statusClass}">${escapeHtml(statusLabel(account.status))}</mark></span>
      </div>
      <div class="usage-meter" aria-label="额度使用率">
        <span style="width: ${usedPercent}%"></span>
      </div>
      <div class="usage-meta">${account.used} / ${account.quota} · ${usedPercent}%</div>
      <div class="account-metrics">
        <span><b>${formatNumber(stats.usageCount)}</b> 使用</span>
        <span><b>${formatNumber(stats.editCount)}</b> 修改</span>
        <span><b>${formatNumber(stats.successCount)}</b> 成功</span>
        <span><b>${formatNumber(stats.tokenCost)}</b> token</span>
      </div>
      <div class="account-scopes">${renderScopeTags(account)}</div>
      <button class="tiny-btn" data-action="view-account" data-account-id="${account.id}" type="button">明细</button>
      <button class="tiny-btn" data-action="toggle-account" data-account-id="${account.id}" ${disabled} type="button">
        ${account.role === "owner" ? "锁定" : account.status === "active" ? "暂停" : "启用"}
      </button>
    </article>
  `;
}

function renderAccountDetailPanel() {
  const account = getAccountById(state.selectedDetailAccountId) || state.accounts[0];
  if (!account) return "";
  const stats = getUsageStats(account.id);
  const logs = state.usageLogs.filter((log) => log.accountId === account.id).slice(0, 10);
  const usedPercent = Math.min(100, Math.round((account.used / account.quota) * 100));

  return `
    <section class="account-detail-panel">
      <div class="detail-heading">
        <div>
          <h3>${escapeHtml(account.name)} 明细</h3>
          <p>${escapeHtml(account.username)} · ${escapeHtml(roleLabel(account.role))} · ${escapeHtml(statusLabel(account.status))}</p>
        </div>
        <div class="detail-quota">${account.used} / ${account.quota} · ${usedPercent}% 额度</div>
      </div>
      <div class="detail-metrics">
        <div><b>${formatNumber(stats.usageCount)}</b><span>使用次数</span></div>
        <div><b>${formatNumber(stats.editCount)}</b><span>修改次数</span></div>
        <div><b>${formatNumber(stats.successCount)}</b><span>成功生成次数</span></div>
        <div><b>${formatNumber(stats.tokenCost)}</b><span>消耗 token</span></div>
      </div>
      <div class="detail-scopes">
        <div><b>平台权限</b>${account.platforms.map((platform) => `<span>${escapeHtml(platformProfiles[platform]?.label || platform)}</span>`).join("")}</div>
        <div><b>模型权限</b>${account.models.map((model) => `<span>${escapeHtml(modelProfiles[model]?.label || model)}</span>`).join("")}</div>
      </div>
      <div class="usage-list detail-logs">
        ${logs.map(renderUsageLog).join("") || "<p>该账号暂无事件记录</p>"}
      </div>
    </section>
  `;
}

function renderScopeTags(account) {
  const platformTags = account.platforms.map((platform) => platformProfiles[platform]?.label || platform).slice(0, 3);
  const modelTags = account.models.map((model) => modelProfiles[model]?.label || model).slice(0, 2);
  return [...platformTags, ...modelTags].map((item) => `<span>${escapeHtml(item)}</span>`).join("");
}

function renderUsageLog(log) {
  const account = getAccountById(log.accountId);
  return `
    <article class="usage-item">
      <div>
        <b>${escapeHtml(log.action)}</b>
        <span>${escapeHtml(account?.name || log.accountId)} · ${escapeHtml(log.createdAt)}</span>
      </div>
      <span>${escapeHtml(platformProfiles[log.platform]?.label || log.platform)}</span>
      <span>${escapeHtml(modelProfiles[log.model]?.label || log.model)}</span>
      <b>${log.units} 点 · ${formatNumber(log.tokens || 0)} token</b>
    </article>
  `;
}

function roleLabel(role) {
  return {
    owner: "主管理员",
    designer: "设计子账号",
    operator: "运营子账号",
    reviewer: "审核子账号"
  }[role] || "子账号";
}

function statusLabel(status) {
  return status === "active" ? "启用" : "暂停";
}

function accountLimitReason(account) {
  if (!account) return "账号不存在";
  if (account.status !== "active") return "账号已暂停";
  if (account.used >= account.quota) return "额度已用完";
  if (!account.platforms.includes(els.platform.value)) return "无当前平台权限";
  if (!account.models.includes(els.modelProvider.value)) return "无当前模型权限";
  return "平台与模型权限通过";
}

function renderDetailSkeleton(pack) {
  const primaryBenefit = pack.sellingPoints[0] || "beneficio principal do produto";
  const secondBenefit = pack.sellingPoints[1] || "uso pratico no dia a dia";
  const keywords = pack.keywords.slice(0, 6).join(", ") || "palavras-chave principais";

  return `
    <ul>
      <li><strong>Titulo:</strong> ${escapeHtml(pack.productName)} para uso diario - pratico, resistente e ideal para o mercado brasileiro</li>
      <li><strong>Beneficio 1:</strong> ${escapeHtml(primaryBenefit)}</li>
      <li><strong>Beneficio 2:</strong> ${escapeHtml(secondBenefit)}</li>
      <li><strong>Descricao:</strong> Produto pensado para quem busca facilidade, durabilidade e boa apresentacao em marketplaces brasileiros.</li>
      <li><strong>SEO:</strong> ${escapeHtml(keywords)}</li>
      <li><strong>FAQ:</strong> O que acompanha? Como usar? Qual o tamanho? Tem garantia? Serve para qual tipo de cliente?</li>
    </ul>
  `;
}

function buildApiDraft(pack) {
  const account = getCurrentAccount();
  if (!account) return {};
  return {
    locale: "pt-BR",
    market: "Brazil",
    account: {
      id: account.id,
      username: account.username,
      name: account.name,
      role: account.role,
      status: account.status,
      quota: account.quota,
      used: account.used
    },
    platform: pack.platform.label,
    model_provider: pack.model.label,
    model_id: pack.model.model,
    image_model_id: pack.model.imageModel,
    product: {
      name: pack.productName,
      source_urls: els.productUrl.value.split(/[\n,，]+/).map((item) => item.trim()).filter(Boolean),
      source_domains: pack.urlInfo.domains,
      source_ids: pack.urlInfo.ids,
      source_markets: pack.urlInfo.links.map((link) => ({ domain: link.domain, market: link.market, platform: link.platformGuess })),
      selling_points: pack.sellingPoints,
      keyword_signals: pack.keywords,
      auto_keyword_signals: pack.autoKeywords,
      manual_keyword_overrides: pack.manualKeywords
    },
    assets: state.images.map((image) => ({
      name: image.name,
      type: image.type,
      size: image.size
    })),
    prompts: {
      image_generation: pack.imagePrompt,
      detail_page: pack.detailPrompt
    },
    constraints: pack.platform.imageRules
  };
}

async function requestRemoteGeneration(pack) {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(state.authToken ? { Authorization: `Bearer ${state.authToken}` } : {})
    },
    body: JSON.stringify({
      ...buildApiDraft(pack),
      platform_key: els.platform.value,
      usage_estimate: {
        units: estimateUsageUnits(pack),
        tokens: estimateTokenUsage(pack)
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || data.error || "后端生成接口调用失败");
    error.payload = data;
    throw error;
  }
  return data;
}

function getRemoteTokenUsage(remoteData) {
  return Number(remoteData?.usage?.total_tokens || remoteData?.usage?.totalTokens || 0);
}

function buildAdminApiDraft(pack) {
  const account = getCurrentAccount();
  if (!account) return {};
  return {
    auth: {
      current_account_id: account.id,
      username: account.username,
      role: account.role,
      can_manage_subaccounts: account.role === "owner"
    },
    subaccount_schema: {
      id: "string",
      role: "owner | designer | operator | reviewer",
      status: "active | paused",
      quota: "number",
      platforms: Object.keys(platformProfiles),
      models: Object.keys(modelProfiles)
    },
    usage_event_schema: {
      account_id: account.id,
      type: "generate | edit | copy | error",
      platform: els.platform.value,
      model: els.modelProvider.value,
      units: estimateUsageUnits(pack),
      tokens: estimateTokenUsage(pack),
      success: true,
      product_urls: els.productUrl.value.split(/[\n,，]+/).map((item) => item.trim()).filter(Boolean),
      created_at: "ISO-8601"
    },
    admin_endpoints: [
      "POST /api/auth/login",
      "POST /api/auth/logout",
      "GET /api/auth/session",
      "GET /api/admin/accounts",
      "POST /api/admin/accounts",
      "PATCH /api/admin/accounts/:id",
      "GET /api/admin/usage?from=&to=&account_id=",
      "POST /api/usage/events"
    ]
  };
}

function recordUsageEvent(pack, tokenOverride) {
  const account = getCurrentAccount();
  if (!canUseSelection(account, els.platform.value, els.modelProvider.value)) return;

  const units = estimateUsageUnits(pack);
  account.used = Math.min(account.quota, account.used + units);
  appendUsageLog({
    accountId: account.id,
    type: "generate",
    action: pack.productName === "待命名产品" ? "生成商品方案" : `生成 ${pack.productName}`,
    platform: els.platform.value,
    model: els.modelProvider.value,
    units,
    tokens: tokenOverride || estimateTokenUsage(pack),
    success: true
  });
  persistAccountState();
}

function recordAuditEvent(type, action, pack = buildPromptPack()) {
  const account = getCurrentAccount();
  if (!account) return;
  appendUsageLog({
    accountId: account.id,
    type,
    action,
    platform: els.platform.value,
    model: els.modelProvider.value,
    units: type === "edit" ? 0 : 1,
    tokens: type === "edit" ? Math.max(20, Math.round(estimateTokenUsage(pack) * 0.08)) : Math.max(40, Math.round(estimateTokenUsage(pack) * 0.12)),
    success: type !== "error"
  });
  persistAccountState();
}

function appendUsageLog(log) {
  state.usageLogs.unshift({
    id: `log-${Date.now()}`,
    ...log,
    createdAt: formatTimestamp(new Date())
  });
  state.usageLogs = state.usageLogs.slice(0, 80);
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderPreviews(files) {
  state.images.forEach((image) => URL.revokeObjectURL(image.url));
  state.images = Array.from(files).map((file) => ({
    name: file.name,
    type: file.type,
    size: file.size,
    url: URL.createObjectURL(file)
  }));

  els.previewStrip.innerHTML = state.images
    .map(
      (image, index) => `
        <figure class="preview-card">
          <img src="${image.url}" alt="${escapeHtml(image.name)}" />
          <span>#${index + 1}</span>
        </figure>
      `
    )
    .join("");
}

function activateTab(target) {
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === target));
  document.querySelectorAll(".output").forEach((panel) => panel.classList.remove("active"));
  const targetPanel = {
    brief: els.briefOutput,
    image: els.imageOutput,
    detail: els.detailOutput,
    api: els.apiOutput,
    admin: els.adminOutput
  }[target];
  targetPanel.classList.add("active");
}

els.imageInput.addEventListener("change", (event) => {
  renderPreviews(event.target.files);
  renderOutputs();
});

els.generateBtn.addEventListener("click", async () => {
  const pack = buildPromptPack();
  const originalText = els.generateBtn.textContent;
  els.generateBtn.disabled = true;
  els.generateBtn.textContent = "正在调用 API...";

  try {
    const remoteData = await requestRemoteGeneration(pack);
    state.latestRemoteResult = remoteData.result || remoteData.rawText || remoteData;
    state.latestRemoteStatus = `真实 API 已返回，模型：${remoteData.model || pack.model.model}`;
    if (remoteData.account) {
      upsertAccount(remoteData.account);
      state.currentAccountId = remoteData.account.id;
      if (state.authToken) await refreshCloudData();
    } else {
      recordUsageEvent(pack, getRemoteTokenUsage(remoteData));
    }
    activateTab("api");
  } catch (error) {
    state.latestRemoteResult = error.payload || { message: error.message };
    state.latestRemoteStatus = "未连接到后端 API，已回退为本地提示词生成模式。";
    recordUsageEvent(pack);
    activateTab("image");
  } finally {
    els.generateBtn.textContent = originalText;
    renderOutputs();
  }
});

els.copyBtn.addEventListener("click", async () => {
  renderOutputs();
  await navigator.clipboard.writeText(state.latestPrompt);
  recordAuditEvent("copy", "复制提示词");
  renderOutputs();
  els.copyBtn.textContent = "已复制";
  setTimeout(() => {
    els.copyBtn.textContent = "复制提示词";
  }, 1200);
});

els.resetBtn.addEventListener("click", () => {
  els.productUrl.value = "";
  els.productName.value = "";
  els.sellingPoints.value = "";
  els.imageInput.value = "";
  renderPreviews([]);
  renderOutputs();
  activateTab("brief");
});

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab.dataset.tab));
});

els.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = els.loginUsername.value.trim();
  const password = els.loginPassword.value;
  let account = null;
  els.loginError.textContent = "正在登录...";

  try {
    account = await authenticateRemote(username, password);
  } catch {
    account = authenticate(username, password);
    state.cloudMode = false;
  }

  if (!account) {
    els.loginError.textContent = "账号或密码错误，或账号已被暂停。";
    return;
  }

  state.currentAccountId = account.id;
  els.loginError.textContent = "";
  els.loginPassword.value = "";
  persistAccountState();
  renderSession();
});

els.loginView.addEventListener("click", (event) => {
  const button = event.target.closest("[data-demo-login]");
  if (!button) return;
  const credential = demoCredentials[button.dataset.demoLogin];
  if (!credential) return;
  els.loginUsername.value = credential.username;
  els.loginPassword.value = credential.password;
});

els.logoutBtn.addEventListener("click", () => {
  state.currentAccountId = "";
  state.authToken = "";
  state.cloudMode = false;
  persistAccountState();
  activateTab("brief");
  renderSession();
});

els.adminOutput.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const currentAccount = getCurrentAccount();

  if (currentAccount.role !== "owner") return;

  if (action === "view-account") {
    state.selectedDetailAccountId = button.dataset.accountId;
    renderOutputs();
    return;
  }

  if (action === "toggle-account") {
    const account = getAccountById(button.dataset.accountId);
    if (!account || account.role === "owner") return;
    account.status = account.status === "active" ? "paused" : "active";
    if (state.cloudMode) {
      await apiRequest("/api/admin/account", {
        method: "PATCH",
        body: JSON.stringify({ id: account.id, status: account.status })
      });
      await refreshCloudData();
    }
  }

  if (action === "create-account") {
    await createSubAccountFromForm();
  }

  if (action === "reset-accounts") {
    state.accounts = structuredClone(defaultAccounts);
    state.usageLogs = structuredClone(defaultUsageLogs);
    state.currentAccountId = "admin";
  }

  persistAccountState();
  renderOutputs();
});

async function createSubAccountFromForm() {
  const nameInput = document.querySelector("#newAccountName");
  const usernameInput = document.querySelector("#newAccountUsername");
  const passwordInput = document.querySelector("#newAccountPassword");
  const roleInput = document.querySelector("#newAccountRole");
  const quotaInput = document.querySelector("#newAccountQuota");
  const name = nameInput?.value.trim() || `子账号 ${state.accounts.length}`;
  const username = usernameInput?.value.trim() || `sub-${Date.now()}`;
  const password = passwordInput?.value.trim() || "123456";
  const role = roleInput?.value || "operator";
  const quota = Math.max(10, Number(quotaInput?.value || 120));

  if (state.accounts.some((account) => account.username === username)) {
    return;
  }

  const newAccount = {
    id: `sub-${Date.now()}`,
    username,
    password,
    name,
    role,
    status: "active",
    quota,
    used: 0,
    platforms: role === "designer" ? ["amazon", "mercado", "all"] : ["amazon", "mercado", "tiktok", "shopee", "all"],
    models: ["openai"]
  };

  if (state.cloudMode) {
    await apiRequest("/api/admin/accounts", {
      method: "POST",
      body: JSON.stringify(newAccount)
    });
    await refreshCloudData();
    return;
  }

  state.accounts.push(newAccount);
}

function getVisibleUsageLogs() {
  const account = getCurrentAccount();
  if (!account) return [];
  if (account.role === "owner") return state.usageLogs;
  return state.usageLogs.filter((log) => log.accountId === account.id);
}

["input", "change"].forEach((eventName) => {
  [els.productUrl, els.productName, els.platform, els.modelProvider, els.sellingPoints].forEach((element) => {
    element.addEventListener(eventName, () => {
      renderOutputs();
      maybeRecordEditEvent(element);
    });
  });
});

function maybeRecordEditEvent(element) {
  if (!getCurrentAccount()) return;
  const now = Date.now();
  const isTextField = element === els.productUrl || element === els.productName || element === els.sellingPoints;
  if (!isTextField || now - state.lastEditLoggedAt < 12000) return;
  state.lastEditLoggedAt = now;
  recordAuditEvent("edit", "修改商品输入");
}

async function boot() {
  await refreshSessionFromCloud();
  renderSession();
}

boot();
