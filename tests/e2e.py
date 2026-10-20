"""
End-to-end test of OrderJe: signup -> QR order -> kitchen -> QR/cash/credit payments
-> dashboard -> recon -> tenant isolation.

WARNING: drops and recreates the database named in TEST_DB. Never point it at production.

    pip install playwright && playwright install chromium
    npm run build && npm start            # in another terminal
    TEST_DB=orderje python3 tests/e2e.py
"""
import re, subprocess, sys
from playwright.sync_api import sync_playwright, expect

import os
BASE = os.environ.get("BASE_URL", "http://localhost:3000")
DB = os.environ.get("TEST_DB", "orderje")
MYSQL = os.environ.get("MYSQL_CMD", "mysql -uroot").split()
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, "test-results")
QR = os.path.join(SHOTS, "duitnow.png")
subprocess.run(["mkdir", "-p", SHOTS])
subprocess.run([*MYSQL, "-e", f"drop database if exists {DB}; create database {DB} character set utf8mb4;"], check=True)
subprocess.run("set -a && . ./.env.local && npx tsx scripts/migrate.ts", shell=True, check=True, cwd=ROOT)
subprocess.run(["node", "-e", f"require('qrcode').toFile({QR!r}, 'DUITNOW-DEMO', {{width: 400}})"], check=True, cwd=ROOT)


