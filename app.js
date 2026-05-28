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
    generationLabel: "短视频电商移动端",
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

const imageSizeProfiles = {
  amazon: {
    label: "Amazon Brasil",
    generationLabel: "Amazon Brasil",
    apiSize: "1024x1024",
    defaultSpec: {
      canvasLabel: "Amazon 商品图库方图",
      targetRatio: "1:1",
      recommendedPixels: "2000x2000 px",
      safeArea: "产品主体占画面 85% 以上，边缘保留少量安全留白。",
      platformRules: "主图纯白背景 RGB 255/255/255；无文字、徽章、水印、边框或无关道具；长边至少 1000 px 以支持缩放。",
      exportNote: "当前 API 输出 1024x1024 高清 PNG，可作为预览或继续放大到 2000x2000 后上传。"
    },
    detailSpec: {
      canvasLabel: "Amazon A+ 详情页横幅模块",
      targetRatio: "97:60",
      recommendedPixels: "970x600 px（建议源文件 1940x1200）",
      safeArea: "核心产品和文字放在中间 80% 安全区，避免移动端裁切。",
      platformRules: "适合 A+ Header/Single Image 模块；文字少而大，不放价格、折扣、夸张承诺或平台 Logo。",
      exportNote: "API 先生成方图构图稿，设计时预留 970x600 横幅裁切区，后续可裁切为 A+ 模块尺寸。"
    }
  },
  mercado: {
    label: "Mercado Livre",
    generationLabel: "Mercado Livre",
    apiSize: "1024x1024",
    defaultSpec: {
      canvasLabel: "Mercado Livre 商品图",
      targetRatio: "1:1",
      recommendedPixels: "1200x1200 px",
      safeArea: "产品居中，占画面约 90%-95%，不要贴边或被裁切。",
      platformRules: "JPG/PNG，RGB，图片不超过 10MB；干净白底优先，避免水印、促销字、过度拼贴。",
      exportNote: "当前 API 输出 1024x1024，符合方图方向；上架前建议放大/导出为 1200x1200。"
    },
    detailSpec: {
      canvasLabel: "Mercado Livre 详情图模块",
      targetRatio: "1:1",
      recommendedPixels: "1200x1200 px",
      safeArea: "移动端优先，标题和葡语短句保持大字号，四周留 8%-10% 安全边距。",
      platformRules: "用于规格、包装清单、使用步骤和 FAQ 图；强调真实产品、发货/保障信息，不做虚假承诺。",
      exportNote: "按 1200x1200 方图设计，适合商品图片轮播和详情说明复用。"
    }
  },
  tiktok: {
    label: "TikTok Shop",
    generationLabel: "短视频电商移动端",
    apiSize: "1024x1024",
    defaultSpec: {
      canvasLabel: "短视频电商商品方图",
      targetRatio: "1:1",
      recommendedPixels: "1200x1200 px",
      safeArea: "产品居中，首图产品占 80%-90%，移动端缩略图也能看清。",
      platformRules: "商品图至少 600x600；最多 9 张方图；主图白底且展示正面实物；避免文字、边框、水印或遮挡产品。",
      exportNote: "当前 API 输出 1024x1024，适合短视频电商移动端预览；上架前可导出 1200x1200。"
    },
    detailSpec: {
      canvasLabel: "短视频电商移动详情图",
      targetRatio: "1:1",
      recommendedPixels: "1200x1200 px",
      safeArea: "以手机瀑布流阅读为主，文字控制在 3-5 个短词组，按钮/标签不要贴边。",
      platformRules: "副图可展示细节、使用场景、尺寸和配件，但必须准确代表实际售卖商品。",
      exportNote: "保持方图，方便在商品轮播、直播商品卡和短视频封面中复用。"
    }
  },
  shopee: {
    label: "Shopee Brasil",
    generationLabel: "Shopee Brasil",
    apiSize: "1024x1024",
    defaultSpec: {
      canvasLabel: "Shopee 商品方图",
      targetRatio: "1:1",
      recommendedPixels: "1024x1024 px 或更高",
      safeArea: "产品完整入画，主图产品至少占 60%，副图信息区保留清晰留白。",
      platformRules: "高分辨率、方图 1:1；白底和良好光线优先；避免水印、拼贴、边框、模糊和无关物体。",
      exportNote: "当前 API 输出 1024x1024，直接匹配 Shopee 推荐分辨率。"
    },
    detailSpec: {
      canvasLabel: "Shopee 移动端详情图",
      targetRatio: "1:1",
      recommendedPixels: "1024x1024 px 或更高",
      safeArea: "手机端阅读，卖点图标和文字保持大字号，四周留 8%-10% 安全边距。",
      platformRules: "适合尺寸、材质、套装内容、使用步骤和售后信息；每张图只讲一个主题。",
      exportNote: "方图详情模块可直接用于 Shopee 商品图片和移动端描述。"
    }
  },
  all: {
    label: "四平台通用",
    generationLabel: "巴西跨平台电商",
    apiSize: "1024x1024",
    defaultSpec: {
      canvasLabel: "跨平台通用主图",
      targetRatio: "1:1",
      recommendedPixels: "2000x2000 px 母版",
      safeArea: "产品主体居中，按 Amazon 最严格主图标准预留安全区。",
      platformRules: "用 Amazon 白底主图作为通用母版，再按 Mercado Livre 1200、TikTok 1200、Shopee 1024 导出。",
      exportNote: "当前 API 输出 1024x1024，后续可作为跨平台母版继续放大和裁切。"
    },
    detailSpec: {
      canvasLabel: "跨平台详情页模块",
      targetRatio: "1:1 + Amazon 97:60 安全裁切",
      recommendedPixels: "2000x2000 母版；Amazon A+ 裁切 970x600",
      safeArea: "核心产品和文字放在中心 80%，确保方图与 Amazon 横幅裁切都可用。",
      platformRules: "一张图只表达一个卖点，葡语短句移动端可读，不出现虚假折扣、平台 Logo 或违规承诺。",
      exportNote: "先生成方图详情母版；Amazon A+ 需要从中心安全区裁切为 970x600。"
    }
  }
};

const modelProfiles = {
  openai: {
    label: "ChatGPT 5.5 Pro 最高级模型",
    endpoint: "/api/generate/openai",
    model: "gpt-5.5",
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
    name: "审核子账号 C",
    role: "reviewer",
    status: "paused",
    quota: 90,
    used: 88,
    platforms: ["amazon", "all"],
    models: ["openai", "manual"]
  }
];

const localFallbackCredentials = {
  admin: "admin123",
  "creative-a": "design123",
  "ops-b": "ops123",
  "review-c": "review123"
};

const PUBLIC_API_BASE_URL = "";
const MAX_REFERENCE_IMAGES = 6;

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

