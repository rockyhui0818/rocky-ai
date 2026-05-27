const { getAccountByToken, publicAccount } = require("./_lib/auth");
const { getBearerToken, readJson, sendJson } = require("./_lib/http");
const { filter, supabaseRequest } = require("./_lib/supabase");

function extractText(data) {
  return data?.choices?.[0]?.message?.content || data?.output_text || data?.content?.[0]?.text || "";
}

function buildSystemPrompt() {
  return [
    "You are VISION BRZAZIL's senior Brazil ecommerce creative strategist.",
    "Follow this analysis order strictly: first deconstruct US links' main images and detail pages as the primary design direction, then deconstruct Brazil links with the same visual-analysis depth, then localize content, language, scenes, trust signals, and marketplace conventions for Brazil.",
    "For every US and Brazil link, analyze main image design, layout architecture, module sequence, style, color palette, typography, visual hierarchy, claims, icons, comparison logic, lifestyle scenes, and detail-page content blocks.",
    "Final creative direction must preserve the US links' design logic and information architecture while replacing content with Brazil-localized Portuguese language, local scenarios, trust points, and marketplace expectations.",
    "Uploaded product images are the only product-appearance truth for image-to-image generation. Never let competitor URLs change the product shape, color, packaging, accessories, or visible details.",
    "Return practical marketplace output for Brazil in Chinese operational notes plus Brazilian Portuguese listing copy.",
    "Never invent unsupported certifications, medical claims, fake discounts, platform logos, or guarantees."
  ].join(" ");
}

function buildUserPrompt(payload) {
  return [
    "请基于以下资料生成结构化方案：",
    "",
    JSON.stringify(
      {
        locale: payload.locale || "pt-BR",
        market: payload.market || "Brazil",
        account: payload.account,
        platform: payload.platform,
        product: payload.product,
        assets: payload.assets,
        constraints: payload.constraints,
        prompt_pack: payload.prompts
      },
      null,
      2
    ),
    "",
    "输出 JSON，字段必须包含：",
    "link_analysis: 多链接拆解，必须区分美国竞品链接和巴西本地链接。",
    "us_visual_deconstruction: 对美国链接的主图和详情页进行深度拆解，记录设计、架构、风格、色彩、模块顺序、视觉层级、表达内容、痛点和转化逻辑；这是最终设计的主要方向。",
    "br_visual_deconstruction: 对巴西链接用同样维度拆解主图和详情页，记录当地语言、场景、信任要素、平台习惯、价格敏感点和消费者关注点。",
    "localization_map: 说明如何把美国链接的设计逻辑映射到巴西市场，即设计结构跟随美国链接，内容语言、场景和信任表达按巴西链接本土化。",
    "keywords: 自动关键词、人工修正关键词、最终关键词。",
    "image_prompts: 可直接人工修改的主图、副图、场景图、信息图、详情页图片提示词；每条必须说明产品外观来自上传图，设计结构参考美国链接，内容本土化参考巴西链接。",
    "detail_page: pt-BR 标题、5 bullet、描述、FAQ、平台适配建议。",
    "compliance_notes: 风险词、禁用表达、平台合规提醒。",
    "usage_note: 简短说明本次输出适合哪些平台。"
  ].join("\n");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.5";

  if (!apiKey) {
    return sendJson(res, 500, {
      error: "OPENAI_API_KEY_MISSING",
      message: "Set OPENAI_API_KEY in your deployment environment."
    });
  }

  try {
    const payload = await readJson(req);
    const account = await getAccountByToken(getBearerToken(req)).catch(() => null);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildUserPrompt(payload) }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return sendJson(res, response.status, {
        error: "MODEL_REQUEST_FAILED",
        message: data?.error?.message || "The model provider returned an error.",
        provider_status: response.status
      });
    }

    const text = extractText(data);
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    let updatedAccount = account;
    if (account) {
      const units = Number(payload?.usage_estimate?.units || 1);
      const tokens = Number(data?.usage?.total_tokens || payload?.usage_estimate?.tokens || 0);
      await supabaseRequest("usage_logs", {
        method: "POST",
        body: JSON.stringify({
          account_id: account.id,
          type: "generate",
          action: payload?.product?.name ? `生成 ${payload.product.name}` : "生成商品方案",
          platform: payload?.platform_key || payload?.platform || "all",
          model: "openai",
          units,
          tokens,
          success: true,
          metadata: {
            provider_model: model,
            product: payload?.product,
            usage: data.usage || null
          }
        })
      });
      const rows = await supabaseRequest(`accounts?id=${filter(account.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ used: Math.min(Number(account.quota || 0), Number(account.used || 0) + units) })
      });
      updatedAccount = rows[0] || account;
    }

    return sendJson(res, 200, {
      ok: true,
      model,
      usage: data.usage || null,
      account: publicAccount(updatedAccount),
      result: parsed,
      rawText: parsed ? "" : text
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: "GENERATE_FAILED",
      message: error.message
    });
  }
};
