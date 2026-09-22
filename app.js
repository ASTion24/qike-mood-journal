const STORAGE_KEY = "qike.entries.v1";

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
    description: "把肩膀放松一点，不需要刻意吸得很深。",
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
    description: "把手机留在口袋里，留意脚步和空气。",
    seconds: 600,
    mode: "walk",
  },
  sound: {
    eyebrow: "舒缓声音",
    title: "听一段缓慢的声音",
    description: "建议使用较低音量，让呼吸自然慢下来。",
    seconds: 300,
    mode: "sound",
  },
};

const state = {
  selectedMood: null,
  selectedScore: null,
  selectedTriggers: new Set(),
  entries: [],
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
  setDateLabel();
  bindEvents();
  renderAll();
  refreshIcons();
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
  });

  els.intensity.addEventListener("input", () => {
    els.intensityValue.value = els.intensity.value;
  });

  els.journalText.addEventListener("input", () => {
    els.charCount.textContent = els.journalText.value.length;
    evaluateSafetyHint();
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
    button.setAttribute("aria-pressed", String(state.selectedTriggers.has(trigger)));
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

  document.querySelectorAll("[data-days]").forEach((button) => {
    button.addEventListener("click", () => {
      state.trendDays = Number(button.dataset.days);
      document.querySelectorAll("[data-days]").forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
      renderTrends();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!els.practiceModal.hidden) closePractice();
    if (!els.infoModal.hidden) closeInfo();
  });
}

function setDateLabel() {
  const now = new Date();
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][now.getDay()];
  els.dateLabel.textContent = `${now.getMonth() + 1}月${now.getDate()}日 · ${weekday}`;
}

function loadEntries() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return saved;
  } catch (error) {
    console.warn("无法读取本地记录", error);
  }
  const demo = createDemoEntries();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
  return demo;
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
      createdAt: dateOffset(-7, 10, 30),
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

function switchView(viewName) {
  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    const visible = panel.dataset.viewPanel === viewName;
    panel.hidden = !visible;
    panel.classList.toggle("is-visible", visible);
  });
  document.querySelectorAll(".nav-item[data-view], .mobile-nav [data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === viewName);
  });
  if (viewName === "trends") renderTrends();
  if (viewName === "care") updateCareRecommendation();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateSaveState() {
  els.saveButton.disabled = !state.selectedMood;
}

function rotatePrompt() {
  const currentIndex = prompts.indexOf(els.writingPrompt.textContent);
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
  const triggers = Array.from(new Set([...state.selectedTriggers, ...inferred]));
  const entry = {
    id: `entry-${Date.now()}`,
    createdAt: new Date().toISOString(),
    mood: state.selectedMood,
    score: state.selectedScore,
    intensity: Number(els.intensity.value),
    text: text || "这一刻没有写下具体的事，只记录了此刻的感受。",
    triggers: triggers.length ? triggers : ["说不清"],
  };

  state.entries.unshift(entry);
  persistEntries();
  showAnalysis(entry, inferred);
  resetForm();
  renderAll();
  showToast("已经收好这一刻");

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

function showAnalysis(entry, inferred) {
  const strongFeeling = entry.intensity >= 4;
  const lowMood = entry.score <= 2;
  const practice = recommendPractice(entry);
  const summaries = {
    1: strongFeeling
      ? "这份低落现在占据了不少空间。先不急着解决所有事情，把注意力放回身体和身边能确认的事。"
      : "你觉察到了一点向下的情绪。允许它短暂停留，也给自己留一件容易完成的小事。",
    2: entry.triggers.includes("睡眠")
      ? "疲惫可能同时来自压力和休息不足。今天的目标可以不是“振作”，而是减少一点消耗。"
      : "你似乎已经承受了一段时间。此刻更需要恢复，而不是再要求自己多坚持一点。",
    3: "平静不是空白，而是身体正在恢复秩序。可以留意是什么帮助了你，把它保存为下一次的线索。",
    4: "这份轻快值得被记住。回看触发它的人、事或行动，会帮你找到可重复的能量来源。",
    5: "你捕捉到了一个明亮的时刻。试着让这份感觉多停留几秒，它也会成为低潮时的证据。",
  };

  els.analysisTitle.textContent = lowMood ? "谢谢你没有忽略自己" : "你已经看见了这份感受";
  els.analysisMood.textContent = `${entry.mood} · 强度 ${entry.intensity}`;
  els.analysisSummary.textContent = summaries[entry.score];
  els.analysisTags.innerHTML = entry.triggers
    .map((trigger) => `<span>${escapeHtml(trigger)}${inferred.includes(trigger) ? " · 文字线索" : ""}</span>`)
    .join("");
  els.suggestedCareText.textContent = practice.label;
  els.suggestedCareButton.dataset.practice = practice.key;
  els.analysisResult.hidden = false;
  requestAnimationFrame(() => els.analysisResult.scrollIntoView({ behavior: "smooth", block: "center" }));
}

function recommendPractice(entry) {
  if (entry.triggers.includes("睡眠")) return { key: "sound", label: "听 5 分钟舒缓声音" };
  if (entry.triggers.includes("身体状态") || entry.mood === "疲惫") return { key: "walk", label: "进行 10 分钟轻缓步行" };
  if (entry.intensity >= 4 || entry.score <= 2) return { key: "grounding", label: "做 3 分钟感官着陆" };
  return { key: "breath", label: "做 1 分钟呼吸练习" };
}

function resetForm() {
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
  updateSaveState();
}

function persistEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
}

