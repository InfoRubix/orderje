"""
End-to-end test of OrderJe: signup -> brand & menu photos -> QR order -> kitchen ->
counter payments (DuitNow QR, cash, credit) -> dashboard -> recon -> tenant isolation.

Runs against the Firestore emulator and WIPES it first. It refuses to run without one.

    pip install playwright && playwright install chromium
    npm run emulators                     # terminal 1
    npm run build && npm start            # terminal 2 (.env.local points at the emulator)
    python3 tests/e2e.py
"""
import json, os, re, subprocess, urllib.request
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE_URL", "http://localhost:3000")
EMU = os.environ.get("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080")
PROJECT = os.environ.get("FIREBASE_PROJECT_ID", "demo-orderje")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, "test-results")
QR = os.path.join(SHOTS, "duitnow.png")
os.makedirs(SHOTS, exist_ok=True)
urllib.request.urlopen(urllib.request.Request(
    f"http://{EMU}/emulator/v1/projects/{PROJECT}/databases/(default)/documents", method="DELETE"))
subprocess.run(["node", "-e", f"require('qrcode').toFile({QR!r}, 'DUITNOW-DEMO', {{width: 400}})"], check=True, cwd=ROOT)


def dump():
    env = {**os.environ, "FIRESTORE_EMULATOR_HOST": EMU, "FIREBASE_PROJECT_ID": PROJECT}
    out = subprocess.run(["node", "tests/fsdump.mjs"], capture_output=True, text=True, cwd=ROOT, env=env, check=True)
    return json.loads(out.stdout)


def docs(collection, **match):
    """Documents in any collection with this name (e.g. "orders" under any tenant), filtered by field values."""
    return [d for path, d in dump().items()
            if path.split("/")[-2] == collection and all(d.get(k) == v for k, v in match.items())]


def one(collection, **match):
    found = docs(collection, **match)
    assert len(found) == 1, (collection, match, found)
    return found[0]


def pick(d, *keys):
    return tuple(d[k] for k in keys)


