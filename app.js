const STORAGE_KEY = "qike.entries.v1";
const DRAFT_KEY = "qike.draft.v1";
const CARE_KEY = "qike.care.v1";
const MODE_KEY = "qike.demo.v1";

const moodMeta = {
  1: { label: "低落", color: "#82919a" },
  2: { label: "疲惫", color: "#9b93ae" },
  3: { label: "平静", color: "#718a74" },
  4: { label: "轻快", color: "#d69a47" },
  5: { label: "雀跃", color: "#ec6a55" },
};

const prompts = [
  "这一刻，身体最先告诉了你什么？",
  "今天有没有一个瞬间，让情绪发生了变化？",
  "如果这份感受会说话，它最想告诉你什么？",
  "此刻你最希望被怎样理解？",
  "有什么是你已经努力过、却还没来得及肯定自己的？",
];

const triggerKeywords = {
  "工作/学业": ["工作", "加班", "会议", "同事", "老板", "考试", "论文", "作业", "绩效", "截止", "ddl", "汇报", "面试"],
  人际关系: ["朋友", "同学", "家人", "父母", "伴侣", "吵架", "误会", "关系", "消息", "社交"],
  睡眠: ["睡", "失眠", "熬夜", "凌晨", "困", "醒", "梦"],
  身体状态: ["头疼", "胃", "痛", "生病", "身体", "心跳", "胸闷", "经期", "累"],
  自我期待: ["应该", "必须", "不够好", "失败", "比较", "别人", "责怪", "做不到", "完美"],
};

const crisisKeywords = ["不想活", "自杀", "伤害自己", "活不下去", "消失算了", "结束生命"];

const practiceConfig = {
  breath: {
    eyebrow: "一分钟练习",
    title: "跟随呼吸",
    description: "自然吸气 4 秒，缓慢呼气 6 秒。不用屏息，也不用刻意深呼吸。",
    seconds: 60,
    mode: "breath",
  },
  grounding: {
    eyebrow: "感官着陆",
    title: "把注意力带回附近",
    description: "慢慢寻找，不需要一次完成所有答案。",
    seconds: 180,
    mode: "grounding",
  },
  walk: {
    eyebrow: "十分钟活动",
    title: "不带目标地走一会",
    description: "选择安全、平坦的地方，按舒适的速度走动。身体不适时请改为休息。",
    seconds: 600,
    mode: "walk",
  },
  sound: {
    eyebrow: "舒缓声音",
    title: "听一段缓慢的声音",
    description: "一段缓慢变化的合成环境和音。先调低音量，不必刻意跟随它。",
    seconds: 300,
    mode: "sound",
  },
};

const state = {
  selectedMood: null,
  selectedScore: null,
  selectedTriggers: new Set(),
  entries: [],
  demoEntries: [],
  demo: false,
  careSessions: [],
  editingId: null,
  storageError: "",
  practiceDeadline: 0,
  feedbackId: null,
  lastChord: -1,
  audioMaster: null,
  focusReturn: null,
  trendDays: 7,
  activePractice: null,
  practiceRemaining: 0,
  practiceTimer: null,
  practiceRunning: false,
  audioContext: null,
  audioNodes: [],
  toastTimer: null,
};

const els = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheElements();
  state.entries = loadEntries();
  state.demoEntries = createDemoEntries();
  state.careSessions = readList(CARE_KEY).filter(validCareSession);
  state.demo = readLocal(MODE_KEY) === "true" ||
    (readLocal(MODE_KEY) === null && !state.entries.length && readLocal(STORAGE_KEY) !== "[]");
  setDateLabel();
  bindEvents();
  restoreDraft();
  renderAll();
  refreshIcons();
  if (state.storageError) showSaveError(state.storageError);
});

function cacheElements() {
  [
    "dateLabel",
    "checkinForm",
    "moodOptions",
    "intensity",
    "intensityValue",
    "journalText",
    "writingPrompt",
    "promptButton",
    "charCount",
    "supportHint",
    "triggerOptions",
    "saveButton",
    "analysisResult",
    "analysisTitle",
    "analysisMood",
    "analysisSummary",
    "analysisTags",
    "suggestedCareButton",
    "suggestedCareText",
    "entryList",
    "weekCount",
    "miniChart",
    "contextInsight",
    "averageMood",
    "averageMoodLabel",
    "totalEntries",
    "topTrigger",
    "topTriggerCount",
    "trendChart",
    "triggerBars",
    "reflectionText",
    "careHeadline",
    "practiceModal",
    "practiceType",
    "practiceModalTitle",
    "practiceDescription",
    "practiceStage",
    "breathVisual",
    "breathProgress",
    "breathText",
    "groundingList",
    "soundVisual",
    "practiceTime",
    "practiceStartButton",
    "infoModal",
    "infoEyebrow",
    "infoModalTitle",
    "infoModalBody",
    "infoModalActions",
    "privacyButton",
    "settingsButton",
    "supportButton",
    "quickBreathButton",
    "toast",
    "toastText",
    "demoNotice", "showDemoButton", "startPersonalButton", "viewHistoryButton",
    "draftStatus", "draftMessage", "discardDraftButton", "triggerHint", "saveError",
    "historySearch", "historyMood", "historyList", "historyCount", "periodLabel",
    "featuredPracticeButton", "featuredPracticeTitle", "featuredReason", "featuredCaption",
    "practiceNote", "practiceFeedback", "feedbackSaved", "soundVolumeLabel", "soundVolume",
    "careHistorySummary", "careHistoryList", "importFile",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  els.moodOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mood]");
    if (!button) return;
    state.selectedMood = button.dataset.mood;
    state.selectedScore = Number(button.dataset.score);
    document.querySelectorAll("[data-mood]").forEach((item) => {
      item.setAttribute("aria-pressed", String(item === button));
    });
    updateSaveState();
    saveDraft();
  });

  els.intensity.addEventListener("input", () => {
    els.intensityValue.value = els.intensity.value;
    saveDraft();
  });

  els.journalText.addEventListener("input", () => {
    els.charCount.textContent = els.journalText.value.length;
    evaluateSafetyHint();
    renderTriggerSuggestions();
    saveDraft();
  });

  els.promptButton.addEventListener("click", rotatePrompt);

  els.triggerOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-trigger]");
    if (!button) return;
    const trigger = button.dataset.trigger;
    if (state.selectedTriggers.has(trigger)) {
      state.selectedTriggers.delete(trigger);
    } else {
      state.selectedTriggers.add(trigger);
    }
    if (trigger === "说不清" && state.selectedTriggers.has(trigger)) {
      state.selectedTriggers = new Set(["说不清"]);
    } else if (trigger !== "说不清") {
      state.selectedTriggers.delete("说不清");
    }
    renderTriggerSuggestions();
    saveDraft();
  });

  els.checkinForm.addEventListener("submit", saveCheckin);
  els.suggestedCareButton.addEventListener("click", () => openPractice(els.suggestedCareButton.dataset.practice || "breath"));
  els.quickBreathButton.addEventListener("click", () => openPractice("breath"));

  document.querySelectorAll("[data-practice]").forEach((button) => {
    button.addEventListener("click", () => openPractice(button.dataset.practice));
  });

  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closePractice);
  });
  document.querySelectorAll("[data-close-info]").forEach((button) => {
    button.addEventListener("click", closeInfo);
  });

  els.practiceModal.addEventListener("click", (event) => {
    if (event.target === els.practiceModal) closePractice();
  });
  els.infoModal.addEventListener("click", (event) => {
    if (event.target === els.infoModal) closeInfo();
  });

  els.practiceStartButton.addEventListener("click", togglePractice);
  els.privacyButton.addEventListener("click", showPrivacy);
  els.settingsButton.addEventListener("click", showSettings);
  els.supportButton.addEventListener("click", showSupport);
  els.startPersonalButton.addEventListener("click", () => {
    setDemo(false);
    switchView("today");
    document.querySelector('[data-mood="平静"]').focus({ preventScroll: true });
  });
  els.showDemoButton.addEventListener("click", () => setDemo(true));
  els.viewHistoryButton.addEventListener("click", () => {
    switchView("trends", false);
    document.getElementById("historySection").scrollIntoView({ behavior: "smooth" });
    els.historySearch.focus({ preventScroll: true });
  });
  els.historySearch.addEventListener("input", renderHistory);
  els.historyMood.addEventListener("change", renderHistory);
  [els.entryList, els.historyList].forEach((list) => {
    list.addEventListener("click", (event) => {
      const button = event.target.closest("[data-entry]");
      if (button) showEntry(button.dataset.entry);
    });
  });
  els.discardDraftButton.addEventListener("click", () => {
    resetForm();
    removeLocal(DRAFT_KEY);
    showToast("草稿已丢弃");
  });
  els.importFile.addEventListener("change", importData);
  els.soundVolume.addEventListener("input", () => {
    if (state.audioMaster && state.audioContext) {
      state.audioMaster.gain.setTargetAtTime(Number(els.soundVolume.value) / 1000, state.audioContext.currentTime, 0.2);
    }
  });
  document.querySelectorAll("[data-feedback]").forEach((button) => {
    button.addEventListener("click", () => saveFeedback(button.dataset.feedback));
  });
  els.analysisTags.addEventListener("click", (event) => {
    const button = event.target.closest("[data-confirm-trigger]");
    if (!button) return;
    const entry = state.entries.find((item) => item.id === els.analysisResult.dataset.entry);
    if (!entry) return;
    const trigger = button.dataset.confirmTrigger;
    const updated = { ...entry, triggers: [...new Set([...entry.triggers.filter((item) => item !== "说不清"), trigger])] };
    if (!persistEntries(state.entries.map((item) => item.id === entry.id ? updated : item))) return;
    showAnalysis(updated, inferTriggers(updated.text), false);
    renderAll();
    showToast("已确认这条线索");
  });

  document.querySelectorAll("[data-days]").forEach((button) => {
    button.addEventListener("click", () => {
      state.trendDays = Number(button.dataset.days);
      renderTrends();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!els.infoModal.hidden) closeInfo();
      else if (!els.practiceModal.hidden) closePractice();
    }
    if (event.key === "Tab") trapModalFocus(event);
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      setDateLabel();
      if (state.practiceRunning) tickPractice();
    }
  });
  window.addEventListener("resize", () => {
    if (!document.getElementById("trendsView").hidden) renderTrendChart(entriesWithinDays(state.trendDays));
  });
}