function renderAll() {
  renderEntries();
  renderMiniChart();
  renderTrends();
  updateCareRecommendation();
}

function renderEntries() {
  const recent = [...state.entries]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 3);
  if (!recent.length) {
    els.entryList.innerHTML = '<div class="empty-state">还没有记录。下一次情绪经过时，可以先留下一句话。</div>';
    return;
  }

  els.entryList.innerHTML = recent
    .map((entry) => {
      const date = new Date(entry.createdAt);
      const meta = moodMeta[entry.score] || moodMeta[3];
      return `
        <article class="entry-item">
          <time class="entry-date" datetime="${entry.createdAt}">
            <strong>${String(date.getDate()).padStart(2, "0")}</strong>
            ${date.getMonth() + 1}月
          </time>
          <div class="entry-body">
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
    })
    .join("");
}

function renderMiniChart() {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return startOfDay(date);
  });
  const labels = ["日", "一", "二", "三", "四", "五", "六"];
  const values = days.map((date) => {
    const entries = state.entries.filter((entry) => isSameDay(new Date(entry.createdAt), date));
    if (!entries.length) return null;
    return entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length;
  });

  els.miniChart.innerHTML = values
    .map((value, index) => {
      const score = value || 0.55;
      const color = value ? (moodMeta[Math.round(value)] || moodMeta[3]).color : "#d7d8d1";
      return `
        <div class="mini-bar-wrap" title="${value ? `平均情绪 ${value.toFixed(1)}` : "没有记录"}">
          <div class="mini-bar" style="height:${score * 18}%;--bar-color:${color};animation-delay:${index * 50}ms"></div>
          <span>${labels[days[index].getDay()]}</span>
        </div>
      `;
    })
    .join("");

  const recentWeek = entriesWithinDays(7);
  els.weekCount.textContent = `${recentWeek.length} 次记录`;
  els.contextInsight.textContent = buildContextInsight(recentWeek);
}

function buildContextInsight(entries) {
  if (!entries.length) return "这一周还没有记录。情绪被看见的那一刻，变化就已经开始。";
  const triggerCounts = countTriggers(entries);
  const top = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0];
  const average = averageScore(entries);
  if (top && top[0] === "睡眠") return "睡眠近期多次与你的情绪一起出现，今晚可以把“早点休息”当作唯一任务。";
  if (top && top[0] === "工作/学业") return "工作与学业是近期最常见的波动线索。任务结束后的过渡时间，可能比继续坚持更重要。";
  if (average <= 2.2) return "这周的情绪能量偏低。把目标缩小，并让信任的人知道你的状态。";
  if (average >= 3.8) return "这周有不少明亮时刻。回看当时做过的小事，它们可能值得重复。";
  return "情绪有起伏，也在慢慢回到中间。你正在形成自己的恢复节奏。";
}

function renderTrends() {
  const entries = entriesWithinDays(state.trendDays);
  const average = averageScore(entries);
  const triggerCounts = countTriggers(entries);
  const top = Object.entries(triggerCounts).sort((a, b) => b[1] - a[1])[0];

  els.averageMood.textContent = entries.length ? average.toFixed(1) : "—";
  els.averageMoodLabel.textContent = entries.length ? scoreLabel(average) : "等待记录";
  els.totalEntries.textContent = String(entries.length);
  els.topTrigger.textContent = top ? top[0].replace("/", " / ") : "尚无线索";
  els.topTriggerCount.textContent = top ? `出现 ${top[1]} 次` : "记录后生成";
  renderTrendChart(entries);
  renderTriggerBars(triggerCounts);
  renderReflection(entries, top);
}

function renderTrendChart(entries) {
  const width = 900;
  const height = 310;
  const padding = { top: 20, right: 26, bottom: 40, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const sorted = [...entries].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  const grid = [1, 2, 3, 4, 5]
    .map((value) => {
      const y = padding.top + ((5 - value) / 4) * plotHeight;
      return `<line class="chart-grid" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}"></line>
        <text class="chart-y-label" x="8" y="${y + 4}">${moodMeta[value].label}</text>`;
    })
    .join("");

  if (!sorted.length) {
    els.trendChart.innerHTML = `${grid}<text class="chart-label" x="${width / 2}" y="${height / 2}" text-anchor="middle">这段时间还没有记录</text>`;
    return;
  }

  const points = sorted.map((entry, index) => {
    const x =
      sorted.length === 1
        ? width / 2
        : padding.left + (index / (sorted.length - 1)) * plotWidth;
    const y = padding.top + ((5 - entry.score) / 4) * plotHeight;
    return { x, y, entry };
  });

  const bars = points
    .map(({ x, entry }) => {
      const barHeight = (entry.intensity / 5) * 54;
      return `<rect class="chart-bar" x="${x - 8}" y="${height - padding.bottom - barHeight}" width="16" height="${barHeight}" rx="2"></rect>`;
    })
    .join("");
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;
  const circles = points
    .map(
      (point, index) =>
        `<circle class="chart-point${index === points.length - 1 ? " is-latest" : ""}" cx="${point.x}" cy="${point.y}" r="5">
          <title>${point.entry.mood} · 强度 ${point.entry.intensity}</title>
        </circle>`,
    )
    .join("");
  const dateLabels = points
    .map(({ x, entry }) => {
      const date = new Date(entry.createdAt);
      return `<text class="chart-label" x="${x}" y="${height - 13}" text-anchor="middle">${date.getMonth() + 1}/${date.getDate()}</text>`;
    })
    .join("");

  els.trendChart.innerHTML = `${grid}${bars}<path class="chart-area" d="${areaPath}"></path><path class="chart-line" d="${linePath}"></path>${circles}${dateLabels}`;
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
    els.reflectionText.textContent = "“当你对自己要求很高时，情绪更容易向下。把‘必须做好’改成‘先完成一点’，可能会给你更多空间。”";
  } else if (top && top[0] === "睡眠") {
    els.reflectionText.textContent = "“休息质量和近期情绪反复一起出现。恢复不一定要做更多，有时是允许今天早点结束。”";
  } else if (latest.score >= 4) {
    els.reflectionText.textContent = "“最近一次记录里有明显的轻快感。记住当时的人、地点和行动，它们可能是可以主动靠近的资源。”";
  } else {
    els.reflectionText.textContent = "“即使在压力高的时候，你仍愿意停下来记录。这份觉察本身，就是正在形成的恢复能力。”";
  }
}

function updateCareRecommendation() {
  const latest = [...state.entries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  if (!latest) {
    els.careHeadline.textContent = "回到呼吸";
    return;
  }
  if (latest.triggers.includes("睡眠")) els.careHeadline.textContent = "准备休息";
  else if (latest.intensity >= 4) els.careHeadline.textContent = "松开紧绷";
  else if (latest.score >= 4) els.careHeadline.textContent = "留住能量";
  else els.careHeadline.textContent = "回到身体";
}

function openPractice(type) {
  const config = practiceConfig[type] || practiceConfig.breath;
  stopPractice();
  state.activePractice = type;
  state.practiceRemaining = config.seconds;
  els.practiceType.textContent = config.eyebrow;
  els.practiceModalTitle.textContent = config.title;
  els.practiceDescription.textContent = config.description;
  els.practiceStartButton.querySelector("span").textContent = "开始";
  els.practiceTime.textContent = formatTime(config.seconds);
  configurePracticeStage(config.mode);
  els.practiceModal.hidden = false;
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => els.practiceStartButton.focus());
  refreshIcons();
}

function configurePracticeStage(mode) {
  els.breathVisual.hidden = !["breath", "walk"].includes(mode);
  els.groundingList.hidden = mode !== "grounding";
  els.soundVisual.hidden = mode !== "sound";
  els.soundVisual.classList.remove("is-playing");
  els.breathProgress.className = "breath-progress";
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
  if (!state.activePractice) return;
  state.practiceRunning = true;
  els.practiceStartButton.querySelector("span").textContent = "暂停";
  setPracticeButtonIcon("pause");
  if (state.activePractice === "sound") startSound();
  updatePracticeVisual();
  state.practiceTimer = window.setInterval(() => {
    state.practiceRemaining -= 1;
    els.practiceTime.textContent = formatTime(state.practiceRemaining);
    updatePracticeVisual();
    if (state.practiceRemaining <= 0) completePractice();
  }, 1000);
}

function pausePractice() {
  state.practiceRunning = false;
  window.clearInterval(state.practiceTimer);
  state.practiceTimer = null;
  els.practiceStartButton.querySelector("span").textContent = "继续";
  setPracticeButtonIcon("play");
  stopSound();
  els.soundVisual.classList.remove("is-playing");
}

function stopPractice() {
  state.practiceRunning = false;
  window.clearInterval(state.practiceTimer);
  state.practiceTimer = null;
  stopSound();
}

function completePractice() {
  stopPractice();
  els.practiceTime.textContent = "完成";
  els.practiceStartButton.querySelector("span").textContent = "再来一次";
  setPracticeButtonIcon("rotate-ccw");
  els.breathProgress.className = "breath-progress";
  els.breathText.textContent = "辛苦了";
  els.soundVisual.classList.remove("is-playing");
  showToast("你为自己留出了一点空间");
  state.practiceRemaining = practiceConfig[state.activePractice].seconds;
}

function updatePracticeVisual() {
  if (state.activePractice === "breath") {
    const elapsed = practiceConfig.breath.seconds - state.practiceRemaining;
    const cycle = elapsed % 12;
    els.breathProgress.className = "breath-progress";
    if (cycle < 4) {
      els.breathProgress.classList.add("is-inhaling");
      els.breathText.textContent = "慢慢吸气";
    } else if (cycle < 6) {
      els.breathProgress.classList.add("is-inhaling");
      els.breathText.textContent = "停留一下";
    } else if (cycle < 10) {
      els.breathProgress.classList.add("is-exhaling");
      els.breathText.textContent = "缓缓呼气";
    } else {
      els.breathProgress.classList.add("is-exhaling");
      els.breathText.textContent = "停留一下";
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
    if (!AudioContext) return;
    state.audioContext = new AudioContext();
    const master = state.audioContext.createGain();
    master.gain.setValueAtTime(0.0001, state.audioContext.currentTime);
    master.gain.exponentialRampToValueAtTime(0.035, state.audioContext.currentTime + 1.5);
    master.connect(state.audioContext.destination);

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
  } catch (error) {
    console.warn("浏览器未允许声音播放", error);
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
  if (state.audioContext) {
    state.audioContext.close().catch(() => {});
    state.audioContext = null;
  }
}

function closePractice() {
  stopPractice();
  els.practiceModal.hidden = true;
  document.body.style.overflow = "";
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
      <p>示例记录与真实记录会一起导出，文件只会下载到当前设备。</p>
    `,
    actions: `
      <button class="secondary-button" type="button" id="exportDataButton"><span>导出记录</span></button>
      <button class="danger-button" type="button" id="clearDataButton">清除全部记录</button>
    `,
  });
  document.getElementById("exportDataButton").addEventListener("click", exportData);
  document.getElementById("clearDataButton").addEventListener("click", confirmClearData);
}

