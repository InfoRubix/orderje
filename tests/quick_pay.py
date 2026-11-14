"""
Pay now at the counter (order + payment in one step) and items that skip the kitchen board.

Runs against the Firestore emulator and WIPES it first, like tests/e2e.py.

    npm run emulators                     # terminal 1
    npm run build && npm start            # terminal 2
    python3 tests/quick_pay.py
"""
import json, os, re, subprocess, urllib.request
from datetime import datetime, timedelta, timezone
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


def node(js):
    subprocess.run(["node", "-e", """
      const { initializeApp } = require('firebase-admin/app');
      const { getFirestore } = require('firebase-admin/firestore');
      initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
      const db = getFirestore();
    """ + js], cwd=ROOT, env=ENV, check=True)


def step(name):
    print(f"--- {name}", flush=True)


def tap(page, name):
    item = page.locator("section button.min-h-24", has_text=name)
    tabs = page.locator("section > div.mb-4 > button")
    for i in range(tabs.count()):
        if item.count():
            break
        tabs.nth(i).click()
    item.first.click()


def nasi_campur(page, price):
    tap(page, "Nasi Campur")
    page.get_by_role("dialog").get_by_label("Price (RM)").fill(price)
    page.get_by_role("dialog").get_by_label("Price (RM)").press("Enter")


def teh_tarik(page):
    tap(page, "Teh Tarik")
    d = page.get_by_role("dialog")
    d.get_by_role("button", name="Panas", exact=True).click()
    d.get_by_role("button", name="Add · RM 2.50").click()


def kitchen(page):
    return page.request.get(f"{BASE}/api/kitchen").json()["orders"]


