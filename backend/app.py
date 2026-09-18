import json
import os
import re
import secrets
import smtplib
import sqlite3
import urllib.request
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, g, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

BASE_DIR = os.path.dirname(__file__)
ENV_PATH = os.path.join(BASE_DIR, ".env")
DB_PATH = os.path.join(BASE_DIR, "data.db")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
WEBSITE_DIR = os.path.join(os.path.dirname(BASE_DIR), "website")
os.makedirs(UPLOADS_DIR, exist_ok=True)

load_dotenv(ENV_PATH)  # reads backend/.env if present (see .env.example)

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD")
NOTIFY_TO = os.environ.get("NOTIFY_TO", SMTP_USER)
EMAIL_ENABLED = bool(SMTP_USER and SMTP_PASSWORD and NOTIFY_TO)

ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}

# Simple in-memory admin session tokens (bearer tokens, not cookies — this
# sidesteps cross-origin cookie issues since the site and API can run on
# different ports/domains). Tokens reset when the backend process restarts,
# so the admin just logs in again; that's fine for a single small-team site.
ACTIVE_ADMIN_TOKENS = set()

app = Flask(__name__)
CORS(app)


def require_admin(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        token = auth_header.removeprefix("Bearer ").strip()
        if not token or token not in ACTIVE_ADMIN_TOKENS:
            return jsonify({"success": False, "error": "กรุณาเข้าสู่ระบบแอดมินก่อน"}), 401
        return view(*args, **kwargs)

    return wrapped


def send_notification_email(name, contact, question):
    """Email the community team when a new Q&A question comes in.
    Silently skipped if SMTP_* env vars are not configured (see .env.example);
    a send failure is logged but never breaks the API response."""
    if not EMAIL_ENABLED:
        app.logger.info("Email notification skipped: SMTP not configured (see backend/.env.example)")
        return

    msg = EmailMessage()
    msg["Subject"] = f"[เว็บไซต์แม่หอพระ] คำถามใหม่จาก {name}"
    msg["From"] = SMTP_USER
    msg["To"] = NOTIFY_TO
    msg.set_content(
        f"มีคำถามใหม่เข้ามาทางเว็บไซต์\n\n"
        f"ชื่อ: {name}\n"
        f"ช่องทางติดต่อกลับ: {contact}\n"
        f"คำถาม:\n{question}\n"
    )

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as exc:  # noqa: BLE001 - never let email issues break the request
        app.logger.warning("Failed to send notification email: %s", exc)


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def _images_to_db(images):
    """A list of image URLs/paths -> the JSON string stored in the images column."""
    if not isinstance(images, list):
        return json.dumps([])
    cleaned = [str(u).strip() for u in images if isinstance(u, str) and str(u).strip()]
    return json.dumps(cleaned)


def _row_with_images(row):
    """A sqlite3.Row (or dict) with JSON `images`/`tags` columns -> a plain
    dict with those decoded back into real lists, for clean JSON responses."""
    d = dict(row)
    try:
        d["images"] = json.loads(d.get("images") or "[]")
    except (TypeError, ValueError):
        d["images"] = []
    if "tags" in d:
        try:
            d["tags"] = json.loads(d.get("tags") or "[]")
        except (TypeError, ValueError):
            d["tags"] = []
    return d


_LATLNG_PATTERNS = (
    re.compile(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)"),  # place URLs: ...!3d<lat>!4d<lng>...
    re.compile(r"[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)"),  # ...?q=<lat>,<lng>
    re.compile(r"@(-?\d+\.\d+),(-?\d+\.\d+)"),       # ...@<lat>,<lng>,<zoom>z
)


def _extract_lat_lng(map_url):
    """A Google Maps URL (full or short link) -> (lat, lng) floats, or (None, None)
    if no coordinates could be found in it."""
    url = (map_url or "").strip()
    if not url:
        return None, None

    for pattern in _LATLNG_PATTERNS:
        match = pattern.search(url)
        if match:
            return float(match.group(1)), float(match.group(2))

    # Short links (maps.app.goo.gl / goo.gl/maps) carry no coordinates in the
    # link itself — follow the redirect to the real Google Maps URL and retry.
    if "goo.gl" in url or "google.com/maps" not in url:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=6) as resp:
                resolved_url = resp.geturl()
            for pattern in _LATLNG_PATTERNS:
                match = pattern.search(resolved_url)
                if match:
                    return float(match.group(1)), float(match.group(2))
        except Exception:
            pass

    return None, None


