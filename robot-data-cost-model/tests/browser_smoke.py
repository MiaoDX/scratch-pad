"""Browser smoke tests on bundled reports, with every network request blocked.
Requires Playwright and Chromium. CHROMIUM_PATH may select an existing browser.
No browser security policy is modified. Rendering uses set_content so tests can
run in sandboxes where navigation to file:// and localhost is disabled.
"""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import tempfile
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("report_build", ROOT / "build.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)

with sync_playwright() as pw, tempfile.TemporaryDirectory() as td:
    executable = os.environ.get("CHROMIUM_PATH") or shutil.which("chromium")
    kwargs = {"headless": True}
    if executable:
        kwargs["executable_path"] = executable
    browser = pw.chromium.launch(**kwargs)
    errors = []
    def page_for(name):
        page = browser.new_page(viewport={"width": 1440, "height": 1100})
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.route("**/*", lambda route: route.abort())
        page.set_content(build.bundle(name))
        page.wait_for_timeout(250)
        assert page.locator("#results").is_visible()
        return page

    detail = page_for("index.html")
    detail.click("#setBase")
    detail.locator("#month").fill("24")
    detail.wait_for_timeout(250)
    assert "24" in detail.locator("#baselineNote").inner_text()
    detail.select_option("#view", "cash")
    detail.wait_for_timeout(200)
    assert "现金" in detail.locator("#kpis").inner_text()
    # Strategy changes must preserve user-entered business input and prices.
    detail.fill("#f-mod-0-h", "22000")
    detail.locator("#f-mod-0-h").dispatch_event("change")
    detail.click('[data-preset="hybrid"]')
    assert detail.input_value("#f-mod-0-h") == "22000"
    assert detail.evaluate("window.reportResult.params.gpuPrice") == 8
    assert detail.evaluate("window.reportResult.results[23].capex") >= 0
    # Invalid lifecycle must hide stale totals, not silently clamp values.
    detail.fill("#f-stdDays", "0")
    detail.locator("#f-stdDays").dispatch_event("change")
    detail.wait_for_timeout(250)
    assert detail.locator("#error").is_visible()
    assert not detail.locator("#results").is_visible()
    detail.fill("#f-stdDays", "90")
    detail.locator("#f-stdDays").dispatch_event("change")
    detail.wait_for_timeout(250)
    assert detail.locator("#results").is_visible()
    # Full snapshot download and round-trip, including Unicode names.
    with detail.expect_download() as event:
        detail.click("#export")
    path = Path(td) / "detail.json"
    event.value.save_as(path)
    saved = json.loads(path.read_text())
    saved["params"]["mod"][0]["name"] = '<img src=x onerror="window.injected=true">'
    path.write_text(json.dumps(saved, ensure_ascii=False))
    detail.locator("#import").set_input_files(path)
    detail.wait_for_timeout(300)
    assert detail.evaluate("window.injected !== true")
    assert detail.locator("#params img").count() == 0
    assert '<img src=x' in detail.locator("#params").inner_text()
    assert detail.evaluate("window.reportResult.params.mod[0].h") == 22000

    # Window preset derives the IDC window from existing capacity; ? opens a definition.
    detail.click('[data-preset="window"]')
    detail.wait_for_timeout(250)
    assert int(detail.input_value("#f-stdDays")) > 30
    assert detail.evaluate("window.reportResult.params.hotPlace") == "idc"
    detail.locator("#params button.q").first.click()
    assert detail.locator("#termpop").is_visible()
    detail.keyboard.press("Escape")
    assert not detail.locator("#termpop").is_visible()
    assert detail.locator("#principles li").count() == 5
    assert detail.locator("#glossary .gi").count() > 20

    executive = page_for("v2.html")
    rows = executive.evaluate("window.executiveResult.rows")
    assert rows[2]["windowDays"] == 83
    assert rows[0]["deliveredH"] == 600000
    executive.click("#saveBase")
    executive.fill("#hours", "20950")
    assert executive.evaluate("window.executiveResult.business.hours") == 20950
    assert executive.locator(".scheme .delta").count() == 3
    executive.select_option("#prodPolicy", "30")
    assert executive.evaluate("window.executiveResult.business.prodDays") == 30
    executive.locator("#assumptions").evaluate("e => e.open = true")
    capex = executive.evaluate("window.executiveResult.rows[2].capex")
    executive.fill("#f-existingGPU", "5000")
    executive.locator("#f-existingGPU").dispatch_event("change")
    assert executive.evaluate("window.executiveResult.rows[2].capex") < capex
    executive.fill("#hours", "-1")
    assert executive.locator("#error").is_visible()
    assert not executive.locator("#results").is_visible()
    assert "修正" in executive.locator("#decisionText").inner_text()
    executive.fill("#hours", "20950")
    with executive.expect_download() as event:
        executive.click("#export")
    path = Path(td) / "executive.json"
    event.value.save_as(path)
    executive.fill("#hours", "10000")
    executive.locator("#import").set_input_files(path)
    executive.wait_for_timeout(200)
    assert executive.evaluate("window.executiveResult.business.hours") == 20950
    assert executive.input_value("#prodPolicy") == "30"
    executive.locator(".control button.q").first.click()
    assert executive.locator("#termpop").is_visible()
    # No body-level horizontal overflow at phone or desktop widths; print keeps results.
    for page in (detail, executive):
        page.set_viewport_size({"width": 390, "height": 844})
        assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
        page.emulate_media(media="print")
        assert page.locator("#results").is_visible()
        page.emulate_media(media="screen")
    assert not errors, errors
    browser.close()
    print("PASS: offline rendering, controls, baseline, strategy isolation, window preset, term popovers, invalid inputs, JSON round-trip, XSS safety, mobile and print")
