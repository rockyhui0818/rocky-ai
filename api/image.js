const { getAccountByToken, publicAccount } = require("./_lib/auth");
const { getBearerToken, handleOptions, readJson, sendJson } = require("./_lib/http");
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

function estimateBytes(value) {
  return Buffer.byteLength(String(value || ""), "utf8");
}

async function readProviderPayload(response) {
  const rawText = await response.text().catch(() => "");
  if (!rawText) return { data: {}, rawText: "" };
  try {
    return { data: JSON.parse(rawText), rawText };
  } catch {
    return { data: {}, rawText };
  }
}

function cleanProviderText(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
}

function getProviderMessage(data, rawText, fallback) {
  const error = data?.error;
  return readableProviderMessage(
    error?.message ||
    error?.error?.message ||
    error ||
    data?.message ||
    data?.detail ||
    cleanProviderText(rawText) ||
    fallback
  );
}

function readableProviderMessage(value) {
  if (!value) return "";
  if (typeof value === "string") return value === "[object Object]" ? "" : value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(readableProviderMessage).filter(Boolean).join("；");
  if (typeof value === "object") {
    const direct = value.message || value.error?.message || value.error || value.detail || value.code || value.type;
    const directText = readableProviderMessage(direct);
    if (directText) return directText;
    try {
      return JSON.stringify(value).slice(0, 700);
    } catch {
      return "";
    }
  }
  return String(value);
}

function isRetryableProviderError(error) {
  const status = Number(error?.details?.status || error?.statusCode || 0);
  const message = String(error?.message || "").toLowerCase();
  return (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status >= 500 ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("temporarily") ||
    message.includes("rate limit")
  );
}

function appendReferenceImages(form, blobs) {
  blobs.forEach((blob, index) => {
    form.append("image", blob, `product-reference-${index + 1}.jpg`);
  });
}

async function requestImage({ baseUrl, apiKey, model, prompt, size, referenceImage, referenceImages }) {
  const referenceBlobs = (Array.isArray(referenceImages) && referenceImages.length ? referenceImages : [referenceImage])
    .map(dataUrlToBlob)
    .filter(Boolean)
    .slice(0, 4);
  let editFailure = null;
  if (referenceBlobs.length) {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt);
    form.append("size", size);
    form.append("response_format", "b64_json");
    appendReferenceImages(form, referenceBlobs);
    const editResponse = await fetch(`${baseUrl}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form
    });
    const { data: editData, rawText: editRawText } = await readProviderPayload(editResponse);
    if (editResponse.ok) {
      return { data: editData, mode: "reference-edit" };
    }

    if (referenceBlobs.length > 1) {
      const singleForm = new FormData();
      singleForm.append("model", model);
      singleForm.append("prompt", prompt);
      singleForm.append("size", size);
      singleForm.append("response_format", "b64_json");
      appendReferenceImages(singleForm, referenceBlobs.slice(0, 1));
      const singleResponse = await fetch(`${baseUrl}/images/edits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: singleForm
      });
      const { data: singleData, rawText: singleRawText } = await readProviderPayload(singleResponse);
      if (singleResponse.ok) {
        return { data: singleData, mode: "reference-edit-single-fallback" };
      }
      editFailure = {
        endpoint: "/images/edits",
        status: singleResponse.status,
        message: getProviderMessage(singleData, singleRawText, "Reference image edit request failed."),
        details: {
          multi_reference_failure: editData,
          single_reference_failure: singleData
        },
        raw: cleanProviderText(singleRawText) || cleanProviderText(editRawText)
      };
    } else {
      editFailure = {
        endpoint: "/images/edits",
        status: editResponse.status,
        message: getProviderMessage(editData, editRawText, "Reference image edit request failed."),
        details: editData,
        raw: cleanProviderText(editRawText)
      };
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
  const { data, rawText } = await readProviderPayload(response);
  if (!response.ok) {
    const message = getProviderMessage(data, rawText, "The image provider returned an error.");
    const error = new Error(message);
    error.statusCode = response.status;
    error.details = {
      endpoint: "/images/generations",
      status: response.status,
      provider_message: message,
      provider_details: data,
      provider_raw: cleanProviderText(rawText),
      reference_edit_failure: editFailure
    };
    throw error;
  }
  return { data, mode: "text-generation" };
}

module.exports = async function handler(req, res) {
  if (handleOptions(req, res)) return;
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
    const referenceImages = Array.isArray(payload.reference_images) ? payload.reference_images.slice(0, 4) : [];
    const referenceBytes = referenceImages.length
      ? referenceImages.reduce((sum, item) => sum + estimateBytes(item), 0)
      : estimateBytes(payload.reference_image);
    if (referenceBytes > 900000) {
      return sendJson(res, 413, {
        error: "REFERENCE_IMAGE_TOO_LARGE",
        message: "上传参考图体积过大，请换用更小图片或等待前端压缩后再生成。",
        details: {
          reference_bytes: referenceBytes,
          max_reference_bytes: 900000
        }
      });
    }

    const prompts = Array.isArray(payload.prompts) && payload.prompts.length
      ? payload.prompts
      : [{ type: payload.type || "main", prompt }];
    const images = [];
    const modes = new Set();

    const failures = [];
    const maxImages = Math.max(1, Math.min(Number(payload.max_images || 3), 4));
    for (const item of prompts.slice(0, maxImages)) {
      const finalPrompt = [
        String(item.prompt || prompt),
        "",
        "Critical product consistency rules:",
        "Use the uploaded product reference as the source of truth for shape, color, material, proportions, visible features, and included accessories.",
        "Do not invent a different product. Do not change core product design. Generate one standalone marketplace image only, not a collage."
      ].join("\n");
      try {
        let result;
        try {
          result = await requestImage({
            baseUrl,
            apiKey,
            model,
            prompt: finalPrompt,
            size,
            referenceImage: payload.reference_image,
            referenceImages
          });
        } catch (firstError) {
          if (!isRetryableProviderError(firstError)) throw firstError;
          result = await requestImage({
            baseUrl,
            apiKey,
            model,
            prompt: finalPrompt,
            size,
            referenceImage: payload.reference_image,
            referenceImages
          });
        }
        modes.add(result.mode);
        images.push({
          type: item.type || "image",
          label: item.label || item.type || "图片",
          targetSpec: item.targetSpec || null,
          prompt: finalPrompt,
          ...firstImage(result.data)
        });
      } catch (itemError) {
        failures.push({
          type: item.type || "image",
          label: item.label || item.type || "图片",
          targetSpec: item.targetSpec || null,
          message: itemError.message,
          details: itemError.details || null
        });
      }
    }

    if (!images.length && failures.length) {
      const error = new Error(failures[0]?.message || "All image generation requests failed.");
      error.statusCode = failures[0]?.details?.status || 502;
      error.details = {
        model,
        size,
        failures
      };
      throw error;
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
            max_images: maxImages,
            image_count: images.length,
            failed_image_count: failures.length,
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
      failures,
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
