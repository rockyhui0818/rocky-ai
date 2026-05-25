function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function extractText(data) {
  return data?.choices?.[0]?.message?.content || data?.output_text || data?.content?.[0]?.text || "";
}

function buildSystemPrompt() {
  return [
    "You are VISION BRZAZIL's senior Brazil ecommerce creative strategist.",
    "Analyze multi-market product URLs, selling points, corrected keywords, and platform rules.",
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
    "link_analysis: 多链接拆解，区分美国竞品链接和巴西本地链接。",
    "keywords: 自动关键词、人工修正关键词、最终关键词。",
    "image_prompts: 主图、副图、场景图、信息图、详情页图片提示词。",
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
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.5-pro";

  if (!apiKey) {
    return sendJson(res, 500, {
      error: "OPENAI_API_KEY_MISSING",
      message: "Set OPENAI_API_KEY in your deployment environment."
    });
  }

  try {
    const payload = await readJson(req);
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

    return sendJson(res, 200, {
      ok: true,
      model,
      usage: data.usage || null,
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