with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1366, "height": 900})
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    step("signup: sample Nasi Campur skips the kitchen")
    page.goto(f"{BASE}/signup")
    page.fill("input[name=shopName]", "Kedai Kak Ros")
    page.fill("input[name=ownerName]", "Ros")
    page.fill("input[name=email]", "ros@kedai.my")
    page.fill("input[name=password]", "password123")
    page.fill("input[name=tables]", "2")
    page.click("button:has-text('Create kedai')")
    page.wait_for_url(f"{BASE}/app")
    assert docs("menuItems", name="Nasi Campur")[0]["skipKitchen"] is True
    tenant_id = docs("tenants")[0]["_id"]

    step("pay now in cash: change shown, cart cleared, ready for the next customer")
    page.goto(f"{BASE}/app/pos/new")
    nasi_campur(page, "8.50")
    teh_tarik(page)
    page.get_by_role("button", name="Pay now · RM 11.00").click()
    page.get_by_role("button", name="20").click()
    expect(page.get_by_text("Change RM 9.00")).to_be_visible()
    page.get_by_role("button", name="Receive RM 11.00").click()
    expect(page.get_by_text("Paid · Order #1")).to_be_visible()
    expect(page.get_by_text("Change RM 9.00")).to_be_visible()
    expect(page.get_by_text("Tap items to add them.")).to_be_visible()
    assert page.url == f"{BASE}/app/pos/new", page.url
    o1 = docs("orders", orderNo=1)[0]
    assert o1["paymentStatus"] == "paid" and o1["paidMethod"] == "cash" and o1["total"] == 1100, o1
    pay1 = docs("payments", orderId=o1["_id"])
    assert len(pay1) == 1 and (pay1[0]["tendered"], pay1[0]["changeGiven"], pay1[0]["amount"]) == (2000, 900, 1100), pay1

    step("kitchen gets only the teh tarik, not the nasi campur")
    k = kitchen(page)
    assert [(o["orderNo"], [i["name"] for i in o["items"]]) for o in k] == [(1, ["Teh Tarik"])], k

    step("tapping the next item clears the last change")
    nasi_campur(page, "6.00")
    expect(page.get_by_text("Paid · Order #1")).to_have_count(0)

    step("only nasi campur: never reaches the kitchen, marked served")
    page.get_by_role("button", name="Pay now · RM 6.00").click()
    page.get_by_role("button", name="Exact").click()
    page.get_by_role("button", name="Receive RM 6.00").click()
    expect(page.get_by_text("Paid · Order #2")).to_be_visible()
    o2 = docs("orders", orderNo=2)[0]
    assert o2["status"] == "served" and o2["paymentStatus"] == "paid", o2
    assert 2 not in [o["orderNo"] for o in kitchen(page)]

    step("pay now by DuitNow QR needs the bank reference")
    teh_tarik(page)
    page.get_by_role("button", name="Pay now · RM 2.50").click()
    page.get_by_role("button", name="DuitNow QR").click()
    expect(page.get_by_role("button", name="Receive RM 2.50")).to_be_disabled()
    page.get_by_placeholder("Bank reference (last 4–6 digits)").fill("77120")
    page.get_by_role("button", name="Receive RM 2.50").click()
    expect(page.get_by_text("Paid · Order #3")).to_be_visible()
    o3 = docs("orders", orderNo=3)[0]
    assert o3["paidMethod"] == "duitnow_qr" and o3["total"] == 250, o3

    step("bill later still works as before")
    teh_tarik(page)
    page.get_by_role("button", name="Send to kitchen & bill").click()
    page.wait_for_url(f"{BASE}/app/orders/**")
    assert docs("orders", orderNo=4)[0]["paymentStatus"] == "unpaid"

    step("owner ticks 'Don't send to kitchen' on Limau Ais")
    page.goto(f"{BASE}/app/menu")
    page.get_by_role("button", name="Edit Limau Ais").click()
    page.get_by_text("Don't send to kitchen").click()
    page.get_by_role("button", name="Save changes").click()
    expect(page.locator("li", has_text="Limau Ais").get_by_text("Not sent to kitchen")).to_be_visible()

    step("a QR order for Limau Ais still shows in the kitchen (someone has to see it)")
    table = docs("tables")[0]
    slug = docs("tenants")[0]["slug"]
    cust = browser.new_context(viewport={"width": 390, "height": 844}).new_page()
    cust.goto(f"{BASE}/t/{slug}/{table['token']}")
    cust.get_by_role("button", name=re.compile("Limau Ais")).first.click()
    cust.get_by_role("button", name=re.compile(r"^Add · RM 2\.50")).click()
    cust.get_by_role("button", name=re.compile("View order")).click()
    cust.get_by_role("button", name="Send order to kitchen").click()
    cust.wait_for_url("**/o/**")
    k = kitchen(page)
    assert any(o["orderNo"] == 5 and [i["name"] for i in o["items"]] == ["Limau Ais"] for o in k), k

    step("reply lost while paying: the retry never pays twice")
    page.goto(f"{BASE}/app/pos/new")
    nasi_campur(page, "7.00")
    page.get_by_role("button", name="Pay now · RM 7.00").click()
    page.get_by_role("button", name="Exact").click()
    state = {"done": False}

    def drop_reply(route):
        if route.request.method == "POST" and not state["done"]:
            state["done"] = True
            route.fetch()  # order made AND paid on the server...
            route.abort()  # ...but the answer is lost
        else:
            route.continue_()

    page.route("**/app/pos/new", drop_reply)
    page.get_by_role("button", name="Receive RM 7.00").click()
    expect(page.get_by_text("Paid in cash and saved on this device")).to_be_visible()
    page.unroute("**/app/pos/new")
    expect(page.get_by_text("waiting for internet")).to_have_count(0, timeout=20000)
    o6 = docs("orders", orderNo=6)
    assert len(o6) == 1 and o6[0]["paymentStatus"] == "paid", o6
    assert len(docs("payments", orderId=o6[0]["_id"])) == 1, "paid exactly once"
    assert len(docs("orders")) == 6

    step("offline: pay now takes cash only, and the payment is recorded when sent")
    page.goto(f"{BASE}/app/pos/new")
    ctx.set_offline(True)
    nasi_campur(page, "9.20")
    page.get_by_role("button", name="Pay now · RM 9.20").click()
    expect(page.get_by_role("button", name="DuitNow QR")).to_be_disabled()
    page.get_by_role("button", name="10", exact=True).click()
    page.get_by_role("button", name="Receive RM 9.20").click()
    expect(page.get_by_text("Change RM 0.80. Paid in cash and saved on this device")).to_be_visible()
    assert len(docs("orders")) == 6
    ctx.set_offline(False)
    expect(page.get_by_text("waiting for internet")).to_have_count(0, timeout=20000)
    o7 = docs("orders", orderNo=7)[0]
    assert o7["queuedAt"] and o7["paymentStatus"] == "paid", o7
    p7 = docs("payments", orderId=o7["_id"])
    assert len(p7) == 1 and (p7[0]["tendered"], p7[0]["changeGiven"]) == (1000, 80), p7

    step("day already closed in Recon: pay now is refused and no unpaid bill is left behind")
    today = (datetime.now(timezone.utc) + timedelta(hours=8)).strftime("%Y-%m-%d")
    node(f"db.doc('tenants/{tenant_id}/reconciliations/{today}').set({{ tenantId: '{tenant_id}', businessDate: '{today}', "
         "openingFloat: 0, expectedCash: 0, countedCash: 0, expectedQr: 0, bankQr: 0, creditSales: 0, notes: null, "
         "closedBy: 'test', createdAt: new Date() });")
    nasi_campur(page, "5.00")
    page.get_by_role("button", name="Pay now · RM 5.00").click()
    page.get_by_role("button", name="Exact").click()
    page.get_by_role("button", name="Receive RM 5.00").click()
    expect(page.get_by_text("Today is already closed in Recon")).to_be_visible()
    assert len(docs("orders")) == 7

    assert not errors, errors
    print("PASS: pay now and skip kitchen")
    browser.close()
