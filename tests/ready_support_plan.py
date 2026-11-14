"""
Ready alert on the customer's order page, the calling screen, WhatsApp support links,
the Plan page and Rubix admin add-on switches.

Runs against the Firestore emulator and WIPES it first, like tests/e2e.py. The server must run
with SUPERADMIN_EMAILS=info@rubix.com.my (as in .env.example).

    npm run emulators                     # terminal 1
    npm run build && npm start            # terminal 2
    python3 tests/ready_support_plan.py
"""
import json, os, re, subprocess, urllib.request
from urllib.parse import unquote
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE_URL", "http://localhost:3000")
EMU = os.environ.get("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080")
PROJECT = os.environ.get("FIREBASE_PROJECT_ID", "demo-orderje")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = {**os.environ, "FIRESTORE_EMULATOR_HOST": EMU, "FIREBASE_PROJECT_ID": PROJECT}
WA = "https://wa.me/601155515937?text="
urllib.request.urlopen(urllib.request.Request(
    f"http://{EMU}/emulator/v1/projects/{PROJECT}/databases/(default)/documents", method="DELETE"))


def dump():
    out = subprocess.run(["node", "tests/fsdump.mjs"], capture_output=True, text=True, cwd=ROOT, env=ENV, check=True)
    return json.loads(out.stdout)


def docs(collection, **match):
    return [d for path, d in dump().items()
            if path.split("/")[-2] == collection and all(d.get(k) == v for k, v in match.items())]


def step(name):
    print(f"--- {name}", flush=True)


def signup(page, shop, email):
    page.goto(f"{BASE}/signup")
    page.fill("input[name=shopName]", shop)
    page.fill("input[name=ownerName]", "Ros")
    page.fill("input[name=email]", email)
    page.fill("input[name=password]", "password123")
    page.fill("input[name=tables]", "2")
    page.click("button:has-text('Create kedai')")
    page.wait_for_url(f"{BASE}/app")


def qr_order(browser, slug, token, item):
    phone = browser.new_context(viewport={"width": 390, "height": 844})
    # Record vibrations, since a headless browser can't buzz.
    phone.add_init_script("window.__buzz = []; navigator.vibrate = (p) => { window.__buzz.push(p); return true; };")
    c = phone.new_page()
    c.goto(f"{BASE}/t/{slug}/{token}")
    c.get_by_role("button", name=re.compile(item)).first.click()
    c.get_by_role("button", name=re.compile(r"^Add · ")).click()
    c.get_by_role("button", name=re.compile("View order")).click()
    c.get_by_role("button", name="Send order to kitchen").click()
    c.wait_for_url("**/o/**")
    return c