function setDateLabel() {
  const now = new Date();
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][now.getDay()];
  els.dateLabel.textContent = `${now.getMonth() + 1}月${now.getDate()}日 · ${weekday}`;
}

function loadEntries() {
  try {
    const raw = readLocal(STORAGE_KEY);
    if (raw === null) return [];
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved) || !saved.every(validEntry)) throw new Error("Invalid data");
    // v1 seeded samples in personal storage; preserve every real entry during migration.
    return saved.filter((entry) => !isLegacyDemo(entry)).map(normalizeEntry);
  } catch (error) {
    state.storageError = "本地记录格式异常，尚未覆盖原数据。请在数据设置中导出原始备份后再恢复。";
    return [];
  }
}

function createDemoEntries() {
  return [
    {
      id: "demo-1",
      createdAt: dateOffset(-1, 19, 20),
      mood: "疲惫",
      score: 2,
      intensity: 4,
      text: "下午连续开了几个会，回到家还是在想没做完的事。昨晚也睡得很晚。",
      triggers: ["工作/学业", "睡眠"],
    },
    {
      id: "demo-2",
      createdAt: dateOffset(-2, 21, 10),
      mood: "平静",
      score: 3,
      intensity: 2,
      text: "晚饭后一个人走了二十分钟，没有戴耳机，风吹过来时觉得慢下来了。",
      triggers: ["身体状态"],
    },
    {
      id: "demo-3",
      createdAt: dateOffset(-4, 17, 45),
      mood: "轻快",
      score: 4,
      intensity: 3,
      text: "准备很久的分享顺利结束，收到了同事真诚的反馈，终于松了一口气。",
      triggers: ["工作/学业", "人际关系"],
    },
    {
      id: "demo-4",
      createdAt: dateOffset(-5, 23, 5),
      mood: "低落",
      score: 1,
      intensity: 4,
      text: "看到别人的进展后忍不住比较，觉得自己总是做得不够好。",
      triggers: ["自我期待"],
    },
    {
      id: "demo-5",
      createdAt: dateOffset(-6, 10, 30),
      mood: "平静",
      score: 3,
      intensity: 2,
      text: "今天睡醒后精神不错，整理了房间，也给自己做了一顿认真吃的早餐。",
      triggers: ["睡眠", "身体状态"],
    },
  ];
}

