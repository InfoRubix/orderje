"""
Open-price items (nasi campur): the cashier types the price for each order at the counter.
Hidden from the QR menu. Works offline too.

Runs against the Firestore emulator and WIPES it first, like tests/e2e.py.

    npm run emulators                     # terminal 1
    npm run build && npm start            # terminal 2
    python3 tests/open_price.py
"""
import json, os, subprocess, urllib.request
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE_URL", "http://localhost:3000")
EMU = os.environ.get("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080")
PROJECT = os.environ.get("FIREBASE_PROJECT_ID", "demo-orderje")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = {**os.environ, "FIRESTORE_EMULATOR_HOST": EMU, "FIREBASE_PROJECT_ID": PROJECT}
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


def tap(page, name):
    """Taps a menu item at the counter, switching category tabs until it shows up."""
    item = page.locator("section button.min-h-24", has_text=name)
    tabs = page.locator("section > div.mb-4 > button")
    for i in range(tabs.count()):
        if item.count():
            break
        tabs.nth(i).click()
    item.first.click()


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1366, "height": 900})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    step("signup: the sample menu includes Nasi Campur as an open-price item")
    page.goto(f"{BASE}/signup")
    page.fill("input[name=shopName]", "Kedai Kak Ros")
    page.fill("input[name=ownerName]", "Ros")
    page.fill("input[name=email]", "ros@kedai.my")
    page.fill("input[name=password]", "password123")
    page.fill("input[name=tables]", "2")
    page.click("button:has-text('Create kedai')")
    page.wait_for_url(f"{BASE}/app")
    nc = docs("menuItems", name="Nasi Campur")
    assert len(nc) == 1 and nc[0]["openPrice"] is True, nc

    step("menu screen labels it 'Price at counter'")
    page.goto(f"{BASE}/app/menu")
    expect(page.locator("li", has_text="Nasi Campur").get_by_text("Price at counter")).to_be_visible()

    step("owner adds a new open-price item with no usual price")
    page.get_by_role("button", name="+ Add item to Nasi & Mee").click()
    page.get_by_placeholder("e.g. Nasi Ayam Penyet").fill("Lauk Ikan")
    page.get_by_text("Price keyed in at the counter").click()
    page.get_by_role("button", name="Add to menu").click()
    expect(page.locator("li", has_text="Lauk Ikan").get_by_text("Price at counter")).to_be_visible()
    li = docs("menuItems", name="Lauk Ikan")
    assert len(li) == 1 and li[0]["openPrice"] is True and li[0]["price"] == 0, li

    step("a normal item still needs a price")
    page.get_by_role("button", name="+ Add item to Nasi & Mee").click()
    page.get_by_placeholder("e.g. Nasi Ayam Penyet").fill("Mee Rebus")
    page.get_by_role("button", name="Add to menu").click()
    expect(page.get_by_text("Enter a price, e.g. 8.50.")).to_be_visible()
    page.keyboard.press("Escape")

    step("customers don't see open-price items on the QR menu")
    table = docs("tables")[0]
    slug = docs("tenants")[0]["slug"]
    cust = browser.new_context(viewport={"width": 390, "height": 844}).new_page()
    cust.goto(f"{BASE}/t/{slug}/{table['token']}")
    expect(cust.get_by_text("Nasi Goreng Kampung").first).to_be_visible()
    expect(cust.get_by_text("Nasi Campur")).to_have_count(0)
    expect(cust.get_by_text("Lauk Ikan")).to_have_count(0)

    step("a tampered QR order for Nasi Campur, with a price of 1 sen, is refused by the server")
    nasi_goreng = docs("menuItems", name="Nasi Goreng Kampung")[0]["_id"]
    nasi_campur = nc[0]["_id"]

    def swap(route):
        body = route.request.post_data or ""
        if route.request.method == "POST" and nasi_goreng in body:
            body = body.replace(f'"menuItemId":"{nasi_goreng}"', f'"menuItemId":"{nasi_campur}","price":1')
            route.continue_(post_data=body)
        else:
            route.continue_()

    cust.route("**/t/**", swap)
    cust.get_by_role("button", name="Nasi Goreng Kampung").first.click()
    cust.get_by_role("button", name="Add · RM 7.50").click()
    cust.get_by_role("button", name="View order").click()
    cust.get_by_role("button", name="Send order to kitchen").click()
    expect(cust.get_by_text("Nasi Campur is priced at the counter. Please order it there.")).to_be_visible()
    assert docs("orders") == [], "no order should be created"

    step("counter: Nasi Campur asks for the price before it can be added")
    page.goto(f"{BASE}/app/pos/new")
    tap(page, "Nasi Campur")
    dialog = page.get_by_role("dialog", name="Nasi Campur")
    expect(dialog.get_by_role("button", name="Enter the price")).to_be_disabled()
    dialog.get_by_label("Price (RM)").fill("8.50")
    dialog.get_by_placeholder("What's on the plate (optional)").fill("ayam, sayur")
    expect(dialog.get_by_role("button", name="Add · RM 8.50")).to_be_enabled()
    dialog.get_by_label("Price (RM)").press("Enter")  # Enter adds it, for quick keying
    expect(dialog).to_have_count(0)

    step("a second plate at a different price is its own line; a quick button fills the price")
    tap(page, "Nasi Campur")
    page.get_by_role("dialog").get_by_role("button", name="6.00").click()
    page.get_by_role("dialog").get_by_role("button", name="Add · RM 6.00").click()
    tap(page, "Nasi Campur")
    page.get_by_role("dialog").get_by_role("button", name="6.00").click()
    page.get_by_role("dialog").get_by_role("button", name="Add · RM 6.00").click()
    expect(page.locator("aside li", has_text="Nasi Campur")).to_have_count(2)
    expect(page.locator("aside dl").get_by_text("RM 20.50").last).to_be_visible()

    step("sent order keeps the typed prices")
    page.get_by_role("button", name="Send to kitchen & bill").click()
    page.wait_for_url(f"{BASE}/app/orders/**")
    order = docs("orders")[0]
    got = sorted((i["unitPrice"], i["qty"], i["note"]) for i in order["items"])
    assert got == [(600, 2, None), (850, 1, "ayam, sayur")], got
    assert order["subtotal"] == 2050, order

    step("pays like any other bill")
    page.get_by_role("button", name="Cash", exact=True).click()
    page.get_by_role("button", name="Exact").click()
    page.get_by_role("button", name="Receive RM 20.50").click()
    expect(page.get_by_text("Paid").first).to_be_visible()

    step("offline: an open-price order is saved with its price and sent later")
    page.goto(f"{BASE}/app/pos/new")
    ctx.set_offline(True)
    tap(page, "Lauk Ikan")
    page.get_by_role("dialog").get_by_label("Price (RM)").fill("4.20")
    page.get_by_role("dialog").get_by_role("button", name="Add · RM 4.20").click()
    page.get_by_role("button", name="Save order on this device").click()
    expect(page.get_by_text("Saved on this device: ")).to_be_visible()
    ctx.set_offline(False)
    expect(page.get_by_text("waiting for internet")).to_have_count(0, timeout=20000)
    late = [o for o in docs("orders") if o.get("queuedAt")]
    assert len(late) == 1 and late[0]["items"][0]["unitPrice"] == 420, late

    assert not errors, errors
    print("PASS: open-price items")
    browser.close()