const state = {
  images: [],
  latestPrompt: "",
  latestRemoteResult: null,
  latestRemoteStatus: "",
  latestImageResult: null,
  latestImageStatus: "",
  imageJobs: [],
  referenceImageInfo: null,
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
  customImagePrompt: document.querySelector("#customImagePrompt"),
  customDetailPrompt: document.querySelector("#customDetailPrompt"),
  generateBtn: document.querySelector("#generateBtn"),
  saveDraftBtn: document.querySelector("#saveDraftBtn"),
  loadDraftBtn: document.querySelector("#loadDraftBtn"),
  copyBtn: document.querySelector("#copyBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  workspacePage: document.querySelector("#workspacePage"),
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
      password: "",
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

function getConfiguredApiBase() {
  const runtimeBase = window.VISION_BRZAZIL_API_BASE_URL || localStorage.getItem("visionBrzazil.apiBaseUrl") || PUBLIC_API_BASE_URL;
  return String(runtimeBase || "").replace(/\/$/, "");
}

function isStaticPagesHost() {
  return location.hostname.endsWith("github.io");
}

function resolveApiUrl(path) {
  const apiBase = getConfiguredApiBase();
  if (apiBase) return `${apiBase}${path}`;
  return path;
}

function createStaticApiError(path) {
  const error = new Error("当前页面运行在 GitHub Pages 静态站，无法直接调用 /api 后端。请使用 Render 部署后的网址，或配置 Render 后端地址后再生成图片。");
  error.status = 405;
  error.payload = {
    error: "STATIC_HOST_API_UNAVAILABLE",
    message: error.message,
    details: {
      requested_path: path,
      current_host: location.hostname,
      fix: "部署 Render Web Service 后，直接使用 Render 提供的网址；如果继续使用 GitHub Pages，需要在 window.VISION_BRZAZIL_API_BASE_URL 或 localStorage 中填写 Render 后端域名。"
    }
  };
  return error;
}

function createNetworkApiError(path, error) {
  const apiBase = getConfiguredApiBase();
  const message = apiBase
    ? `无法连接后端 API：${apiBase}${path}。链接扫描和模型拆解没有执行，请检查 Render 服务是否已部署成功、环境变量是否完整、服务是否处于运行状态。`
    : `无法连接后端 API：${path}。`;
  const wrapped = new Error(message);
  wrapped.status = 0;
  wrapped.payload = {
    error: "API_NETWORK_FAILED",
    message,
    details: {
      requested_path: path,
      api_base: apiBase || location.origin,
      original_message: error?.message || String(error || "")
    }
  };
  return wrapped;
}

async function apiRequest(path, options = {}) {
  if (isStaticPagesHost() && path.startsWith("/api/") && !getConfiguredApiBase()) {
    throw createStaticApiError(path);
  }
  let response;
  try {
    response = await fetch(resolveApiUrl(path), {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(state.authToken ? { Authorization: `Bearer ${state.authToken}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch (error) {
    throw createNetworkApiError(path, error);
  }
  const rawText = await response.text().catch(() => "");
  let data = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { message: cleanApiResponseText(rawText), raw: rawText.slice(0, 1200) };
  }
  if (!response.ok) {
    const error = new Error(data.message || data.error || `${response.status} ${response.statusText || "API 请求失败"}`);
    error.payload = data;
    error.status = response.status;
    throw error;
  }
  return data;
}

function cleanApiResponseText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
}

function summarizeApiError(error) {
  const payload = error?.payload || {};
  const detail = payload.details || {};
  const failures = Array.isArray(detail.failures) ? detail.failures : [];
  const firstFailure = failures[0] || {};
  const providerDetails = firstFailure.details || detail;
  return [
    error?.message,
    firstFailure.message,
    providerDetails.provider_message,
    providerDetails.reference_edit_failure?.message,
    providerDetails.provider_raw,
    payload.message,
    payload.error
  ].map(readableErrorText).filter(Boolean).find((item) => String(item).trim()) || "请检查 API 配置或稍后重试。";
}

function readableErrorText(value) {
  if (!value) return "";
  if (typeof value === "string") return value === "[object Object]" ? "" : value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(readableErrorText).filter(Boolean).join("；");
  if (typeof value === "object") {
    const direct = value.message || value.error?.message || value.error || value.detail || value.code || value.type;
    const directText = readableErrorText(direct);
    if (directText) return directText;
    try {
      return JSON.stringify(value).slice(0, 700);
    } catch {
      return "";
    }
  }
  return String(value);
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
  const account = state.accounts.find((item) => item.username === username);
  if (!account || account.status !== "active") return null;
  return localFallbackCredentials[account.username] === password ? account : null;
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
    parts.push("美国链接：只用于提炼竞品卖点、视觉层级、主图构图、详情页模块顺序和英文关键词，不作为产品外观参考。");
  }
  if (sourceGroups.br.length) {
    parts.push("巴西链接：用于判断当地平台语境、消费者需求、葡语表达、价格敏感点、物流售后信任和本土化页面习惯。");
  }
  if (sourceGroups.other.length) {
    parts.push("其他市场链接：只补充跨市场趋势、使用场景和差异化表达，不改变上传产品图片里的产品本体。");
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

  const autoImagePrompt = [
    `角色：你是巴西电商视觉总监和葡语转化文案专家。`,
    `模型优先级：默认第一优先级使用 ChatGPT 5.5 Pro 最高级模型（API 模型标识：gpt-5.5）进行链接拆解、关键词判断、图片提示词和详情页生成；其他 API 仅作为备用或人工指定。`,
    `强制分析顺序：第一步，先用模型完整解析美国链接的主图和详情页，逐项记录图片设计、页面架构、风格、色彩、字体/图标风格、视觉层级、模块顺序、表达内容、痛点、对比逻辑和转化路径。第二步，用同样维度解析巴西链接的主图和详情页，记录本土语言、生活场景、信任元素、价格敏感点、平台习惯和消费者关注点。第三步，最终生成时整体设计逻辑、架构和风格跟随美国链接，内容语言、场景和信任表达根据巴西链接本土化。`,
    `最高优先级：上传的 ${imageCount} 张产品图片是唯一产品外观基准。必须保持产品形状、颜色、材质、结构、尺寸比例、配件、包装和可见细节；链接内容只用于卖点和市场策略，绝不能替代或改写产品本体。`,
    `目标：基于上传产品图片生成符合 ${platform.label} 的主图、卖点图、场景图和详情页模块图。`,
    `产品：${productName}`,
    `巴西市场定位：重视价格感、耐用性、清晰规格、快速理解和真实使用场景。`,
    `链接拆解来源：${urlInfo.domains.join(", ")}；平台线索：${urlInfo.platformGuesses.join(", ")}；ID 线索：${urlInfo.ids.join(", ") || "无"}`,
    `跨市场参考策略：${urlInfo.summary}`,
    `美国竞品链接分析是主要方向：必须把美国链接主图与详情页的设计拆成可执行设计蓝图，包括整体风格、色彩系统、构图比例、信息层级、模块架构、场景表达、图标/标注方式、对比方式和消费者购买理由；不得复制竞品品牌、外观、包装或把竞品当成生成主体。`,
    `巴西链接只做本土化分析：用同样维度解析巴西主图和详情页，但最终只抽取更本土的葡语短句、当地生活场景、价格敏感点、信任背书、配送/售后表达、平台规则和移动端阅读习惯。`,
    `关键词信号：${keywords.join(", ") || "待补充"}${manualKeywords.length ? "（人工修正关键词，优先级最高）" : "（自动拆解关键词）"}`,
    `核心卖点：${sellingPoints.join("；") || "请根据产品图识别材质、功能、使用场景和差异化优势"}`,
    `图片规则：${platform.imageRules.join(" ")}`,
    `输出图片：每次生成一张独立图片，最终队列包含 1 张平台合规主图 + 多张副图，覆盖细节、尺寸、使用场景、包装清单、对比和痛点解决。`,
    `视觉要求：产品本体必须与上传图一致；只优化背景、光线、构图、道具环境和巴西葡萄牙语短文案；手机端可读；避免水印、平台 Logo、虚假折扣、医疗功效、绝对化承诺。`,
    `负面提示词：different product, changed color, changed material, wrong shape, wrong packaging, missing accessory, extra accessories not included, blurry, distorted product, wrong logo, watermark, unreadable text, fake discount badge, medical claim, exaggerated guarantee.`
  ].join("\n");

  const autoDetailPrompt = [
    `模型优先级：默认第一优先级使用 ChatGPT 5.5 Pro 最高级模型（API 模型标识：gpt-5.5）；其他 API 仅作为备用或人工指定。`,
    `请为 ${platform.label} 生成巴西葡萄牙语商品详情页。`,
    `详情页分析逻辑：先完整拆解美国链接详情页模块，包括首屏、痛点引入、功能卖点、尺寸规格、场景图、对比图、包装清单、FAQ、保障模块的顺序、视觉层级、色彩和表达内容；再用同样维度拆解巴西链接，提取本土语言、场景、信任元素和消费者关注点；最终详情页结构跟随美国链接，内容表达按巴西链接本土化。`,
    `产品事实来源优先级：1 上传产品图片，2 用户填写卖点和规格，3 美国链接竞品卖点，4 巴西链接本土化表达。不得编造上传图中不存在的配件、材质、认证或功能。`,
    `美国链接用途是主要方向：拆分主图设计、详情页模块结构、竞品痛点、卖点排序、信息图表达和视觉层级。巴西链接用途是本土化：校准葡语、当地需求、本土场景、配送售后信任、价格敏感点和平台页面习惯。`,
    `语气：${platform.tone}`,
    `结构：${platform.detailShape.join(" / ")}`,
    `必须包含：标题、5 个核心卖点、规格参数、包装清单、使用场景、FAQ、合规风险提醒、可用于图片的信息图短句。`,
    `关键词自然融入：${keywords.join(", ") || "根据产品类型自动补全"}`,
    `中文运营备注：指出哪些内容适合主图，哪些适合详情页，哪些词应避免。`
  ].join("\n");
  const customImagePrompt = els.customImagePrompt?.dataset.manual === "true" ? els.customImagePrompt.value.trim() : "";
  const customDetailPrompt = els.customDetailPrompt?.dataset.manual === "true" ? els.customDetailPrompt.value.trim() : "";
  const imagePrompt = customImagePrompt || autoImagePrompt;
  const detailPrompt = customDetailPrompt || autoDetailPrompt;

  return {
    urlInfo,
    platform,
    model,
    sellingPoints,
    productName,
    autoKeywords,
    manualKeywords,
    keywords,
    autoImagePrompt,
    autoDetailPrompt,
    customImagePrompt,
    customDetailPrompt,
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

function getWorkflowState(pack) {
  return [
    {
      step: "01",
      title: "产品图基准",
      status: state.images.length ? "ready" : "pending",
      note: state.images.length ? `${state.images.length} 张产品图已上传，最多 ${MAX_REFERENCE_IMAGES} 张会作为多角度视觉参考。` : "请先上传产品图，否则生图只能按文字猜测。"
    },
    {
      step: "02",
      title: "链接拆解",
      status: pack.urlInfo.providedCount ? "ready" : "pending",
      note: `美国 ${pack.urlInfo.sourceGroups.us.length} 条，巴西 ${pack.urlInfo.sourceGroups.br.length} 条；链接只提供策略，不改变产品外观。`
    },
    {
      step: "03",
      title: "关键词校准",
      status: pack.keywords.length ? "ready" : "pending",
      note: pack.manualKeywords.length ? "正在使用人工修正关键词，优先级最高。" : "当前使用自动拆解关键词，可手动修正。"
    },
    {
      step: "04",
      title: "生成输出",
      status: canUseSelection(getCurrentAccount(), els.platform.value, els.modelProvider.value) ? "ready" : "blocked",
      note: accountLimitReason(getCurrentAccount())
    }
  ];
}

function renderWorkflowState(items) {
  return `
    <div class="workflow-status-grid">
      ${items.map((item) => `
        <article class="workflow-status ${item.status}">
          <span>${escapeHtml(item.step)}</span>
          <b>${escapeHtml(item.title)}</b>
          <p>${escapeHtml(item.note)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function syncPromptEditors(pack) {
  [
    { element: els.customImagePrompt, autoValue: pack.autoImagePrompt },
    { element: els.customDetailPrompt, autoValue: pack.autoDetailPrompt }
  ].forEach(({ element, autoValue }) => {
    if (!element) return;
    const isEditing = document.activeElement === element;
    const isManual = element.dataset.manual === "true";
    if (!isEditing && !isManual) {
      element.value = autoValue || "";
      element.dataset.autoValue = autoValue || "";
    }
  });
}

function renderOutputs() {
  if (!getCurrentAccount()) return;
  const pack = buildPromptPack();
  syncPromptEditors(pack);
  renderAccountControls(pack);
  state.latestPrompt = `${pack.imagePrompt}\n\n--- DETAILS ---\n${pack.detailPrompt}`;
  const workflow = getWorkflowState(pack);

  els.briefOutput.innerHTML = `
    <h2>工作流拆解结果</h2>
    ${renderWorkflowState(workflow)}
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
    ${renderLinkScanEvidence()}
    ${renderModelLinkDeconstruction()}
    <h3>主图与详情页方向</h3>
    <div class="direction-grid">
      <div><b>产品图基准</b><span>上传图片决定产品外观、颜色、材质、比例、配件和包装；链接不能改变产品本体。</span></div>
      <div><b>美国链接主方向</b><span>先完整拆解美国主图和详情页的设计、架构、风格、色彩、模块顺序、视觉层级和表达内容。</span></div>
      <div><b>巴西链接本土化</b><span>同样拆解巴西主图和详情页，但只抽取本土葡语、场景、信任元素、价格敏感点和平台习惯。</span></div>
      <div><b>最终生成逻辑</b><span>整体设计结构跟随美国链接，内容语言和生活场景根据巴西链接本土化，产品外观始终来自上传图。</span></div>
    </div>
  `;

  els.imageOutput.innerHTML = `
    <h2>图片生成提示词</h2>
    ${renderImageResult()}
    <div class="prompt-block">${escapeHtml(pack.imagePrompt)}</div>
    <p>${pack.customImagePrompt ? "当前使用人工修改后的图片提示词。" : "当前使用系统根据链接自动生成的图片提示词，可在左侧定制提示词中修改。"}</p>
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
    <h2>详情页</h2>
    ${renderDetailImages()}
    ${renderGeneratedDetail()}
    <h3>详情页生成提示词</h3>
    <div class="prompt-block">${escapeHtml(pack.detailPrompt)}</div>
    <p>${pack.customDetailPrompt ? "当前使用人工修改后的详情页提示词。" : "当前使用系统根据链接自动生成的详情页提示词，可在左侧定制提示词中修改。"}</p>
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

function getGeneratedImageItems() {
  const jobImages = state.imageJobs
    .map((job) => job.image)
    .filter(Boolean);
  if (jobImages.length) return jobImages;
  return Array.isArray(state.latestImageResult?.images) && state.latestImageResult.images.length
    ? state.latestImageResult.images
    : state.latestImageResult?.b64_json || state.latestImageResult?.url
      ? [state.latestImageResult]
      : [];
}

function renderImageResult() {
  if (!state.latestImageStatus && !state.latestImageResult && !state.imageJobs.length) return "";
  const imageItems = getGeneratedImageItems();
  const sizeSummary = imageItems.some((item) => item.targetSpec?.recommendedPixels)
    ? "每张图片下方已标注对应平台推荐尺寸"
    : "每张图片均为独立高清 1024x1024 PNG";
  const failures = Array.isArray(state.latestImageResult?.details?.failures)
    ? state.latestImageResult.details.failures
    : Array.isArray(state.latestImageResult?.failures)
      ? state.latestImageResult.failures
      : [];
  return `
    <section class="generated-section">
      <h3>真实生成图片</h3>
      <p>${escapeHtml(state.latestImageStatus || "图片 API 已返回")} · ${escapeHtml(sizeSummary)}</p>
      ${state.referenceImageInfo ? `<p class="reference-compress-note">参考图已压缩用于 API：${escapeHtml(state.referenceImageInfo.count || 1)} 张 · ${escapeHtml(state.referenceImageInfo.summary || `${state.referenceImageInfo.width}x${state.referenceImageInfo.height}`)} · 合计 ${escapeHtml(formatBytes(state.referenceImageInfo.bytes))}，产品外观仍作为生成基准。</p>` : ""}
      ${state.imageJobs.length ? renderImageJobProgress() : ""}
      ${failures.length ? renderImageFailures(failures) : ""}
      ${imageItems.length ? `<div class="generated-image-grid">${imageItems.map(renderGeneratedImageItem).join("")}</div>` : ""}
      ${!imageItems.length && state.latestImageResult ? `<div class="data-block">${escapeHtml(JSON.stringify(state.latestImageResult, null, 2))}</div>` : ""}
      ${state.latestImageResult?.revised_prompt ? `<div class="prompt-block">${escapeHtml(state.latestImageResult.revised_prompt)}</div>` : ""}
    </section>
  `;
}

function renderImageJobProgress() {
  const successCount = state.imageJobs.filter((job) => job.status === "success").length;
  const errorCount = state.imageJobs.filter((job) => job.status === "error").length;
  const processedCount = successCount + errorCount;
  const activeIndex = state.imageJobs.findIndex((job) => job.status === "running");
  const percent = state.imageJobs.length ? Math.round((processedCount / state.imageJobs.length) * 100) : 0;
  return `
    <div class="image-progress-panel">
      <div class="progress-heading">
        <b>逐张生成进度</b>
        <span>${successCount} 张成功 · ${errorCount} 张失败 · ${processedCount}/${state.imageJobs.length} 已处理${activeIndex >= 0 ? ` · 正在生成第 ${activeIndex + 1} 张` : ""}</span>
      </div>
      <div class="progress-track"><span style="width:${percent}%"></span></div>
      <div class="image-job-list">
        ${state.imageJobs.map(renderImageJobItem).join("")}
      </div>
    </div>
  `;
}

function renderImageJobItem(job, index) {
  const statusText = {
    pending: "等待中",
    running: "生成中",
    success: "已完成",
    error: "失败"
  }[job.status] || "等待中";
  return `
    <article class="image-job-item ${escapeHtml(job.status || "pending")}">
      <div>
        <b>${index + 1}. ${escapeHtml(job.label || job.type || "图片")}</b>
        <span>${escapeHtml(job.message || statusText)}</span>
      </div>
      ${job.image ? `<a class="mini-download" href="${job.image.b64_json ? `data:image/png;base64,${job.image.b64_json}` : job.image.url || ""}" download="${escapeHtml(buildImageDownloadName(job.image, index))}">下载</a>` : `<em>${escapeHtml(statusText)}</em>`}
    </article>
  `;
}

function renderImageFailures(failures) {
  return `
    <div class="image-failure-list">
      ${failures.map((failure) => {
        const detail = failure.details || {};
        const referenceFailure = detail.reference_edit_failure?.message ? `；参考图编辑失败：${detail.reference_edit_failure.message}` : "";
        const providerRaw = detail.provider_raw ? `；原始返回：${detail.provider_raw}` : "";
        return `<p><b>${escapeHtml(failure.label || failure.type || "图片")}</b> ${escapeHtml(failure.message || detail.provider_message || "生成失败")}${escapeHtml(referenceFailure + providerRaw)}</p>`;
      }).join("")}
    </div>
  `;
}

function renderDetailImages() {
  const detailImages = getGeneratedImageItems().filter((item) => String(item.type || "").startsWith("detail"));
  if (!detailImages.length) {
    return `<p>点击“生成方案”后，这里会显示详情页模块图片；主图和其他图片显示在“图片提示词”标签页。</p>`;
  }
  return `
    <section class="generated-section">
      <h3>详情页生成图片</h3>
      <p>以下为独立详情页模块图，每张均可单独下载，并标注对应平台推荐尺寸。</p>
      <div class="generated-image-grid">${detailImages.map(renderGeneratedImageItem).join("")}</div>
    </section>
  `;
}

function renderGeneratedImageItem(item, index) {
  const image = item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url || "";
  const label = item.label || item.type || `图片 ${index + 1}`;
  const targetSpec = item.targetSpec || {};
  const specLines = [
    targetSpec.canvasLabel ? `画布：${targetSpec.canvasLabel}` : "",
    targetSpec.recommendedPixels ? `推荐尺寸：${targetSpec.recommendedPixels}` : "",
    targetSpec.targetRatio ? `比例：${targetSpec.targetRatio}` : "",
    targetSpec.safeArea ? `安全区：${targetSpec.safeArea}` : "",
    targetSpec.platformRules ? `规则：${targetSpec.platformRules}` : "",
    targetSpec.exportNote ? `导出：${targetSpec.exportNote}` : ""
  ].filter(Boolean);
  const downloadName = buildImageDownloadName(item, index);
  if (!image) return "";
  return `
    <article class="generated-image-item">
      <b>${escapeHtml(label)}</b>
      ${specLines.length ? `<div class="image-spec-list">${specLines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}</div>` : ""}
      <figure class="generated-image-card"><img src="${image}" alt="${escapeHtml(label)}" /></figure>
      <a class="download-btn" href="${image}" download="${escapeHtml(downloadName)}">下载高清 PNG</a>
    </article>
  `;
}

function buildImageDownloadName(item, index = 0) {
  const label = item.label || item.type || `图片 ${index + 1}`;
  const targetSpec = item.targetSpec || {};
  return [
    slugifyFileName(els.productName.value || "vision-brzazil-product"),
    slugifyFileName(targetSpec.platformLabel || els.platform.value || "platform"),
    slugifyFileName(label),
    slugifyFileName(targetSpec.recommendedPixels || "hd")
  ].join("-") + ".png";
}

function slugifyFileName(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "vision-brzazil-product";
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function renderGeneratedDetail() {
  const detail = state.latestRemoteResult?.detail_page;
  if (!detail) {
    return `<p>点击“生成方案”后，这里会显示模型返回的真实详情页内容；图片会显示在“图片提示词”标签页顶部。</p>`;
  }
  return `
    <section class="generated-section">
      <h3>真实生成详情页</h3>
      <div class="detail-output-card">
        ${renderDetailValue(detail)}
      </div>
    </section>
  `;
}

function renderDetailValue(value) {
  if (Array.isArray(value)) {
    return `<ul>${value.map((item) => `<li>${renderDetailValue(item)}</li>`).join("")}</ul>`;
  }
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `<div class="detail-field"><b>${escapeHtml(formatDetailKey(key))}</b>${renderDetailValue(item)}</div>`)
      .join("");
  }
  return `<p>${escapeHtml(value || "")}</p>`;
}

function formatDetailKey(key) {
  return String(key).replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
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

function renderModelLinkDeconstruction() {
  const result = state.latestRemoteResult;
  if (!result || typeof result !== "object") {
    return `
      <h3>模型深度拆解</h3>
      <p>点击“开始自动生成”后，这里会显示模型返回的美国链接设计拆解、巴西链接本土化拆解和最终映射逻辑。</p>
    `;
  }

  const flow = result.analysis_flow && typeof result.analysis_flow === "object"
    ? `
      <h4>分段模型工作流</h4>
      <div class="direction-grid">
        ${renderAnalysisSection("1. 美国链接主图分析", result.analysis_flow.us_main_image_analysis)}
        ${renderAnalysisSection("2. 巴西链接主图本土化", result.analysis_flow.br_main_image_analysis)}
        ${renderAnalysisSection("3. 美国详情页结构分析", result.analysis_flow.us_detail_page_analysis)}
        ${renderAnalysisSection("4. 巴西详情页本土化", result.analysis_flow.br_detail_page_analysis)}
      </div>
    `
    : "";

  const sections = [
    ["workflow_analysis", "综合优化逻辑"],
    ["link_analysis", "多链接拆解"],
    ["main_image_plan", "主图生成方向"],
    ["detail_page_plan", "详情页生成方向"],
    ["keywords", "模型关键词判断"],
    ["final_prompt_strategy", "最终提示词策略"],
    ["image_prompts", "模型图片提示词"]
  ]
    .map(([key, label]) => renderAnalysisSection(label, result[key]))
    .filter(Boolean)
    .join("");

  return `
    <h3>模型深度拆解</h3>
    ${flow}
    ${sections || `<p>模型已返回，但没有包含链接拆解字段。你可以在“模型接口”页查看完整原始 JSON。</p>`}
  `;
}

function renderLinkScanEvidence() {
  const scans = Array.isArray(state.latestRemoteResult?.link_scan_results)
    ? state.latestRemoteResult.link_scan_results
    : [];
  if (!scans.length) return "";
  return `
    <h3>链接页面扫描证据</h3>
    <div class="scan-evidence-list">
      ${scans.map(renderScanEvidenceItem).join("")}
    </div>
  `;
}

function renderScanEvidenceItem(scan) {
  const images = Array.isArray(scan.image_candidates) ? scan.image_candidates.slice(0, 6) : [];
  const headings = Array.isArray(scan.headings) ? scan.headings.slice(0, 8) : [];
  return `
    <article class="scan-evidence-card">
      <b>${escapeHtml(scan.title || scan.url || "链接扫描结果")}</b>
      <span>${escapeHtml(scan.final_url || scan.url || "")} · ${scan.ok ? "扫描成功" : escapeHtml(scan.error || "扫描失败")}</span>
      ${scan.description ? `<p>${escapeHtml(scan.description)}</p>` : ""}
      ${headings.length ? `<div class="scan-tags">${headings.map((item) => `<em>H${escapeHtml(item.level)} ${escapeHtml(item.text)}</em>`).join("")}</div>` : ""}
      ${images.length ? `
        <div class="scan-image-list">
          ${images.map((image) => `
            <a href="${escapeHtml(image.src)}" target="_blank" rel="noreferrer">
              <strong>${escapeHtml(image.type || "image")}</strong>
              <small>${escapeHtml(image.alt || image.src)}</small>
            </a>
          `).join("")}
        </div>
      ` : `<p>未扫描到可用图片候选，模型会根据页面文本和用户输入分析。</p>`}
    </article>
  `;
}

function extractPromptText(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map(extractPromptText).filter(Boolean).join("\n\n");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => {
        const text = extractPromptText(item);
        return text ? `${formatDetailKey(key)}:\n${text}` : "";
      })
      .filter(Boolean)
      .join("\n\n");
  }
  return String(value).trim();
}

function buildModelGuidedPromptPack(basePack, remoteResult) {
  if (!remoteResult || typeof remoteResult !== "object") return basePack;
  const modelImagePrompts = extractPromptText(remoteResult.image_prompts);
  const modelDetailPage = extractPromptText(remoteResult.detail_page);
  const modelStrategy = extractPromptText({
    link_analysis: remoteResult.link_analysis,
    us_visual_deconstruction: remoteResult.us_visual_deconstruction,
    br_visual_deconstruction: remoteResult.br_visual_deconstruction,
    localization_map: remoteResult.localization_map,
    final_prompt_strategy: remoteResult.final_prompt_strategy,
    keywords: remoteResult.keywords
  });
  const modelImagePrompt = [
    basePack.imagePrompt,
    "",
    "===== 模型链接扫描与拆解结果，以下内容必须优先用于生图提示词 =====",
    modelStrategy,
    "",
    "===== 模型生成的具体图片提示词 =====",
    modelImagePrompts
  ].filter(Boolean).join("\n");
  const modelDetailPrompt = [
    basePack.detailPrompt,
    "",
    "===== 模型链接扫描与拆解结果，以下内容必须优先用于详情页 =====",
    modelStrategy,
    "",
    "===== 模型生成的详情页内容/提示词 =====",
    modelDetailPage
  ].filter(Boolean).join("\n");

  return {
    ...basePack,
    imagePrompt: modelImagePrompt,
    detailPrompt: modelDetailPrompt,
    modelImagePrompt,
    modelDetailPrompt,
    remoteImagePrompts: Array.isArray(remoteResult.image_prompts) ? remoteResult.image_prompts : []
  };
}

function syncModelPromptsToEditors(pack) {
  if (els.customImagePrompt && pack.modelImagePrompt && els.customImagePrompt.dataset.manual !== "true") {
    els.customImagePrompt.value = pack.modelImagePrompt;
    els.customImagePrompt.dataset.autoValue = pack.modelImagePrompt;
  }
  if (els.customDetailPrompt && pack.modelDetailPrompt && els.customDetailPrompt.dataset.manual !== "true") {
    els.customDetailPrompt.value = pack.modelDetailPrompt;
    els.customDetailPrompt.dataset.autoValue = pack.modelDetailPrompt;
  }
}

function renderAnalysisSection(label, value) {
  if (value === undefined || value === null || value === "") return "";
  return `
    <section class="analysis-section">
      <b>${escapeHtml(label)}</b>
      ${renderAnalysisValue(value)}
    </section>
  `;
}

function renderAnalysisValue(value) {
  if (Array.isArray(value)) {
    return `<div class="analysis-list">${value.map((item) => `<div>${renderAnalysisValue(item)}</div>`).join("")}</div>`;
  }
  if (value && typeof value === "object") {
    return `
      <div class="analysis-object">
        ${Object.entries(value).map(([key, item]) => `
          <article>
            <span>${escapeHtml(formatDetailKey(key))}</span>
            ${renderAnalysisValue(item)}
          </article>
        `).join("")}
      </div>
    `;
  }
  return `<p>${escapeHtml(String(value))}</p>`;
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
    ${renderOwnerSettingsPanel(currentAccount)}
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

function renderOwnerSettingsPanel(account) {
  return `
    <section class="admin-create-panel">
      <div>
        <h3>主账号设置</h3>
        <p>主管理员可修改自己的显示名称、登录账号和密码。密码留空则不修改。</p>
      </div>
      <div class="create-account-grid">
        <input id="ownerAccountName" type="text" placeholder="主账号名称" value="${escapeHtml(account.name)}" />
        <input id="ownerAccountUsername" type="text" placeholder="主账号登录账号" value="${escapeHtml(account.username)}" />
        <input id="ownerAccountPassword" type="password" placeholder="新密码，留空不修改" autocomplete="new-password" />
        <button class="primary-btn" data-action="update-owner-account" type="button">保存主账号</button>
      </div>
    </section>
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
      <button class="tiny-btn danger-btn" data-action="delete-account" data-account-id="${account.id}" ${disabled} type="button">删除</button>
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
    constraints: pack.platform.imageRules,
    workflow_required_order: [
      "1. 后端先下载扫描美国产品链接和巴西产品链接页面。",
      "2. 从页面中提取主图、详情页图片候选、图片 alt、标题、描述、模块标题和正文样本。",
      "3. 模型先展示美国链接设计拆解，再展示巴西链接本土化拆解。",
      "4. 综合后生成可人工修改的具体图片提示词和详情页提示词。",
      "5. 最后才使用上传产品图作为唯一外观基准逐张生图。"
    ]
  };
}

async function requestRemoteGeneration(pack) {
  if (isStaticPagesHost() && !getConfiguredApiBase()) {
    throw createStaticApiError("/api/generate");
  }
  let response;
  try {
    response = await fetch(resolveApiUrl("/api/generate"), {
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
  } catch (error) {
    throw createNetworkApiError("/api/generate", error);
  }

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

async function requestRemoteImage(pack) {
  const referenceImages = await getReferenceImageDataUrls();
  const selectedSizeProfile = getSelectedImageSizeProfile();
  const basePayload = {
    prompt: `${pack.productName} marketplace image`,
    reference_image: referenceImages[0] || "",
    reference_images: referenceImages,
    platform: els.platform.value,
    size: selectedSizeProfile.apiSize || "1024x1024",
    max_images: 1,
    units: referenceImages.length ? Math.min(MAX_REFERENCE_IMAGES, referenceImages.length + 1) : 1
  };
  const priorityPrompts = buildImagePromptQueue(pack);
  state.imageJobs = priorityPrompts.map((item) => ({
    type: item.type,
    label: item.label,
    targetSpec: item.targetSpec || null,
    status: "pending",
    message: "等待生成"
  }));
  state.latestImageResult = { ok: true, images: [], failures: [] };
  state.latestImageStatus = `图片队列已创建：共 ${state.imageJobs.length} 张，将逐张生成。`;
  renderOutputs();

  const images = [];
  const failures = [];
  const modes = new Set();
  let model = "gpt-image-2";
  let size = selectedSizeProfile.apiSize || "1024x1024";
  let account = null;

  for (let index = 0; index < priorityPrompts.length; index += 1) {
    const item = priorityPrompts[index];
    state.imageJobs[index] = {
      ...state.imageJobs[index],
      status: "running",
      message: "正在调用图片模型，请稍候..."
    };
    state.latestImageStatus = `正在生成第 ${index + 1}/${priorityPrompts.length} 张：${item.label}`;
    renderOutputs();

    try {
      const data = await apiRequest("/api/image", {
      method: "POST",
      body: JSON.stringify({
        ...basePayload,
        prompts: [item]
      })
      });
      const itemImages = data.images || (data.image ? [data.image] : []);
      const firstImage = itemImages[0] ? {
        ...itemImages[0],
        type: itemImages[0].type || item.type,
        label: itemImages[0].label || item.label,
        targetSpec: itemImages[0].targetSpec || item.targetSpec || null
      } : null;
      if (firstImage) images.push(firstImage);
      failures.push(...(data.failures || []));
      if (data.mode) modes.add(data.mode);
      model = data.model || model;
      size = data.size || size;
      account = data.account || account;
      state.imageJobs[index] = {
        ...state.imageJobs[index],
        status: firstImage ? "success" : "error",
        message: firstImage ? "生成完成，可下载高清 PNG。" : "未返回图片，请查看失败原因。",
        image: firstImage || null
      };
      state.latestImageResult = { ok: true, model, size, mode: Array.from(modes).join(","), images, failures, image: images[0] || {}, account };
      state.latestImageStatus = firstImage
        ? `第 ${index + 1}/${priorityPrompts.length} 张已完成：${item.label}`
        : `第 ${index + 1}/${priorityPrompts.length} 张未返回图片：${item.label}`;
      renderOutputs();
    } catch (error) {
      const failure = {
        type: item.type || "image",
        label: item.label || "图片",
        targetSpec: item.targetSpec || null,
        message: summarizeApiError(error),
        details: error?.payload?.details || error?.payload || null
      };
      failures.push(failure);
      state.imageJobs[index] = {
        ...state.imageJobs[index],
        status: "error",
        message: failure.message
      };
      state.latestImageResult = { ok: false, model, size, mode: Array.from(modes).join(","), images, failures, image: images[0] || {}, account };
      state.latestImageStatus = `第 ${index + 1}/${priorityPrompts.length} 张生成失败：${item.label}`;
      renderOutputs();
    }
  }

  if (!images.length && failures.length) {
    const error = new Error(failures[0]?.message || "图片 API 请求失败");
    error.payload = {
      error: "IMAGE_GENERATION_FAILED",
      message: error.message,
      details: { failures }
    };
    throw error;
  }

  return {
    ok: true,
    model,
    size,
    mode: Array.from(modes).join(","),
    images,
    failures,
    image: images[0] || {},
    account
  };
}

function getSelectedImageSizeProfile() {
  return imageSizeProfiles[els.platform.value] || imageSizeProfiles.all;
}

function getImageTargetSpec(type) {
  const profile = getSelectedImageSizeProfile();
  const baseSpec = String(type || "").startsWith("detail") ? profile.detailSpec : profile.defaultSpec;
  return {
    platformKey: els.platform.value,
    platformLabel: profile.label,
    generationLabel: profile.generationLabel || profile.label,
    apiSize: profile.apiSize || "1024x1024",
    ...baseSpec
  };
}

function formatSpecForPrompt(spec) {
  return [
    `目标平台：${spec.generationLabel || spec.platformLabel}`,
    `目标画布：${spec.canvasLabel}`,
    `推荐上传尺寸：${spec.recommendedPixels}`,
    `目标比例：${spec.targetRatio}`,
    `构图安全区：${spec.safeArea}`,
    `平台规则：${spec.platformRules}`,
    `导出备注：${spec.exportNote}`
  ].filter(Boolean).join("\n");
}

function withTargetSpec(type, label, brief) {
  const targetSpec = getImageTargetSpec(type);
  return {
    type,
    label,
    targetSpec,
    prompt: `${formatSpecForPrompt(targetSpec)}\n${brief}`
  };
}

function buildImagePromptQueue(pack) {
  const remoteQueue = buildRemoteImagePromptQueue(pack);
  if (remoteQueue.length) return remoteQueue;

  const consistency = [
    `产品：${pack.productName}`,
    `用户最终定制提示词：${pack.imagePrompt}`,
    `生成逻辑：设计结构、页面架构、视觉层级、色彩风格、模块顺序和表达框架优先跟随美国链接拆解结果；葡语文案、人物/家庭/办公/户外场景、信任表达、配送售后和消费者语境根据巴西链接本土化。`,
    `最高优先级：上传产品图片是唯一视觉基准。必须严格保持参考图中的产品外观、颜色、材质、结构、比例、配件、包装和可见细节。`,
    `美国链接必须先拆主图与详情页的设计、架构、风格、色彩和表达内容；巴西链接必须用同样维度拆解，但只用于本土化语言、场景和信任要素。`,
    `不要把链接里的竞品外观、颜色、包装或品牌带入生成结果。不要生成不同品类、不同颜色、不同包装或额外配件。`,
    `每次只生成一张独立图片，不要拼图，不要四宫格。`,
    `如果目标尺寸与 API 输出尺寸不同，请按目标尺寸构图，在 ${getSelectedImageSizeProfile().apiSize || "1024x1024"} 画布中保留可裁切安全区。`
  ].join("\n");
  return [
    withTargetSpec(
      "main",
      "平台主图",
      `${consistency}\n生成一张平台合规白底主图：产品居中，高清真实摄影，无文字、无水印、无 logo，优先满足目标平台的上传尺寸和裁切规则。`
    ),
    withTargetSpec(
      "infographic",
      "卖点信息图",
      `${consistency}\n生成一张独立卖点信息图：主要参考美国链接的主图卖点表达和信息层级；保持产品主体一致，加入少量巴西葡语短卖点和清晰指示线，移动端可读，背景干净。关键词：${pack.keywords.slice(0, 8).join(", ")}。`
    ),
    withTargetSpec(
      "lifestyle",
      "巴西场景主图",
      `${consistency}\n生成一张独立巴西本土生活场景图：主构图参考美国链接里的使用场景和视觉方向，但场景换成本土化巴西家庭、办公室、出行或日常环境；产品外观必须来自上传图，光线自然。`
    ),
    withTargetSpec(
      "detail",
      "尺寸细节图",
      `${consistency}\n生成一张独立尺寸与细节图：参考美国链接的细节展示方式，突出材质、接口、尺寸、包装内容或关键结构；产品必须与上传图一致，葡语标注简洁清晰。`
    ),
    withTargetSpec(
      "detail-benefits",
      "详情页卖点模块图",
      `${consistency}\n生成一张独立详情页卖点模块图：主要参考美国链接里的详情页模块结构、视觉层级、卖点排序和设计方向，但产品外观必须来自上传图；巴西链接只用于把短句、本土场景和信任表达本地化。展示产品、3 个核心 beneficio、简洁葡语短句、干净高级背景。`
    ),
    withTargetSpec(
      "detail-usage",
      "详情页使用步骤图",
      `${consistency}\n生成一张独立详情页使用步骤图：参考美国链接的步骤模块结构，转化为巴西葡语 modo de uso，使用本土化场景表达；产品外观必须与上传图一致，不要拼成合集。`
    ),
    withTargetSpec(
      "detail-comparison",
      "详情页对比模块图",
      `${consistency}\n生成一张独立详情页对比模块图：参考美国链接的对比逻辑，突出本产品相对普通方案的优势，但不出现竞品品牌、不攻击竞品；产品外观必须来自上传图。`
    ),
    withTargetSpec(
      "detail-package",
      "包装清单模块图",
      `${consistency}\n生成一张独立包装清单或规格模块图：展示实际包含内容、规格参数和注意事项；不得添加上传图和用户描述中不存在的配件，葡语短句本土化。`
    )
  ];
}

function normalizePromptType(type, index) {
  const raw = String(type || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const map = {
    white_main: "main",
    main_image: "main",
    main: "main",
    lifestyle: "lifestyle",
    lifestyle_usage: "detail-usage",
    infographic: "infographic",
    details_specs: "detail",
    detail_specs: "detail",
    comparison: "detail-comparison",
    comparison_chart: "detail-comparison",
    hero_banner: "detail-hero",
    core_features: "detail-benefits",
    faq: "detail-faq"
  };
  return map[raw] || (index >= 5 ? `detail-${raw || index + 1}` : raw || `image-${index + 1}`);
}

function buildRemoteImagePromptQueue(pack) {
  const prompts = Array.isArray(pack.remoteImagePrompts)
    ? pack.remoteImagePrompts
    : Array.isArray(state.latestRemoteResult?.image_prompts)
      ? state.latestRemoteResult.image_prompts
      : [];
  if (!prompts.length) return [];

  const consistency = [
    `产品：${pack.productName}`,
    `最高优先级：使用上传产品图片做图生图，上传图是唯一产品外观基准。`,
    `严格保持上传图中的产品外观、颜色、材质、结构、比例、配件、包装和可见细节。`,
    `美国链接只参考构图、模块、风格、色彩和信息层级；巴西链接只参考葡语表达、本土场景和信任点。`,
    `不要复制竞品品牌、包装、颜色、logo、人物肖像或任何未上传的产品外观。`,
    `每次只生成一张独立图片，不要拼图，不要四宫格。`
  ].join("\n");

  return prompts.slice(0, 12).map((item, index) => {
    const type = normalizePromptType(item?.type || item?.module || item?.kind, index);
    const label = item?.label || item?.title || item?.type || `模型提示词 ${index + 1}`;
    const sourceLogic = item?.source_logic ? `参考美国链接逻辑：${item.source_logic}` : "";
    const brLocalization = item?.br_localization ? `巴西本土化：${item.br_localization}` : "";
    const promptText = typeof item === "string" ? item : item?.prompt || extractPromptText(item);
    return withTargetSpec(
      type,
      label,
      [consistency, sourceLogic, brLocalization, promptText].filter(Boolean).join("\n")
    );
  });
}

async function getReferenceImageDataUrls() {
  const files = state.images.slice(0, MAX_REFERENCE_IMAGES).map((image) => image.file).filter(Boolean);
  if (!files.length) {
    state.referenceImageInfo = null;
    return [];
  }
  const compressed = (await Promise.all(files.map((file) => compressReferenceImage(file)))).filter(Boolean);
  const totalBytes = compressed.reduce((sum, item) => sum + item.bytes, 0);
  state.referenceImageInfo = {
    count: compressed.length,
    bytes: totalBytes,
    summary: compressed.map((item) => `${item.width}x${item.height}`).join(" / ")
  };
  return compressed.map((item) => item.dataUrl);
}

function compressReferenceImage(file) {
  if (!file) return Promise.resolve(null);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 640;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        context.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.66);
        resolve({
          dataUrl,
          width,
          height,
          bytes: Math.round((dataUrl.length * 3) / 4)
        });
      };
      img.onerror = () => resolve(null);
      img.src = String(reader.result || "");
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
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
  const selectedFiles = Array.from(files).slice(0, MAX_REFERENCE_IMAGES);
  state.images = selectedFiles.map((file) => ({
    file,
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
  if (Array.from(files).length > MAX_REFERENCE_IMAGES) {
    els.previewStrip.insertAdjacentHTML("beforeend", `<p class="reference-compress-note">最多使用 ${MAX_REFERENCE_IMAGES} 张产品参考图，已自动忽略多余图片。</p>`);
  }
}

function activateTab(target) {
  const account = getCurrentAccount();
  const safeTarget = target === "admin" && account?.role !== "owner" ? "workspace" : target;
  document.querySelectorAll(".app-page").forEach((panel) => panel.classList.remove("active"));
  const targetPanel = {
    workspace: els.workspacePage,
    brief: els.briefOutput,
    image: els.imageOutput,
    detail: els.detailOutput,
    api: els.apiOutput,
    admin: els.adminOutput
  }[safeTarget] || els.workspacePage;
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === safeTarget));
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
  els.generateBtn.textContent = "正在扫描链接并生成提示词...";

  let generatedSomething = false;
  let imagePack = pack;

  activateTab("brief");
  state.latestRemoteStatus = "正在下载扫描美国/巴西产品链接，分析主图、详情页图片、页面结构和本土化信息...";
  state.latestImageStatus = "";
  state.latestImageResult = null;
  state.imageJobs = [];
  renderOutputs();

  try {
    const remoteData = await requestRemoteGeneration(pack);
    state.latestRemoteResult = remoteData.result || remoteData.rawText || remoteData;
    state.latestRemoteStatus = `链接扫描和模型拆解已完成，模型：${remoteData.model || pack.model.model}。下方已展示分析逻辑和具体提示词，现在开始逐张生成图片。`;
    generatedSomething = true;
    imagePack = buildModelGuidedPromptPack(pack, state.latestRemoteResult);
    syncModelPromptsToEditors(imagePack);
    state.latestPrompt = `${imagePack.imagePrompt}\n\n--- DETAILS ---\n${imagePack.detailPrompt}`;
    if (remoteData.account) {
      upsertAccount(remoteData.account);
      state.currentAccountId = remoteData.account.id;
      if (state.authToken) await refreshCloudData();
    } else {
      recordUsageEvent(pack, getRemoteTokenUsage(remoteData));
    }
    renderOutputs();
    await new Promise((resolve) => setTimeout(resolve, 250));
  } catch (error) {
    state.latestRemoteResult = error.payload || { message: error.message };
    state.latestRemoteStatus = "链接扫描/模型拆解失败，已停止生成图片。当前没有调用模型分析链接，也不会使用本地提示词继续生图。";
    state.latestImageResult = null;
    state.latestImageStatus = "已停止：必须先完成链接扫描和模型拆解，才会开始生成图片。";
    els.generateBtn.textContent = originalText;
    els.generateBtn.disabled = false;
    renderOutputs();
    activateTab("brief");
    return;
  }

  els.generateBtn.textContent = "正在根据提示词逐张生成图片...";

  try {
    const imageData = await requestRemoteImage(imagePack);
    state.latestImageResult = imageData;
    state.latestImageStatus = `图片队列完成：成功 ${imageData.images?.length || 0} 张，失败 ${imageData.failures?.length || 0} 张，模型：${imageData.model || "gpt-image-2"}`;
    generatedSomething = true;
  } catch (error) {
    state.latestImageResult = error.payload || { message: error.message };
    state.latestImageStatus = `图片生成失败：${summarizeApiError(error)}`;
  }

  if (!generatedSomething) {
    recordUsageEvent(pack);
  }
  activateTab("image");
  els.generateBtn.textContent = originalText;
  renderOutputs();
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

els.saveDraftBtn.addEventListener("click", () => {
  saveDraft();
});

els.loadDraftBtn.addEventListener("click", () => {
  loadDraft();
});

els.resetBtn.addEventListener("click", () => {
  els.productUrl.value = "";
  els.productName.value = "";
  els.sellingPoints.value = "";
  els.manualKeywords.value = "";
  if (els.customImagePrompt) {
    els.customImagePrompt.value = "";
    els.customImagePrompt.dataset.manual = "false";
  }
  if (els.customDetailPrompt) {
    els.customDetailPrompt.value = "";
    els.customDetailPrompt.dataset.manual = "false";
  }
  els.imageInput.value = "";
  state.latestRemoteResult = null;
  state.latestRemoteStatus = "";
  state.latestImageResult = null;
  state.latestImageStatus = "";
  state.imageJobs = [];
  state.referenceImageInfo = null;
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

els.logoutBtn.addEventListener("click", () => {
  state.currentAccountId = "";
  state.authToken = "";
  state.cloudMode = false;
  persistAccountState();
  activateTab("workspace");
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

  if (action === "delete-account") {
    await deleteSubAccount(button.dataset.accountId);
  }

  if (action === "update-owner-account") {
    await updateOwnerAccountFromForm();
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

async function updateOwnerAccountFromForm() {
  const account = getCurrentAccount();
  if (!account) return;
  const name = document.querySelector("#ownerAccountName")?.value.trim();
  const username = document.querySelector("#ownerAccountUsername")?.value.trim();
  const password = document.querySelector("#ownerAccountPassword")?.value.trim();
  const patch = {
    id: account.id,
    ...(name ? { name } : {}),
    ...(username ? { username } : {}),
    ...(password ? { password } : {})
  };

  if (state.cloudMode) {
    const data = await apiRequest("/api/admin/account", {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    upsertAccount(data.account);
    state.currentAccountId = data.account.id;
    const passwordInput = document.querySelector("#ownerAccountPassword");
    if (passwordInput) passwordInput.value = "";
    await refreshCloudData();
    return;
  }

  account.name = name || account.name;
  account.username = username || account.username;
  const passwordInput = document.querySelector("#ownerAccountPassword");
  if (passwordInput) passwordInput.value = "";
}

async function deleteSubAccount(accountId) {
  const account = getAccountById(accountId);
  if (!account || account.role === "owner") return;
  const confirmed = window.confirm(`确认删除子账号「${account.name}」？该账号的用量记录也会被删除。`);
  if (!confirmed) return;

  if (state.cloudMode) {
    await apiRequest("/api/admin/account", {
      method: "DELETE",
      body: JSON.stringify({ id: accountId })
    });
    await refreshCloudData();
  } else {
    state.accounts = state.accounts.filter((item) => item.id !== accountId);
    state.usageLogs = state.usageLogs.filter((log) => log.accountId !== accountId);
  }

  if (state.selectedDetailAccountId === accountId) {
    state.selectedDetailAccountId = "";
  }
}

function draftKey() {
  const account = getCurrentAccount();
  return `commerceStudio.draft.${account?.id || "guest"}`;
}

function collectDraft() {
  return {
    productName: els.productName.value,
    platform: els.platform.value,
    modelProvider: els.modelProvider.value,
    productUrl: els.productUrl.value,
    sellingPoints: els.sellingPoints.value,
    manualKeywords: els.manualKeywords.value,
    customImagePrompt: els.customImagePrompt?.value || "",
    customDetailPrompt: els.customDetailPrompt?.value || "",
    savedAt: new Date().toISOString()
  };
}

function saveDraft() {
  if (!getCurrentAccount()) return;
  localStorage.setItem(draftKey(), JSON.stringify(collectDraft()));
  els.saveDraftBtn.textContent = "草稿已保存";
  setTimeout(() => {
    els.saveDraftBtn.textContent = "保存草稿";
  }, 1400);
}

function loadDraft() {
  if (!getCurrentAccount()) return;
  const raw = localStorage.getItem(draftKey());
  if (!raw) {
    els.loadDraftBtn.textContent = "暂无草稿";
    setTimeout(() => {
      els.loadDraftBtn.textContent = "载入草稿";
    }, 1400);
    return;
  }
  const draft = JSON.parse(raw);
  els.productName.value = draft.productName || "";
  els.platform.value = draft.platform || "amazon";
  els.modelProvider.value = draft.modelProvider || "openai";
  els.productUrl.value = draft.productUrl || "";
  els.sellingPoints.value = draft.sellingPoints || "";
  els.manualKeywords.value = draft.manualKeywords || "";
  if (els.customImagePrompt) {
    els.customImagePrompt.value = draft.customImagePrompt || "";
    els.customImagePrompt.dataset.manual = draft.customImagePrompt ? "true" : "false";
  }
  if (els.customDetailPrompt) {
    els.customDetailPrompt.value = draft.customDetailPrompt || "";
    els.customDetailPrompt.dataset.manual = draft.customDetailPrompt ? "true" : "false";
  }
  renderOutputs();
  activateTab("brief");
  els.loadDraftBtn.textContent = "草稿已载入";
  setTimeout(() => {
    els.loadDraftBtn.textContent = "载入草稿";
  }, 1400);
}

function getVisibleUsageLogs() {
  const account = getCurrentAccount();
  if (!account) return [];
  if (account.role === "owner") return state.usageLogs;
  return state.usageLogs.filter((log) => log.accountId === account.id);
}

["input", "change"].forEach((eventName) => {
  [els.productUrl, els.productName, els.platform, els.modelProvider, els.sellingPoints, els.manualKeywords, els.customImagePrompt, els.customDetailPrompt].filter(Boolean).forEach((element) => {
    element.addEventListener(eventName, () => {
      if (element === els.customImagePrompt || element === els.customDetailPrompt) {
        element.dataset.manual = element.value.trim() ? "true" : "false";
      }
      renderOutputs();
      maybeRecordEditEvent(element);
    });
  });
});

function maybeRecordEditEvent(element) {
  if (!getCurrentAccount()) return;
  const now = Date.now();
  const isTextField = element === els.productUrl || element === els.productName || element === els.sellingPoints || element === els.customImagePrompt || element === els.customDetailPrompt;
  if (!isTextField || now - state.lastEditLoggedAt < 12000) return;
  state.lastEditLoggedAt = now;
  recordAuditEvent("edit", "修改商品输入");
}

async function boot() {
  await refreshSessionFromCloud();
  renderSession();
}

boot();