function dateOffset(days, hour, minute) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function switchView(viewName, scroll = true) {
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    const visible = panel.dataset.viewPanel === viewName;
    panel.hidden = !visible;
    panel.classList.toggle("is-visible", visible);
  });
  document.querySelectorAll(".nav-item[data-view], .mobile-nav [data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewName);
    if (button.dataset.view === viewName) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (viewName === "trends") renderTrends();
  if (viewName === "care") updateCareRecommendation();
  if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateSaveState() {
  els.saveButton.disabled = !state.selectedMood;
}

function rotatePrompt() {
  const currentIndex = prompts.indexOf(els.writingPrompt.textContent);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    els.writingPrompt.textContent = prompts[(currentIndex + 1) % prompts.length];
    return;
  }
  els.writingPrompt.animate(
    [
      { opacity: 1, transform: "translateY(0)" },
      { opacity: 0, transform: "translateY(-4px)" },
    ],
    { duration: 140, easing: "ease-out" },
  ).onfinish = () => {
    els.writingPrompt.textContent = prompts[(currentIndex + 1) % prompts.length];
    els.writingPrompt.animate(
      [
        { opacity: 0, transform: "translateY(4px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 220, easing: "ease-out" },
    );
  };
}

function evaluateSafetyHint() {
  const hasCrisisLanguage = crisisKeywords.some((keyword) => els.journalText.value.includes(keyword));
  els.supportHint.textContent = hasCrisisLanguage
    ? "你不必独自承受，保存后可以查看即时支持"
    : "你的文字只会留在这台设备上";
  els.supportHint.style.color = hasCrisisLanguage ? "#c94e3c" : "";
}

function saveCheckin(event) {
  event.preventDefault();
  if (!state.selectedMood) return;

  const text = els.journalText.value.trim();
  const inferred = inferTriggers(text);
  const triggers = Array.from(state.selectedTriggers);
  const existing = state.entries.find((item) => item.id === state.editingId);
  const entry = {
    id: existing?.id || makeId(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    mood: state.selectedMood,
    score: state.selectedScore,
    intensity: Number(els.intensity.value),
    text: text || "这一刻没有写下具体的事，只记录了此刻的感受。",
    triggers: triggers.length ? triggers : ["说不清"],
  };

  const next = existing
    ? state.entries.map((item) => item.id === existing.id ? entry : item)
    : [entry, ...state.entries];
  if (!persistEntries(next)) return;
  state.demo = false;
  writeLocal(MODE_KEY, "false");
  removeLocal(DRAFT_KEY);
  showAnalysis(entry, inferred);
  resetForm();
  renderAll();
  showToast(existing ? "这页日记已更新" : "已经收好这一刻");

  if (crisisKeywords.some((keyword) => text.includes(keyword))) {
    window.setTimeout(showSupport, 600);
  }
}

function inferTriggers(text) {
  if (!text) return [];
  return Object.entries(triggerKeywords)
    .filter(([, keywords]) => keywords.some((keyword) => text.toLowerCase().includes(keyword)))
    .map(([trigger]) => trigger);
}

function showAnalysis(entry, inferred, scroll = true) {
  const strongFeeling = entry.intensity >= 4;
  const lowMood = entry.score <= 2;
  const practice = recommendPractice(entry);
  const summaries = {
    1: strongFeeling
      ? "这份低落现在占据了不少空间。先不急着解决所有事情，把注意力放回身体和身边能确认的事。"
      : "你觉察到了一点向下的情绪。允许它短暂停留，也给自己留一件容易完成的小事。",
    2: entry.triggers.includes("睡眠")
      ? "你记录了疲惫，也提到了睡眠。可以先看看自己是否需要休息，给今天减少一点消耗。"
      : "你觉察到了疲惫。可以暂停一会，问问自己现在需要的是休息、陪伴，还是给任务减量。",
    3: "你记录下了一份平静。可以留意这一刻周围的人、事和环境，把它们保存为下一次的线索。",
    4: "这份轻快值得被记住。回看触发它的人、事或行动，会帮你找到可重复的能量来源。",
    5: "你捕捉到了一个明亮的时刻。试着让这份感觉多停留几秒，它也会成为低潮时的证据。",
  };

  els.analysisTitle.textContent = lowMood ? "谢谢你没有忽略自己" : "你已经看见了这份感受";
  els.analysisMood.textContent = `${entry.mood} · 强度 ${entry.intensity}`;
  els.analysisSummary.textContent = summaries[entry.score];
  const suggestions = inferred.filter((trigger) => !entry.triggers.includes(trigger));
  els.analysisTags.innerHTML = entry.triggers
    .map((trigger) => `<span>${escapeHtml(trigger)} · 已记录</span>`)
    .join("") + suggestions.map((trigger) =>
      `<button type="button" data-confirm-trigger="${escapeHtml(trigger)}" title="确认这条文字线索">+ ${escapeHtml(trigger)} · 确认线索</button>`).join("");
  els.suggestedCareText.textContent = practice.label;
  els.suggestedCareButton.dataset.practice = practice.key;
  els.analysisResult.hidden = false;
  els.analysisResult.dataset.entry = entry.id;
  if (scroll) requestAnimationFrame(() => els.analysisResult.scrollIntoView({ behavior: "smooth", block: "center" }));
}

function recommendPractice(entry) {
  if (entry.triggers.includes("睡眠")) return { key: "sound", label: "听 5 分钟舒缓声音" };
  if (entry.intensity >= 4 || entry.score <= 2) return { key: "grounding", label: "做 3 分钟感官着陆" };
  if (entry.triggers.includes("工作/学业")) return { key: "walk", label: "进行 10 分钟轻缓步行" };
  return { key: "breath", label: "做 1 分钟呼吸练习" };
}

function resetForm() {
  state.editingId = null;
  state.selectedMood = null;
  state.selectedScore = null;
  state.selectedTriggers.clear();
  document.querySelectorAll("[data-mood], [data-trigger]").forEach((button) => {
    button.setAttribute("aria-pressed", "false");
  });
  els.journalText.value = "";
  els.charCount.textContent = "0";
  els.intensity.value = "3";
  els.intensityValue.value = "3";
  els.supportHint.textContent = "你的文字只会留在这台设备上";
  els.supportHint.style.color = "";
  els.saveButton.querySelector("span").textContent = "收好这一刻";
  els.draftStatus.hidden = true;
  renderTriggerSuggestions();
  updateSaveState();
}

function persistEntries(next) {
  if (state.storageError) {
    showSaveError(state.storageError);
    return false;
  }
  if (!writeLocal(STORAGE_KEY, JSON.stringify(next))) {
    showSaveError("这台设备暂时无法保存。你的输入还在，请检查浏览器存储权限或释放空间后重试。");
    return false;
  }
  state.entries = next;
  els.saveError.hidden = true;
  return true;
}

function renderAll() {
  renderDemoState();
  renderEntries();
  renderHistory();
  renderMiniChart();
  renderTrends();
  updateCareRecommendation();
  renderCareHistory();
  refreshIcons();
}

function renderEntries() {
  const recent = [...displayEntries()]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);
  if (!recent.length) {
    els.entryList.innerHTML = '<div class="empty-state">还没有记录。下一次情绪经过时，可以先留下一句话。</div>';
    return;
  }

  els.entryList.innerHTML = recent.map(entryMarkup).join("");
}

function entryMarkup(entry) {
      const date = new Date(entry.createdAt);
      const meta = moodMeta[entry.score] || moodMeta[3];
      return `
        <article class="entry-item">
          <time class="entry-date" datetime="${entry.createdAt}">
            <strong>${String(date.getDate()).padStart(2, "0")}</strong>
            ${date.getMonth() + 1}月
          </time>
          <div class="entry-body">
            <div class="entry-topline"><span>${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}${state.demo ? " · 示例" : ""}</span><button class="text-button" type="button" data-entry="${escapeHtml(entry.id)}">阅读全文 <span aria-hidden="true">↗</span></button></div>
            <p>${escapeHtml(entry.text)}</p>
            <div class="entry-tags">${entry.triggers
              .slice(0, 3)
              .map((trigger) => `<span>${escapeHtml(trigger)}</span>`)
              .join("")}</div>
          </div>
          <span class="entry-mood" style="--entry-color:${meta.color}">
            <i></i>${escapeHtml(entry.mood)}
          </span>
        </article>
      `;
}

function renderMiniChart() {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return startOfDay(date);
  });
  const labels = ["日", "一", "二", "三", "四", "五", "六"];
  const values = days.map((date) => {
    const entries = displayEntries().filter((entry) => isSameDay(new Date(entry.createdAt), date));
    if (!entries.length) return null;
    return { intensity: entries.reduce((sum, entry) => sum + entry.intensity, 0) / entries.length,
      score: mostFrequentMood(entries).score, count: entries.length };
  });

  els.miniChart.innerHTML = values
    .map((value, index) => {
      const score = value?.intensity || 0.55;
      const color = value ? moodMeta[value.score].color : "#d7d8d1";
      return `
        <div class="mini-bar-wrap" title="${value ? `${value.count} 次记录，平均强度 ${value.intensity.toFixed(1)}` : "没有记录"}">
          <div class="mini-bar" style="height:${score * 18}%;--bar-color:${color};animation-delay:${index * 50}ms"></div>
          <span>${labels[days[index].getDay()]}</span>
        </div>
      `;
    })
    .join("");

  const recentWeek = entriesWithinDays(7);
  els.weekCount.textContent = `${state.demo ? "示例 · " : ""}${recentWeek.length} 次记录`;
  els.contextInsight.textContent = buildContextInsight(recentWeek);
}

