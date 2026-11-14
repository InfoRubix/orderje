"""
Offline counter orders: the counter keeps taking orders with no internet, saves them on the
device, and sends them when the internet is back, without ever making the same order twice.

Runs against the Firestore emulator and WIPES it first, like tests/e2e.py.

    npm run emulators                     # terminal 1
    npm run build && npm start            # terminal 2 (production build: the service worker only runs there)
    python3 tests/offline.py
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


def sold_out(name):
    """Marks a menu item sold out straight in the database (another staff member, still online)."""
    js = f"""
    const {{ initializeApp }} = require('firebase-admin/app');
    const {{ getFirestore }} = require('firebase-admin/firestore');
    initializeApp({{ projectId: process.env.FIREBASE_PROJECT_ID }});
    getFirestore().collectionGroup('menuItems').where('name', '==', {json.dumps(name)}).get()
      .then((qs) => Promise.all(qs.docs.map((d) => d.ref.update({{ available: false }}))));
    """
    subprocess.run(["node", "-e", js], cwd=ROOT, env=ENV, check=True)


def first_plain_item(page):
    """A menu button with no add-on choices, so one tap adds it."""
    page.locator("section button.min-h-24").first.wait_for()
    tabs = page.locator("section > div.mb-4 > button")
    for i in range(tabs.count()):
        tabs.nth(i).click()
        btn = page.locator("section button.min-h-24").filter(has_not_text="+ options").filter(has_not_text="Key in price")
        if btn.count():
            name = btn.first.locator("span").first.inner_text()
            btn.first.click()
            return name
    raise AssertionError("no menu item without add-ons")


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1366, "height": 900})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    step("signup with the sample menu")
    page.goto(f"{BASE}/signup")
    page.fill("input[name=shopName]", "Kedai Kak Ros")
    page.fill("input[name=ownerName]", "Ros")
    page.fill("input[name=email]", "ros@kedai.my")
    page.fill("input[name=password]", "password123")
    page.fill("input[name=tables]", "4")
    page.click("button:has-text('Create kedai')")
    page.wait_for_url(f"{BASE}/app")

    step("open the counter online once, so the service worker keeps a copy")
    page.goto(f"{BASE}/app/pos/new")
    page.evaluate("navigator.serviceWorker.ready")
    page.reload()  # now controlled by the worker, which stores this page
    page.wait_for_function("navigator.serviceWorker.controller !== null")
    expect(page.get_by_role("heading", name="New order")).to_be_visible()

    step("internet drops: the order is saved on the device, not lost")
    ctx.set_offline(True)
    expect(page.get_by_text("No internet.")).to_be_visible()
    item1 = first_plain_item(page)
    page.get_by_placeholder("Customer name (optional)").fill("Pakcik Hamid")
    page.get_by_role("button", name="Save order on this device").click()
    expect(page.get_by_text("Saved on this device: Pakcik Hamid")).to_be_visible()
    expect(page.get_by_text("1 order saved on this device, waiting for internet.")).to_be_visible()
    assert docs("orders") == [], "nothing should reach the server while offline"

    step("refresh with no internet: the counter still opens and takes a second order")
    page.reload()
    expect(page.get_by_role("heading", name="New order")).to_be_visible()
    item2 = first_plain_item(page)
    page.get_by_role("button", name="Save order on this device").click()
    expect(page.get_by_text("2 orders saved on this device, waiting for internet.")).to_be_visible()

    step("meanwhile someone marks the first item sold out; the order already served must still go in")
    sold_out(item1)

    step("internet back: both orders are sent and the banner clears")
    ctx.set_offline(False)
    expect(page.get_by_text("waiting for internet")).to_have_count(0, timeout=20000)
    orders = sorted(docs("orders"), key=lambda o: o["orderNo"])
    assert len(orders) == 2, orders
    assert [o["items"][0]["name"] for o in orders] == [item1, item2], orders
    assert all(o["source"] == "counter" and o["queuedAt"] for o in orders), orders
    assert orders[0]["customerName"] == "Pakcik Hamid"
    assert all(o["queuedAt"] <= o["createdAt"] for o in orders), orders

    step("the same saved order sent again never makes a second one")
    page.evaluate("""() => {
      const q = [{ clientId: %s, tenantId: %s, queuedAt: new Date().toISOString(), label: 'again', total: 0,
                   input: { orderType: 'takeaway', tableId: null, lines: [{ menuItemId: %s, qty: 1, optionIds: [] }] } }];
      localStorage.setItem('orderterus:offline-orders:v1', JSON.stringify(q));
      window.dispatchEvent(new Event('orderterus:offline-orders'));
    }""" % (json.dumps(orders[1]["_id"]), json.dumps(orders[1]["tenantId"]), json.dumps(orders[1]["items"][0]["menuItemId"])))
    expect(page.get_by_text("waiting for internet")).to_have_count(0, timeout=20000)
    assert len(docs("orders")) == 2, "a retry of an order that already arrived must not duplicate it"

    step("reply lost on a bad line: the server got the order, the device thinks it failed")
    page.goto(f"{BASE}/app/pos/new")
    item3 = first_plain_item(page)
    state = {"done": False}

    def drop_reply(route):
        if route.request.method == "POST" and not state["done"]:
            state["done"] = True
            route.fetch()  # reaches the server and creates the order...
            route.abort()  # ...but the answer never comes back
        else:
            route.continue_()

    page.route("**/app/pos/new", drop_reply)
    page.get_by_role("button", name="Send to kitchen & bill").click()
    expect(page.get_by_text("Saved on this device")).to_be_visible()
    page.unroute("**/app/pos/new")
    # Still online, so the saved copy is retried on its own within seconds.
    expect(page.get_by_text("waiting for internet")).to_have_count(0, timeout=20000)
    third = [o for o in docs("orders") if o["orderNo"] == 3]
    assert len(docs("orders")) == 3 and third[0]["items"][0]["name"] == item3, docs("orders")

    step("kitchen sees the late orders marked as taken offline")
    page.goto(f"{BASE}/app/kitchen")
    expect(page.get_by_text("Taken offline at").first).to_be_visible()
    api = page.request.get(f"{BASE}/api/kitchen").json()
    # #3 reached the server on the first try, so it isn't marked offline.
    assert sorted(o["orderNo"] for o in api["orders"] if o["queuedAt"]) == [1, 2], api

    step("order page says when it was taken")
    page.goto(f"{BASE}/app/orders/{orders[0]['_id']}")
    expect(page.get_by_text("Taken offline at")).to_be_visible()

    step("online orders still go straight to the bill as before")
    page.goto(f"{BASE}/app/pos/new")
    first_plain_item(page)
    page.get_by_role("button", name="Send to kitchen & bill").click()
    page.wait_for_url(f"{BASE}/app/orders/**")
    fresh = [o for o in docs("orders") if o["orderNo"] == 4]
    assert len(fresh) == 1 and not fresh[0].get("queuedAt"), fresh

    assert not errors, errors
    print("PASS: offline counter orders")
    browser.close()