def init_db():
    with sqlite3.connect(DB_PATH) as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS qa_submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                contact TEXT NOT NULL,
                question TEXT NOT NULL,
                created_at TEXT NOT NULL,
                answered INTEGER NOT NULL DEFAULT 0,
                answer TEXT
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS site_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL DEFAULT ''
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_name TEXT NOT NULL,
                customer_contact TEXT NOT NULL,
                customer_address TEXT NOT NULL,
                notes TEXT,
                items TEXT NOT NULL DEFAULT '[]',
                subtotal REAL NOT NULL DEFAULT 0,
                shipping_cost REAL NOT NULL DEFAULT 0,
                total REAL NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'new',
                created_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service_id INTEGER,
                service_name TEXT NOT NULL,
                customer_name TEXT NOT NULL,
                customer_contact TEXT NOT NULL,
                preferred_date TEXT,
                party_size TEXT,
                notes TEXT,
                status TEXT NOT NULL DEFAULT 'new',
                created_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS stories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                excerpt TEXT NOT NULL,
                images TEXT NOT NULL DEFAULT '[]',
                published_at TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kind TEXT NOT NULL CHECK (kind IN ('product', 'service')),
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                price_text TEXT,
                images TEXT NOT NULL DEFAULT '[]',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """
        )
        # ============ SERVICES (rich profiles: tour / guide / restaurant /
        # massage / driver) — replaces the old single "service" kind on
        # products. service_type-specific fields simply stay NULL for
        # types that don't use them.
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service_type TEXT NOT NULL CHECK (service_type IN
                    ('tour', 'guide', 'restaurant', 'massage', 'driver')),
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                images TEXT NOT NULL DEFAULT '[]',
                price_text TEXT,
                schedule_text TEXT,
                includes_text TEXT,
                languages TEXT,
                license_no TEXT,
                awards TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS attractions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL CHECK (category IN ('nature', 'culture')),
                name TEXT NOT NULL,
                tag TEXT,
                description TEXT NOT NULL,
                images TEXT NOT NULL DEFAULT '[]',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS nearby_attractions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                area_tag TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                images TEXT NOT NULL DEFAULT '[]',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS highlights (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                images TEXT NOT NULL DEFAULT '[]',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS calendar_months (
                month_index INTEGER PRIMARY KEY,
                label TEXT NOT NULL,
                traditions TEXT NOT NULL DEFAULT '[]',
                activities TEXT NOT NULL DEFAULT '[]',
                products TEXT,
                images TEXT NOT NULL DEFAULT '[]'
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS seasons (
                season_key TEXT PRIMARY KEY CHECK (season_key IN ('summer', 'rainy', 'winter')),
                period_text TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                images TEXT NOT NULL DEFAULT '[]'
            )
            """
        )
        db.commit()

        # Add real-map location columns to attractions if reusing an older
        # database that predates this feature.
        existing_attr_cols = {row[1] for row in db.execute("PRAGMA table_info(attractions)").fetchall()}
        if "map_url" not in existing_attr_cols:
            db.execute("ALTER TABLE attractions ADD COLUMN map_url TEXT")
            db.execute("ALTER TABLE attractions ADD COLUMN lat REAL")
            db.execute("ALTER TABLE attractions ADD COLUMN lng REAL")
            db.commit()

        # Add optional tag lists to products/services if reusing an older
        # database that predates this feature.
        existing_product_cols = {row[1] for row in db.execute("PRAGMA table_info(products)").fetchall()}
        if "tags" not in existing_product_cols:
            db.execute("ALTER TABLE products ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'")
            db.commit()
        if "price_amount" not in existing_product_cols:
            db.execute("ALTER TABLE products ADD COLUMN price_amount REAL")
            db.commit()
        existing_service_cols = {row[1] for row in db.execute("PRAGMA table_info(services)").fetchall()}
        if "tags" not in existing_service_cols:
            db.execute("ALTER TABLE services ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'")
            db.commit()

        # Add optional English/Chinese translation columns to stories if
        # reusing an older database that predates this feature. A story with
        # these left blank simply won't appear when EN/ZH is selected.
        existing_story_cols = {row[1] for row in db.execute("PRAGMA table_info(stories)").fetchall()}
        if "title_en" not in existing_story_cols:
            db.execute("ALTER TABLE stories ADD COLUMN title_en TEXT")
            db.execute("ALTER TABLE stories ADD COLUMN excerpt_en TEXT")
            db.execute("ALTER TABLE stories ADD COLUMN title_zh TEXT")
            db.execute("ALTER TABLE stories ADD COLUMN excerpt_zh TEXT")
            db.commit()

        # Same optional EN/ZH translation pattern for attractions (name +
        # description only — tag/category stay Thai-only structural fields).
        existing_attr_cols2 = {row[1] for row in db.execute("PRAGMA table_info(attractions)").fetchall()}
        if "name_en" not in existing_attr_cols2:
            db.execute("ALTER TABLE attractions ADD COLUMN name_en TEXT")
            db.execute("ALTER TABLE attractions ADD COLUMN description_en TEXT")
            db.execute("ALTER TABLE attractions ADD COLUMN name_zh TEXT")
            db.execute("ALTER TABLE attractions ADD COLUMN description_zh TEXT")
            db.commit()

        # Same pattern for products (name + description only).
        existing_product_cols2 = {row[1] for row in db.execute("PRAGMA table_info(products)").fetchall()}
        if "name_en" not in existing_product_cols2:
            db.execute("ALTER TABLE products ADD COLUMN name_en TEXT")
            db.execute("ALTER TABLE products ADD COLUMN description_en TEXT")
            db.execute("ALTER TABLE products ADD COLUMN name_zh TEXT")
            db.execute("ALTER TABLE products ADD COLUMN description_zh TEXT")
            db.commit()

        # Same pattern for services (name + description only — type-specific
        # fields like schedule/includes/languages/license/awards stay Thai).
        existing_service_cols2 = {row[1] for row in db.execute("PRAGMA table_info(services)").fetchall()}
        if "name_en" not in existing_service_cols2:
            db.execute("ALTER TABLE services ADD COLUMN name_en TEXT")
            db.execute("ALTER TABLE services ADD COLUMN description_en TEXT")
            db.execute("ALTER TABLE services ADD COLUMN name_zh TEXT")
            db.execute("ALTER TABLE services ADD COLUMN description_zh TEXT")
            db.commit()

        # Migrate calendar_months from the old one-tradition/one-activity
        # schema to the new traditions[]/activities[] lists, if an older
        # database is being reused. Preserves every other table untouched.
        existing_cols = {row[1] for row in db.execute("PRAGMA table_info(calendar_months)").fetchall()}
        if "tradition_title" in existing_cols:
            old_rows = db.execute(
                "SELECT month_index, label, tradition_title, tradition_desc, "
                "activity_title, activity_desc, products, images FROM calendar_months"
            ).fetchall()
            db.execute("ALTER TABLE calendar_months RENAME TO calendar_months_old")
            db.execute(
                """
                CREATE TABLE calendar_months (
                    month_index INTEGER PRIMARY KEY,
                    label TEXT NOT NULL,
                    traditions TEXT NOT NULL DEFAULT '[]',
                    activities TEXT NOT NULL DEFAULT '[]',
                    products TEXT,
                    images TEXT NOT NULL DEFAULT '[]'
                )
                """
            )
            for r in old_rows:
                traditions = [{"title": r[2], "desc": r[3] or ""}] if r[2] else []
                activities = [{"title": r[4], "desc": r[5] or ""}] if r[4] else []
                db.execute(
                    "INSERT INTO calendar_months (month_index, label, traditions, activities, products, images) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (r[0], r[1], json.dumps(traditions), json.dumps(activities), r[6], r[7]),
                )
            db.execute("DROP TABLE calendar_months_old")
            db.commit()

        # Seed the products table once, from what is already live on the
        # site, so the admin panel starts populated instead of empty.
        seeded = db.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        if seeded == 0:
            now = datetime.now(timezone.utc).isoformat()
            seed_rows = [
                ("product", "ข้าวกล้องอินทรีย์", "ข้าวพันธุ์พื้นเมืองคัดพิเศษ ปลอดสารพิษ 100% ปลูกด้วยน้ำธรรมชาติ", "฿120 / กก.", [], 1),
                ("product", "ชาสมุนไพรป่า", "ชาสมุนไพรอบแห้ง กลิ่นหอมสดชื่น รสชาตินุ่มละมุน เสริมสร้างภูมิคุ้มกัน", "฿180 / กล่อง", [], 2),
                ("product", "ชะลอมจักสานไม้ไผ่", "งานฝีมือประณีตจากภูมิปัญญาผู้เฒ่าผู้แก่แม่หอพระ ใช้วัสดุธรรมชาติ", "฿85 / ชิ้น", ["images/product-baskets.jpg"], 3),
                ("product", "ไข่เค็ม/ไข่ต้มสมุนไพร", "ไข่แปรรูปพื้นบ้าน คัดสดจากฟาร์มชุมชน พร้อมผงโรยข้าวสูตรพื้นเมือง", "฿50 / แพ็ค", ["images/product-eggs.jpg"], 4),
                ("product", "ผลไม้แช่อิ่ม", "ผลไม้พื้นบ้านแปรรูปแช่อิ่ม รสชาติหวานละมุน เก็บได้นาน", "฿35 / กระปุก", ["images/product-preserves.jpg"], 5),
                ("product", "ผักสดตามฤดูกาล", "ผักปลอดสารพิษเก็บสดจากแปลงเกษตรของสมาชิกชุมชน", "สอบถามราคาหน้าร้าน", ["images/product-vegetables.jpg"], 6),
            ]
            db.executemany(
                "INSERT INTO products (kind, name, description, price_text, images, sort_order, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                [(row[0], row[1], row[2], row[3], _images_to_db(row[4]), row[5], now) for row in seed_rows],
            )
            db.commit()

        # Seed the services table once with the one real tour service already
        # on the site (as service_type "tour").
        seeded = db.execute("SELECT COUNT(*) FROM services").fetchone()[0]
        if seeded == 0:
            now = datetime.now(timezone.utc).isoformat()
            db.execute(
                "INSERT INTO services (service_type, name, description, images, price_text, "
                "schedule_text, includes_text, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    "tour",
                    "เที่ยววิถีชุมชนกับไกด์ท้องถิ่น",
                    "ทำสวยดอกไม้สักการะ กราบไหว้พระพุทธรูปอายุ 300 ปี เยี่ยมชมต้นตะเคียนโบราณ "
                    "เรียนรู้ภูมิปัญญาการทำถั่วเน่าสูตรอุ้ยเอื้อยแม่เฒ่า 100 ปี พร้อมรับประทานอาหารพื้นบ้านกลางวัน",
                    _images_to_db(["images/service-flyer.jpg"]),
                    "฿1,150 / ท่าน",
                    "ครึ่งวัน — รอบ 9.00–13.30 น. หรือ 12.00–16.00 น.",
                    "รวม: ไกด์นำเที่ยว, อาหารกลางวัน, ค่ากิจกรรม | ไม่รวม: ค่าเดินทางมาจุดนัดพบ",
                    1,
                    now,
                ),
            )
            db.commit()

        # Seed nearby_attractions once, from what is already live on the site.
        seeded = db.execute("SELECT COUNT(*) FROM nearby_attractions").fetchone()[0]
        if seeded == 0:
            now = datetime.now(timezone.utc).isoformat()
            nearby_rows = [
                ("อ.แม่แตง", "ล่องแพแม่น้ำแม่แตง", "กิจกรรมล่องแพลำน้ำแม่แตง ตื่นเต้นท่ามกลางหุบเขาและป่าเขียว", [], 1),
                ("อ.แม่แตง", "ปางช้างแม่แตง", "ศูนย์อนุรักษ์และกิจกรรมกับช้างในบรรยากาศธรรมชาติ", [], 2),
                ("อ.สันทราย", "มหาวิทยาลัยแม่โจ้", "แคมปัสสีเขียวชื่อดัง เที่ยวชมทุ่งดอกไม้เมืองหนาวตามฤดูกาล", [], 3),
                ("อ.พร้าว", "ดอยม่อนล้าน", "จุดชมวิวทะเลหมอกและพระอาทิตย์ขึ้นชื่อดังของเชียงใหม่ตอนเหนือ", [], 4),
            ]
            db.executemany(
                "INSERT INTO nearby_attractions (area_tag, name, description, images, sort_order, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                [(row[0], row[1], row[2], _images_to_db(row[3]), row[4], now) for row in nearby_rows],
            )
            db.commit()

        # Seed attractions once, from what is already live on the site.
        seeded = db.execute("SELECT COUNT(*) FROM attractions").fetchone()[0]
        if seeded == 0:
            now = datetime.now(timezone.utc).isoformat()
            attraction_rows = [
                ("nature", "ทุ่งนาอินทรีย์แม่หอพระ", "ธรรมชาติ",
                 "เดินเล่นชมทุ่งนาเขียวขจีสุดลูกหูลูกตา ถ่ายรูปคู่ป้ายชื่อตำบลกลางแปลงนา",
                 ["images/hero-field.jpg"], 1),
                ("culture", "วัดบ้านกาด", "วัฒนธรรม · ศรัทธา",
                 "กราบไหว้พระพุทธรูปโบราณอายุ 300 ปี และเยี่ยมชมต้นตะเคียนอายุหลายร้อยปี",
                 [], 2),
                ("nature", "น้ำตกหินปูน", "ธรรมชาติ",
                 "สายน้ำไหลผ่านชั้นหินปูนกลางป่าร่มรื่น เหมาะแก่การพักผ่อนและถ่ายภาพ",
                 ["images/attraction-waterfall.jpg"], 3),
                ("nature", "บ่อน้ำสีมรกต", "ธรรมชาติ",
                 "แอ่งน้ำใสสะท้อนสีเขียวมรกตกลางป่า บรรยากาศเงียบสงบร่มรื่น",
                 ["images/attraction-emerald.jpg"], 4),
                ("culture", "ถ้ำศักดิ์สิทธิ์", "วัฒนธรรม · ศรัทธา",
                 "ถ้ำธรรมชาติที่ประดิษฐานพระพุทธรูป เป็นที่เคารพสักการะของคนในพื้นที่",
                 ["images/attraction-cave.jpg"], 5),
            ]
            db.executemany(
                "INSERT INTO attractions (category, name, tag, description, images, sort_order, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                [(row[0], row[1], row[2], row[3], _images_to_db(row[4]), row[5], now) for row in attraction_rows],
            )
            db.commit()

        # Seed all 12 calendar months once (most start blank / "no data").
        seeded = db.execute("SELECT COUNT(*) FROM calendar_months").fetchone()[0]
        if seeded == 0:
            month_labels = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                             "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
            month_data = {
                0: {
                    "traditions": [{"title": "ตานข้าวใหม่", "desc": "ประเพณีถวายข้าวที่เพิ่งเกี่ยวใหม่แด่พระสงฆ์ตามวิถีชาวพุทธล้านนา เพื่อความเป็นสิริมงคลและความกตัญญูต่อแม่โพสพ"}],
                    "activities": [{"title": "ปิ้งข้าวจี่โบราณ", "desc": "นึ่งข้าวใหม่ด้วยหวดไม้ไผ่แบบดั้งเดิม ปั้นและปิ้งข้าวจี่ทาไข่เตาถ่านหอมกรุ่น ร่วมทำบุญตานข้าวใหม่ยามเช้ากับคนในชุมชน"}],
                    "products": "ข้าวเหนียวพันธุ์พื้นเมือง, ข้าวหอมอินทรีย์แม่หอพระ",
                },
                3: {
                    "traditions": [{"title": "ปี๋ใหม่เมือง & แห่ไม้ค้ำสะหลี", "desc": "สืบสานป๋าเวณีสงกรานต์ล้านนา ร่วมขบวนแห่ไม้ค้ำต้นโพธิ์เพื่อค้ำจุนพระศาสนาและชีวิตให้อยู่ร่มเย็นเป็นสุข"}],
                    "activities": [{"title": "ตกแต่งไม้ค้ำ & สรงน้ำพระ", "desc": "ประดิษฐ์สวยดอกและตกแต่งไม้ค้ำสะหลี รดน้ำดำหัวผู้เฒ่าผู้แก่ด้วยน้ำขมิ้นส้มป่อย ร่วมขบวนแห่ดนตรีพื้นเมืองล้านนา"}],
                    "products": "มะม่วงพื้นเมือง, พืชผักและดอกไม้หน้าร้อน",
                },
            }
            rows = []
            for i, label in enumerate(month_labels):
                d = month_data.get(i, {})
                rows.append((i, label, json.dumps(d.get("traditions", [])), json.dumps(d.get("activities", [])),
                             d.get("products"), _images_to_db([])))
            db.executemany(
                "INSERT INTO calendar_months (month_index, label, traditions, activities, products, images) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                rows,
            )
            db.commit()

        # Seed the 3 fixed seasonal-picks rows once, from what is already
        # live on the site.
        seeded = db.execute("SELECT COUNT(*) FROM seasons").fetchone()[0]
        if seeded == 0:
            season_rows = [
                ("summer", "มี.ค.–มิ.ย.", "อากาศแจ่มใสยามเช้า เหมาะเดินชมทุ่งนาและกราบไหว้พระที่วัดบ้านกาดก่อนแดดจัด", []),
                ("rainy", "ก.ค.–ต.ค.", "สายน้ำในน้ำตกและบ่อน้ำไหลแรงเต็มที่ ทุ่งนาเขียวขจีสุดสายตา เหมาะกับคนชอบธรรมชาติชุ่มฉ่ำ", []),
                ("winter", "พ.ย.–ก.พ.", "อากาศเย็นสบาย เหมาะเดินป่าเข้าชมถ้ำ พร้อมสัมผัสทุ่งข้าวสีทองในช่วงเก็บเกี่ยว", []),
            ]
            db.executemany(
                "INSERT INTO seasons (season_key, period_text, description, images) VALUES (?, ?, ?, ?)",
                [(row[0], row[1], row[2], _images_to_db(row[3])) for row in season_rows],
            )
            db.commit()

        # Seed a default flat shipping rate once.
        seeded = db.execute("SELECT COUNT(*) FROM site_settings WHERE key = 'shipping_flat_rate'").fetchone()[0]
        if seeded == 0:
            db.execute("INSERT INTO site_settings (key, value) VALUES ('shipping_flat_rate', '50')")
            db.commit()


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