def sql(q):
    return subprocess.run([*MYSQL, DB, "-N", "-e", q], capture_output=True, text=True).stdout.strip()


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
    slug = sql("select slug from tenants where name='Restoran Ali Maju'")
    assert slug == "restoran-ali-maju", slug
    assert sql("select count(*) from menu_items") != "0"

    step("settings: SST 6%, service 10%, DuitNow QR")
    page.goto(f"{BASE}/app/settings")
    page.fill("input[name=address]", "12, Jalan 8/35, Seri Bangi")
    page.fill("input[name=phone]", "03-8920 1234")
    page.fill("input[name=sstRate]", "6")
    page.fill("input[name=serviceChargeRate]", "10")
    page.set_input_files("input[name=duitnowQr]", QR)
    page.click("button:has-text('Save settings')")
    expect(page.get_by_text("Settings saved.")).to_be_visible()
    assert sql("select sst_rate, service_charge_rate, duitnow_qr_url is not null from tenants") == "600\t1000\t1"

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

    step("tables page renders QR")
    page.goto(f"{BASE}/app/tables")
    assert page.locator("svg").count() >= 7
    page.screenshot(path=f"{SHOTS}/06-tables.png", full_page=True)

    # ------------------------------------------------------------ customer on phone
    step("customer QR order at Meja 3")
    token = sql("select token from dining_tables where label='Meja 3'")
    phone = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    c = phone.new_page()
    c.on("pageerror", lambda e: errors.append(str(e)))
    c.goto(f"{BASE}/t/{slug}/{token}")
    expect(c.get_by_text("You're at Meja 3")).to_be_visible()
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
    expect(c.get_by_text("Order #1")).to_be_visible()
    # subtotal 8.00, service 0.80, sst 6% of 8.80 = 0.53 -> 9.33
    assert sql("select subtotal, service_charge, sst, total, source, order_type from orders where order_no=1") == "800\t80\t53\t933\tqr\tdine_in", sql("select subtotal, service_charge, sst, total from orders")
    c.screenshot(path=f"{SHOTS}/04-customer-tracking.png", full_page=True)
    order_url = c.url

    step("timestamps stored in UTC")
    drift = int(sql("select abs(timestampdiff(second, created_at, utc_timestamp())) from orders where order_no=1"))
    assert drift < 120, f"created_at drift {drift}s"

    step("price tampering is impossible: server prices from DB")
    assert sql("select unit_price from order_items where name='Nasi Lemak Biasa'") == "500"

    step("kitchen board")
    page.goto(f"{BASE}/app/kitchen")
    expect(page.get_by_text("#1", exact=True)).to_be_visible()
    expect(page.get_by_text("Telur mata")).to_be_visible()
    page.screenshot(path=f"{SHOTS}/05-kitchen.png")
    page.get_by_role("button", name="Start cooking").click()
    page.wait_for_timeout(1500)
    page.get_by_role("button", name="Mark ready").click()
    page.wait_for_timeout(1500)
    assert sql("select status from orders where order_no=1") == "ready"

    step("customer sees Ready, pays by DuitNow QR")
    c.reload()
    c.get_by_role("button", name="Pay with DuitNow QR").click()
    expect(c.get_by_alt_text("DuitNow QR code")).to_be_visible()
    c.get_by_role("button", name="I've paid").click()
    expect(c.get_by_text("Waiting for the counter to confirm")).to_be_visible()
    c.screenshot(path=f"{SHOTS}/07-customer-qr-pending.png", full_page=True)
    assert sql("select payment_status from orders where order_no=1") == "pending"

    step("counter confirms QR with bank ref")
    page.goto(f"{BASE}/app/pos")
    expect(page.get_by_text("Confirm payments (1)")).to_be_visible()
    page.screenshot(path=f"{SHOTS}/08-counter.png", full_page=True)
    page.get_by_role("button", name="Received", exact=True).click()
    expect(page.get_by_text("Enter the bank reference before confirming.")).to_be_visible()
    page.get_by_label("Bank reference").fill("88231")
    page.get_by_role("button", name="Received", exact=True).click()
    page.wait_for_timeout(1500)
    assert sql("select payment_status from orders where order_no=1") == "paid"
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
    assert sql("select total from orders where order_no=2") == "1749"
    page.get_by_role("button", name="Member", exact=True).click()
    page.get_by_label("Customer").select_option(label="Siti Member · 0123456789")
    page.get_by_role("button", name="Apply member pricing").click()
    page.wait_for_timeout(1500)
    # 5% off 16.50 = 0.83 -> 15.67, sst 0.94 -> 16.61
    assert sql("select discount, sst, total, customer_type from orders where order_no=2") == "83\t94\t1661\tmember", sql("select discount, sst, total, customer_type from orders where order_no=2")
    page.get_by_label("Cash received").fill("20")
    expect(page.get_by_text("Change RM 3.40")).to_be_visible()  # cash rounds 16.61 -> 16.60
    page.screenshot(path=f"{SHOTS}/10-payment-panel.png")
    page.get_by_role("button", name=re.compile("^Receive RM 16.60")).click()
    expect(page.get_by_text("Give change")).to_be_visible()
    assert sql("select total, rounding, payment_status from orders where order_no=2") == "1660\t-1\tpaid"
    assert sql("select tendered, change_given from payments where method='cash'") == "2000\t340"
    page.screenshot(path=f"{SHOTS}/11-paid-change.png")

    step("receipt")
    rtoken = sql("select public_token from orders where order_no=2")
    r = owner.new_page()
    r.goto(f"{BASE}/r/{rtoken}")
    expect(r.get_by_text("Discount (Member)")).to_be_visible()
    r.screenshot(path=f"{SHOTS}/12-receipt.png", full_page=True)
    r.close()

    step("corporate credit order + limit + settlement")
    page.goto(f"{BASE}/app/pos/new?table=" + sql("select id from dining_tables where label='Meja 1'"))
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
    assert sql("select payment_status from orders where order_no=3") == "credit"

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
    oid = sql("select id from orders where order_no=4")
    page.goto(f"{BASE}/app/orders/{oid}")
    page.once("dialog", lambda d: d.accept())
    page.get_by_role("button", name="Cancel order").click()
    page.wait_for_timeout(1500)
    assert sql("select status from orders where order_no=4") == "cancelled"

    step("dashboard")
    page.goto(f"{BASE}/app")
    expect(page.get_by_text("3 paid orders")).to_be_visible()
    page.screenshot(path=f"{SHOTS}/13-dashboard.png", full_page=True)

    step("recon: close the day with RM 0.10 cash short")
    page.goto(f"{BASE}/app/recon")
    page.fill("input[name=openingFloat]", "50")
    page.fill("input[name=countedCash]", "66.50")  # expected 50 + 16.60 = 66.60
    page.fill("input[name=bankQr]", "9.33")
    page.fill("input[name=gatewayOnline]", "0")
    expect(page.get_by_text("Short RM 0.10")).to_be_visible()
    page.screenshot(path=f"{SHOTS}/14-recon-form.png", full_page=True)
    page.fill("textarea[name=notes]", "10 sen short, probably change")
    page.get_by_role("button", name=re.compile("^Close ")).click()
    page.wait_for_timeout(1500)
    assert sql("select expected_cash, counted_cash, opening_float, expected_qr, bank_qr, credit_sales from reconciliations") == "1660\t6650\t5000\t933\t933\t" + sql("select total from orders where order_no=3")
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
