(() => {
  "use strict";

  const PROFILE_KEY = "proposal-tool.profile";
  const API_KEY_STORAGE = "proposal-tool.anthropic-api-key";

  const profileInput = document.getElementById("profile");
  const apiKeyInput = document.getElementById("api-key");
  const rememberKeyCheckbox = document.getElementById("remember-key");
  const modelSelect = document.getElementById("model-select");
  const jobInfoInput = document.getElementById("job-info");
  const btnGenerate = document.getElementById("btn-generate");
  const statusEl = document.getElementById("status");
  const outputEl = document.getElementById("output");
  const btnCopy = document.getElementById("btn-copy");
  const btnDownload = document.getElementById("btn-download");

  // ---- プロフィールの自動保存 ----
  const savedProfile = localStorage.getItem(PROFILE_KEY);
  if (savedProfile) {
    profileInput.value = savedProfile;
  }
  profileInput.addEventListener("blur", () => {
    localStorage.setItem(PROFILE_KEY, profileInput.value);
  });

  // ---- APIキーの記憶 ----
  const savedKey = localStorage.getItem(API_KEY_STORAGE);
  if (savedKey) {
    apiKeyInput.value = savedKey;
    rememberKeyCheckbox.checked = true;
  }
  rememberKeyCheckbox.addEventListener("change", () => {
    if (!rememberKeyCheckbox.checked) {
      localStorage.removeItem(API_KEY_STORAGE);
    }
  });

  // ---- 提案文生成 ----
  btnGenerate.addEventListener("click", async () => {
    const apiKey = apiKeyInput.value.trim();
    const profile = profileInput.value.trim();
    const jobInfo = jobInfoInput.value.trim();
    const model = modelSelect.value;

    if (!apiKey) {
      statusEl.textContent = "APIキーを入力してください。";
      return;
    }
    if (!jobInfo) {
      statusEl.textContent = "案件情報を入力してください。";
      return;
    }

    if (rememberKeyCheckbox.checked) {
      localStorage.setItem(API_KEY_STORAGE, apiKey);
    }
    localStorage.setItem(PROFILE_KEY, profile);

    btnGenerate.disabled = true;
    statusEl.textContent = "生成中...";
    outputEl.value = "";

    const systemPrompt = [
      "あなたはクラウドソーシングサイトでの案件応募文の作成を手伝うアシスタントです。",
      "応募者のプロフィールと案件情報をもとに、その案件に合わせた提案文（応募メッセージ）の下書きを作成してください。",
      "",
      "# 提案文の条件",
      "- 日本語、丁寧だが堅すぎない文体。",
      "- 冒頭で簡潔に挨拶し、案件内容を理解していることを示す。",
      "- プロフィールの中から、この案件に関連する実績・強みを具体的に触れる。",
      "- 誇張や事実にない実績を書かない。プロフィールに書かれていない実績は創作しない。",
      "- 文字数は300〜500字程度。",
      "- 提案文の本文のみを出力し、前置きや説明は付けない。",
    ].join("\n");

    const userContent = [
      "# 応募者プロフィール",
      profile || "(未入力)",
      "",
      "# 案件情報",
      jobInfo,
    ].join("\n");

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }],
        }),
      });

      if (!response.ok) {
        let message = `エラー (HTTP ${response.status})`;
        try {
          const errJson = await response.json();
          if (errJson?.error?.message) {
            message = errJson.error.message;
          }
        } catch (e) {
          // JSON以外のエラー応答は無視
        }
        throw new Error(message);
      }

      const data = await response.json();
      const textBlock = (data.content || []).find((b) => b.type === "text");
      outputEl.value = textBlock ? textBlock.text.trim() : "";
      statusEl.textContent = "完了しました。";
    } catch (err) {
      statusEl.textContent = `失敗しました: ${err.message}`;
    } finally {
      btnGenerate.disabled = false;
    }
  });

  btnCopy.addEventListener("click", () => {
    copyToClipboard(outputEl.value);
  });

  btnDownload.addEventListener("click", () => {
    downloadText(outputEl.value, "proposal-draft.txt");
  });

  // ---- 共通ユーティリティ ----
  function copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).catch(() => {
      // クリップボードAPIが使えない環境では無視
    });
  }

  function downloadText(text, filename) {
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
})();
