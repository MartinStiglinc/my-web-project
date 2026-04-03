/* Sales Decision Daily - pure JS SPA
   Core rules:
   - Load scenarios.json
   - Pick today's scenario by UTC date (YYYY-MM-DD), else fallback to last scenario (by date)
   - Language toggle SK/EN in localStorage dd_lang
   - One attempt per day: dd_result_YYYY-MM-DD
   - Scoring: Relationship/Profit/Risk; Safety=10-Risk; Total=Relationship+Profit+Safety
   - Label algorithm (SK/EN)
   - Streak storage dd_streak {current,best,lastPlayed} updated only on completion
   - Share: Copy + Web Share API if available
*/

(() => {
  const els = {
    todayDateLabel: document.getElementById("todayDateLabel"),

    langEN: document.getElementById("langEN"),
    langSK: document.getElementById("langSK"),

    scenarioTitle: document.getElementById("scenarioTitle"),
    scenarioContext: document.getElementById("scenarioContext"),
    scenarioQuestion: document.getElementById("scenarioQuestion"),

    btnA: document.getElementById("btnA"),
    btnB: document.getElementById("btnB"),
    btnC: document.getElementById("btnC"),
    textA: document.getElementById("textA"),
    textB: document.getElementById("textB"),
    textC: document.getElementById("textC"),

    resultBox: document.getElementById("resultBox"),
    labelPill: document.getElementById("labelPill"),
    attemptInfo: document.getElementById("attemptInfo"),

    mRelName: document.getElementById("mRelName"),
    mProfitName: document.getElementById("mProfitName"),
    mRiskName: document.getElementById("mRiskName"),
    mSafetyName: document.getElementById("mSafetyName"),

    mRelVal: document.getElementById("mRelVal"),
    mProfitVal: document.getElementById("mProfitVal"),
    mRiskVal: document.getElementById("mRiskVal"),
    mSafetyVal: document.getElementById("mSafetyVal"),

    mRelBar: document.getElementById("mRelBar"),
    mProfitBar: document.getElementById("mProfitBar"),
    mRiskBar: document.getElementById("mRiskBar"),
    mSafetyBar: document.getElementById("mSafetyBar"),

    totalLabel: document.getElementById("totalLabel"),
    totalVal: document.getElementById("totalVal"),

    streakCurrent: document.getElementById("streakCurrent"),
    streakBest: document.getElementById("streakBest"),
    streakCurrentLabel: document.getElementById("streakCurrentLabel"),
    streakBestLabel: document.getElementById("streakBestLabel"),

    shareTitle: document.getElementById("shareTitle"),
    shareSub: document.getElementById("shareSub"),
    shareText: document.getElementById("shareText"),
    copyBtn: document.getElementById("copyBtn"),
    shareBtn: document.getElementById("shareBtn"),
    toast: document.getElementById("toast"),

    hintText: document.getElementById("hintText"),
    footerText: document.getElementById("footerText"),
  };

  const LS_LANG = "dd_lang";
  const LS_STREAK = "dd_streak";

  const i18n = {
    en: {
      datePrefix: "UTC",
      loading: "Loading…",
      notAvailable: "Not available",
      oneDecision: "One decision per day. Choose wisely.",
      footer: "Daily micro-scenarios for sales leaders.",

      relationship: "Relationship",
      profit: "Profit",
      risk: "Risk",
      safety: "Safety",
      total: "Total",

      current: "Current",
      best: "Best",

      chosen: "Chosen",
      alreadyPlayed: "Already played today",
      completedOn: "Completed on",
      share: "Share",
      shareSub: "Copy or share your result.",
      copy: "Copy",
      copied: "Copied to clipboard ✓",
      shareBtn: "Share",
      shareNotSupported: "Sharing not supported on this device.",
      copyFailed: "Copy failed. Please select and copy manually.",

      // Labels
      labels: {
        balanced: "Balanced",
        gambler: "Gambler",
        diplomat: "Diplomat",
        closer: "Closer",
        pragmatist: "Pragmatist",
      },

      shareTemplateTitle: "Sales Decision Daily",
      shareYourLabel: "Label",
      shareYourScore: "Score",
      shareStreak: "Streak",
      shareChoice: "Choice",
    },
    sk: {
      datePrefix: "UTC",
      loading: "Načítavam…",
      notAvailable: "Nedostupné",
      oneDecision: "Jedno rozhodnutie za deň. Vyber múdro.",
      footer: "Denné mikro-scenáre pre sales lídrov.",

      relationship: "Vzťah",
      profit: "Zisk",
      risk: "Riziko",
      safety: "Bezpečnosť",
      total: "Spolu",

      current: "Séria",
      best: "Najlepšia",

      chosen: "Voľba",
      alreadyPlayed: "Dnes už si hral",
      completedOn: "Dokončené",
      share: "Zdieľať",
      shareSub: "Skopíruj alebo zdieľaj svoj výsledok.",
      copy: "Kopírovať",
      copied: "Skopírované ✓",
      shareBtn: "Zdieľať",
      shareNotSupported: "Zdieľanie nie je podporované na tomto zariadení.",
      copyFailed: "Kopírovanie zlyhalo. Označ text a skopíruj ručne.",

      // Labels
      labels: {
        balanced: "Vyvážený",
        gambler: "Hazardér",
        diplomat: "Diplomat",
        closer: "Closer",
        pragmatist: "Pragmatik",
      },

      shareTemplateTitle: "Sales Decision Daily",
      shareYourLabel: "Typ",
      shareYourScore: "Skóre",
      shareStreak: "Séria",
      shareChoice: "Voľba",
    }
  };

  let lang = loadLang();
  let scenarios = [];
  let todaysScenario = null;
  let todayStr = "";
  let resultKey = "";
  let todaysResult = null;

  // ---------- Helpers ----------
  function getUTCDateString(date = new Date()) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function parseUTCDateString(yyyyMMdd) {
    // returns Date at UTC midnight
    const [y, m, d] = yyyyMMdd.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  }

  function getYesterdayUTCString(todayYYYYMMDD) {
    const dt = parseUTCDateString(todayYYYYMMDD);
    const yest = new Date(dt.getTime() - 86400000);
    return getUTCDateString(yest);
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function safeJsonParse(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }

  function t(key) {
    return i18n[lang][key] ?? i18n.en[key] ?? key;
  }

  function setText(el, value) {
    if (!el) return;
    el.textContent = value ?? "";
  }

  function pickLocalized(obj) {
    if (!obj) return "";
    if (typeof obj === "string") return obj;
    return obj[lang] ?? obj.en ?? "";
  }

  function loadLang() {
    const saved = localStorage.getItem(LS_LANG);
    if (saved === "sk" || saved === "en") return saved;
    // default: English
    localStorage.setItem(LS_LANG, "en");
    return "en";
  }

  function saveLang(next) {
    lang = next;
    localStorage.setItem(LS_LANG, lang);
    syncLangUI();
    renderAll();
  }

  function syncLangUI() {
    const isEN = lang === "en";
    els.langEN.setAttribute("aria-pressed", String(isEN));
    els.langSK.setAttribute("aria-pressed", String(!isEN));
    document.documentElement.lang = lang;
  }

  function sortScenariosByDateAsc(arr) {
    return [...arr].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  function selectTodayScenario(arr, todayYYYYMMDD) {
    // 1) direct match
    const exact = arr.find(s => s.date === todayYYYYMMDD);
    if (exact) return exact;

    // 2) fallback to last by date (ascending)
    const sorted = sortScenariosByDateAsc(arr);
    return sorted[sorted.length - 1] || null;
  }

  function getResultStorageKey(todayYYYYMMDD) {
    return `dd_result_${todayYYYYMMDD}`;
  }

  function loadTodayResult(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const res = safeJsonParse(raw, null);
    // expected: { choice: "A"|"B"|"C", at: ISO, scenarioDate: "YYYY-MM-DD" }
    if (!res || !res.choice) return null;
    return res;
  }

  function storeTodayResult(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function getOption(scenario, choiceLetter) {
    if (!scenario?.options) return null;
    return scenario.options[choiceLetter] || null;
  }

  function computeScores(option) {
    const rel = clamp(Number(option?.scores?.relationship ?? 0), 0, 10);
    const prof = clamp(Number(option?.scores?.profit ?? 0), 0, 10);
    const risk = clamp(Number(option?.scores?.risk ?? 0), 0, 10);
    const safety = clamp(10 - risk, 0, 10);
    const total = rel + prof + safety;
    return { rel, prof, risk, safety, total };
  }

  function computeLabel(scores) {
    // Balanced if relationship>=6 AND profit>=6 AND safety>=6
    if (scores.rel >= 6 && scores.prof >= 6 && scores.safety >= 6) return "balanced";
    // else Gambler if risk>=7
    if (scores.risk >= 7) return "gambler";

    // else Diplomat if relationship is max and >=7
    const maxVal = Math.max(scores.rel, scores.prof, scores.safety);
    if (scores.rel === maxVal && scores.rel >= 7) return "diplomat";

    // else Closer if profit is max and >=7
    if (scores.prof === maxVal && scores.prof >= 7) return "closer";

    // else Pragmatist
    return "pragmatist";
  }

  function labelText(labelKey) {
    return i18n[lang].labels[labelKey] ?? i18n.en.labels[labelKey] ?? labelKey;
  }

  function emojiBar(value, kind = "good") {
    // 0..10
    const v = clamp(value, 0, 10);
    const filled = Math.round(v / 2); // 0..5
    const empty = 5 - filled;
    const solid = kind === "risk" ? "🟥" : "🟦";
    const blank = "⬜";
    return solid.repeat(filled) + blank.repeat(empty);
  }

  function buildShareText({ scenario, choice, scores, label, streak }) {
    const title = t("shareTemplateTitle");
    const dateLine = `${t("datePrefix")} ${todayStr}`;
    const scenTitle = pickLocalized(scenario.title);
    const choiceText = pickLocalized(getOption(scenario, choice)?.text);

    const relName = t("relationship");
    const profName = t("profit");
    const riskName = t("risk");
    const safeName = t("safety");

    const lines = [];
    lines.push(`${title} • ${dateLine}`);
    lines.push(`${scenTitle}`);
    lines.push("");
    lines.push(`${t("shareChoice")}: ${choice} — ${choiceText}`);
    lines.push(`${t("shareYourLabel")}: ${labelText(label)}`);
    lines.push(`${t("shareYourScore")}: ${scores.total}  (${scores.rel}/${scores.prof}/${scores.safety})`);
    lines.push(`${relName}: ${scores.rel}/10 ${emojiBar(scores.rel)}`);
    lines.push(`${profName}: ${scores.prof}/10 ${emojiBar(scores.prof)}`);
    lines.push(`${riskName}: ${scores.risk}/10 ${emojiBar(scores.risk, "risk")}`);
    lines.push(`${safeName}: ${scores.safety}/10 ${emojiBar(scores.safety)}`);
    lines.push("");
    lines.push(`${t("shareStreak")}: ${streak.current} (${t("best")}: ${streak.best})`);
    return lines.join("\n");
  }

  function showToast(msg) {
    setText(els.toast, msg);
    els.toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => {
      els.toast.hidden = true;
    }, 1800);
  }

  // ---------- Streak ----------
  function loadStreak() {
    const raw = localStorage.getItem(LS_STREAK);
    const s = safeJsonParse(raw, null);
    if (s && typeof s === "object") {
      return {
        current: Number(s.current || 0),
        best: Number(s.best || 0),
        lastPlayed: typeof s.lastPlayed === "string" ? s.lastPlayed : null
      };
    }
    return { current: 0, best: 0, lastPlayed: null };
  }

  function saveStreak(streak) {
    localStorage.setItem(LS_STREAK, JSON.stringify(streak));
  }

  function updateStreakOnComplete(todayYYYYMMDD) {
    const streak = loadStreak();
    const yesterday = getYesterdayUTCString(todayYYYYMMDD);

    if (streak.lastPlayed === todayYYYYMMDD) {
      // already updated today
      return streak;
    }

    if (streak.lastPlayed === yesterday) {
      streak.current = (streak.current || 0) + 1;
    } else {
      streak.current = 1;
    }

    streak.best = Math.max(streak.best || 0, streak.current);
    streak.lastPlayed = todayYYYYMMDD;
    saveStreak(streak);
    return streak;
  }

  // ---------- Rendering ----------
  function applyStaticText() {
    setText(els.hintText, t("oneDecision"));
    setText(els.footerText, t("footer"));

    setText(els.mRelName, t("relationship"));
    setText(els.mProfitName, t("profit"));
    setText(els.mRiskName, t("risk"));
    setText(els.mSafetyName, t("safety"));
    setText(els.totalLabel, t("total"));

    setText(els.shareTitle, t("share"));
    setText(els.shareSub, t("shareSub"));
    setText(els.copyBtn, t("copy"));
    setText(els.shareBtn, t("shareBtn"));

    setText(els.streakCurrentLabel, t("current"));
    setText(els.streakBestLabel, t("best"));

    // date label
    setText(els.todayDateLabel, `${t("datePrefix")} ${todayStr}`);
  }

  function renderScenario() {
    if (!todaysScenario) {
      setText(els.scenarioTitle, t("notAvailable"));
      setText(els.scenarioContext, "");
      setText(els.scenarioQuestion, "");
      setText(els.textA, "—");
      setText(els.textB, "—");
      setText(els.textC, "—");
      disableChoices(true);
      return;
    }

    setText(els.scenarioTitle, pickLocalized(todaysScenario.title));
    setText(els.scenarioContext, pickLocalized(todaysScenario.context));
    setText(els.scenarioQuestion, pickLocalized(todaysScenario.question));

    setText(els.textA, pickLocalized(todaysScenario.options.A.text));
    setText(els.textB, pickLocalized(todaysScenario.options.B.text));
    setText(els.textC, pickLocalized(todaysScenario.options.C.text));
  }

  function disableChoices(disabled) {
    [els.btnA, els.btnB, els.btnC].forEach(btn => btn.disabled = !!disabled);
  }

  function clearChoiceStyling() {
    [els.btnA, els.btnB, els.btnC].forEach(btn => {
      btn.classList.remove("selected");
      btn.classList.remove("dim");
    });
  }

  function styleChoicesAfterPick(choice) {
    clearChoiceStyling();
    const map = { A: els.btnA, B: els.btnB, C: els.btnC };
    const chosenBtn = map[choice];
    if (chosenBtn) chosenBtn.classList.add("selected");
    Object.entries(map).forEach(([k, btn]) => {
      if (k !== choice) btn.classList.add("dim");
    });
  }

  function setBars(scores) {
    // percent: 0..100
    els.mRelVal.textContent = String(scores.rel);
    els.mProfitVal.textContent = String(scores.prof);
    els.mRiskVal.textContent = String(scores.risk);
    els.mSafetyVal.textContent = String(scores.safety);

    els.mRelBar.style.width = `${scores.rel * 10}%`;
    els.mProfitBar.style.width = `${scores.prof * 10}%`;
    els.mRiskBar.style.width = `${scores.risk * 10}%`;
    els.mSafetyBar.style.width = `${scores.safety * 10}%`;

    els.totalVal.textContent = String(scores.total);
  }

  function renderResultState() {
    if (!todaysScenario) return;

    // load streak always for display
    const streak = loadStreak();
    els.streakCurrent.textContent = String(streak.current || 0);
    els.streakBest.textContent = String(streak.best || 0);

    if (!todaysResult) {
      els.resultBox.hidden = true;
      clearChoiceStyling();
      disableChoices(false);
      return;
    }

    const option = getOption(todaysScenario, todaysResult.choice);
    const scores = computeScores(option);
    const labelKey = computeLabel(scores);

    disableChoices(true);
    styleChoicesAfterPick(todaysResult.choice);

    els.resultBox.hidden = false;
    setText(els.labelPill, labelText(labelKey));

    // attempt info
    const at = todaysResult.at ? new Date(todaysResult.at) : null;
    const when = at ? at.toISOString().slice(0, 19).replace("T", " ") + "Z" : "";
    setText(els.attemptInfo, `${t("alreadyPlayed")} • ${t("completedOn")}: ${when}`);

    setBars(scores);

    // Share text
    const shareTxt = buildShareText({
      scenario: todaysScenario,
      choice: todaysResult.choice,
      scores,
      label: labelKey,
      streak
    });
    els.shareText.value = shareTxt;
  }

  function renderAll() {
    syncLangUI();
    applyStaticText();
    renderScenario();
    renderResultState();
  }

  // ---------- Events ----------
  function onChoice(choiceLetter) {
    if (!todaysScenario) return;

    // one attempt per day
    if (todaysResult) return;

    const option = getOption(todaysScenario, choiceLetter);
    if (!option) return;

    // store result
    const payload = {
      choice: choiceLetter,
      at: new Date().toISOString(),
      scenarioDate: todaysScenario.date
    };
    storeTodayResult(resultKey, payload);
    todaysResult = payload;

    // update streak now (only when completing today's decision)
    const streak = updateStreakOnComplete(todayStr);

    // update UI
    // (renderResultState reads streak again, but we'll ensure it is fresh)
    els.streakCurrent.textContent = String(streak.current || 0);
    els.streakBest.textContent = String(streak.best || 0);

    renderResultState();
  }

  async function copyShareText() {
    const text = els.shareText.value || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast(t("copied"));
    } catch (e) {
      // fallback: select and copy
      try {
        els.shareText.focus();
        els.shareText.select();
        const ok = document.execCommand("copy");
        if (ok) showToast(t("copied"));
        else showToast(t("copyFailed"));
      } catch {
        showToast(t("copyFailed"));
      }
    }
  }

  async function webShare() {
    const text = els.shareText.value || "";
    if (!text) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Sales Decision Daily",
          text
        });
      } catch {
        // user cancelled or share failed silently
      }
    } else {
      showToast(t("shareNotSupported"));
    }
  }

  function wireEvents() {
    els.langEN.addEventListener("click", () => saveLang("en"));
    els.langSK.addEventListener("click", () => saveLang("sk"));

    [els.btnA, els.btnB, els.btnC].forEach(btn => {
      btn.addEventListener("click", () => onChoice(btn.dataset.choice));
    });

    els.copyBtn.addEventListener("click", copyShareText);
    els.shareBtn.addEventListener("click", webShare);
  }

  // ---------- Boot ----------
  async function boot() {
    wireEvents();
    syncLangUI();

    todayStr = getUTCDateString(new Date());
    resultKey = getResultStorageKey(todayStr);

    // Set initial text quickly
    setText(els.scenarioTitle, t("loading"));
    setText(els.scenarioContext, "");
    setText(els.scenarioQuestion, "");
    applyStaticText();

    // Load scenarios
    try {
      const res = await fetch("scenarios.json", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load scenarios.json");
      scenarios = await res.json();

      // Validate shape minimally
      if (!Array.isArray(scenarios)) throw new Error("scenarios.json must be an array");

      todaysScenario = selectTodayScenario(scenarios, todayStr);
      todaysResult = loadTodayResult(resultKey);

      renderAll();
    } catch (err) {
      console.error(err);
      setText(els.scenarioTitle, t("notAvailable"));
      setText(els.scenarioContext, "");
      setText(els.scenarioQuestion, "");
      disableChoices(true);
    }
  }

  boot();
})();