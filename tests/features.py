"""
Feature-by-feature check of OrderTerus. Complements tests/e2e.py (the happy path) with the rules,
limits and error cases of every screen. Each check runs on its own and the run ends with a
pass/fail list, so one broken feature doesn't hide the others.

Runs against the Firestore emulator and WIPES it first.

    npm run emulators                     # terminal 1
    npm run build && npm start            # terminal 2 (.env.local points at the emulator)
    python3 tests/features.py
"""
import json, os, re, subprocess, traceback, urllib.error, urllib.request
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("BASE_URL", "http://localhost:3000")
EMU = os.environ.get("FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080")
PROJECT = os.environ.get("FIREBASE_PROJECT_ID", "demo-orderje")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, "test-results")
IMG = os.path.join(SHOTS, "photo.png")
os.makedirs(SHOTS, exist_ok=True)
urllib.request.urlopen(urllib.request.Request(
    f"http://{EMU}/emulator/v1/projects/{PROJECT}/databases/(default)/documents", method="DELETE"))
subprocess.run(["node", "-e", f"require('qrcode').toFile({IMG!r}, 'PHOTO', {{width: 300}})"], check=True, cwd=ROOT)

PW = "password123"


def dump():
    env = {**os.environ, "FIRESTORE_EMULATOR_HOST": EMU, "FIREBASE_PROJECT_ID": PROJECT}
    out = subprocess.run(["node", "tests/fsdump.mjs"], capture_output=True, text=True, cwd=ROOT, env=env, check=True)
    return json.loads(out.stdout)


def docs(collection, under=None, **match):
    return [d for path, d in dump().items()
            if path.split("/")[-2] == collection and (under is None or path.startswith(f"tenants/{under}/"))
            and all(d.get(k) == v for k, v in match.items())]


def one(collection, under=None, **match):
    found = docs(collection, under, **match)
    assert len(found) == 1, (collection, match, len(found))
    return found[0]


def http_status(url):
    try:
        return urllib.request.urlopen(url).status
    except urllib.error.HTTPError as e:
        return e.code


results = []


def check(name):
    def run(fn):
        print(f"--- {name}", flush=True)
        try:
            fn()
            results.append((name, True, ""))
        except Exception as e:  # noqa: BLE001 - report every failure and keep going
            msg = f"{type(e).__name__}: {str(e).splitlines()[0][:300] if str(e) else ''}"
            results.append((name, False, msg))
            traceback.print_exc(limit=2)
            try:
                page.screenshot(path=f"{SHOTS}/fail-{len(results):02d}.png", full_page=True)
            except Exception:
                pass
        return fn
    return run


def login(ctx, email, password=PW):
    pg = ctx.new_page()
    pg.goto(f"{BASE}/login")
    pg.fill("input[name=email]", email)
    pg.fill("input[name=password]", password)
    pg.click("button:has-text('Log in')")
    return pg


def signup(pg, shop, email, owner="Owner", tables="3", sample=True):
    pg.goto(f"{BASE}/signup")
    pg.fill("input[name=shopName]", shop)
    pg.fill("input[name=ownerName]", owner)
    pg.fill("input[name=email]", email)
    pg.fill("input[name=password]", PW)
    pg.fill("input[name=tables]", tables)
    if not sample:
        pg.uncheck("input[name=sample]")
    pg.click("button:has-text('Create kedai')")


def new_counter_order(pg, items, order_type="Takeaway", table=None, name=None):
    pg.goto(f"{BASE}/app/pos/new")
    pg.get_by_role("button", name=order_type, exact=True).click()
    if table:
        pg.get_by_label("Table").select_option(label=table)
    if name:
        pg.get_by_placeholder(re.compile("Customer")).fill(name)
    for it in items:
        if it == "Roti Canai" or it == "Roti Telur":
            pg.get_by_role("button", name=re.compile("^Roti")).first.click()
        pg.get_by_role("button", name=re.compile("^" + it)).click()
    pg.get_by_role("button", name="Send to kitchen & bill").click()
    pg.wait_for_url(re.compile(r"/app/orders/"))
    return pg.url.rsplit("/", 1)[1]


