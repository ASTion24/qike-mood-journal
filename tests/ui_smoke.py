import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)
URL = os.environ.get("QIKE_TEST_URL", "http://127.0.0.1:43127")
ERRORS = []


def new_page(browser, width=1440):
    page = browser.new_page(
        viewport={"width": width, "height": 960 if width > 880 else 844},
        reduced_motion="reduce",
    )
    page.on("pageerror", lambda error: ERRORS.append(str(error)))
    page.on("console", lambda msg: ERRORS.append(msg.text) if msg.type == "error" else None)
    return page


def assert_no_horizontal_overflow(page):
    metrics = page.evaluate("""() => ({
        viewport: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth
    })""")
    assert metrics["scroll"] <= metrics["viewport"] + 1, metrics


def saved_entries(page):
    return page.evaluate("JSON.parse(localStorage.getItem('qike.entries.v1') || '[]')")


def nav(page, view, width=1440):
    selector = ".nav-item" if width > 880 else ".mobile-nav button"
    page.locator(f'{selector}[data-view="{view}"]').click()


def upload_backup(page, contents):
    page.locator("#importFile").set_input_files({
        "name": "backup.json",
        "mimeType": "application/json",
        "buffer": contents.encode("utf-8"),
    })


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = new_page(browser)
    page.goto(URL, wait_until="networkidle")

    # Samples are visible, explicitly labeled, and never written as personal data.
    expect(page.locator("#demoNotice")).to_be_visible()
    expect(page.locator("#entryList .entry-item")).to_have_count(3)
    assert saved_entries(page) == []
    page.screenshot(path=str(ARTIFACTS / "desktop-home-v2.png"), full_page=True)
    nav(page, "trends")
    expect(page.locator("#historyList .entry-item")).to_have_count(5)
    page.screenshot(path=str(ARTIFACTS / "desktop-trends-v2.png"), full_page=True)
    nav(page, "today")

    # Draft recovery and the explicit confirmation boundary for inferred triggers.
    page.locator('[data-mood="疲惫"]').click()
    page.locator("#journalText").fill("明天要汇报，昨晚也没睡好，心里一直有点紧。")
    page.locator('[data-trigger="工作/学业"]').click()
    page.reload(wait_until="networkidle")
    expect(page.locator("#journalText")).to_have_value("明天要汇报，昨晚也没睡好，心里一直有点紧。")
    expect(page.locator('[data-mood="疲惫"]')).to_have_attribute("aria-pressed", "true")
    page.locator("#saveButton").click()
    expect(page.locator("#analysisResult")).to_be_visible()
    assert len(saved_entries(page)) == 1
    assert saved_entries(page)[0]["triggers"] == ["工作/学业"]
    page.locator('[data-confirm-trigger="睡眠"]').click()
    assert "睡眠" in saved_entries(page)[0]["triggers"]
    original_id = saved_entries(page)[0]["id"]
    original_time = saved_entries(page)[0]["createdAt"]
    expect(page.locator("#demoNotice")).to_be_hidden()
    assert page.evaluate("localStorage.getItem('qike.draft.v1')") is None
    page.screenshot(path=str(ARTIFACTS / "desktop-saved-v2.png"), full_page=True)

    # A full archive, filtering, viewing, and editing preserve entry identity/date.
    page.locator("#viewHistoryButton").click()
    expect(page.locator("#historyList .entry-item")).to_have_count(1)
    page.locator("#historySearch").fill("没有这段文字")
    expect(page.locator("#historyList .entry-item")).to_have_count(0)
    page.locator("#historySearch").fill("汇报")
    page.locator("#historyMood").select_option(label="平静")
    expect(page.locator("#historyList .entry-item")).to_have_count(0)
    page.locator("#historyMood").select_option(label="疲惫")
    page.locator("#historyList [data-entry]").click()
    expect(page.locator("#infoModal .entry-full")).to_contain_text("明天要汇报")
    page.locator("#editEntryButton").click()
    page.locator("#journalText").fill('昨晚没睡好。<script>alert("不会执行")</script>')
    page.locator("#saveButton").click()
    assert len(saved_entries(page)) == 1
    assert saved_entries(page)[0]["id"] == original_id
    assert saved_entries(page)[0]["createdAt"] == original_time
    expect(page.locator("#entryList .entry-body p")).to_contain_text("<script>")
    page.reload(wait_until="networkidle")
    assert len(saved_entries(page)) == 1
    nav(page, "care")
    expect(page.locator("#featuredPracticeButton")).to_have_attribute("data-practice", "sound")
    expect(page.locator("#featuredReason")).to_contain_text("睡眠")
    page.screenshot(path=str(ARTIFACTS / "desktop-care-v2.png"), full_page=True)

    # Hidden practice modes, pause/resume, completion and feedback survive reload.
    page.clock.install()
    page.locator('.practice-row[data-practice="breath"]').click()
    expect(page.locator("#breathVisual")).to_be_visible()
    expect(page.locator("#soundVisual")).to_be_hidden()
    page.locator("#practiceStartButton").click()
    page.clock.fast_forward(12_000)
    expect(page.locator("#practiceTime")).not_to_have_text("01:00")
    page.locator("#practiceStartButton").click()
    paused = page.locator("#practiceTime").inner_text()
    page.clock.fast_forward(20_000)
    expect(page.locator("#practiceTime")).to_have_text(paused)
    page.locator("#practiceStartButton").click()
    page.clock.fast_forward(60_000)
    expect(page.locator("#practiceFeedback")).to_be_visible()
    page.locator('[data-feedback="helpful"]').click()
    expect(page.locator("#feedbackSaved")).to_contain_text("已记下")
    page.screenshot(path=str(ARTIFACTS / "practice-feedback-v2.png"))
    page.locator("[data-close-modal]").click()
    expect(page.locator("#careHistorySummary")).to_contain_text("1 次练习")
    page.locator('.practice-row[data-practice="sound"]').click()
    expect(page.locator("#breathVisual")).to_be_hidden()
    expect(page.locator("#soundVisual")).to_be_visible()
    page.locator("#practiceStartButton").click()
    expect(page.locator("#soundVisual")).to_have_class("sound-visual is-playing")
    page.locator("#soundVolume").fill("10")
    page.locator("[data-close-modal]").click()
    page.locator('.practice-row[data-practice="grounding"]').click()
    expect(page.locator("#breathVisual")).to_be_hidden()
    expect(page.locator("#groundingList")).to_be_visible()
    page.locator("#practiceStartButton").click()
    page.clock.fast_forward(40_000)
    expect(page.locator(".grounding-step").nth(1)).to_have_class("grounding-step is-active")
    page.locator("[data-close-modal]").click()

    # Export contains personal data only; restore merges without duplicating IDs.
    page.locator("#settingsButton").click()
    with page.expect_download() as download_info:
        page.locator("#exportDataButton").click()
    download = download_info.value
    backup = Path(download.path()).read_text()
    data = json.loads(backup)
    assert data["version"] == 2 and len(data["entries"]) == 1 and len(data["care"]) == 1
    page.locator("#clearDataButton").click()
    assert len(saved_entries(page)) == 1
    page.locator("#clearDataButton").click()
    assert saved_entries(page) == []
    page.reload(wait_until="networkidle")
    expect(page.locator("#demoNotice")).to_be_hidden()
    upload_backup(page, backup)
    page.locator("#confirmImportButton").click()
    assert len(saved_entries(page)) == 1
    upload_backup(page, backup)
    expect(page.locator("#infoModalBody")).to_contain_text("新增 0 条日记")
    page.locator("#confirmImportButton").click()
    assert len(saved_entries(page)) == 1
    upload_backup(page, '{"version":2,"entries":[{"text":"bad"}],"care":[]}')
    expect(page.locator("#infoModalTitle")).to_have_text("备份没有被写入")
    assert len(saved_entries(page)) == 1
    page.locator(".info-modal .modal-close").click()
    page.locator("#viewHistoryButton").click()
    page.locator("#historyList [data-entry]").click()
    page.locator("#deleteEntryButton").click()
    assert len(saved_entries(page)) == 1
    page.locator("#deleteEntryButton").click()
    assert saved_entries(page) == []
    page.close()
    print("PASS: diary, drafts, confirmed triggers, archive, edit/delete, practices, backup")

    # Migrate v1 seeded samples without losing real entries, and check date boundaries.
    now = datetime.now(timezone.utc)
    def record(entry_id, days, text):
        return {"id": entry_id, "createdAt": (now - timedelta(days=days)).isoformat(),
                "mood": "疲惫", "score": 2, "intensity": 4, "text": text,
                "triggers": ["工作/学业", "睡眠"]}
    legacy = [
        record("demo-1", 1, "下午连续开了几个会，回到家还是在想没做完的事。昨晚也睡得很晚。"),
        record("user-retained", 0, "真实记录应当保留"),
        record("user-seven-days-ago", 7, "七天窗口之外"),
    ]
    migrated = new_page(browser)
    migrated.add_init_script("localStorage.setItem('qike.entries.v1'," + json.dumps(json.dumps(legacy)) + ");")
    migrated.goto(URL, wait_until="networkidle")
    expect(migrated.locator("#demoNotice")).to_be_hidden()
    expect(migrated.locator("#entryList .entry-item")).to_have_count(2)
    nav(migrated, "trends")
    expect(migrated.locator("#totalEntries")).to_have_text("1")
    migrated.locator('[data-days="14"]').click()
    expect(migrated.locator("#totalEntries")).to_have_text("2")
    expect(migrated.locator("#periodLabel")).to_contain_text("近 14 天")
    migrated.close()

    # A storage failure keeps the unsaved input and does not claim success.
    blocked = new_page(browser)
    blocked.add_init_script("Storage.prototype.setItem = () => { throw new DOMException('full','QuotaExceededError'); };")
    blocked.goto(URL, wait_until="networkidle")
    blocked.locator('[data-mood="平静"]').click()
    blocked.locator("#journalText").fill("这段文字不能丢失")
    blocked.locator("#saveButton").click()
    expect(blocked.locator("#saveError")).to_be_visible()
    expect(blocked.locator("#journalText")).to_have_value("这段文字不能丢失")
    expect(blocked.locator("#analysisResult")).to_be_hidden()
    blocked.close()
    print("PASS: v1 migration, date boundaries, storage failure recovery")

    # Fresh visitors at phone, tablet and desktop widths; no external requests.
    for width in [320, 390, 768, 900, 1440]:
        responsive = new_page(browser, width)
        requests = []
        responsive.on("request", lambda req: requests.append(req.url))
        responsive.goto(URL, wait_until="networkidle")
        for view in ["today", "trends", "care"]:
            nav(responsive, view, width)
            assert_no_horizontal_overflow(responsive)
            if width == 390:
                responsive.screenshot(path=str(ARTIFACTS / f"mobile-{view}-v2.png"), full_page=True)
        assert all(request.startswith(URL) for request in requests), requests
        responsive.close()
    assert not ERRORS, ERRORS
    browser.close()
    print("PASS: all views at 320/390/768/900/1440px; no external dependencies or browser errors")

print("Qike v2 regression tests passed")
