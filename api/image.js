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

function dataUrlToBlob(dataUrl) {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  return new Blob([bytes], { type: match[1] });
}

async function requestImage({ baseUrl, apiKey, model, prompt, size, referenceImage }) {
  const referenceBlob = dataUrlToBlob(referenceImage);
  if (referenceBlob) {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt);
    form.append("size", size);
    form.append("response_format", "b64_json");
    form.append("image", referenceBlob, "product-reference.png");
    const editResponse = await fetch(`${baseUrl}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    });
    const editData = await editResponse.json().catch(() => ({}));
    if (editResponse.ok) {
      return { data: editData, mode: "reference-edit" };
    }
  }

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
      size,
      response_format: "b64_json"
    })
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data?.error?.message || "The image provider returned an error.");
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }
  return { data, mode: "text-generation" };
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
    const size = payload.size || "1024x1024";
    if (!prompt) return sendJson(res, 400, { error: "PROMPT_REQUIRED", message: "Image prompt is required." });

    const prompts = Array.isArray(payload.prompts) && payload.prompts.length
      ? payload.prompts
      : [{ type: payload.type || "main", prompt }];
    const images = [];
    const modes = new Set();

    for (const item of prompts.slice(0, 6)) {
      const finalPrompt = [
        String(item.prompt || prompt),
        "",
        "Critical product consistency rules:",
        "Use the uploaded product reference as the source of truth for shape, color, material, proportions, visible features, and included accessories.",
        "Do not invent a different product. Do not change core product design. Generate one standalone marketplace image only, not a collage."
      ].join("\n");
      const result = await requestImage({
        baseUrl,
        apiKey,
        model,
        prompt: finalPrompt,
        size,
        referenceImage: payload.reference_image
      });
      modes.add(result.mode);
      images.push({
        type: item.type || "image",
        label: item.label || item.type || "图片",
        prompt: finalPrompt,
        ...firstImage(result.data)
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
            size,
            image_count: images.length,
            mode: Array.from(modes).join(",")
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
      size,
      mode: Array.from(modes).join(","),
      images,
      image: images[0] || {},
      account: publicAccount(updatedAccount)
    });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      error: "IMAGE_GENERATION_FAILED",
      message: error.message,
      details: error.details
    });
  }
};
