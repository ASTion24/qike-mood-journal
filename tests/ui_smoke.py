from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)


def assert_no_horizontal_overflow(page):
    metrics = page.evaluate(
        """() => ({
            viewport: document.documentElement.clientWidth,
            scroll: document.documentElement.scrollWidth
        })"""
    )
    assert metrics["scroll"] <= metrics["viewport"] + 1, metrics


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)

    desktop = browser.new_page(viewport={"width": 1440, "height": 1000})
    console_errors = []
    desktop.on(
        "console",
        lambda message: console_errors.append(message.text)
        if message.type == "error"
        else None,
    )
    desktop.goto("http://127.0.0.1:43127", wait_until="networkidle")

    assert desktop.title() == "栖刻 · 情绪日记与自我关怀"
    assert desktop.locator(".entry-item").count() == 3
    assert_no_horizontal_overflow(desktop)
    desktop.screenshot(path=str(ARTIFACTS / "desktop-home.png"), full_page=True)

    desktop.locator('[data-mood="疲惫"]').click()
    desktop.locator("#journalText").fill("明天要汇报，昨晚也没睡好，心里一直有点紧。")
    desktop.locator('[data-trigger="工作/学业"]').click()
    desktop.locator("#checkinForm").locator('button[type="submit"]').click()
    assert desktop.locator("#analysisResult").is_visible()
    assert "睡眠" in desktop.locator("#analysisTags").inner_text()
    assert "明天要汇报" in desktop.locator(".entry-item").first.inner_text()

    desktop.locator('.nav-item[data-view="trends"]').click()
    assert desktop.locator("#trendsView").is_visible()
    assert desktop.locator("#trendChart .chart-point").count() >= 1

    desktop.locator('.nav-item[data-view="care"]').click()
    desktop.locator('[data-practice="breath"]').first.click()
    assert desktop.locator("#practiceModal").is_visible()
    desktop.locator("#practiceStartButton").click()
    desktop.wait_for_timeout(1100)
    assert desktop.locator("#practiceTime").inner_text() != "01:00"
    desktop.locator("[data-close-modal]").click()
    assert desktop.locator("#practiceModal").is_hidden()

    mobile = browser.new_page(viewport={"width": 390, "height": 844})
    mobile.goto("http://127.0.0.1:43127", wait_until="networkidle")
    assert mobile.locator(".mobile-nav").is_visible()
    assert_no_horizontal_overflow(mobile)
    mobile.screenshot(path=str(ARTIFACTS / "mobile-home.png"), full_page=True)

    relevant_errors = [
        error for error in console_errors if "favicon" not in error.lower()
    ]
    assert not relevant_errors, relevant_errors
    browser.close()

print("UI smoke test passed")