function showSupport() {
  openInfo({
    eyebrow: "即时支持",
    title: "先让一个人知道",
    body: `
      <p>如果你正在经历强烈痛苦，或担心自己会伤害自己，请先离开危险物品和独处环境，联系一位可以陪伴你的人。</p>
      <ul>
        <li><strong>立即危险：</strong>拨打 110 或 120</li>
        <li><strong>心理援助：</strong>拨打全国统一心理援助热线 12356</li>
        <li><strong>身边支持：</strong>联系朋友、家人、老师或所在机构的心理中心</li>
      </ul>
      <p>栖刻不能替代专业的心理咨询、诊断或紧急援助。</p>
    `,
    actions: '<button class="primary-button" type="button" data-close-info><span>我会联系支持</span></button>',
  });
}

function openInfo({ eyebrow, title, body, actions }) {
  els.infoEyebrow.textContent = eyebrow;
  els.infoModalTitle.textContent = title;
  els.infoModalBody.innerHTML = body;
  els.infoModalActions.innerHTML = actions;
  els.infoModal.hidden = false;
  document.body.style.overflow = "hidden";
  els.infoModal.querySelectorAll("[data-close-info]").forEach((button) => {
    button.addEventListener("click", closeInfo);
  });
  refreshIcons();
}

function closeInfo() {
  els.infoModal.hidden = true;
  document.body.style.overflow = "";
}

function exportData() {
  const blob = new Blob([JSON.stringify(state.entries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `栖刻-情绪记录-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("记录已导出");
}

function confirmClearData(event) {
  const button = event.currentTarget;
  if (button.dataset.confirmed !== "true") {
    button.dataset.confirmed = "true";
    button.textContent = "再次点击确认清除";
    return;
  }
  state.entries = [];
  persistEntries();
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
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return state.entries.filter((entry) => new Date(entry.createdAt) >= cutoff);
}

function countTriggers(entries) {
  return entries.reduce((counts, entry) => {
    entry.triggers.forEach((trigger) => {
      counts[trigger] = (counts[trigger] || 0) + 1;
    });
    return counts;
  }, {});
}

function averageScore(entries) {
  if (!entries.length) return 0;
  return entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length;
}

function scoreLabel(score) {
  return (moodMeta[Math.max(1, Math.min(5, Math.round(score)))] || moodMeta[3]).label;
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