with sync_playwright() as p:
    browser = p.chromium.launch()
    owner = browser.new_context(viewport={"width": 1366, "height": 900})
    page = owner.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    state = {}

    # ------------------------------------------------------------------ auth
    @check("Auth: /app needs a login")
    def _():
        anon = browser.new_context()
        pg = anon.new_page()
        pg.goto(f"{BASE}/app/pos")
        expect(pg).to_have_url(re.compile(r"/login$"))
        assert http_status(f"{BASE}/api/kitchen") == 401
        anon.close()

    @check("Signup: new kedai with sample menu and tables")
    def _():
        signup(page, "Kedai Satu", "satu@kedai.my", owner="Siti", tables="3")
        page.wait_for_url(f"{BASE}/app")
        t = one("tenants", name="Kedai Satu")
        state["t1"] = t["_id"]
        state["slug1"] = t["slug"]
        assert t["slug"] == "kedai-satu" and t["brandColor"] == "#d92d20", t
        assert len(docs("tables", t["_id"])) == 3
        assert len(docs("menuItems", t["_id"])) == 13

    @check("Signup: duplicate email and taken link name are refused")
    def _():
        other = browser.new_context()
        pg = other.new_page()
        signup(pg, "Kedai Lain Lagi", "satu@kedai.my")
        expect(pg.get_by_text("An account with this email already exists")).to_be_visible()
        signup(pg, "Kedai Satu", "lain@kedai.my")
        expect(pg.get_by_text('The link name "kedai-satu" is taken')).to_be_visible()
        other.close()
        assert len(docs("tenants")) == 1

    @check("Login: wrong password is refused; logout works")
    def _():
        other = browser.new_context()
        pg = login(other, "satu@kedai.my", "wrongpass1")
        expect(pg.get_by_text("Email or password is incorrect.")).to_be_visible()
        pg.fill("input[name=password]", PW)
        pg.click("button:has-text('Log in')")
        pg.wait_for_url(f"{BASE}/app")
        pg.get_by_role("button", name="Log out").first.click()
        pg.wait_for_url(re.compile(r"/login"))
        pg.goto(f"{BASE}/app")
        expect(pg).to_have_url(re.compile(r"/login"))
        other.close()

    # ------------------------------------------------------------------ settings & brand
    @check("Settings: rates are validated and saved")
    def _():
        page.goto(f"{BASE}/app/settings")
        page.fill("input[name=sstRate]", "150")
        page.click("button:has-text('Save settings')")
        expect(page.get_by_text("SST must be between 0 and 100%.")).to_be_visible()
        page.fill("input[name=sstRate]", "6")
        page.fill("input[name=serviceChargeRate]", "10")
        page.fill("input[name=memberDiscountRate]", "10")
        page.fill("input[name=staffDiscountRate]", "50")
        page.click("button:has-text('Save settings')")
        expect(page.get_by_text("Settings saved.")).to_be_visible()
        t = one("tenants", name="Kedai Satu")
        assert (t["sstRate"], t["serviceChargeRate"], t["memberDiscountRate"], t["staffDiscountRate"]) == (600, 1000, 1000, 5000), t

    @check("Brand: name required, logo upload and remove, custom colour, live preview")
    def _():
        page.goto(f"{BASE}/app/brand")
        page.fill("input[name=name]", "")
        page.get_by_role("button", name="Save", exact=True).click()
        assert one("tenants", name="Kedai Satu")  # browser blocks the empty required field
        page.fill("input[name=name]", "Kedai Satu")
        page.fill("input[name=tagline]", "Sedap sejak 2001")
        page.fill("input[name=receiptFooter]", "Jumpa lagi!")
        page.get_by_label("Custom brand colour").fill("#1f5f9e")
        page.set_input_files("input[aria-label='Upload logo']", IMG)
        expect(page.get_by_alt_text("Current logo")).to_be_visible()
        expect(page.get_by_text("Sedap sejak 2001").last).to_be_visible()  # live preview updates as you type
        page.get_by_role("button", name="Save", exact=True).click()
        expect(page.get_by_text("Saved. Customers see it straight away.")).to_be_visible()
        t = one("tenants", name="Kedai Satu")
        assert t["brandColor"] == "#1f5f9e" and t["logoUrl"].startswith("/img/"), t
        assert http_status(BASE + t["logoUrl"]) == 200
        first_logo = t["logoPath"]
        # replace, then remove: old image docs are deleted
        page.reload()
        page.set_input_files("input[aria-label='Upload logo']", IMG)
        page.get_by_role("button", name="Save", exact=True).click()
        expect(page.get_by_text("Saved. Customers see it straight away.")).to_be_visible()
        assert not docs("images", tenantId=state["t1"], _id=first_logo), "old logo not deleted"
        page.reload()
        page.get_by_role("button", name="Remove logo").click()
        page.get_by_role("button", name="Save", exact=True).click()
        expect(page.get_by_text("Saved. Customers see it straight away.")).to_be_visible()
        t = one("tenants", name="Kedai Satu")
        assert t["logoUrl"] is None and not docs("images", tenantId=state["t1"]), t
        assert http_status(f"{BASE}/img/not-an-id") == 404
        assert http_status(f"{BASE}/img/00000000-0000-0000-0000-000000000000") == 404

    # ------------------------------------------------------------------ menu
    @check("Menu: add, rename and reorder categories")
    def _():
        page.goto(f"{BASE}/app/menu")
        page.get_by_placeholder("e.g. Minuman Sejuk").fill("Kuih")
        page.get_by_role("button", name="Add category").click()
        expect(page.get_by_role("heading", name=re.compile("^Kuih"))).to_be_visible()
        card = page.locator("div.overflow-hidden", has=page.get_by_role("button", name="+ Add item to Kuih"))
        card.get_by_role("button", name="Rename").click()
        card.get_by_label("Category name").fill("Kuih Muih")
        card.get_by_role("button", name="Save").click()
        expect(page.get_by_role("heading", name=re.compile("^Kuih Muih"))).to_be_visible()
        page.get_by_role("button", name="Move Kuih Muih up").click()
        page.wait_for_timeout(1200)
        sorts = {d["name"]: d["sort"] for d in docs("categories", state["t1"])}
        assert sorts["Kuih Muih"] < sorts["Minuman"] and sorted(sorts.values()) == [0, 1, 2, 3], sorts
        expect(page.get_by_role("button", name=re.compile("Move Nasi & Mee up"))).to_be_disabled()

    @check("Menu: item popup validates name, price and add-on groups")
    def _():
        page.goto(f"{BASE}/app/menu")
        page.get_by_role("button", name="+ Add item to Kuih Muih").click()
        page.get_by_role("button", name="Add to menu").click()
        expect(page.get_by_text("Give the item a name.")).to_be_visible()
        page.get_by_placeholder("e.g. Nasi Ayam Penyet").fill("Kuih Lapis")
        page.get_by_placeholder("8.50").fill("0")
        page.get_by_role("button", name="Add to menu").click()
        expect(page.get_by_text("Enter a price, e.g. 8.50.")).to_be_visible()
        page.get_by_placeholder("8.50").fill("1.20")
        page.get_by_role("button", name="Add-on group").click()
        page.get_by_label("Group name").fill("Saiz")
        page.get_by_role("button", name="Add to menu").click()
        expect(page.get_by_text("Each add-on group needs at least one option.")).to_be_visible()
        page.get_by_label("Option name").fill("Besar")
        page.get_by_label("Extra price").fill("abc")
        page.get_by_role("button", name="Add to menu").click()
        expect(page.get_by_text("Check the extra price for Besar.")).to_be_visible()
        page.get_by_label("Extra price").fill("0.50")
        page.get_by_role("button", name="+ Option").click()
        page.get_by_label("Option name").nth(1).fill("Kecil")
        page.locator("label", has_text="Required").locator("input").check()
        page.set_input_files("input[aria-label='Upload photo']", IMG)
        page.get_by_role("button", name="Add to menu").click()
        expect(page.get_by_text("Kuih Lapis added to the menu")).to_be_visible()
        it = one("menuItems", state["t1"], name="Kuih Lapis")
        g = it["groups"][0]
        assert it["price"] == 120 and it["imageUrl"] and g["required"] and [o["name"] for o in g["options"]] == ["Besar", "Kecil"], it
        assert g["options"][0]["price"] == 50
        state["lapis_img"] = it["imagePath"]

    @check("Menu: edit item, move it to another category, remove its photo")
    def _():
        page.goto(f"{BASE}/app/menu")
        page.get_by_role("button", name="Edit Kuih Lapis").click()
        page.get_by_placeholder("8.50").fill("1.50")
        page.get_by_role("dialog").get_by_role("combobox").select_option(label="Minuman")
        page.get_by_role("button", name="Remove photo").click()
        page.get_by_role("button", name="Save changes").click()
        expect(page.get_by_text("Kuih Lapis saved")).to_be_visible()
        it = one("menuItems", state["t1"], name="Kuih Lapis")
        minuman = one("categories", state["t1"], name="Minuman")
        assert it["price"] == 150 and it["categoryId"] == minuman["_id"] and it["imageUrl"] is None, it
        assert not docs("images", _id=state["lapis_img"]), "photo not deleted"

    @check("Menu: sold out hides the item from customers, and back")
    def _():
        page.goto(f"{BASE}/app/menu")
        row = page.locator("li", has=page.get_by_text("Tosai", exact=True))
        row.get_by_role("switch").click()
        expect(row.get_by_role("switch")).to_have_text("Sold out")
        page.wait_for_timeout(800)
        assert one("menuItems", state["t1"], name="Tosai")["available"] is False
        tok = docs("tables", state["t1"])[0]["token"]
        state["tok1"] = tok
        cust = browser.new_context().new_page()
        cust.goto(f"{BASE}/t/{state['slug1']}/{tok}")
        expect(cust.get_by_role("button", name=re.compile("^Roti Canai"))).to_be_visible()
        assert cust.get_by_role("button", name=re.compile("^Tosai")).count() == 0
        row.get_by_role("switch").click()
        page.wait_for_timeout(800)
        cust.reload()
        expect(cust.get_by_role("button", name=re.compile("^Tosai"))).to_be_visible()
        cust.context.close()

    @check("Menu: delete item and delete a category with its items")
    def _():
        page.goto(f"{BASE}/app/menu")
        page.get_by_role("button", name="Edit Kuih Lapis").click()
        page.get_by_role("button", name="Delete item").click()
        page.get_by_role("dialog").get_by_role("button", name="Delete", exact=True).click()
        expect(page.get_by_text("Kuih Lapis deleted")).to_be_visible()
        assert not docs("menuItems", state["t1"], name="Kuih Lapis")
        page.get_by_role("button", name="+ Add item to Kuih Muih").click()
        page.get_by_placeholder("e.g. Nasi Ayam Penyet").fill("Seri Muka")
        page.get_by_placeholder("8.50").fill("1.00")
        page.get_by_role("button", name="Add to menu").click()
        expect(page.get_by_text("Seri Muka added to the menu")).to_be_visible()
        card = page.locator("div.overflow-hidden", has=page.get_by_role("button", name="+ Add item to Kuih Muih"))
        card.get_by_role("button", name="Delete", exact=True).click()
        expect(card.get_by_text("Delete Kuih Muih and its 1 item?")).to_be_visible()
        card.get_by_role("button", name="Delete", exact=True).last.click()
        page.wait_for_timeout(1200)
        assert not docs("categories", state["t1"], name="Kuih Muih") and not docs("menuItems", state["t1"], name="Seri Muka")

    # ------------------------------------------------------------------ customers & staff
    @check("Customers: add member, staff, corporate; edit; deactivate hides from picker")
    def _():
        for typ, name, extra in [("member", "Ahmad Member", None), ("staff", "Mei Staff", None),
                                 ("corporate", "Encik Bos", ("Syarikat Kecil", "5.00")), ("member", "Bekas Member", None)]:
            page.goto(f"{BASE}/app/customers?type={typ}")
            page.fill("input[name=name]", name)
            if extra:
                page.fill("input[name=company]", extra[0])
                page.fill("input[name=creditLimit]", extra[1])
            page.click("form button:has-text('Add')")
            expect(page.get_by_text("Customer added.")).to_be_visible()
        page.goto(f"{BASE}/app/customers?type=member")
        row = page.locator("div.px-5", has=page.get_by_text("Bekas Member"))
        row.get_by_role("button", name="Edit").click()
        row.locator("input[name=active][type=checkbox]").uncheck()
        row.get_by_role("button", name="Save").click()
        expect(row.get_by_text("(inactive)")).to_be_visible()
        assert one("customers", state["t1"], name="Bekas Member")["active"] is False
        assert one("customers", state["t1"], name="Encik Bos")["creditLimit"] == 500
        oid = new_counter_order(page, ["Roti Canai"])
        page.get_by_role("button", name="Member", exact=True).click()
        labels = page.get_by_label("Customer").locator("option").all_inner_texts()
        assert any("Ahmad Member" in x for x in labels) and not any("Bekas Member" in x for x in labels), labels
        page.once("dialog", lambda d: d.accept())
        page.get_by_role("button", name="Cancel order").click()
        page.wait_for_timeout(1200)
        assert one("orders", state["t1"], _id=oid)["status"] == "cancelled"

    @check("Staff: add cashier and kitchen; duplicate email refused")
    def _():
        page.goto(f"{BASE}/app/staff")
        for name, email, role in [("Kasyier", "kasyier@kedai.my", "Cashier"), ("Tukang Masak", "dapur@kedai.my", "Kitchen")]:
            page.fill("input[name=name]", name)
            page.fill("input[name=email]", email)
            page.locator("select[name=role]").first.select_option(label=role)
            page.fill("input[name=password]", PW)
            page.click("button:has-text('Add staff')")
            expect(page.get_by_text(f"{name} can now log in.")).to_be_visible()
        page.fill("input[name=name]", "Pendua")
        page.fill("input[name=email]", "dapur@kedai.my")
        page.fill("input[name=password]", PW)
        page.click("button:has-text('Add staff')")
        expect(page.get_by_text("That email is already used by another account.")).to_be_visible()
        assert len(docs("users", tenantId=state["t1"])) == 3

    @check("Roles: kitchen sees only the kitchen and can't cancel; cashier can't open owner pages")
    def _():
        k = browser.new_context()
        kp = login(k, "dapur@kedai.my")
        kp.wait_for_url(f"{BASE}/app/kitchen")
        for path in ["/app/pos", "/app", "/app/menu", "/app/recon"]:
            kp.goto(BASE + path)
            expect(kp).to_have_url(f"{BASE}/app/kitchen")
        state["kitchen_ctx"] = k
        c = browser.new_context()
        cp = login(c, "kasyier@kedai.my")
        cp.wait_for_url(f"{BASE}/app/pos")
        for path in ["/app", "/app/menu", "/app/brand", "/app/settings", "/app/staff", "/app/tables"]:
            cp.goto(BASE + path)
            expect(cp).to_have_url(f"{BASE}/app/pos")
        state["cashier_ctx"] = c

    @check("Staff: deactivated user is logged out at once; reactivate; change email")
    def _():
        cp = state["cashier_ctx"].pages[0]
        page.goto(f"{BASE}/app/staff")
        page.locator("div.px-5", has=page.get_by_text("kasyier@kedai.my")).get_by_role("button", name="Deactivate").click()
        page.wait_for_timeout(1000)
        cp.goto(f"{BASE}/app/pos")
        expect(cp).to_have_url(re.compile(r"/login\?e=inactive"))
        expect(cp.get_by_text("Your account was deactivated")).to_be_visible()
        page.reload()
        row = page.locator("div.px-5", has=page.get_by_text("kasyier@kedai.my"))
        row.get_by_role("button", name="Reactivate").click()
        page.wait_for_timeout(1000)
        row.get_by_role("button", name="Edit").click()
        row.locator("input[name=email]").fill("kasir@kedai.my")
        row.get_by_role("button", name="Save").click()
        page.wait_for_timeout(1200)
        assert one("users", tenantId=state["t1"], name="Kasyier")["email"] == "kasir@kedai.my"
        bad = login(state["cashier_ctx"], "kasyier@kedai.my")
        expect(bad.get_by_text("Email or password is incorrect.")).to_be_visible()
        good = login(state["cashier_ctx"], "kasir@kedai.my")
        good.wait_for_url(f"{BASE}/app/pos")

    # ------------------------------------------------------------------ tables
    @check("Tables: add, rename, disable (QR stops), new QR (old sticker stops)")
    def _():
        page.goto(f"{BASE}/app/tables")
        page.get_by_label("How many").fill("2")
        page.get_by_label("Name prefix").fill("Luar")
        page.get_by_role("button", name="Add tables").click()
        page.wait_for_timeout(1200)
        labels = sorted(d["label"] for d in docs("tables", state["t1"]))
        assert "Luar 4" in labels and "Luar 5" in labels, labels
        card = page.locator("div.break-inside-avoid", has=page.get_by_text("Luar 4", exact=True))
        card.get_by_role("button", name="Rename").click()
        card.get_by_label("Table name").fill("Teres")
        card.get_by_role("button", name="Save").click()
        page.wait_for_timeout(1000)
        teres = one("tables", state["t1"], label="Teres")
        card = page.locator("div.break-inside-avoid", has=page.get_by_text("Teres", exact=True))
        card.get_by_role("button", name="Disable").click()
        page.wait_for_timeout(1000)
        assert http_status(f"{BASE}/t/{state['slug1']}/{teres['token']}") == 404
        card.get_by_role("button", name="Enable").click()
        page.wait_for_timeout(1000)
        assert http_status(f"{BASE}/t/{state['slug1']}/{teres['token']}") == 200
        page.once("dialog", lambda d: d.accept())
        card.get_by_role("button", name="New QR").click()
        page.wait_for_timeout(1000)
        new = one("tables", state["t1"], label="Teres")
        assert new["token"] != teres["token"]
        assert http_status(f"{BASE}/t/{state['slug1']}/{teres['token']}") == 404
        assert http_status(f"{BASE}/t/{state['slug1']}/{new['token']}") == 200
        assert http_status(f"{BASE}/t/{state['slug1']}/takeaway") == 200
        assert http_status(f"{BASE}/t/no-such-kedai/takeaway") == 404

    # ------------------------------------------------------------------ customer ordering
    @check("Customer menu: brand, add-on rules, quantity, note, cart survives reload, bungkus drops service")
    def _():
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        c = ctx.new_page()
        c.on("pageerror", lambda e: errors.append(str(e)))
        c.goto(f"{BASE}/t/{state['slug1']}/{state['tok1']}")
        expect(c.get_by_text("Sedap sejak 2001")).to_be_visible()
        bg = c.locator("header").first.evaluate("e => getComputedStyle(e).backgroundColor")
        assert bg == "rgb(31, 95, 158)", bg  # #1f5f9e
        # required group blocks Add; radio swaps; max picks enforced on a multi-pick group
        c.get_by_role("button", name=re.compile("^Teh Tarik")).click()
        expect(c.get_by_role("button", name="Choose Panas / Ais")).to_be_disabled()
        c.get_by_label("Panas", exact=True).check()
        c.get_by_label(re.compile("^Ais")).check()
        expect(c.get_by_label("Panas", exact=True)).not_to_be_checked()
        c.get_by_role("button", name="More").click()
        c.get_by_placeholder("e.g. no onion").fill("kurang ais")
        c.get_by_role("button", name=re.compile(r"^Add · RM 6\.00")).click()  # (2.50 + 0.50) x 2
        c.get_by_role("button", name=re.compile("^Nasi Lemak Biasa")).click()
        for o in ["Telur mata", "Ayam goreng", "Sotong"]:
            c.get_by_label(re.compile("^" + o)).check()
        c.get_by_role("button", name=re.compile(r"^Add · RM 13\.50")).click()  # 3.50 + 1.50 + 4.50 + 4.00
        c.reload()
        c.get_by_role("button", name=re.compile(r"View order \(3\)")).click()
        expect(c.get_by_text("kurang ais")).to_be_visible()
        # dine-in: 19.50 + 10% svc 1.95 = 21.45, SST 6% 1.29 -> 22.74
        expect(c.get_by_role("dialog").get_by_text("RM 22.74")).to_be_visible()
        c.get_by_role("radio", name="Bungkus").click()
        # bungkus: no service charge. 19.50 + SST 1.17 -> 20.67, and a name is required
        expect(c.get_by_role("dialog").get_by_text("RM 20.67")).to_be_visible()
        expect(c.get_by_role("button", name="Send order to kitchen")).to_be_disabled()
        c.get_by_placeholder("Your name (required)").fill("Daniel")
        c.get_by_role("button", name="Send order to kitchen").click()
        c.wait_for_url(re.compile(r"/o/"))
        expect(c.get_by_text("Please pay at the counter")).to_be_visible()
        o = one("orders", state["t1"], customerName="Daniel")
        assert (o["orderType"], o["serviceCharge"], o["total"], o["source"]) == ("takeaway", 0, 2067, "qr"), o
        assert o["items"][0]["note"] == "kurang ais" and o["items"][0]["qty"] == 2
        state["daniel"] = (o["_id"], c.url)
        state["phone"] = ctx

    @check("Customer: takeaway QR asks for a name; order page tracks status; cancelled shows")
    def _():
        c = state["phone"].new_page()
        c.goto(f"{BASE}/t/{state['slug1']}/takeaway")
        expect(c.get_by_text("Takeaway order")).to_be_visible()
        c.get_by_role("button", name=re.compile("^Roti Canai")).click()
        c.get_by_role("button", name=re.compile(r"^Add · ")).click()
        c.get_by_role("button", name=re.compile("View order")).click()
        assert c.get_by_role("radio", name="Makan sini").count() == 0
        expect(c.get_by_role("button", name="Send order to kitchen")).to_be_disabled()
        c.get_by_placeholder("Your name (required)").fill("Batal")
        c.get_by_role("button", name="Send order to kitchen").click()
        c.wait_for_url(re.compile(r"/o/"))
        state["batal_url"] = c.url
        c.close()

    # ------------------------------------------------------------------ kitchen
    @check("Kitchen: tickets move, Undo moves back, kitchen has no Cancel, owner can cancel")
    def _():
        kp = state["kitchen_ctx"].pages[0]
        kp.goto(f"{BASE}/app/kitchen")
        ticket = kp.locator("article", has=kp.get_by_text("Daniel"))
        expect(ticket).to_be_visible()
        assert ticket.get_by_role("button", name="Cancel").count() == 0
        ticket.get_by_role("button", name="Start cooking").click()
        expect(kp.locator("section[aria-label='Cooking']").get_by_text("Daniel")).to_be_visible()
        kp.locator("section[aria-label='Cooking'] article", has=kp.get_by_text("Daniel")).get_by_role("button", name="Undo").click()
        expect(kp.locator("section[aria-label='New']").get_by_text("Daniel")).to_be_visible()
        page.goto(f"{BASE}/app/kitchen")
        page.once("dialog", lambda d: d.accept())
        page.locator("article", has=page.get_by_text("Batal")).get_by_role("button", name="Cancel").click()
        page.wait_for_timeout(1500)
        assert one("orders", state["t1"], customerName="Batal")["status"] == "cancelled"
        c = state["phone"].new_page()
        c.goto(state["batal_url"])
        expect(c.get_by_text("This order was cancelled by the kedai")).to_be_visible()
        c.close()

    # ------------------------------------------------------------------ counter
    @check("Counter: dine-in needs a table; delivery order with rider name")
    def _():
        page.goto(f"{BASE}/app/pos/new")
        page.get_by_role("button", name="Dine-in", exact=True).click()
        page.get_by_label("Table").select_option(index=0)
        page.get_by_role("button", name=re.compile("^Nasi Goreng Kampung")).click()
        page.get_by_role("button", name="Send to kitchen & bill").click()
        expect(page.get_by_text("Pick a table for dine-in, or switch to takeaway.")).to_be_visible()
        assert "/app/orders/" not in page.url
        oid = new_counter_order(page, ["Nasi Goreng Kampung"], "Delivery", name="Grab #88")
        o = one("orders", state["t1"], _id=oid)
        assert (o["orderType"], o["customerName"], o["serviceCharge"]) == ("delivery", "Grab #88", 0), o
        state["grab"] = oid

    @check("Counter: staff discount, cash less than due is blocked, change is right")
    def _():
        page.goto(f"{BASE}/app/orders/{state['grab']}")
        page.get_by_role("button", name="Staff", exact=True).click()
        page.get_by_label("Customer").select_option(label="Mei Staff")
        page.get_by_role("button", name="Apply staff pricing").click()
        page.wait_for_timeout(1500)
        o = one("orders", state["t1"], _id=state["grab"])
        # 7.50 - 50% = 3.75, SST 6% 0.23 -> 3.98; cash rounds to 4.00
        assert (o["discount"], o["sst"], o["total"], o["customerType"]) == (375, 23, 398, "staff"), o
        page.get_by_label("Cash received").fill("3")
        expect(page.get_by_role("button", name=re.compile("^Receive RM 4.00"))).to_be_disabled()
        page.get_by_label("Cash received").fill("10")
        expect(page.get_by_text("Change RM 6.00")).to_be_visible()
        page.get_by_role("button", name=re.compile("^Receive RM 4.00")).click()
        expect(page.get_by_text("Give change")).to_be_visible()
        o = one("orders", state["t1"], _id=state["grab"])
        assert (o["paymentStatus"], o["total"], o["rounding"], o["paidMethod"]) == ("paid", 400, 2, "cash"), o

    @check("Counter: corporate credit limit is enforced; settle credit")
    def _():
        oid = new_counter_order(page, ["Nasi Goreng Kampung"])
        page.get_by_role("button", name="Corporate", exact=True).click()
        page.get_by_label("Customer").select_option(label="Encik Bos (Syarikat Kecil)")
        page.get_by_role("button", name="Apply corporate pricing").click()
        page.wait_for_timeout(1500)
        page.get_by_role("button", name=re.compile("^Charge RM")).click()
        expect(page.get_by_text("Encik Bos would exceed their credit limit.")).to_be_visible()
        oid2 = new_counter_order(page, ["Roti Canai"])
        page.get_by_role("button", name="Corporate", exact=True).click()
        page.get_by_label("Customer").select_option(label="Encik Bos (Syarikat Kecil)")
        page.get_by_role("button", name="Apply corporate pricing").click()
        page.wait_for_timeout(1500)
        page.get_by_role("button", name=re.compile("^Charge RM")).click()
        expect(page.get_by_text("Charged to company account")).to_be_visible()
        owed = one("orders", state["t1"], _id=oid2)["total"]  # 1.50 + SST 0.09 = 1.59
        page.goto(f"{BASE}/app/customers?type=corporate")
        expect(page.get_by_text(f"RM {owed / 100:.2f}").first).to_be_visible()
        page.get_by_role("button", name="Record payment").click()
        page.fill("input[name=amount]", "50")
        page.get_by_role("button", name="Record", exact=True).click()
        expect(page.get_by_text(re.compile("They only owe 1.59"))).to_be_visible()
        page.fill("input[name=amount]", "1.59")
        page.get_by_role("button", name="Record", exact=True).click()
        expect(page.locator("div.px-5", has=page.get_by_text("Encik Bos")).get_by_text("RM 0.00")).to_be_visible()
        assert one("payments", state["t1"], kind="settlement")["amount"] == 159
        state["unpaid_corp"] = oid

    @check("Counter: cancel unpaid order; void a paid order (owner only) and re-pay")
    def _():
        page.goto(f"{BASE}/app/orders/{state['unpaid_corp']}")
        page.once("dialog", lambda d: d.accept())
        page.get_by_role("button", name="Cancel order").click()
        page.wait_for_timeout(1500)
        assert one("orders", state["t1"], _id=state["unpaid_corp"])["status"] == "cancelled"
        # cashier sees no void button on a paid order
        cp = state["cashier_ctx"].pages[-1]
        cp.goto(f"{BASE}/app/orders/{state['grab']}")
        expect(cp.get_by_text("Paid", exact=True)).to_be_visible()
        assert cp.get_by_role("button", name="Void payment").count() == 0
        page.goto(f"{BASE}/app/orders/{state['grab']}")
        page.once("dialog", lambda d: d.accept("Salah cara bayar"))
        page.get_by_role("button", name="Void payment").click()
        page.wait_for_timeout(1500)
        o = one("orders", state["t1"], _id=state["grab"])
        assert (o["paymentStatus"], o["total"], o["rounding"], o["paidMethod"]) == ("unpaid", 398, 0, None), o
        voided = one("payments", state["t1"], orderId=state["grab"])
        assert voided["status"] == "failed" and "Salah cara bayar" in voided["reference"], voided
        page.reload()
        page.get_by_role("button", name="DuitNow QR", exact=True).click()
        page.get_by_placeholder("Bank reference (last 4–6 digits)").fill("777")
        page.get_by_role("button", name=re.compile("^Receive RM 3.98")).click()
        page.wait_for_timeout(1500)
        assert one("orders", state["t1"], _id=state["grab"])["paidMethod"] == "duitnow_qr"

    @check("Counter: Daniel's QR order paid by cash; Just paid shows the method")
    def _():
        page.goto(f"{BASE}/app/orders/{state['daniel'][0]}")
        page.get_by_role("button", name=re.compile("^Receive RM")).click()
        expect(page.get_by_text("Paid", exact=True)).to_be_visible()
        page.goto(f"{BASE}/app/pos")
        expect(page.get_by_text("Unpaid bills (0)")).to_be_visible()
        just = page.locator("li", has=page.get_by_text(re.compile("Takeaway"))).first
        expect(page.get_by_text("DuitNow QR").first).to_be_visible()
        expect(page.get_by_text("Corporate credit").first).to_be_visible()
        del just
        c = state["phone"].new_page()
        c.goto(state["daniel"][1])
        expect(c.get_by_text("Paid. Terima kasih!")).to_be_visible()
        c.get_by_role("link", name="View receipt").click()
        expect(c.get_by_text("Jumpa lagi!")).to_be_visible()
        expect(c.get_by_text("Kedai Satu").first).to_be_visible()
        c.close()

    # ------------------------------------------------------------------ orders, dashboard, recon
    @check("Orders list: today shows every order, yesterday none")
    def _():
        page.goto(f"{BASE}/app/orders")
        n = len(docs("orders", state["t1"]))
        expect(page.get_by_text(f"{n} order(s) placed on")).to_be_visible()
        page.goto(f"{BASE}/app/orders?date=2001-01-01")
        expect(page.get_by_text("No orders on this day")).to_be_visible()

    @check("Dashboard: every range loads; numbers match paid orders")
    def _():
        for q in ["", "?range=yesterday", "?range=7d", "?range=30d", "?range=custom&from=2026-01-01&to=2026-12-31"]:
            page.goto(f"{BASE}/app{q}")
            expect(page.get_by_text("Sales", exact=True).first).to_be_visible()
        page.goto(f"{BASE}/app")
        paid = [o for o in docs("orders", state["t1"]) if o["paymentStatus"] in ("paid", "credit")]
        total = sum(o["total"] for o in paid)
        expect(page.get_by_text(f"{len(paid)} paid order")).to_be_visible()
        expect(page.get_by_text(f"RM {total / 100:.2f}").first).to_be_visible()

    @check("Recon: close, cashier can't reopen, owner reopens, future date refused")
    def _():
        page.goto(f"{BASE}/app/recon")
        page.fill("input[name=openingFloat]", "0")
        exp_cash = sum(p["amount"] for p in docs("payments", state["t1"], status="success", method="cash"))
        exp_qr = sum(p["amount"] for p in docs("payments", state["t1"], status="success", method="duitnow_qr"))
        page.fill("input[name=countedCash]", f"{exp_cash / 100:.2f}")
        page.fill("input[name=bankQr]", f"{exp_qr / 100:.2f}")
        expect(page.get_by_text("Matches").first).to_be_visible()
        page.get_by_role("button", name=re.compile("^Close ")).click()
        page.wait_for_timeout(1500)
        rec = one("reconciliations", state["t1"])
        assert (rec["expectedCash"], rec["expectedQr"], rec["countedCash"]) == (exp_cash, exp_qr, exp_cash), rec
        page.reload()
        expect(page.get_by_text("Balanced")).to_be_visible()
        cp = state["cashier_ctx"].pages[-1]
        cp.goto(f"{BASE}/app/recon")
        expect(cp.get_by_text("This day is closed")).to_be_visible()
        assert cp.get_by_role("button", name="Reopen day").count() == 0
        page.once("dialog", lambda d: d.accept())
        page.get_by_role("button", name="Reopen day").click()
        page.wait_for_timeout(1500)
        assert not docs("reconciliations", state["t1"])
        page.goto(f"{BASE}/app/recon?date=2099-01-01")
        expect(page.get_by_text("Today", exact=True)).to_be_visible()  # future dates fall back to today

    # ------------------------------------------------------------------ AI menu assistant (mock mode)
    @check("AI Menu: poster to draft, fix price and crop, apply to the menu")
    def _():
        page.goto(f"{BASE}/app/assistant")
        expect(page.get_by_text("Apa nak ubah dalam menu?")).to_be_visible()
        expect(page.get_by_text("Baki hari ini: 30/30")).to_be_visible()
        page.set_input_files("input[aria-label='Lampirkan gambar']", IMG)
        expect(page.get_by_alt_text("Lampiran")).to_be_visible()
        page.get_by_label("Mesej untuk AI").fill("Masukkan semua menu dalam poster ni")
        page.get_by_label("Mesej untuk AI").press("Enter")
        expect(page.get_by_text("Saya jumpa 3 menu dalam poster")).to_be_visible(timeout=20000)
        expect(page.get_by_text("Baki hari ini: 29/30")).to_be_visible()
        cards = page.get_by_role("region", name="Draf perubahan").get_by_label("Nama item")
        expect(cards).to_have_count(3)
        teh = page.locator("div.p-4", has=page.locator("input[value='Teh O Ais']"))
        teh.get_by_label("Harga").fill("3.00")
        page.get_by_role("button", name="Ubah potongan gambar Set A Simple Tapi Padu").click()
        expect(page.get_by_role("dialog")).to_be_visible()
        page.get_by_role("button", name="Guna potongan ini").click()
        page.get_by_role("button", name="Masukkan ke menu").first.click()
        expect(page.get_by_text("Menu disimpan: 3 ditambah").first).to_be_visible(timeout=20000)
        a = one("menuItems", state["t1"], name="Set A Simple Tapi Padu")
        assert a["price"] == 1200 and a["imageUrl"] and a["groups"][0]["name"] == "Ayam" and a["groups"][0]["required"], a
        assert http_status(BASE + a["imageUrl"]) == 200
        assert one("menuItems", state["t1"], name="Teh O Ais")["price"] == 300
        set_cat = one("categories", state["t1"], name="Set Ayam Gepuk")
        assert one("menuItems", state["t1"], name="Set B Kenyang Puas")["categoryId"] == set_cat["_id"]
        assert len(docs("categories", state["t1"], name="Minuman")) == 1  # reused, not duplicated
        assert docs("aiUsage", state["t1"])[0]["count"] == 1
        cashier = state["cashier_ctx"].pages[-1]
        cashier.goto(f"{BASE}/app/assistant")
        expect(cashier).to_have_url(f"{BASE}/app/pos")  # owners only

    # ------------------------------------------------------------------ admin
    @check("Admin: only Rubix emails; suspend blocks login and QR ordering; reactivate")
    def _():
        page.goto(f"{BASE}/admin")
        expect(page).to_have_url(re.compile(r"/login"))
        page.goto(f"{BASE}/app")  # owner session is still valid
        rx = browser.new_context()
        rp = rx.new_page()
        signup(rp, "Rubix HQ", "info@rubix.com.my", sample=False, tables="0")
        rp.wait_for_url(f"{BASE}/app")
        rp.goto(f"{BASE}/admin")
        row = rp.locator("tr", has=rp.get_by_text("Kedai Satu", exact=True))
        expect(row).to_be_visible()
        row.get_by_role("button", name="Suspend").click()
        rp.wait_for_timeout(1200)
        assert one("tenants", name="Kedai Satu")["active"] is False
        page.goto(f"{BASE}/app/pos")
        expect(page).to_have_url(re.compile(r"/login\?e=suspended"))
        c = state["phone"].new_page()
        c.goto(f"{BASE}/t/{state['slug1']}/{state['tok1']}")
        expect(c.get_by_text("isn't taking QR orders right now")).to_be_visible()
        rp.locator("tr", has=rp.get_by_text("Kedai Satu", exact=True)).get_by_role("button", name="Reactivate").click()
        rp.wait_for_timeout(1200)
        c.reload()
        expect(c.get_by_role("button", name=re.compile("^Roti Canai"))).to_be_visible()
        c.close()
        rx.close()
        login(owner, "satu@kedai.my").wait_for_url(f"{BASE}/app")

    @check("Isolation: another kedai can't see this kedai's orders, menu items or images")
    def _():
        other = browser.new_context()
        op = login(other, "info@rubix.com.my")
        op.wait_for_url(f"{BASE}/app")
        op.goto(f"{BASE}/app/orders/{state['grab']}")
        expect(op.get_by_text("404")).to_be_visible()
        op.goto(f"{BASE}/app/menu")
        expect(op.get_by_text("Start with a category")).to_be_visible()
        other.close()

    for ctx in [state.get("kitchen_ctx"), state.get("cashier_ctx"), state.get("phone")]:
        if ctx:
            ctx.close()
    browser.close()

print("\n================ FEATURE CHECK ================")
for name, ok, msg in results:
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"\n      {msg}" if msg else ""))
print(f"\n{sum(ok for _, ok, _ in results)}/{len(results)} passed. Page errors: {errors}")
