"""Progressive check-in, keyboard navigation, and draft continuity."""
import json
import os
from pathlib import Path
from playwright.sync_api import expect, sync_playwright

URL = os.environ.get("QIKE_TEST_URL", "http://127.0.0.1:43127")
ARTIFACTS = Path(__file__).resolve().parents[1] / "artifacts"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width, height in [(1440, 960), (390, 844), (320, 640)]:
        page = browser.new_page(viewport={"width": width, "height": height}, reduced_motion="reduce")
        page.goto(URL, wait_until="networkidle")
        nav = ".nav-item" if width > 880 else ".mobile-nav button"
        expect(page.locator("#checkinDetails")).to_be_hidden()
        expect(page.locator("#journalView")).to_be_hidden()
        page.screenshot(path=str(ARTIFACTS / f"checkin-home-{width}.png"), full_page=True, animations="disabled")

        # Selecting an emotion keeps the picker stable and permits a mood-only entry.
        button = page.locator('[data-mood="轻快"]')
        before = button.bounding_box()
        button.focus()
        page.keyboard.press("Enter")
        after = button.bounding_box()
        assert abs(before["y"] - after["y"]) < 1
        expect(page.locator("#saveButton")).to_be_enabled()
        expect(page.locator("#optionalWriting")).to_be_hidden()
        page.screenshot(path=str(ARTIFACTS / f"checkin-selected-{width}.png"), full_page=True, animations="disabled")
        page.locator("#saveButton").click()
        expect(page.locator("#analysisResult")).to_be_visible()
        expect(page.locator("#checkinForm")).to_be_hidden()
        expect(page.locator("#todaySummary")).to_contain_text("今天已记录 1 次")
        saved = page.evaluate("JSON.parse(localStorage.getItem('qike.entries.v1'))")
        assert len(saved) == 1 and saved[0]["text"] == "只记录了情绪。"

        # A new entry opens from either the saved state or the main navigation.
        page.locator("#newEntryButton").click()
        expect(page.locator("#checkinDetails")).to_be_hidden()
        page.locator('[data-mood="平静"]').click()
        page.locator("#writingToggle").click()
        expect(page.locator("#journalText")).to_be_focused()
        page.locator("#journalText").fill("下班后走了一小段路，慢慢地，就没那么着急了。")
        page.screenshot(path=str(ARTIFACTS / f"checkin-writing-{width}.png"), full_page=True, animations="disabled")
        # Folding content and visiting another page must not discard the writing.
        page.locator("#writingToggle").click()
        page.locator(f'{nav}[data-view="journal"]').click()
        page.locator(f'{nav}[data-view="today"]').click()
        page.reload(wait_until="networkidle")
        expect(page.locator("#optionalWriting")).to_be_visible()
        expect(page.locator("#journalText")).to_have_value("下班后走了一小段路，慢慢地，就没那么着急了。")
        page.locator("#saveButton").click()
        page.screenshot(path=str(ARTIFACTS / f"checkin-saved-{width}.png"), full_page=True, animations="disabled")
        page.locator('#analysisResult [data-view="journal"]').click()
        page.locator("#viewHistoryButton").click()
        expect(page.locator("#historyList .entry-item")).to_have_count(2)
        # Selecting a calendar day exits search mode into the selected day's list.
        page.locator("#calendarGrid .has-entry").click()
        expect(page.locator("#recentSection")).to_be_visible()
        expect(page.locator("#entryList .entry-item")).to_have_count(2)
        expect(page.locator("#historySection")).to_be_hidden()
        page.locator("#entryList [data-entry]").first.click()
        page.locator("#deleteEntryButton").click()
        page.locator("#deleteEntryButton").click()
        expect(page.locator("#entryList .entry-item")).to_have_count(1)
        page.locator(f'{nav}[data-view="today"]').click()
        expect(page.locator("#checkinForm")).to_be_visible()
        expect(page.locator("#checkinDetails")).to_be_hidden()
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        page.close()

    # Previous-version drafts without a selected emotion are still editable.
    page = browser.new_page()
    draft = {"mood": None, "score": None, "text": "旧版还没选情绪的草稿",
             "intensity": 3, "triggers": [], "editingId": None}
    page.add_init_script("localStorage.setItem('qike.draft.v1'," + json.dumps(json.dumps(draft)) + ");")
    page.goto(URL, wait_until="networkidle")
    expect(page.locator("#journalText")).to_be_visible()
    expect(page.locator("#saveButton")).to_be_disabled()
    page.locator("#discardDraftButton").click()
    expect(page.locator("#checkinDetails")).to_be_hidden()
    expect(page.locator("#openingTitle")).to_be_focused()
    browser.close()

print("PASS: progressive check-in, stable picker, mood-only save, draft continuity, journal scopes")