function buildContextInsight(entries) {
  if (!entries.length) return "这一周还没有记录。情绪被看见的那一刻，变化就已经开始。";
  const triggerCounts = countTriggers(entries);
  const top = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0];
  if (top) return `近 7 天的 ${entries.length} 条${state.demo ? "示例" : ""}记录中，${top[1]} 条提到了「${top[0]}」。这是一条值得回顾的线索，还不能说明因果。`;
  return `近 7 天留下了 ${entries.length} 次记录。线索可以慢慢补充，不需要立刻找到原因。`;
}

function renderTrends() {
  const entries = entriesWithinDays(state.trendDays);
  const frequent = mostFrequentMood(entries);
  const triggerCounts = countTriggers(entries);
  const top = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0];

  els.periodLabel.textContent = `近 ${state.trendDays} 天 · 含今天${state.demo ? " · 示例数据" : ""}`;
  document.querySelectorAll("[data-days]").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.days) === state.trendDays);
    button.setAttribute("aria-pressed", String(Number(button.dataset.days) === state.trendDays));
  });
  els.averageMood.textContent = frequent ? moodMeta[frequent.score].label : "—";
  els.averageMoodLabel.textContent = frequent ? `${frequent.count} 次记录${frequent.tied ? " · 有并列" : ""}` : "等待记录";
  els.totalEntries.textContent = String(entries.length);
  els.topTrigger.textContent = top ? top[0].replace("/", " / ") : "尚无线索";
  els.topTriggerCount.textContent = top ? `出现 ${top[1]} 次` : "记录后生成";
  renderTrendChart(entries);
  renderTriggerBars(triggerCounts);
  renderReflection(entries, top);
}

function renderTrendChart(entries) {
  const width = Math.max(280, Math.min(900, els.trendChart.parentElement.clientWidth || 900));
  const height = 310;
  els.trendChart.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const padding = { top: 20, right: 26, bottom: 40, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const days = Array.from({ length: state.trendDays }, (_, index) => {
    const date = startOfDay(new Date());
    date.setDate(date.getDate() - (state.trendDays - 1 - index));
    return date;
  });
  const xFor = (index) => padding.left + (index + 0.5) * plotWidth / days.length;
  const grid = [1, 2, 3, 4, 5]
    .map((value) => {
      const y = padding.top + ((5 - value) / 4) * plotHeight;
      return `<line class="chart-grid" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"></line>
        <text class="chart-y-label" x="8" y="${y + 4}">${moodMeta[value].label}</text>`;
    })
    .join("");

  const circles = days.map((date, dayIndex) => {
    const records = entries.filter((entry) => isSameDay(new Date(entry.createdAt), date));
    return records.map((entry, index) => {
      const spread = Math.min(18, plotWidth / days.length * 0.55);
      const offset = records.length > 1 ? (index / (records.length - 1) - 0.5) * spread : 0;
      const y = padding.top + ((5 - entry.score) / 4) * plotHeight;
      const label = `${date.getMonth() + 1}/${date.getDate()} ${entry.mood} · 强度 ${entry.intensity}`;
      return `<circle class="chart-point" style="stroke:${moodMeta[entry.score].color};fill:${moodMeta[entry.score].color}" cx="${xFor(dayIndex) + offset}" cy="${y}" r="${3 + entry.intensity}" opacity=".82"><title>${escapeHtml(label)}</title></circle>`;
    }).join("");
  }).join("");
  const labelStep = Math.max(1, Math.ceil(45 / (plotWidth / days.length)));
  const dateLabels = days.map((date, index) => {
    if (index !== days.length - 1 && (index % labelStep !== 0 || days.length - 1 - index < labelStep)) return "";
    return `<text class="chart-label" x="${xFor(index)}" y="${height - 13}" text-anchor="middle">${date.getMonth() + 1}/${date.getDate()}</text>`;
  }).join("");
  const empty = entries.length ? "" : `<text class="chart-label" x="${width / 2}" y="${height / 2 + 28}" text-anchor="middle">这段时间还没有记录</text>`;
  els.trendChart.innerHTML = `${grid}${circles}${dateLabels}${empty}`;
}

function renderTriggerBars(counts) {
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    els.triggerBars.innerHTML = '<div class="empty-state">继续记录后，这里会整理反复出现的线索。</div>';
    return;
  }
  const max = sorted[0][1];
  els.triggerBars.innerHTML = sorted
    .slice(0, 5)
    .map(
      ([trigger, count]) => `
        <div class="trigger-bar-row">
          <span>${escapeHtml(trigger)}</span>
          <div class="trigger-bar-track"><div class="trigger-bar-fill" style="width:${(count / max) * 100}%"></div></div>
          <span>${count}</span>
        </div>
      `,
    )
    .join("");
}