def step(name):
    print(f"--- {name}", flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch()
    owner = browser.new_context(viewport={"width": 1366, "height": 900})
    page = owner.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))

    step("signup")
    page.goto(f"{BASE}/signup")
    page.fill("input[name=shopName]", "Restoran Ali Maju")
    page.fill("input[name=ownerName]", "Ali")
    page.fill("input[name=email]", "ali@alimaju.my")
    page.fill("input[name=password]", "password123")
    page.fill("input[name=tables]", "6")
    page.click("button:has-text('Create kedai')")
    page.wait_for_url(f"{BASE}/app")
    slug = one("tenants", name="Restoran Ali Maju")["slug"]
    assert slug == "restoran-ali-maju", slug
    assert len(docs("menuItems")) > 0

    step("brand & profile: logo, tagline, colour")
    page.goto(f"{BASE}/app/brand")
    page.fill("input[name=tagline]", "Mamak 24 jam sejak 1998")
    page.fill("input[name=address]", "12, Jalan 8/35, Seri Bangi")
    page.fill("input[name=phone]", "03-8920 1234")
    page.get_by_role("button", name="Biru laut").click()
    page.set_input_files("input[aria-label='Upload logo']", QR)
    expect(page.get_by_alt_text("Current logo")).to_be_visible()
    page.screenshot(path=f"{SHOTS}/00-brand.png", full_page=True)
    page.get_by_role("button", name="Save", exact=True).click()
    expect(page.get_by_text("Saved. Customers see it straight away.")).to_be_visible()
    t = one("tenants")
    assert (t["brandColor"], t["tagline"]) == ("#1f5f9e", "Mamak 24 jam sejak 1998"), t
    logo = urllib.request.urlopen(BASE + t["logoUrl"])
    assert logo.status == 200 and logo.headers["Content-Type"] == "image/png", t["logoUrl"]
    assert len(docs("images", tenantId=t["_id"])) == 1

    step("settings: SST 6%, service 10%")
    page.goto(f"{BASE}/app/settings")
    page.fill("input[name=sstRate]", "6")
    page.fill("input[name=serviceChargeRate]", "10")
    page.click("button:has-text('Save settings')")
    expect(page.get_by_text("Settings saved.")).to_be_visible()
    t = one("tenants")
    assert (t["sstRate"], t["serviceChargeRate"]) == (600, 1000), t

    step("add member + corporate customers")
    page.goto(f"{BASE}/app/customers?type=member")
    page.fill("input[name=name]", "Siti Member")
    page.fill("input[name=phone]", "0123456789")
    page.click("form button:has-text('Add')")
    expect(page.get_by_text("Customer added.")).to_be_visible()
    page.goto(f"{BASE}/app/customers?type=corporate")
    page.fill("input[name=name]", "Encik Rahman")
    page.fill("input[name=company]", "Syarikat Bina Jaya")
    page.fill("input[name=creditLimit]", "300")
    page.click("form button:has-text('Add')")
    expect(page.get_by_text("Customer added.")).to_be_visible()

    step("add staff cashier")
    page.goto(f"{BASE}/app/staff")
    page.fill("input[name=name]", "Mei Ling")
    page.fill("input[name=email]", "cashier@alimaju.my")
    page.fill("input[name=password]", "password123")
    page.click("button:has-text('Add staff')")
    expect(page.get_by_text("Mei Ling can now log in.")).to_be_visible()

    step("menu: photo upload, add item in the popup, reorder categories")
    page.goto(f"{BASE}/app/menu")
    page.get_by_role("button", name="Edit Nasi Lemak Biasa").click()
    page.set_input_files("input[aria-label='Upload photo']", QR)
    page.get_by_role("button", name="Save changes").click()
    expect(page.get_by_text("Nasi Lemak Biasa saved")).to_be_visible()
    nl = one("menuItems", name="Nasi Lemak Biasa")
    assert nl["imagePath"] and urllib.request.urlopen(BASE + nl["imageUrl"]).status == 200, nl
    assert len(nl["groups"]) == 1 and nl["groups"][0]["name"] == "Lauk tambah", nl["groups"]
    page.get_by_role("button", name="+ Add item to Minuman").click()
    page.get_by_placeholder("e.g. Nasi Ayam Penyet").fill("Air Kosong")
    page.get_by_placeholder("8.50").fill("0.50")
    page.get_by_role("button", name="Add to menu").click()
    expect(page.get_by_text("Air Kosong added to the menu")).to_be_visible()
    page.get_by_role("button", name="Move Minuman up").click()
    page.wait_for_timeout(1500)
    cats = {d["name"]: d["sort"] for d in docs("categories")}
    assert cats["Minuman"] < cats["Roti"], cats
    page.screenshot(path=f"{SHOTS}/05b-menu.png", full_page=True)

    step("tables page renders QR")
    page.goto(f"{BASE}/app/tables")
    assert page.locator("svg").count() >= 7
    page.screenshot(path=f"{SHOTS}/06-tables.png", full_page=True)

    # ------------------------------------------------------------ customer on phone
    step("customer QR order at Meja 3")
    token = one("tables", label="Meja 3")["token"]
    phone = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    c = phone.new_page()
    c.on("pageerror", lambda e: errors.append(str(e)))
    c.goto(f"{BASE}/t/{slug}/{token}")
    expect(c.get_by_text("You're at Meja 3")).to_be_visible()
    expect(c.get_by_text("Mamak 24 jam sejak 1998")).to_be_visible()
    expect(c.get_by_alt_text("Restoran Ali Maju logo")).to_be_visible()
    c.screenshot(path=f"{SHOTS}/01-customer-menu.png")
    c.get_by_role("button", name=re.compile("Nasi Lemak Biasa")).click()
    c.get_by_label("Telur mata").check()
    c.screenshot(path=f"{SHOTS}/02-customer-item.png")
    c.get_by_role("button", name=re.compile(r"^Add · RM 5\.00")).click()
    c.get_by_role("button", name=re.compile("^Teh Tarik")).click()
    btn = c.get_by_role("button", name="Choose Panas / Ais")
    expect(btn).to_be_disabled()
    c.get_by_label("Ais").check()
    c.get_by_role("button", name=re.compile(r"^Add · RM 3\.00")).click()
    c.get_by_role("button", name=re.compile("View order")).click()
    c.get_by_placeholder("Your name (optional)").fill("Farid")
    c.screenshot(path=f"{SHOTS}/03-customer-cart.png")
    c.get_by_role("button", name="Send order to kitchen").click()
    c.wait_for_url(re.compile(r"/o/"))
    expect(c.get_by_role("heading", name="Order #1")).to_be_visible()
    # subtotal 8.00, service 0.80, sst 6% of 8.80 = 0.53 -> 9.33
    o1 = one("orders", orderNo=1)
    assert pick(o1, "subtotal", "serviceCharge", "sst", "total", "source", "orderType") == (800, 80, 53, 933, "qr", "dine_in"), o1
    c.screenshot(path=f"{SHOTS}/04-customer-tracking.png", full_page=True)
    order_url = c.url

    step("timestamps stored in UTC")
    created = datetime.fromisoformat(o1["createdAt"].replace("Z", "+00:00"))
    drift = abs((datetime.now(timezone.utc) - created).total_seconds())
    assert drift < 120, f"created_at drift {drift}s"

    step("price tampering is impossible: server prices from DB")
    assert [i["unitPrice"] for i in o1["items"] if i["name"] == "Nasi Lemak Biasa"] == [500], o1["items"]

    step("kitchen board")
    page.goto(f"{BASE}/app/kitchen")
    expect(page.get_by_text("#1", exact=True)).to_be_visible()
    expect(page.get_by_text("Telur mata")).to_be_visible()
    page.screenshot(path=f"{SHOTS}/05-kitchen.png")
    page.get_by_role("button", name="Start cooking").click()
    page.wait_for_timeout(1500)
    page.get_by_role("button", name="Mark ready").click()
    page.wait_for_timeout(1500)
    assert one("orders", orderNo=1)["status"] == "ready"

    step("customer is told to pay at the counter")
    c.reload()
    expect(c.get_by_text("Please pay at the counter")).to_be_visible()
    c.screenshot(path=f"{SHOTS}/07-customer-pay-at-counter.png", full_page=True)

    step("counter takes DuitNow QR with bank ref")
    page.goto(f"{BASE}/app/pos")
    expect(page.get_by_text("Unpaid bills (1)")).to_be_visible()
    page.screenshot(path=f"{SHOTS}/08-counter.png", full_page=True)
    page.get_by_role("link", name=re.compile("Meja 3")).first.click()
    page.wait_for_url(re.compile(r"/app/orders/"))
    page.get_by_role("button", name="DuitNow QR", exact=True).click()
    receive = page.get_by_role("button", name=re.compile(r"^Receive RM 9\.33"))
    expect(receive).to_be_disabled()  # bank reference is required
    page.get_by_placeholder("Bank reference (last 4–6 digits)").fill("88231")
    receive.click()
    page.wait_for_timeout(1500)
    o1 = one("orders", orderNo=1)
    assert o1["paymentStatus"] == "paid", o1
    assert one("payments", method="duitnow_qr")["reference"] == "88231"
    c.reload()
    expect(c.get_by_text("Paid. Terima kasih!")).to_be_visible()

    step("counter order: takeaway for member, cash with change")
    page.goto(f"{BASE}/app/pos/new")
    page.get_by_role("button", name="Takeaway", exact=True).click()
    page.get_by_role("button", name=re.compile("^Nasi Goreng Kampung")).click()
    page.get_by_role("button", name=re.compile("^Nasi Goreng Kampung")).click()
    page.get_by_role("button", name=re.compile("^Roti")).first.click()  # category tab
    page.get_by_role("button", name=re.compile("^Roti Canai")).click()
    page.screenshot(path=f"{SHOTS}/09-counter-new-order.png")
    page.get_by_role("button", name="Send to kitchen & bill").click()
    page.wait_for_url(re.compile(r"/app/orders/"))
    # takeaway: no service charge. 2x7.50 + 1.50 = 16.50, sst 0.99 -> 17.49
    assert one("orders", orderNo=2)["total"] == 1749
    page.get_by_role("button", name="Member", exact=True).click()
    page.get_by_label("Customer").select_option(label="Siti Member · 0123456789")
    page.get_by_role("button", name="Apply member pricing").click()
    page.wait_for_timeout(1500)
    # 5% off 16.50 = 0.83 -> 15.67, sst 0.94 -> 16.61
    o2 = one("orders", orderNo=2)
    assert pick(o2, "discount", "sst", "total", "customerType") == (83, 94, 1661, "member"), o2
    page.get_by_label("Cash received").fill("20")
    expect(page.get_by_text("Change RM 3.40")).to_be_visible()  # cash rounds 16.61 -> 16.60
    page.screenshot(path=f"{SHOTS}/10-payment-panel.png")
    page.get_by_role("button", name=re.compile("^Receive RM 16.60")).click()
    expect(page.get_by_text("Give change")).to_be_visible()
    assert pick(one("orders", orderNo=2), "total", "rounding", "paymentStatus") == (1660, -1, "paid")
    assert pick(one("payments", method="cash"), "tendered", "changeGiven") == (2000, 340)
    page.screenshot(path=f"{SHOTS}/11-paid-change.png")

    step("receipt")
    rtoken = one("orders", orderNo=2)["publicToken"]
    r = owner.new_page()
    r.goto(f"{BASE}/r/{rtoken}")
    expect(r.get_by_text("Discount (Member)")).to_be_visible()
    r.screenshot(path=f"{SHOTS}/12-receipt.png", full_page=True)
    r.close()

    step("corporate credit order + limit + settlement")
    page.goto(f"{BASE}/app/pos/new?table=" + one("tables", label="Meja 1")["_id"])
    page.get_by_role("button", name=re.compile("^Mee Goreng Mamak")).click()
    page.get_by_role("button", name="Biasa", exact=True).click()
    page.get_by_role("button", name=re.compile(r"^Add · ")).click()
    page.get_by_role("button", name="Send to kitchen & bill").click()
    page.wait_for_url(re.compile(r"/app/orders/"))
    page.get_by_role("button", name="Corporate", exact=True).click()
    page.get_by_label("Customer").select_option(index=1)
    page.get_by_role("button", name="Apply corporate pricing").click()
    page.wait_for_timeout(1500)
    page.get_by_role("button", name=re.compile("^Charge RM")).click()
    expect(page.get_by_text("Charged to company account")).to_be_visible()
    assert one("orders", orderNo=3)["paymentStatus"] == "credit"

    step("cashier login + role limits")
    cashier = browser.new_context(viewport={"width": 1280, "height": 800})
    cp = cashier.new_page()
    cp.goto(f"{BASE}/login")
    cp.fill("input[name=email]", "cashier@alimaju.my")
    cp.fill("input[name=password]", "password123")
    cp.click("button:has-text('Log in')")
    cp.wait_for_url(f"{BASE}/app/pos")
    cp.goto(f"{BASE}/app/settings")
    cp.wait_for_url(f"{BASE}/app/pos")  # bounced
    cp.goto(f"{BASE}/app/customers?type=corporate")
    expect(cp.get_by_text("RM 8.16")).to_be_visible()  # 7.00 + 10% svc + 6% SST
    cashier.close()

    step("unpaid order blocks closing, then cancel it")
    page.goto(f"{BASE}/app/pos/new")
    page.get_by_role("button", name="Takeaway", exact=True).click()
    page.get_by_role("button", name=re.compile("^Roti")).first.click()
    page.get_by_role("button", name=re.compile("^Roti Telur")).click()
    page.get_by_role("button", name="Send to kitchen & bill").click()
    page.wait_for_url(re.compile(r"/app/orders/"))
    page.goto(f"{BASE}/app/recon")
    expect(page.get_by_text("Can't close yet")).to_be_visible()
    oid = one("orders", orderNo=4)["_id"]
    page.goto(f"{BASE}/app/orders/{oid}")
    page.once("dialog", lambda d: d.accept())
    page.get_by_role("button", name="Cancel order").click()
    page.wait_for_timeout(1500)
    assert one("orders", orderNo=4)["status"] == "cancelled"

    step("dashboard")
    page.goto(f"{BASE}/app")
    expect(page.get_by_text("3 paid orders")).to_be_visible()
    page.screenshot(path=f"{SHOTS}/13-dashboard.png", full_page=True)

    step("recon: close the day with RM 0.10 cash short")
    page.goto(f"{BASE}/app/recon")
    page.fill("input[name=openingFloat]", "50")
    page.fill("input[name=countedCash]", "66.50")  # expected 50 + 16.60 = 66.60
    page.fill("input[name=bankQr]", "9.33")
    expect(page.get_by_text("Short RM 0.10")).to_be_visible()
    page.screenshot(path=f"{SHOTS}/14-recon-form.png", full_page=True)
    page.fill("textarea[name=notes]", "10 sen short, probably change")
    page.get_by_role("button", name=re.compile("^Close ")).click()
    page.wait_for_timeout(1500)
    rec = one("reconciliations")
    assert pick(rec, "expectedCash", "countedCash", "openingFloat", "expectedQr", "bankQr", "creditSales") == (
        1660, 6650, 5000, 933, 933, one("orders", orderNo=3)["total"]), rec
    page.reload()
    page.screenshot(path=f"{SHOTS}/15-recon-closed.png", full_page=True)

    step("payments blocked after close")
    page.goto(f"{BASE}/app/pos/new")
    page.get_by_role("button", name="Takeaway", exact=True).click()
    page.get_by_role("button", name=re.compile("^Nasi Goreng Kampung")).click()
    page.get_by_role("button", name="Send to kitchen & bill").click()
    page.wait_for_url(re.compile(r"/app/orders/"))
    page.get_by_role("button", name=re.compile("^Receive RM")).click()
    expect(page.get_by_text("Today is already closed in Recon")).to_be_visible()

    step("tenant isolation: second kedai cannot see first kedai's order")
    other = browser.new_context()
    op = other.new_page()
    op.goto(f"{BASE}/signup")
    op.fill("input[name=shopName]", "Kedai Lain")
    op.fill("input[name=ownerName]", "Abu")
    op.fill("input[name=email]", "abu@lain.my")
    op.fill("input[name=password]", "password123")
    op.click("button:has-text('Create kedai')")
    op.wait_for_url(f"{BASE}/app")
    op.goto(f"{BASE}/app/orders/{oid}")
    expect(op.get_by_text("404")).to_be_visible()
    other.close()

    print("PAGE ERRORS:", errors)
    browser.close()
    print("ALL PASSED")