with sync_playwright() as p:
    browser = p.chromium.launch()
    owner = browser.new_context(viewport={"width": 1366, "height": 900})
    page = owner.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    step("signup")
    signup(page, "Kedai Kak Ros", "ros@kedai.my")
    tenant = docs("tenants")[0]
    slug = tenant["slug"]
    tables = sorted(docs("tables"), key=lambda t: t["sort"])

    step("WhatsApp help in the staff app names the kedai")
    href = page.get_by_role("link", name="Help on WhatsApp").get_attribute("href")
    assert href.startswith(WA), href
    assert "Kedai Kak Ros" in unquote(href) and slug in unquote(href), unquote(href)

    step("Plan page: free with no time limit, add-ons coming soon with a WhatsApp ask")
    page.get_by_role("link", name="Plan").first.click()
    expect(page.get_by_role("heading", name="Free")).to_be_visible()
    expect(page.get_by_text("No time limit and no card needed.")).to_be_visible()
    expect(page.get_by_text("Coming soon")).to_have_count(2)
    ask = page.get_by_role("link", name="Tell me when it's ready").first.get_attribute("href")
    assert ask.startswith(WA) and "Supplier invoices" in unquote(ask) and slug in unquote(ask), unquote(ask)

    step("landing page: price FAQ and a WhatsApp link")
    visitor = browser.new_context().new_page()
    visitor.goto(BASE)
    expect(visitor.get_by_text("Berapa harga?")).to_be_visible()
    assert visitor.get_by_role("link", name="WhatsApp kami").get_attribute("href").startswith(WA)

    step("customer orders by QR and asks to be alerted")
    c = qr_order(browser, slug, tables[0]["token"], "Roti Canai")
    expect(c.get_by_role("heading", name="Order #1")).to_be_visible()
    c.get_by_role("button", name="Alert me when it's ready").click()
    expect(c.get_by_text("We'll beep when your food is ready.")).to_be_visible()
    c2 = qr_order(browser, slug, tables[1]["token"], "Roti Telur")

    step("calling screen shows both as being made")
    page.goto(f"{BASE}/app/display")
    making = page.get_by_role("region", name="Being made")
    expect(making.get_by_text("1", exact=True)).to_be_visible()
    expect(making.get_by_text("2", exact=True)).to_be_visible()
    expect(page.get_by_role("region", name="Ready to collect").get_by_text("Nothing ready yet.")).to_be_visible()

    step("kitchen marks #1 ready")
    kitchen = owner.new_page()
    kitchen.goto(f"{BASE}/app/kitchen")
    t1 = kitchen.locator("article", has_text="#1")
    t1.get_by_role("button", name="Start cooking").click()
    kitchen.locator("article", has_text="#1").get_by_role("button", name="Mark ready").click()

    step("customer's phone shows the big banner, buzzes and changes the tab title")
    expect(c.locator("[role=alert].ready-pulse")).to_contain_text("Order #1 is ready!", timeout=15000)
    assert c.evaluate("window.__buzz.length") >= 2, c.evaluate("window.__buzz")  # tap to arm + the alert
    assert "Order #1 is ready" in c.title(), c.title()
    buzzes = c.evaluate("window.__buzz.length")
    c.wait_for_timeout(6000)  # page refreshes again: no second alert
    assert c.evaluate("window.__buzz.length") == buzzes

    step("calling screen moves #1 to ready, #2 stays being made")
    ready = page.get_by_role("region", name="Ready to collect")
    expect(ready.get_by_text("1", exact=True)).to_be_visible(timeout=10000)
    expect(making.get_by_text("2", exact=True)).to_be_visible()
    expect(making.get_by_text("1", exact=True)).to_have_count(0)

    step("served: #1 leaves the calling screen")
    kitchen.locator("article", has_text="#1").get_by_role("button", name="Served").click()
    expect(ready.get_by_text("Nothing ready yet.")).to_be_visible(timeout=10000)

    step("Rubix admin switches on Petty cash for this kedai")
    admin = browser.new_context(viewport={"width": 1366, "height": 900}).new_page()
    signup(admin, "Rubix Test Kedai", "info@rubix.com.my")
    admin.goto(f"{BASE}/admin")
    row = admin.locator("tr", has_text="Kedai Kak Ros")
    row.get_by_role("button", name="Petty cash").click()
    expect(admin.locator("tr", has_text="Kedai Kak Ros").get_by_role("button", name="Petty cash")).to_have_attribute("aria-pressed", "true")
    assert docs("tenants", slug=slug)[0]["addons"] == ["petty_cash"]
    page.goto(f"{BASE}/app/plan")
    expect(page.locator("div", has=page.get_by_role("heading", name="Petty cash")).get_by_text("Active").first).to_be_visible()
    expect(page.get_by_text("Coming soon")).to_have_count(1)
    admin.locator("tr", has_text="Kedai Kak Ros").get_by_role("button", name="Petty cash").click()
    expect(admin.locator("tr", has_text="Kedai Kak Ros").get_by_role("button", name="Petty cash")).to_have_attribute("aria-pressed", "false")
    assert docs("tenants", slug=slug)[0]["addons"] == []

    step("a suspended kedai's login page offers WhatsApp support")
    admin.locator("tr", has_text="Kedai Kak Ros").get_by_role("button", name="Suspend").click()
    expect(admin.locator("tr", has_text="Kedai Kak Ros").get_by_text("Suspended")).to_be_visible()
    fresh = browser.new_context().new_page()
    fresh.goto(f"{BASE}/login")
    fresh.fill("input[name=email]", "ros@kedai.my")
    fresh.fill("input[name=password]", "password123")
    fresh.get_by_role("button", name="Log in").click()
    expect(fresh.get_by_text("subscription is suspended")).to_be_visible()
    fresh.goto(f"{BASE}/login?e=suspended")
    assert fresh.get_by_role("link", name="WhatsApp Rubix support").get_attribute("href").startswith(WA)

    assert not errors, errors
    print("PASS: ready alert, calling screen, support and plan")
    browser.close()
