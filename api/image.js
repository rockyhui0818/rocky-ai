const { getAccountByToken, publicAccount } = require("./_lib/auth");
const { getBearerToken, readJson, sendJson } = require("./_lib/http");
const { filter, supabaseRequest } = require("./_lib/supabase");

function firstImage(data) {
  const item = data?.data?.[0] || {};
  return {
    b64_json: item.b64_json || "",
    url: item.url || "",
    revised_prompt: item.revised_prompt || ""
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "METHOD_NOT_ALLOWED" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

  if (!apiKey) {
    return sendJson(res, 500, {
      error: "OPENAI_API_KEY_MISSING",
      message: "Set OPENAI_API_KEY in your deployment environment."
    });
  }

  try {
    const payload = await readJson(req);
    const account = await getAccountByToken(getBearerToken(req)).catch(() => null);
    const prompt = String(payload.prompt || "").trim();
    if (!prompt) return sendJson(res, 400, { error: "PROMPT_REQUIRED", message: "Image prompt is required." });

    const response = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size: payload.size || "1024x1024",
        response_format: "b64_json"
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return sendJson(res, response.status, {
        error: "IMAGE_REQUEST_FAILED",
        message: data?.error?.message || "The image provider returned an error.",
        provider_status: response.status
      });
    }

    let updatedAccount = account;
    if (account) {
      const units = Number(payload.units || 3);
      await supabaseRequest("usage_logs", {
        method: "POST",
        body: JSON.stringify({
          account_id: account.id,
          type: "generate",
          action: "生成产品图片",
          platform: payload.platform || "all",
          model: "openai-image",
          units,
          tokens: 0,
          success: true,
          metadata: {
            provider_model: model,
            prompt_preview: prompt.slice(0, 500),
            size: payload.size || "1024x1024"
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
      image: firstImage(data),
      account: publicAccount(updatedAccount)
    });
  } catch (error) {
    return sendJson(res, 500, {
      error: "IMAGE_GENERATION_FAILED",
      message: error.message
    });
  }
};