function renderReflection(entries, top) {
  if (!entries.length) {
    els.reflectionText.textContent = "“记录不是为了给情绪打分，而是逐渐辨认什么消耗你、什么让你恢复。”";
    return;
  }
  const latest = [...entries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  if (top && top[0] === "自我期待") {
    els.reflectionText.textContent = `这 ${entries.length} 条记录中，${top[1]} 条提到了自我期待。可以问问自己：这一次的标准是谁设定的？哪些要求可以稍微放松？`;
  } else if (top && top[0] === "睡眠") {
    els.reflectionText.textContent = `睡眠出现在 ${top[1]} 条记录里，但这些记录还无法区分睡眠质量。下次可以写下入睡时间和醒来的感受，帮助你更具体地回顾。`;
  } else if (latest.score >= 4) {
    els.reflectionText.textContent = "“最近一次记录里有明显的轻快感。记住当时的人、地点和行动，它们可能是可以主动靠近的资源。”";
  } else {
    els.reflectionText.textContent = `最近一次记录是「${latest.mood}」，感受强度 ${latest.intensity}/5。可以回看当时发生了什么，再为自己选择一件容易做到的小事。`;
  }
}

function updateCareRecommendation() {
  const latest = [...displayEntries()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const recommendation = latest ? recommendPractice(latest) : { key: "breath" };
  const config = practiceConfig[recommendation.key];
  const titles = {
    breath: "跟随呼吸，\n把注意力带回身体",
    grounding: "从身边的事物，\n找到一点安定",
    walk: "离开屏幕，\n给身体一点空间",
    sound: "让缓慢的声音，\n陪你休息一会",
  };
  const captions = {
    breath: ["吸气 4 秒", "自然呼吸", "呼气 6 秒"],
    grounding: ["看见", "触碰", "听见"],
    walk: ["脚步", "空气", "远处"],
    sound: ["调低音量", "慢慢听", "不必用力"],
  };
  els.careHeadline.textContent = { breath: "回到呼吸", grounding: "回到当下", walk: "舒展身体", sound: "安静休息" }[recommendation.key];
  els.featuredPracticeTitle.textContent = titles[recommendation.key];
  els.featuredReason.textContent = latest
    ? `${state.demo ? "示例中" : ""}最近一次记录是「${latest.mood}」，强度 ${latest.intensity}/5${latest.triggers[0] !== "说不清" ? `，提到了${latest.triggers.join("、")}` : ""}。可以试试${config.title}。`
    : "先用一分钟觉察呼吸，再选择接下来想做的事。也可以直接挑选下方的练习。";
  els.featuredPracticeButton.dataset.practice = recommendation.key;
  els.featuredPracticeButton.querySelector("span").textContent = `开始 ${config.seconds / 60} 分钟`;
  els.featuredCaption.innerHTML = captions[recommendation.key].map((caption) => `<span>${caption}</span>`).join("");
}

function openPractice(type) {
  const config = practiceConfig[type] || practiceConfig.breath;
  stopPractice();
  state.activePractice = config.mode;
  state.feedbackId = null;
  state.lastChord = -1;
  state.practiceRemaining = config.seconds;
  els.practiceType.textContent = config.eyebrow;
  els.practiceModalTitle.textContent = config.title;
  els.practiceDescription.textContent = config.description;
  els.practiceStartButton.querySelector("span").textContent = "开始";
  els.practiceTime.textContent = formatTime(config.seconds);
  setPracticeButtonIcon("play");
  els.practiceFeedback.hidden = true;
  els.feedbackSaved.hidden = true;
  els.practiceStage.hidden = false;
  els.practiceNote.hidden = false;
  els.practiceNote.textContent = type === "breath"
    ? "如果感到头晕或不适，请暂停并恢复自然呼吸。"
    : "按自己的节奏进行，任何时候都可以暂停。";
  els.soundVolumeLabel.hidden = type !== "sound";
  document.querySelectorAll("[data-feedback]").forEach((button) => {
    button.disabled = false;
    button.setAttribute("aria-pressed", "false");
  });
  configurePracticeStage(config.mode);
  showModal(els.practiceModal);
  requestAnimationFrame(() => els.practiceStartButton.focus());
  refreshIcons();
}

function configurePracticeStage(mode) {
  els.breathVisual.hidden = !["breath", "walk"].includes(mode);
  els.groundingList.hidden = mode !== "grounding";
  els.soundVisual.hidden = mode !== "sound";
  els.soundVisual.classList.remove("is-playing");
  els.breathProgress.className = "breath-progress";
  els.breathProgress.style.transform = "";
  els.breathText.textContent = mode === "walk" ? "准备出发" : "准备好";

  if (mode === "grounding") {
    const steps = [
      ["看见的东西", 5],
      ["触碰到的感觉", 4],
      ["听见的声音", 3],
      ["闻到的气味", 2],
      ["愿意肯定自己的事", 1],
    ];
    els.groundingList.innerHTML = steps
      .map(
        ([label, count], index) =>
          `<div class="grounding-step${index === 0 ? " is-active" : ""}"><span>${label}</span><strong>${count}</strong></div>`,
      )
      .join("");
  }
}

function togglePractice() {
  if (state.practiceRunning) {
    pausePractice();
  } else {
    startPractice();
  }
}

function startPractice() {
  if (!state.activePractice || state.practiceRunning) return;
  if (state.feedbackId) {
    openPractice(state.activePractice);
  }
  state.practiceDeadline = Date.now() + state.practiceRemaining * 1000;
  els.breathProgress.style.transform = "";
  state.practiceRunning = true;
  els.practiceStartButton.querySelector("span").textContent = "暂停";
  setPracticeButtonIcon("pause");
  if (state.activePractice === "sound" && !startSound()) {
    state.practiceRunning = false;
    els.practiceStartButton.querySelector("span").textContent = "重试";
    setPracticeButtonIcon("play");
    return;
  }
  updatePracticeVisual();
  state.practiceTimer = window.setInterval(tickPractice, 250);
}

function tickPractice() {
  if (!state.practiceRunning) return;
  state.practiceRemaining = Math.max(0, Math.ceil((state.practiceDeadline - Date.now()) / 1000));
  els.practiceTime.textContent = formatTime(state.practiceRemaining);
  if (state.practiceRemaining <= 0) completePractice();
  else updatePracticeVisual();
}

function pausePractice() {
  state.practiceRemaining = Math.max(0, (state.practiceDeadline - Date.now()) / 1000);
  state.practiceRunning = false;
  window.clearInterval(state.practiceTimer);
  state.practiceTimer = null;
  els.practiceStartButton.querySelector("span").textContent = "继续";
  setPracticeButtonIcon("play");
  stopSound();
  els.soundVisual.classList.remove("is-playing");
  els.breathProgress.style.transform = getComputedStyle(els.breathProgress).transform;
}

function stopPractice() {
  state.practiceRunning = false;
  window.clearInterval(state.practiceTimer);
  state.practiceTimer = null;
  stopSound();
}

function completePractice() {
  stopPractice();
  const session = { id: makeId(), type: state.activePractice, createdAt: new Date().toISOString(), feedback: null };
  state.feedbackId = session.id;
  const next = [...state.careSessions, session];
  if (writeLocal(CARE_KEY, JSON.stringify(next))) state.careSessions = next;
  else {
    els.feedbackSaved.hidden = false;
    els.feedbackSaved.textContent = "练习已完成，但设备暂时无法保存，请释放空间后重试。";
  }
  els.practiceTime.textContent = "完成";
  els.practiceStartButton.querySelector("span").textContent = "再来一次";
  setPracticeButtonIcon("rotate-ccw");
  els.breathProgress.className = "breath-progress";
  els.breathText.textContent = "辛苦了";
  els.soundVisual.classList.remove("is-playing");
  els.practiceStage.hidden = true;
  els.practiceNote.hidden = true;
  els.soundVolumeLabel.hidden = true;
  els.practiceFeedback.hidden = false;
  renderCareHistory();
  showToast("你为自己留出了一点空间");
  state.practiceRemaining = practiceConfig[state.activePractice].seconds;
}

function updatePracticeVisual() {
  if (state.activePractice === "breath") {
    const elapsed = practiceConfig.breath.seconds - state.practiceRemaining;
    const cycle = elapsed % 10;
    els.breathProgress.classList.toggle("is-inhaling", cycle < 4);
    els.breathProgress.classList.toggle("is-exhaling", cycle >= 4);
    if (cycle < 4) {
      els.breathText.textContent = "慢慢吸气";
    } else {
      els.breathText.textContent = "缓缓呼气";
    }
  }

  if (state.activePractice === "walk") {
    const elapsed = practiceConfig.walk.seconds - state.practiceRemaining;
    const messages = ["感受脚掌落地", "留意空气温度", "放松下颌和肩膀", "看看远处的颜色"];
    els.breathText.textContent = messages[Math.floor(elapsed / 25) % messages.length];
    els.breathProgress.classList.toggle("is-inhaling", elapsed % 8 < 4);
    els.breathProgress.classList.toggle("is-exhaling", elapsed % 8 >= 4);
  }

  if (state.activePractice === "grounding") {
    const elapsed = practiceConfig.grounding.seconds - state.practiceRemaining;
    const activeIndex = Math.min(4, Math.floor(elapsed / 36));
    els.groundingList.querySelectorAll(".grounding-step").forEach((step, index) => {
      step.classList.toggle("is-active", index === activeIndex);
    });
  }
  if (state.activePractice === "sound" && state.audioContext) {
    const chordIndex = Math.floor((300 - state.practiceRemaining) / 12) % 4;
    if (chordIndex !== state.lastChord) {
      const chords = [[174.61, 220, 261.63], [164.81, 220, 261.63], [146.83, 196, 246.94], [130.81, 174.61, 220]];
      state.audioNodes.slice(0, 3).forEach((node, index) => {
        node.frequency.setTargetAtTime(chords[chordIndex][index], state.audioContext.currentTime, 2);
      });
      state.lastChord = chordIndex;
    }
  }
}

function setPracticeButtonIcon(iconName) {
  const currentIcon = els.practiceStartButton.querySelector("svg, i[data-lucide]");
  if (currentIcon) {
    const replacement = document.createElement("i");
    replacement.setAttribute("data-lucide", iconName);
    replacement.setAttribute("aria-hidden", "true");
    currentIcon.replaceWith(replacement);
    refreshIcons();
  }
}

function startSound() {
  try {
    const AudioContext = window.AudioContext;
    if (!AudioContext) throw new Error("Audio unavailable");
    state.audioContext = new AudioContext();
    const master = state.audioContext.createGain();
    master.gain.setValueAtTime(0.0001, state.audioContext.currentTime);
    master.gain.linearRampToValueAtTime(Number(els.soundVolume.value) / 1000, state.audioContext.currentTime + 1.5);
    master.connect(state.audioContext.destination);
    state.audioMaster = master;
    state.lastChord = -1;
    state.audioContext.resume().catch(() => {
      pausePractice();
      showToast("声音播放被浏览器阻止，请重新点击开始");
    });

    [174, 220, 261.63].forEach((frequency, index) => {
      const oscillator = state.audioContext.createOscillator();
      const gain = state.audioContext.createGain();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.value = index === 0 ? 0.5 : 0.16;
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start();
      state.audioNodes.push(oscillator);
    });
    state.audioNodes.push(master);
    els.soundVisual.classList.add("is-playing");
    return true;
  } catch (error) {
    stopSound();
    els.practiceNote.textContent = "此浏览器暂时无法播放声音。你也可以选择呼吸或感官练习。";
    return false;
  }
}

function stopSound() {
  state.audioNodes.forEach((node) => {
    try {
      if (typeof node.stop === "function") node.stop();
      if (typeof node.disconnect === "function") node.disconnect();
    } catch (_) {
      // The node may already be stopped.
    }
  });
  state.audioNodes = [];
  state.audioMaster = null;
  if (state.audioContext) {
    state.audioContext.close().catch(() => {});
    state.audioContext = null;
  }
}

function closePractice() {
  stopPractice();
  hideModal(els.practiceModal);
}

function showPrivacy() {
  openInfo({
    eyebrow: "隐私与数据",
    title: "记录只属于你",
    body: `
      <p>栖刻不会把日记上传到服务器。所有内容都保存在当前浏览器的本地存储中，关闭页面后仍会保留。</p>
      <ul>
        <li>没有账号，也不收集姓名或联系方式</li>
        <li>趋势分析在设备上完成</li>
        <li>清除浏览器数据会同时清除记录</li>
      </ul>
    `,
    actions: '<button class="secondary-button" type="button" data-close-info><span>知道了</span></button>',
  });
}

function showSettings() {
  openInfo({
    eyebrow: "数据设置",
    title: "管理本地记录",
    body: `
      <p>当前设备保存了 <strong>${state.entries.length}</strong> 条情绪记录。你可以导出备份，或清除全部数据。</p>
      <p>备份只包含你的日记与练习反馈，不包含示例。导入会合并记录，同一条记录以当前设备版本为准。</p>
      ${state.storageError ? `<p class="form-error">${escapeHtml(state.storageError)}</p>` : ""}
    `,
    actions: `
      <button class="secondary-button" type="button" id="exportDataButton"><span>导出记录</span></button>
      <button class="secondary-button" type="button" id="importDataButton"><span>导入备份</span></button>
      <button class="secondary-button" type="button" id="settingsDemoButton"><span>${state.demo ? "回到我的日记" : "查看示例"}</span></button>
      ${state.storageError ? '<button class="secondary-button" type="button" id="rawBackupButton">导出原始备份</button>' : ""}
      <button class="danger-button" type="button" id="clearDataButton">清除全部记录</button>
    `,
  });
  document.getElementById("exportDataButton").addEventListener("click", exportData);
  document.getElementById("importDataButton").addEventListener("click", () => els.importFile.click());
  document.getElementById("settingsDemoButton").addEventListener("click", () => {
    setDemo(!state.demo);
    closeInfo();
  });
  document.getElementById("rawBackupButton")?.addEventListener("click", () => downloadJson(readLocal(STORAGE_KEY) || "[]", "原始备份"));
  document.getElementById("clearDataButton").addEventListener("click", confirmClearData);
}

function showSupport() {
  openInfo({
    eyebrow: "即时支持",
    title: "先让一个人知道",
    body: `
      <p>如果你正在经历强烈痛苦，或担心自己会伤害自己，请先离开危险物品和独处环境，联系一位可以陪伴你的人。</p>
      <ul>
        <li><strong>立即危险：</strong>拨打 <a href="tel:110">110</a> 或 <a href="tel:120">120</a></li>
        <li><strong>中国大陆心理援助：</strong><a href="tel:12356">12356</a></li>
        <li><strong>身边支持：</strong>联系朋友、家人、老师或所在机构的心理中心</li>
      </ul>
      <p>栖刻不能替代专业的心理咨询、诊断或紧急援助。</p>
    `,
    actions: '<button class="primary-button" type="button" data-close-info><span>知道了</span></button>',
  });
}

function openInfo({ eyebrow, title, body, actions }) {
  els.infoEyebrow.textContent = eyebrow;
  els.infoModalTitle.textContent = title;
  els.infoModalBody.innerHTML = body;
  els.infoModalActions.innerHTML = actions;
  showModal(els.infoModal);
  els.infoModalActions.querySelectorAll("[data-close-info]").forEach((button) => {
    button.addEventListener("click", closeInfo);
  });
  refreshIcons();
  els.infoModal.querySelector(".modal-close").focus();
}

function closeInfo() {
  hideModal(els.infoModal);
}

function exportData() {
  downloadJson(JSON.stringify({ version: 2, entries: state.entries, care: state.careSessions }, null, 2), "情绪记录");
  showToast("记录已导出");
}

function downloadJson(text, name) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `栖刻-${name}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function confirmClearData(event) {
  const button = event.currentTarget;
  if (button.dataset.confirmed !== "true") {
    button.dataset.confirmed = "true";
    button.textContent = "再次点击确认清除";
    return;
  }
  const previousError = state.storageError;
  state.storageError = "";
  if (!persistEntries([])) {
    state.storageError = previousError;
    return;
  }
  if (writeLocal(CARE_KEY, "[]")) state.careSessions = [];
  removeLocal(DRAFT_KEY);
  resetForm();
  state.demo = false;
  writeLocal(MODE_KEY, "false");
  els.analysisResult.hidden = true;
  renderAll();
  closeInfo();
  showToast("本地记录已清除");
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  els.toastText.textContent = message;
  els.toast.classList.add("is-visible");
  state.toastTimer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 2600);
}

function entriesWithinDays(days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (days - 1));
  cutoff.setHours(0, 0, 0, 0);
  return displayEntries().filter((entry) => new Date(entry.createdAt) >= cutoff && new Date(entry.createdAt) <= new Date());
}

function countTriggers(entries) {
  return entries.reduce((counts, entry) => {
    entry.triggers.forEach((trigger) => {
      if (trigger === "说不清") return;
      counts[trigger] = (counts[trigger] || 0) + 1;
    });
    return counts;
  }, {});
}

function startOfDay(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(seconds) {
  seconds = Math.ceil(seconds);
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const rest = Math.max(0, seconds) % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons({ attrs: { "stroke-width": 1.8 } });
  }
}

function makeId() {
  return `entry-${crypto.randomUUID()}`;
}

function readLocal(key) {
  try { return localStorage.getItem(key); }
  catch (_) { return null; }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (_) { return false; }
}

function removeLocal(key) {
  try { localStorage.removeItem(key); } catch (_) { /* Keep the current input usable. */ }
}

function readList(key) {
  try {
    const value = JSON.parse(readLocal(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (_) { return []; }
}

function validEntry(entry) {
  return !!entry && typeof entry === "object" &&
    typeof entry.id === "string" && /^[\w-]{1,100}$/.test(entry.id) &&
    typeof entry.createdAt === "string" && Number.isFinite(Date.parse(entry.createdAt)) &&
    Number.isInteger(entry.score) && !!moodMeta[entry.score] &&
    entry.mood === moodMeta[entry.score].label &&
    Number.isInteger(entry.intensity) && entry.intensity >= 1 && entry.intensity <= 5 &&
    typeof entry.text === "string" && entry.text.length <= 360 &&
    Array.isArray(entry.triggers) && entry.triggers.length >= 1 && entry.triggers.length <= 6 &&
    entry.triggers.every((trigger) => Object.hasOwn(triggerKeywords, trigger) || trigger === "说不清");
}

function normalizeEntry(entry) {
  return {
    id: entry.id, createdAt: new Date(entry.createdAt).toISOString(),
    mood: entry.mood, score: entry.score, intensity: entry.intensity, text: entry.text,
    triggers: [...new Set(entry.triggers)],
  };
}

function validCareSession(session) {
  return !!session && typeof session.id === "string" && /^[\w-]{1,100}$/.test(session.id) &&
    Object.hasOwn(practiceConfig, session.type) && Number.isFinite(Date.parse(session.createdAt)) &&
    [null, "helpful", "same", "worse"].includes(session.feedback);
}

function isLegacyDemo(entry) {
  // Only the five exact sample records from the first release are migrated.
  const original = createDemoEntries().find((demo) => demo.id === entry.id);
  return !!original && original.text === entry.text && original.mood === entry.mood;
}

function displayEntries() {
  return state.demo ? state.demoEntries : state.entries;
}

function setDemo(enabled) {
  state.demo = enabled;
  writeLocal(MODE_KEY, String(enabled));
  els.analysisResult.hidden = true;
  renderAll();
}

function renderDemoState() {
  els.demoNotice.hidden = !state.demo;
  els.showDemoButton.hidden = state.demo;
  document.getElementById("recentTitle").textContent = state.demo ? "示例日记的一周" : "情绪留下的纹理";
}

function showSaveError(message) {
  els.saveError.hidden = false;
  els.saveError.textContent = message;
  showToast(message);
}

function renderTriggerSuggestions() {
  const suggested = inferTriggers(els.journalText.value);
  document.querySelectorAll("[data-trigger]").forEach((button) => {
    const selected = state.selectedTriggers.has(button.dataset.trigger);
    const suggestion = suggested.includes(button.dataset.trigger) && !selected;
    button.setAttribute("aria-pressed", String(selected));
    button.classList.toggle("is-suggested", suggestion);
    button.title = suggestion ? "文字中出现的线索，点击确认" : "";
  });
  els.triggerHint.textContent = suggested.some((trigger) => !state.selectedTriggers.has(trigger))
    ? "虚线标签是文字里的可能线索，点击确认后才会纳入统计。"
    : "你可以只记录情绪，也可以点选相关线索。";
}

function saveDraft() {
  const draft = {
    mood: state.selectedMood,
    score: state.selectedScore,
    text: els.journalText.value,
    intensity: Number(els.intensity.value),
    triggers: Array.from(state.selectedTriggers),
    editingId: state.editingId,
  };
  const hasContent = draft.mood || draft.text || draft.triggers.length || draft.editingId;
  els.draftStatus.hidden = !hasContent;
  if (!hasContent) {
    removeLocal(DRAFT_KEY);
    return;
  }
  const saved = writeLocal(DRAFT_KEY, JSON.stringify(draft));
  els.draftMessage.textContent = saved
    ? `${state.editingId ? "正在编辑 · " : ""}草稿已存于本机`
    : "草稿暂时无法保存，请保留当前页面";
}

function restoreDraft() {
  try {
    const draft = JSON.parse(readLocal(DRAFT_KEY));
    if (!draft || typeof draft.text !== "string" || draft.text.length > 360 ||
      !Number.isInteger(draft.intensity) || draft.intensity < 1 || draft.intensity > 5 ||
      !Array.isArray(draft.triggers)) return;
    if (draft.score !== null && moodMeta[draft.score]?.label !== draft.mood) return;
    if (!draft.triggers.every((trigger) => Object.hasOwn(triggerKeywords, trigger) || trigger === "说不清")) return;
    state.editingId = state.entries.some((entry) => entry.id === draft.editingId) ? draft.editingId : null;
    populateForm(draft);
    els.draftStatus.hidden = false;
    els.draftMessage.textContent = state.editingId ? "已恢复未完成的编辑" : "已恢复上次的草稿";
  } catch (_) { /* Ignore malformed drafts without touching saved journals. */ }
}

function populateForm(entry) {
  state.selectedMood = entry.mood;
  state.selectedScore = entry.score;
  state.selectedTriggers = new Set(entry.triggers);
  document.querySelectorAll("[data-mood]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mood === entry.mood));
  });
  els.journalText.value = entry.text;
  els.charCount.textContent = String(entry.text.length);
  els.intensity.value = String(entry.intensity);
  els.intensityValue.value = String(entry.intensity);
  els.saveButton.querySelector("span").textContent = state.editingId ? "保存修改" : "收好这一刻";
  renderTriggerSuggestions();
  evaluateSafetyHint();
  updateSaveState();
}

function renderHistory() {
  const query = els.historySearch.value.trim().toLowerCase();
  const mood = els.historyMood.value;
  const entries = displayEntries().filter((entry) =>
    (!mood || entry.mood === mood) &&
    (!query || `${entry.text} ${entry.triggers.join(" ")}`.toLowerCase().includes(query)),
  ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  els.historyCount.textContent = `${state.demo ? "示例 · " : ""}${entries.length} 条记录`;
  els.historyList.innerHTML = entries.length
    ? entries.map(entryMarkup).join("")
    : '<p class="empty-state">没有匹配的日记。试试其他文字或情绪，或回到「此刻」开始记录。</p>';
}

function showEntry(id) {
  const entry = displayEntries().find((item) => item.id === id);
  if (!entry) return;
  openInfo({
    eyebrow: `${state.demo ? "示例 · " : ""}${new Date(entry.createdAt).toLocaleString("zh-CN", { hour12: false })}`,
    title: `${entry.mood} · 强度 ${entry.intensity}`,
    body: `<p class="entry-full">${escapeHtml(entry.text)}</p><div class="analysis-tags">${entry.triggers.map((trigger) => `<span>${escapeHtml(trigger)}</span>`).join("")}</div>`,
    actions: state.demo
      ? '<button class="secondary-button" type="button" data-close-info>关闭示例</button>'
      : '<button class="secondary-button" id="editEntryButton" type="button">编辑这页</button><button class="danger-button" id="deleteEntryButton" type="button">删除记录</button>',
  });
  document.getElementById("editEntryButton")?.addEventListener("click", () => {
    const edit = () => {
      closeInfo();
      state.editingId = entry.id;
      populateForm(entry);
      saveDraft();
      els.analysisResult.hidden = true;
      switchView("today");
      els.journalText.focus({ preventScroll: true });
    };
    if (readLocal(DRAFT_KEY)) {
      openInfo({
        eyebrow: "保留当前草稿",
        title: "先处理还没写完的记录",
        body: "<p>打开这页编辑会替换当前草稿。你可以先返回保存草稿，或放弃草稿开始编辑。</p>",
        actions: '<button class="secondary-button" type="button" data-close-info>保留草稿</button><button class="danger-button" id="replaceDraftButton" type="button">放弃草稿并编辑</button>',
      });
      document.getElementById("replaceDraftButton").addEventListener("click", edit);
    } else edit();
  });
  document.getElementById("deleteEntryButton")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    if (!button.dataset.confirmed) {
      button.dataset.confirmed = "true";
      button.textContent = "确认删除这条记录";
      return;
    }
    if (!persistEntries(state.entries.filter((item) => item.id !== entry.id))) return;
    if (state.editingId === entry.id) {
      resetForm();
      removeLocal(DRAFT_KEY);
    }
    if (els.analysisResult.dataset.entry === entry.id) els.analysisResult.hidden = true;
    closeInfo();
    renderAll();
    showToast("这条记录已删除");
  });
}

function mostFrequentMood(entries) {
  if (!entries.length) return null;
  const counts = {};
  [...entries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).forEach((entry) => {
    counts[entry.score] = (counts[entry.score] || 0) + 1;
  });
  const latestScore = [...entries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0].score;
  const sorted = Object.entries(counts).sort((a, b) =>
    b[1] - a[1] || Number(Number(b[0]) === latestScore) - Number(Number(a[0]) === latestScore) || Number(a[0]) - Number(b[0]));
  return { score: Number(sorted[0][0]), count: sorted[0][1], tied: sorted[1]?.[1] === sorted[0][1] };
}

function saveFeedback(feedback) {
  const session = state.careSessions.find((item) => item.id === state.feedbackId) ||
    { id: state.feedbackId, type: state.activePractice, createdAt: new Date().toISOString(), feedback: null };
  const next = [...state.careSessions.filter((item) => item.id !== session.id), { ...session, feedback }];
  if (!writeLocal(CARE_KEY, JSON.stringify(next))) {
    els.feedbackSaved.hidden = false;
    els.feedbackSaved.textContent = "反馈暂时无法保存，请检查设备存储后再试。";
    return;
  }
  state.careSessions = next;
  document.querySelectorAll("[data-feedback]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.feedback === feedback));
  });
  els.feedbackSaved.hidden = false;
  els.feedbackSaved.textContent = {
    helpful: "已记下。下次需要时，可以再试试这个方法。",
    same: "已记下。没有立刻变化也没关系，愿意照顾自己就很珍贵。",
    worse: "已记下。先停止这项练习，按舒适的方式休息；如果持续不适，请联系专业人员。",
  }[feedback];
  renderCareHistory();
}

function renderCareHistory() {
  if (!state.careSessions.length) {
    els.careHistorySummary.textContent = "完成练习后，记下是否有帮助，慢慢找到自己的恢复方式。";
    els.careHistoryList.innerHTML = "";
    return;
  }
  const helpful = state.careSessions.filter((session) => session.feedback === "helpful");
  const types = [...new Set(helpful.map((session) => practiceConfig[session.type].title))];
  els.careHistorySummary.textContent = `你已完成 ${state.careSessions.length} 次练习。${types.length ? `你曾觉得「${types.join("」「")}」有帮助。` : "每次感受都可以不同，按需要选择就好。"}`;
  els.careHistoryList.innerHTML = [...state.careSessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5).map((session) => `<div class="care-history-row"><span>${practiceConfig[session.type].title}</span><span>${new Date(session.createdAt).toLocaleDateString("zh-CN")} · ${({ helpful: "松了一点", same: "差不多", worse: "更不舒服" })[session.feedback] || "未填写反馈"}</span></div>`).join("");
}

async function importData() {
  const file = els.importFile.files[0];
  els.importFile.value = "";
  if (!file) return;
  try {
    if (file.size > 2 * 1024 * 1024) throw new Error("文件超过 2 MB，请选择栖刻导出的 JSON 备份。");
    const backup = JSON.parse(await file.text());
    const entries = Array.isArray(backup) ? backup : backup?.version === 2 ? backup.entries : null;
    const care = Array.isArray(backup) ? [] : backup.care;
    if (!Array.isArray(entries) || entries.length > 5000 || !entries.every(validEntry) ||
      !Array.isArray(care) || care.length > 5000 || !care.every(validCareSession)) {
      throw new Error("文件格式不符合栖刻备份要求，现有记录未被更改。");
    }
    if (state.storageError) throw new Error("请先导出原始备份，再清除异常数据后恢复。");
    const incoming = [...new Map(entries.filter((entry) => !isLegacyDemo(entry)).map((entry) => [entry.id, normalizeEntry(entry)])).values()];
    const incomingCare = [...new Map(care.map((session) => [session.id, session])).values()];
    const fresh = incoming.filter((entry) => !state.entries.some((item) => item.id === entry.id));
    const freshCare = incomingCare.filter((session) => !state.careSessions.some((item) => item.id === session.id));
    openInfo({
      eyebrow: "恢复备份",
      title: "准备合并这些记录",
      body: `<p>将新增 <strong>${fresh.length}</strong> 条日记与 <strong>${freshCare.length}</strong> 次练习。已有 ID 的记录不会被覆盖。</p>`,
      actions: '<button class="secondary-button" type="button" data-close-info>取消</button><button class="primary-button" type="button" id="confirmImportButton">确认导入</button>',
    });
    document.getElementById("confirmImportButton").addEventListener("click", () => {
      const previousCare = readLocal(CARE_KEY);
      const nextCare = [...state.careSessions, ...freshCare];
      if (!writeLocal(CARE_KEY, JSON.stringify(nextCare))) {
        showSaveError("空间不足，备份未导入。请释放空间后重试。");
        return;
      }
      if (!persistEntries([...state.entries, ...fresh])) {
        if (previousCare === null) removeLocal(CARE_KEY);
        else writeLocal(CARE_KEY, previousCare);
        return;
      }
      state.careSessions = nextCare;
      closeInfo();
      setDemo(false);
      showToast(`已导入 ${fresh.length} 条日记与 ${freshCare.length} 次练习`);
    });
  } catch (error) {
    openInfo({
      eyebrow: "未能导入",
      title: "备份没有被写入",
      body: `<p>${escapeHtml(error instanceof SyntaxError ? "文件不是有效 JSON。请选择从栖刻导出的备份。" : error.message)}</p>`,
      actions: '<button class="secondary-button" type="button" data-close-info>知道了</button>',
    });
  }
}

function showModal(modal) {
  const alreadyOpen = !els.infoModal.hidden || !els.practiceModal.hidden;
  if (!alreadyOpen) state.focusReturn = document.activeElement;
  modal.hidden = false;
  document.querySelector(".app-shell").inert = true;
  els.practiceModal.inert = modal === els.infoModal && !els.practiceModal.hidden;
  document.body.style.overflow = "hidden";
}

function hideModal(modal) {
  modal.hidden = true;
  const anotherOpen = !els.infoModal.hidden || !els.practiceModal.hidden;
  if (!anotherOpen) {
    document.querySelector(".app-shell").inert = false;
    document.body.style.overflow = "";
    if (state.focusReturn?.isConnected) state.focusReturn.focus({ preventScroll: true });
  } else if (!els.practiceModal.hidden) {
    els.practiceModal.inert = false;
    els.practiceStartButton.focus();
  }
}

function trapModalFocus(event) {
  const modal = !els.infoModal.hidden ? els.infoModal : !els.practiceModal.hidden ? els.practiceModal : null;
  if (!modal) return;
  const focusable = [...modal.querySelectorAll("button, input, select, textarea, a[href], [tabindex='0']")]
    .filter((element) => !element.disabled && element.getClientRects().length > 0);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
