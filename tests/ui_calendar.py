"""Calendar navigation and local-date grouping in the journal workspace."""
import json
import os
from datetime import datetime, timezone

from playwright.sync_api import expect, sync_playwright

URL = os.environ.get("QIKE_TEST_URL", "http://127.0.0.1:43127")


def entry(identifier, when, text):
    return {
        "id": identifier, "createdAt": when, "text": text,
        "mood": "平静", "score": 3, "intensity": 2, "triggers": ["睡眠"],
    }


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(timezone_id="Asia/Shanghai", reduced_motion="reduce")
    page.clock.install(time=datetime(2026, 9, 23, 4, tzinfo=timezone.utc))
    records = [
        entry("morning", "2026-09-23T02:10:00Z", "同一天的第二条记录"),
        entry("midnight", "2026-09-22T16:10:00Z", "本地时间九月二十三日的第一条"),
        entry("yesterday", "2026-09-22T01:00:00Z", "昨天的日记"),
        entry("previous-month", "2026-08-31T12:00:00Z", "八月的日记"),
    ]
    page.add_init_script(
        "localStorage.setItem('qike.entries.v1', " + json.dumps(json.dumps(records)) + ");"
        "localStorage.setItem('qike.demo.v1', 'false');"
    )
    page.goto(URL, wait_until="networkidle")
    page.locator('.nav-item[data-view="journal"]').click()
    expect(page.locator("#calendarSummary")).to_contain_text("本月记录 2 天")
    expect(page.locator("#calendarNext")).to_be_disabled()

    # A UTC record from the previous date belongs to the user's local calendar day.
    day = page.locator('[data-date="2026-09-23"]')
    expect(day).to_have_attribute("aria-label", "2026年9月23日，今天，2条记录，常见情绪平静")
    day.click()
    expect(page.locator("#entryList .entry-item")).to_have_count(2)
    expect(page.locator("#entryList")).to_contain_text("本地时间九月二十三日")
    expect(day).to_be_focused()
    day.click()
    expect(page.locator("#entryList .entry-item")).to_have_count(3)

    page.locator("#calendarPrev").click()
    expect(page.locator("#calendarTitle")).to_contain_text("八月")
    page.locator('[data-date="2026-08-31"]').click()
    expect(page.locator("#entryList .entry-item")).to_have_count(1)
    expect(page.locator("#entryList")).to_contain_text("八月的日记")
    page.locator("#clearDateFilter").click()
    expect(page.locator("#entryList .entry-item")).to_have_count(3)

    # Saving while looking at an older month returns to the new record.
    page.locator('.nav-item[data-view="today"]').click()
    page.locator('[data-mood="轻快"]').click()
    page.locator("#writingToggle").click()
    page.locator("#journalText").fill("刚刚写下的新日记")
    page.locator("#saveButton").click()
    page.locator('#analysisResult [data-view="journal"]').click()
    expect(page.locator("#calendarTitle")).to_contain_text("九月")
    expect(page.locator("#entryList")).to_contain_text("刚刚写下的新日记")
    expect(page.locator("#calendarNext")).to_be_disabled()

    page.locator("#showDemoButton").click()
    expect(page.locator("#calendarSummary")).to_contain_text("示例")
    expect(page.locator("#entryList")).not_to_contain_text("刚刚写下的新日记")
    page.locator("#startPersonalButton").click()
    page.locator('.nav-item[data-view="journal"]').click()
    expect(page.locator("#entryList")).to_contain_text("刚刚写下的新日记")
    browser.close()

print("PASS: local dates, multiple entries per day, month navigation, saving, demo isolation")