# ============ SERVE THE FRONTEND (same Flask app, same origin) ============
# Keeps this to one deployable service: no separate static host, no CORS
# headaches, no hardcoded API URL to keep in sync between environments.
#
# no-cache on every response: this site is actively edited (HTML/CSS/JS
# change often during development, and content changes via the admin
# panel), so a browser silently serving a stale cached copy caused real
# confusion more than once. Bandwidth cost is irrelevant at this site's
# scale, so we simply always revalidate.

@app.after_request
def add_no_cache_headers(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response


@app.get("/")
def serve_index():
    return send_from_directory(WEBSITE_DIR, "index.html")


@app.get("/admin.html")
def serve_admin():
    return send_from_directory(WEBSITE_DIR, "admin.html")


@app.get("/<path:filename>")
def serve_static_asset(filename):
    return send_from_directory(WEBSITE_DIR, filename)


@app.post("/api/qa")
def submit_question():
    payload = request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    contact = (payload.get("contact") or "").strip()
    question = (payload.get("question") or "").strip()

    if not name or not contact or not question:
        return jsonify({"success": False, "error": "กรุณากรอกชื่อ ช่องทางติดต่อ และคำถามให้ครบถ้วน"}), 400

    db = get_db()
    cursor = db.execute(
        "INSERT INTO qa_submissions (name, contact, question, created_at) VALUES (?, ?, ?, ?)",
        (name, contact, question, datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    send_notification_email(name, contact, question)
    return jsonify({"success": True, "id": cursor.lastrowid}), 201


@app.get("/api/qa")
@require_admin
def list_questions():
    db = get_db()
    rows = db.execute(
        "SELECT id, name, contact, question, created_at, answered, answer "
        "FROM qa_submissions ORDER BY created_at DESC"
    ).fetchall()
    return jsonify([dict(row) for row in rows])


@app.patch("/api/qa/<int:question_id>")
@require_admin
def answer_question(question_id):
    payload = request.get_json(silent=True) or {}
    answer = (payload.get("answer") or "").strip()
    if not answer:
        return jsonify({"success": False, "error": "กรุณากรอกคำตอบ"}), 400

    db = get_db()
    result = db.execute(
        "UPDATE qa_submissions SET answered = 1, answer = ? WHERE id = ?",
        (answer, question_id),
    )
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบคำถามนี้"}), 404
    return jsonify({"success": True})


# ============ SITE SETTINGS (shipping rate) ============

@app.get("/api/settings/shipping")
def get_shipping_setting():
    db = get_db()
    row = db.execute("SELECT value FROM site_settings WHERE key = 'shipping_flat_rate'").fetchone()
    rate = float(row["value"]) if row else 0.0
    return jsonify({"shipping_flat_rate": rate})


@app.put("/api/settings/shipping")
@require_admin
def update_shipping_setting():
    payload = request.get_json(silent=True) or {}
    try:
        rate = float(payload.get("shipping_flat_rate"))
    except (TypeError, ValueError):
        return jsonify({"success": False, "error": "กรุณากรอกค่าจัดส่งเป็นตัวเลข"}), 400

    db = get_db()
    db.execute(
        "INSERT INTO site_settings (key, value) VALUES ('shipping_flat_rate', ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (str(rate),),
    )
    db.commit()
    return jsonify({"success": True})


# ============ ORDERS (product cart checkout) ============

@app.post("/api/orders")
def create_order():
    payload = request.get_json(silent=True) or {}
    customer_name = (payload.get("customer_name") or "").strip()
    customer_contact = (payload.get("customer_contact") or "").strip()
    customer_address = (payload.get("customer_address") or "").strip()
    notes = (payload.get("notes") or "").strip() or None
    cart_items = payload.get("items")

    if not customer_name or not customer_contact or not customer_address:
        return jsonify({"success": False, "error": "กรุณากรอกชื่อ ช่องทางติดต่อ และที่อยู่จัดส่งให้ครบถ้วน"}), 400
    if not isinstance(cart_items, list) or not cart_items:
        return jsonify({"success": False, "error": "ไม่มีสินค้าในตะกร้า"}), 400

    db = get_db()
    resolved_items = []
    subtotal = 0.0
    for entry in cart_items:
        if not isinstance(entry, dict):
            continue
        try:
            product_id = int(entry.get("product_id"))
            qty = max(1, int(entry.get("qty") or 1))
        except (TypeError, ValueError):
            continue
        row = db.execute(
            "SELECT id, name, price_amount FROM products WHERE id = ? AND kind = 'product'", (product_id,)
        ).fetchone()
        if not row or row["price_amount"] is None:
            continue
        line_total = row["price_amount"] * qty
        subtotal += line_total
        resolved_items.append({
            "product_id": row["id"], "name": row["name"], "price_amount": row["price_amount"],
            "qty": qty, "line_total": line_total,
        })

    if not resolved_items:
        return jsonify({"success": False, "error": "สินค้าที่เลือกไม่สามารถสั่งซื้อได้ (อาจไม่มีราคาแล้ว)"}), 400

    shipping_row = db.execute("SELECT value FROM site_settings WHERE key = 'shipping_flat_rate'").fetchone()
    shipping_cost = float(shipping_row["value"]) if shipping_row else 0.0
    total = subtotal + shipping_cost

    cursor = db.execute(
        "INSERT INTO orders (customer_name, customer_contact, customer_address, notes, items, "
        "subtotal, shipping_cost, total, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)",
        (customer_name, customer_contact, customer_address, notes, json.dumps(resolved_items),
         subtotal, shipping_cost, total, datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    return jsonify({
        "success": True, "id": cursor.lastrowid,
        "subtotal": subtotal, "shipping_cost": shipping_cost, "total": total,
    }), 201


@app.get("/api/orders")
@require_admin
def list_orders():
    db = get_db()
    rows = db.execute("SELECT * FROM orders ORDER BY created_at DESC").fetchall()
    result = []
    for row in rows:
        d = dict(row)
        try:
            d["items"] = json.loads(d.get("items") or "[]")
        except (TypeError, ValueError):
            d["items"] = []
        result.append(d)
    return jsonify(result)


@app.patch("/api/orders/<int:order_id>")
@require_admin
def update_order_status(order_id):
    payload = request.get_json(silent=True) or {}
    status = (payload.get("status") or "").strip()
    if status not in ("new", "confirmed", "shipped", "done"):
        return jsonify({"success": False, "error": "สถานะไม่ถูกต้อง"}), 400

    db = get_db()
    result = db.execute("UPDATE orders SET status = ? WHERE id = ?", (status, order_id))
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบคำสั่งซื้อนี้"}), 404
    return jsonify({"success": True})


# ============ BOOKINGS (service reservations) ============

@app.post("/api/bookings")
def create_booking():
    payload = request.get_json(silent=True) or {}
    service_id = payload.get("service_id")
    customer_name = (payload.get("customer_name") or "").strip()
    customer_contact = (payload.get("customer_contact") or "").strip()
    preferred_date = (payload.get("preferred_date") or "").strip() or None
    party_size = (payload.get("party_size") or "").strip() or None
    notes = (payload.get("notes") or "").strip() or None

    if not customer_name or not customer_contact:
        return jsonify({"success": False, "error": "กรุณากรอกชื่อและช่องทางติดต่อกลับให้ครบถ้วน"}), 400

    db = get_db()
    service_name = (payload.get("service_name") or "").strip()
    try:
        service_id = int(service_id)
        row = db.execute("SELECT name FROM services WHERE id = ?", (service_id,)).fetchone()
        if row:
            service_name = row["name"]
    except (TypeError, ValueError):
        service_id = None

    if not service_name:
        return jsonify({"success": False, "error": "ไม่พบบริการที่ต้องการจอง"}), 400

    cursor = db.execute(
        "INSERT INTO bookings (service_id, service_name, customer_name, customer_contact, preferred_date, "
        "party_size, notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?)",
        (service_id, service_name, customer_name, customer_contact, preferred_date, party_size, notes,
         datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    return jsonify({"success": True, "id": cursor.lastrowid}), 201


@app.get("/api/bookings")
@require_admin
def list_bookings():
    db = get_db()
    rows = db.execute("SELECT * FROM bookings ORDER BY created_at DESC").fetchall()
    return jsonify([dict(row) for row in rows])


@app.patch("/api/bookings/<int:booking_id>")
@require_admin
def update_booking_status(booking_id):
    payload = request.get_json(silent=True) or {}
    status = (payload.get("status") or "").strip()
    if status not in ("new", "confirmed", "done", "cancelled"):
        return jsonify({"success": False, "error": "สถานะไม่ถูกต้อง"}), 400

    db = get_db()
    result = db.execute("UPDATE bookings SET status = ? WHERE id = ?", (status, booking_id))
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบการจองนี้"}), 404
    return jsonify({"success": True})


# ============ ADMIN AUTH ============

@app.post("/api/admin/login")
def admin_login():
    if not ADMIN_PASSWORD:
        return jsonify({"success": False, "error": "ยังไม่ได้ตั้งรหัสผ่านแอดมิน (ADMIN_PASSWORD) ใน backend/.env"}), 500

    payload = request.get_json(silent=True) or {}
    password = payload.get("password") or ""
    if not secrets.compare_digest(password, ADMIN_PASSWORD):
        return jsonify({"success": False, "error": "รหัสผ่านไม่ถูกต้อง"}), 401

    token = secrets.token_urlsafe(32)
    ACTIVE_ADMIN_TOKENS.add(token)
    return jsonify({"success": True, "token": token})


@app.post("/api/admin/logout")
def admin_logout():
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    ACTIVE_ADMIN_TOKENS.discard(token)
    return jsonify({"success": True})


@app.get("/api/admin/check")
def admin_check():
    auth_header = request.headers.get("Authorization", "")
    token = auth_header.removeprefix("Bearer ").strip()
    return jsonify({"is_admin": token in ACTIVE_ADMIN_TOKENS})


# ============ IMAGE UPLOAD ============

@app.post("/api/upload")
@require_admin
def upload_image():
    file = request.files.get("image")
    if not file or not file.filename:
        return jsonify({"success": False, "error": "กรุณาเลือกไฟล์รูปภาพ"}), 400

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        return jsonify({"success": False, "error": "รองรับเฉพาะไฟล์ jpg, jpeg, png, webp, gif"}), 400

    filename = secure_filename(f"{uuid.uuid4().hex}.{ext}")
    file.save(os.path.join(UPLOADS_DIR, filename))
    url = f"{request.host_url.rstrip('/')}/uploads/{filename}"
    return jsonify({"success": True, "url": url}), 201


@app.get("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(UPLOADS_DIR, filename)


# ============ STORIES ============

@app.get("/api/stories")
def list_stories():
    db = get_db()
    rows = db.execute("SELECT * FROM stories ORDER BY published_at DESC, id DESC").fetchall()
    return jsonify([_row_with_images(row) for row in rows])


@app.post("/api/stories")
@require_admin
def create_story():
    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    excerpt = (payload.get("excerpt") or "").strip()
    title_en = (payload.get("title_en") or "").strip() or None
    excerpt_en = (payload.get("excerpt_en") or "").strip() or None
    title_zh = (payload.get("title_zh") or "").strip() or None
    excerpt_zh = (payload.get("excerpt_zh") or "").strip() or None
    images = _images_to_db(payload.get("images"))
    published_at = (payload.get("published_at") or "").strip() or datetime.now(timezone.utc).date().isoformat()

    if not title or not excerpt:
        return jsonify({"success": False, "error": "กรุณากรอกชื่อบทความและสรุปย่อ"}), 400

    db = get_db()
    cursor = db.execute(
        "INSERT INTO stories (title, excerpt, title_en, excerpt_en, title_zh, excerpt_zh, images, "
        "published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (title, excerpt, title_en, excerpt_en, title_zh, excerpt_zh, images, published_at,
         datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    return jsonify({"success": True, "id": cursor.lastrowid}), 201


@app.put("/api/stories/<int:story_id>")
@require_admin
def update_story(story_id):
    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    excerpt = (payload.get("excerpt") or "").strip()
    title_en = (payload.get("title_en") or "").strip() or None
    excerpt_en = (payload.get("excerpt_en") or "").strip() or None
    title_zh = (payload.get("title_zh") or "").strip() or None
    excerpt_zh = (payload.get("excerpt_zh") or "").strip() or None
    images = _images_to_db(payload.get("images"))
    published_at = (payload.get("published_at") or "").strip()

    if not title or not excerpt or not published_at:
        return jsonify({"success": False, "error": "กรุณากรอกข้อมูลให้ครบถ้วน"}), 400

    db = get_db()
    result = db.execute(
        "UPDATE stories SET title = ?, excerpt = ?, title_en = ?, excerpt_en = ?, title_zh = ?, "
        "excerpt_zh = ?, images = ?, published_at = ? WHERE id = ?",
        (title, excerpt, title_en, excerpt_en, title_zh, excerpt_zh, images, published_at, story_id),
    )
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบบทความนี้"}), 404
    return jsonify({"success": True})


@app.delete("/api/stories/<int:story_id>")
@require_admin
def delete_story(story_id):
    db = get_db()
    result = db.execute("DELETE FROM stories WHERE id = ?", (story_id,))
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบบทความนี้"}), 404
    return jsonify({"success": True})


# ============ PRODUCTS ============

@app.get("/api/products")
def list_products():
    db = get_db()
    rows = db.execute("SELECT * FROM products WHERE kind = 'product' ORDER BY sort_order, id").fetchall()
    return jsonify([_row_with_images(row) for row in rows])


def _parse_product_payload(payload):
    price_amount = payload.get("price_amount")
    try:
        price_amount = float(price_amount) if price_amount not in (None, "") else None
    except (TypeError, ValueError):
        price_amount = None
    return {
        "name": (payload.get("name") or "").strip(),
        "description": (payload.get("description") or "").strip(),
        "price_text": (payload.get("price_text") or "").strip() or None,
        "price_amount": price_amount,
        "images": _images_to_db(payload.get("images")),
        "tags": _images_to_db(payload.get("tags")),
        "sort_order": int(payload.get("sort_order") or 0),
        "name_en": (payload.get("name_en") or "").strip() or None,
        "description_en": (payload.get("description_en") or "").strip() or None,
        "name_zh": (payload.get("name_zh") or "").strip() or None,
        "description_zh": (payload.get("description_zh") or "").strip() or None,
    }


@app.post("/api/products")
@require_admin
def create_product():
    data = _parse_product_payload(request.get_json(silent=True) or {})
    if not data["name"] or not data["description"]:
        return jsonify({"success": False, "error": "กรุณากรอกชื่อและรายละเอียดให้ครบถ้วน"}), 400

    db = get_db()
    cursor = db.execute(
        "INSERT INTO products (kind, name, description, price_text, price_amount, images, tags, sort_order, "
        "name_en, description_en, name_zh, description_zh, created_at) "
        "VALUES ('product', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (data["name"], data["description"], data["price_text"], data["price_amount"], data["images"], data["tags"],
         data["sort_order"], data["name_en"], data["description_en"], data["name_zh"], data["description_zh"],
         datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    return jsonify({"success": True, "id": cursor.lastrowid}), 201


@app.put("/api/products/<int:product_id>")
@require_admin
def update_product(product_id):
    data = _parse_product_payload(request.get_json(silent=True) or {})
    if not data["name"] or not data["description"]:
        return jsonify({"success": False, "error": "กรุณากรอกชื่อและรายละเอียดให้ครบถ้วน"}), 400

    db = get_db()
    result = db.execute(
        "UPDATE products SET name = ?, description = ?, price_text = ?, price_amount = ?, images = ?, tags = ?, "
        "sort_order = ?, name_en = ?, description_en = ?, name_zh = ?, description_zh = ? "
        "WHERE id = ? AND kind = 'product'",
        (data["name"], data["description"], data["price_text"], data["price_amount"], data["images"], data["tags"],
         data["sort_order"], data["name_en"], data["description_en"], data["name_zh"], data["description_zh"],
         product_id),
    )
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบรายการนี้"}), 404
    return jsonify({"success": True})


@app.delete("/api/products/<int:product_id>")
@require_admin
def delete_product(product_id):
    db = get_db()
    result = db.execute("DELETE FROM products WHERE id = ? AND kind = 'product'", (product_id,))
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบรายการนี้"}), 404
    return jsonify({"success": True})


# ============ SERVICES (tour / guide / restaurant / massage / driver) ============

SERVICE_TYPES = ("tour", "guide", "restaurant", "massage", "driver")


@app.get("/api/services")
def list_services():
    db = get_db()
    rows = db.execute("SELECT * FROM services ORDER BY service_type, sort_order, id").fetchall()
    return jsonify([_row_with_images(row) for row in rows])


def _parse_service_payload(payload):
    return {
        "service_type": (payload.get("service_type") or "").strip(),
        "name": (payload.get("name") or "").strip(),
        "description": (payload.get("description") or "").strip(),
        "images": _images_to_db(payload.get("images")),
        "price_text": (payload.get("price_text") or "").strip() or None,
        "schedule_text": (payload.get("schedule_text") or "").strip() or None,
        "includes_text": (payload.get("includes_text") or "").strip() or None,
        "languages": (payload.get("languages") or "").strip() or None,
        "license_no": (payload.get("license_no") or "").strip() or None,
        "awards": (payload.get("awards") or "").strip() or None,
        "tags": _images_to_db(payload.get("tags")),
        "sort_order": int(payload.get("sort_order") or 0),
        "name_en": (payload.get("name_en") or "").strip() or None,
        "description_en": (payload.get("description_en") or "").strip() or None,
        "name_zh": (payload.get("name_zh") or "").strip() or None,
        "description_zh": (payload.get("description_zh") or "").strip() or None,
    }


@app.post("/api/services")
@require_admin
def create_service():
    data = _parse_service_payload(request.get_json(silent=True) or {})
    if data["service_type"] not in SERVICE_TYPES or not data["name"] or not data["description"]:
        return jsonify({"success": False, "error": "กรุณากรอกประเภทบริการ ชื่อ และรายละเอียดให้ครบถ้วน"}), 400

    db = get_db()
    cursor = db.execute(
        "INSERT INTO services (service_type, name, description, images, price_text, schedule_text, "
        "includes_text, languages, license_no, awards, tags, sort_order, name_en, description_en, "
        "name_zh, description_zh, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (data["service_type"], data["name"], data["description"], data["images"], data["price_text"],
         data["schedule_text"], data["includes_text"], data["languages"], data["license_no"],
         data["awards"], data["tags"], data["sort_order"],
         data["name_en"], data["description_en"], data["name_zh"], data["description_zh"],
         datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    return jsonify({"success": True, "id": cursor.lastrowid}), 201


@app.put("/api/services/<int:service_id>")
@require_admin
def update_service(service_id):
    data = _parse_service_payload(request.get_json(silent=True) or {})
    if data["service_type"] not in SERVICE_TYPES or not data["name"] or not data["description"]:
        return jsonify({"success": False, "error": "กรุณากรอกประเภทบริการ ชื่อ และรายละเอียดให้ครบถ้วน"}), 400

    db = get_db()
    result = db.execute(
        "UPDATE services SET service_type = ?, name = ?, description = ?, images = ?, price_text = ?, "
        "schedule_text = ?, includes_text = ?, languages = ?, license_no = ?, awards = ?, tags = ?, "
        "sort_order = ?, name_en = ?, description_en = ?, name_zh = ?, description_zh = ? WHERE id = ?",
        (data["service_type"], data["name"], data["description"], data["images"], data["price_text"],
         data["schedule_text"], data["includes_text"], data["languages"], data["license_no"],
         data["awards"], data["tags"], data["sort_order"],
         data["name_en"], data["description_en"], data["name_zh"], data["description_zh"], service_id),
    )
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบบริการนี้"}), 404
    return jsonify({"success": True})


@app.delete("/api/services/<int:service_id>")
@require_admin
def delete_service(service_id):
    db = get_db()
    result = db.execute("DELETE FROM services WHERE id = ?", (service_id,))
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบบริการนี้"}), 404
    return jsonify({"success": True})


# ============ ATTRACTIONS ============

@app.get("/api/attractions")
def list_attractions():
    db = get_db()
    rows = db.execute("SELECT * FROM attractions ORDER BY sort_order, id").fetchall()
    return jsonify([_row_with_images(row) for row in rows])


def _parse_attraction_payload(payload):
    map_url = (payload.get("map_url") or "").strip() or None
    lat, lng = _extract_lat_lng(map_url)
    return {
        "category": (payload.get("category") or "").strip(),
        "name": (payload.get("name") or "").strip(),
        "tag": (payload.get("tag") or "").strip() or None,
        "description": (payload.get("description") or "").strip(),
        "images": _images_to_db(payload.get("images")),
        "sort_order": int(payload.get("sort_order") or 0),
        "map_url": map_url,
        "lat": lat,
        "lng": lng,
        "name_en": (payload.get("name_en") or "").strip() or None,
        "description_en": (payload.get("description_en") or "").strip() or None,
        "name_zh": (payload.get("name_zh") or "").strip() or None,
        "description_zh": (payload.get("description_zh") or "").strip() or None,
    }


@app.post("/api/attractions")
@require_admin
def create_attraction():
    data = _parse_attraction_payload(request.get_json(silent=True) or {})
    if data["category"] not in ("nature", "culture") or not data["name"] or not data["description"]:
        return jsonify({"success": False, "error": "กรุณากรอกหมวดหมู่ ชื่อ และรายละเอียดให้ครบถ้วน"}), 400

    db = get_db()
    cursor = db.execute(
        "INSERT INTO attractions (category, name, tag, description, images, sort_order, "
        "map_url, lat, lng, name_en, description_en, name_zh, description_zh, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (data["category"], data["name"], data["tag"], data["description"], data["images"],
         data["sort_order"], data["map_url"], data["lat"], data["lng"],
         data["name_en"], data["description_en"], data["name_zh"], data["description_zh"],
         datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    return jsonify({"success": True, "id": cursor.lastrowid, "lat": data["lat"], "lng": data["lng"]}), 201


@app.put("/api/attractions/<int:attraction_id>")
@require_admin
def update_attraction(attraction_id):
    data = _parse_attraction_payload(request.get_json(silent=True) or {})
    if data["category"] not in ("nature", "culture") or not data["name"] or not data["description"]:
        return jsonify({"success": False, "error": "กรุณากรอกหมวดหมู่ ชื่อ และรายละเอียดให้ครบถ้วน"}), 400

    db = get_db()
    result = db.execute(
        "UPDATE attractions SET category = ?, name = ?, tag = ?, description = ?, images = ?, "
        "sort_order = ?, map_url = ?, lat = ?, lng = ?, name_en = ?, description_en = ?, "
        "name_zh = ?, description_zh = ? WHERE id = ?",
        (data["category"], data["name"], data["tag"], data["description"], data["images"],
         data["sort_order"], data["map_url"], data["lat"], data["lng"],
         data["name_en"], data["description_en"], data["name_zh"], data["description_zh"], attraction_id),
    )
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบแหล่งท่องเที่ยวนี้"}), 404
    return jsonify({"success": True, "lat": data["lat"], "lng": data["lng"]})


@app.delete("/api/attractions/<int:attraction_id>")
@require_admin
def delete_attraction(attraction_id):
    db = get_db()
    result = db.execute("DELETE FROM attractions WHERE id = ?", (attraction_id,))
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบแหล่งท่องเที่ยวนี้"}), 404
    return jsonify({"success": True})


# ============ NEARBY ATTRACTIONS ============

@app.get("/api/nearby-attractions")
def list_nearby_attractions():
    db = get_db()
    rows = db.execute("SELECT * FROM nearby_attractions ORDER BY sort_order, id").fetchall()
    return jsonify([_row_with_images(row) for row in rows])


def _parse_nearby_payload(payload):
    return {
        "area_tag": (payload.get("area_tag") or "").strip(),
        "name": (payload.get("name") or "").strip(),
        "description": (payload.get("description") or "").strip(),
        "images": _images_to_db(payload.get("images")),
        "sort_order": int(payload.get("sort_order") or 0),
    }


@app.post("/api/nearby-attractions")
@require_admin
def create_nearby_attraction():
    data = _parse_nearby_payload(request.get_json(silent=True) or {})
    if not data["area_tag"] or not data["name"] or not data["description"]:
        return jsonify({"success": False, "error": "กรุณากรอกพื้นที่ ชื่อ และรายละเอียดให้ครบถ้วน"}), 400

    db = get_db()
    cursor = db.execute(
        "INSERT INTO nearby_attractions (area_tag, name, description, images, sort_order, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (data["area_tag"], data["name"], data["description"], data["images"],
         data["sort_order"], datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    return jsonify({"success": True, "id": cursor.lastrowid}), 201


@app.put("/api/nearby-attractions/<int:item_id>")
@require_admin
def update_nearby_attraction(item_id):
    data = _parse_nearby_payload(request.get_json(silent=True) or {})
    if not data["area_tag"] or not data["name"] or not data["description"]:
        return jsonify({"success": False, "error": "กรุณากรอกพื้นที่ ชื่อ และรายละเอียดให้ครบถ้วน"}), 400

    db = get_db()
    result = db.execute(
        "UPDATE nearby_attractions SET area_tag = ?, name = ?, description = ?, images = ?, sort_order = ? "
        "WHERE id = ?",
        (data["area_tag"], data["name"], data["description"], data["images"], data["sort_order"], item_id),
    )
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบรายการนี้"}), 404
    return jsonify({"success": True})


@app.delete("/api/nearby-attractions/<int:item_id>")
@require_admin
def delete_nearby_attraction(item_id):
    db = get_db()
    result = db.execute("DELETE FROM nearby_attractions WHERE id = ?", (item_id,))
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบรายการนี้"}), 404
    return jsonify({"success": True})


# ============ HIGHLIGHTS ("สิ่งที่น่าสนใจ") ============

@app.get("/api/highlights")
def list_highlights():
    db = get_db()
    rows = db.execute("SELECT * FROM highlights ORDER BY sort_order, id").fetchall()
    return jsonify([_row_with_images(row) for row in rows])


def _parse_highlight_payload(payload):
    return {
        "name": (payload.get("name") or "").strip(),
        "description": (payload.get("description") or "").strip(),
        "images": _images_to_db(payload.get("images")),
        "sort_order": int(payload.get("sort_order") or 0),
    }


@app.post("/api/highlights")
@require_admin
def create_highlight():
    data = _parse_highlight_payload(request.get_json(silent=True) or {})
    if not data["name"] or not data["description"]:
        return jsonify({"success": False, "error": "กรุณากรอกชื่อและรายละเอียดให้ครบถ้วน"}), 400

    db = get_db()
    cursor = db.execute(
        "INSERT INTO highlights (name, description, images, sort_order, created_at) VALUES (?, ?, ?, ?, ?)",
        (data["name"], data["description"], data["images"], data["sort_order"],
         datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    return jsonify({"success": True, "id": cursor.lastrowid}), 201


@app.put("/api/highlights/<int:item_id>")
@require_admin
def update_highlight(item_id):
    data = _parse_highlight_payload(request.get_json(silent=True) or {})
    if not data["name"] or not data["description"]:
        return jsonify({"success": False, "error": "กรุณากรอกชื่อและรายละเอียดให้ครบถ้วน"}), 400

    db = get_db()
    result = db.execute(
        "UPDATE highlights SET name = ?, description = ?, images = ?, sort_order = ? WHERE id = ?",
        (data["name"], data["description"], data["images"], data["sort_order"], item_id),
    )
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบรายการนี้"}), 404
    return jsonify({"success": True})


@app.delete("/api/highlights/<int:item_id>")
@require_admin
def delete_highlight(item_id):
    db = get_db()
    result = db.execute("DELETE FROM highlights WHERE id = ?", (item_id,))
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบรายการนี้"}), 404
    return jsonify({"success": True})


# ============ CALENDAR (12 MONTHS) ============

@app.get("/api/calendar")
def list_calendar():
    db = get_db()
    rows = db.execute("SELECT * FROM calendar_months ORDER BY month_index").fetchall()
    result = []
    for row in rows:
        d = _row_with_images(row)
        for key in ("traditions", "activities"):
            try:
                d[key] = json.loads(d.get(key) or "[]")
            except (TypeError, ValueError):
                d[key] = []
        result.append(d)
    return jsonify(result)


def _clean_entry_list(raw):
    """A list of {title, desc} from the request -> the same, minus blank entries."""
    if not isinstance(raw, list):
        return []
    cleaned = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        title = (entry.get("title") or "").strip()
        desc = (entry.get("desc") or "").strip()
        if title or desc:
            cleaned.append({"title": title, "desc": desc})
    return cleaned


@app.put("/api/calendar/<int:month_index>")
@require_admin
def update_calendar_month(month_index):
    if not 0 <= month_index <= 11:
        return jsonify({"success": False, "error": "เดือนไม่ถูกต้อง"}), 400

    payload = request.get_json(silent=True) or {}
    traditions = json.dumps(_clean_entry_list(payload.get("traditions")))
    activities = json.dumps(_clean_entry_list(payload.get("activities")))
    products = (payload.get("products") or "").strip() or None
    images = _images_to_db(payload.get("images"))

    db = get_db()
    result = db.execute(
        "UPDATE calendar_months SET traditions = ?, activities = ?, products = ?, images = ? "
        "WHERE month_index = ?",
        (traditions, activities, products, images, month_index),
    )
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบเดือนนี้"}), 404
    return jsonify({"success": True})


# ============ SEASONAL PICKS ("แนะนำแหล่งท่องเที่ยวตามฤดูกาล") ============

SEASON_KEYS = ("summer", "rainy", "winter")


@app.get("/api/seasons")
def list_seasons():
    db = get_db()
    rows = db.execute("SELECT * FROM seasons").fetchall()
    by_key = {row["season_key"]: _row_with_images(row) for row in rows}
    return jsonify([by_key[k] for k in SEASON_KEYS if k in by_key])


@app.put("/api/seasons/<season_key>")
@require_admin
def update_season(season_key):
    if season_key not in SEASON_KEYS:
        return jsonify({"success": False, "error": "ฤดูกาลไม่ถูกต้อง"}), 400

    payload = request.get_json(silent=True) or {}
    period_text = (payload.get("period_text") or "").strip()
    description = (payload.get("description") or "").strip()
    images = _images_to_db(payload.get("images"))

    db = get_db()
    result = db.execute(
        "UPDATE seasons SET period_text = ?, description = ?, images = ? WHERE season_key = ?",
        (period_text, description, images, season_key),
    )
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบฤดูกาลนี้"}), 404
    return jsonify({"success": True})


# Runs at import time too (not just when launched directly), so a
# production WSGI server (gunicorn, PythonAnywhere, etc.) that imports
# this module without running it as __main__ still gets the database
# created and seeded.
init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5050"))
    app.run(host="0.0.0.0", port=port, debug=False)
