import os
import secrets
import smtplib
import sqlite3
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
            CREATE TABLE IF NOT EXISTS stories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                excerpt TEXT NOT NULL,
                image_path TEXT,
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
                image_path TEXT,
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
                image_path TEXT,
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
                tradition_title TEXT,
                tradition_desc TEXT,
                activity_title TEXT,
                activity_desc TEXT,
                products TEXT
            )
            """
        )
        db.commit()

        # Seed the products/services table once, from what is already live on
        # the site, so the admin panel starts populated instead of empty.
        seeded = db.execute("SELECT COUNT(*) FROM products").fetchone()[0]
        if seeded == 0:
            now = datetime.now(timezone.utc).isoformat()
            seed_rows = [
                ("product", "ข้าวกล้องอินทรีย์", "ข้าวพันธุ์พื้นเมืองคัดพิเศษ ปลอดสารพิษ 100% ปลูกด้วยน้ำธรรมชาติ", "฿120 / กก.", None, 1),
                ("product", "ชาสมุนไพรป่า", "ชาสมุนไพรอบแห้ง กลิ่นหอมสดชื่น รสชาตินุ่มละมุน เสริมสร้างภูมิคุ้มกัน", "฿180 / กล่อง", None, 2),
                ("product", "ชะลอมจักสานไม้ไผ่", "งานฝีมือประณีตจากภูมิปัญญาผู้เฒ่าผู้แก่แม่หอพระ ใช้วัสดุธรรมชาติ", "฿85 / ชิ้น", "images/product-baskets.jpg", 3),
                ("product", "ไข่เค็ม/ไข่ต้มสมุนไพร", "ไข่แปรรูปพื้นบ้าน คัดสดจากฟาร์มชุมชน พร้อมผงโรยข้าวสูตรพื้นเมือง", "฿50 / แพ็ค", "images/product-eggs.jpg", 4),
                ("product", "ผลไม้แช่อิ่ม", "ผลไม้พื้นบ้านแปรรูปแช่อิ่ม รสชาติหวานละมุน เก็บได้นาน", "฿35 / กระปุก", "images/product-preserves.jpg", 5),
                ("product", "ผักสดตามฤดูกาล", "ผักปลอดสารพิษเก็บสดจากแปลงเกษตรของสมาชิกชุมชน", "สอบถามราคาหน้าร้าน", "images/product-vegetables.jpg", 6),
                ("service", "เที่ยววิถีชุมชนกับไกด์ท้องถิ่น", "รอบ 9.00–13.30 น. หรือ 12.00–16.00 น. — ทำสวยดอกไม้สักการะ กราบไหว้พระพุทธรูปอายุ 300 ปี เยี่ยมชมต้นตะเคียนโบราณ เรียนรู้ภูมิปัญญาการทำถั่วเน่าสูตรอุ้ยเอื้อยแม่เฒ่า 100 ปี พร้อมรับประทานอาหารพื้นบ้านกลางวัน", "฿1,150 / ท่าน", "images/service-flyer.jpg", 1),
            ]
            db.executemany(
                "INSERT INTO products (kind, name, description, price_text, image_path, sort_order, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                [(*row, now) for row in seed_rows],
            )
            db.commit()

        # Seed attractions once, from what is already live on the site.
        seeded = db.execute("SELECT COUNT(*) FROM attractions").fetchone()[0]
        if seeded == 0:
            now = datetime.now(timezone.utc).isoformat()
            attraction_rows = [
                ("nature", "ทุ่งนาอินทรีย์แม่หอพระ", "ธรรมชาติ",
                 "เดินเล่นชมทุ่งนาเขียวขจีสุดลูกหูลูกตา ถ่ายรูปคู่ป้ายชื่อตำบลกลางแปลงนา",
                 "images/hero-field.jpg", 1),
                ("culture", "วัดบ้านกาด", "วัฒนธรรม · ศรัทธา",
                 "กราบไหว้พระพุทธรูปโบราณอายุ 300 ปี และเยี่ยมชมต้นตะเคียนอายุหลายร้อยปี",
                 None, 2),
                ("nature", "น้ำตกหินปูน", "ธรรมชาติ",
                 "สายน้ำไหลผ่านชั้นหินปูนกลางป่าร่มรื่น เหมาะแก่การพักผ่อนและถ่ายภาพ",
                 "images/attraction-waterfall.jpg", 3),
                ("nature", "บ่อน้ำสีมรกต", "ธรรมชาติ",
                 "แอ่งน้ำใสสะท้อนสีเขียวมรกตกลางป่า บรรยากาศเงียบสงบร่มรื่น",
                 "images/attraction-emerald.jpg", 4),
                ("culture", "ถ้ำศักดิ์สิทธิ์", "วัฒนธรรม · ศรัทธา",
                 "ถ้ำธรรมชาติที่ประดิษฐานพระพุทธรูป เป็นที่เคารพสักการะของคนในพื้นที่",
                 "images/attraction-cave.jpg", 5),
            ]
            db.executemany(
                "INSERT INTO attractions (category, name, tag, description, image_path, sort_order, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                [(*row, now) for row in attraction_rows],
            )
            db.commit()

        # Seed all 12 calendar months once (most start blank / "no data").
        seeded = db.execute("SELECT COUNT(*) FROM calendar_months").fetchone()[0]
        if seeded == 0:
            month_labels = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
                             "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."]
            month_data = {
                0: {
                    "tradition_title": "ตานข้าวใหม่",
                    "tradition_desc": "ประเพณีถวายข้าวที่เพิ่งเกี่ยวใหม่แด่พระสงฆ์ตามวิถีชาวพุทธล้านนา เพื่อความเป็นสิริมงคลและความกตัญญูต่อแม่โพสพ",
                    "activity_title": "ปิ้งข้าวจี่โบราณ",
                    "activity_desc": "นึ่งข้าวใหม่ด้วยหวดไม้ไผ่แบบดั้งเดิม ปั้นและปิ้งข้าวจี่ทาไข่เตาถ่านหอมกรุ่น ร่วมทำบุญตานข้าวใหม่ยามเช้ากับคนในชุมชน",
                    "products": "ข้าวเหนียวพันธุ์พื้นเมือง, ข้าวหอมอินทรีย์แม่หอพระ",
                },
                3: {
                    "tradition_title": "ปี๋ใหม่เมือง & แห่ไม้ค้ำสะหลี",
                    "tradition_desc": "สืบสานป๋าเวณีสงกรานต์ล้านนา ร่วมขบวนแห่ไม้ค้ำต้นโพธิ์เพื่อค้ำจุนพระศาสนาและชีวิตให้อยู่ร่มเย็นเป็นสุข",
                    "activity_title": "ตกแต่งไม้ค้ำ & สรงน้ำพระ",
                    "activity_desc": "ประดิษฐ์สวยดอกและตกแต่งไม้ค้ำสะหลี รดน้ำดำหัวผู้เฒ่าผู้แก่ด้วยน้ำขมิ้นส้มป่อย ร่วมขบวนแห่ดนตรีพื้นเมืองล้านนา",
                    "products": "มะม่วงพื้นเมือง, พืชผักและดอกไม้หน้าร้อน",
                },
            }
            rows = []
            for i, label in enumerate(month_labels):
                d = month_data.get(i, {})
                rows.append((i, label, d.get("tradition_title"), d.get("tradition_desc"),
                             d.get("activity_title"), d.get("activity_desc"), d.get("products")))
            db.executemany(
                "INSERT INTO calendar_months (month_index, label, tradition_title, tradition_desc, "
                "activity_title, activity_desc, products) VALUES (?, ?, ?, ?, ?, ?, ?)",
                rows,
            )
            db.commit()


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


# ============ SERVE THE FRONTEND (same Flask app, same origin) ============
# Keeps this to one deployable service: no separate static host, no CORS
# headaches, no hardcoded API URL to keep in sync between environments.

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
    return jsonify([dict(row) for row in rows])


@app.post("/api/stories")
@require_admin
def create_story():
    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    excerpt = (payload.get("excerpt") or "").strip()
    image_path = (payload.get("image_path") or "").strip() or None
    published_at = (payload.get("published_at") or "").strip() or datetime.now(timezone.utc).date().isoformat()

    if not title or not excerpt:
        return jsonify({"success": False, "error": "กรุณากรอกชื่อบทความและสรุปย่อ"}), 400

    db = get_db()
    cursor = db.execute(
        "INSERT INTO stories (title, excerpt, image_path, published_at, created_at) VALUES (?, ?, ?, ?, ?)",
        (title, excerpt, image_path, published_at, datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    return jsonify({"success": True, "id": cursor.lastrowid}), 201


@app.put("/api/stories/<int:story_id>")
@require_admin
def update_story(story_id):
    payload = request.get_json(silent=True) or {}
    title = (payload.get("title") or "").strip()
    excerpt = (payload.get("excerpt") or "").strip()
    image_path = (payload.get("image_path") or "").strip() or None
    published_at = (payload.get("published_at") or "").strip()

    if not title or not excerpt or not published_at:
        return jsonify({"success": False, "error": "กรุณากรอกข้อมูลให้ครบถ้วน"}), 400

    db = get_db()
    result = db.execute(
        "UPDATE stories SET title = ?, excerpt = ?, image_path = ?, published_at = ? WHERE id = ?",
        (title, excerpt, image_path, published_at, story_id),
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


# ============ PRODUCTS & SERVICES ============

@app.get("/api/products")
def list_products():
    db = get_db()
    rows = db.execute("SELECT * FROM products ORDER BY kind, sort_order, id").fetchall()
    return jsonify([dict(row) for row in rows])


def _parse_product_payload(payload):
    return {
        "kind": (payload.get("kind") or "").strip(),
        "name": (payload.get("name") or "").strip(),
        "description": (payload.get("description") or "").strip(),
        "price_text": (payload.get("price_text") or "").strip() or None,
        "image_path": (payload.get("image_path") or "").strip() or None,
        "sort_order": int(payload.get("sort_order") or 0),
    }


@app.post("/api/products")
@require_admin
def create_product():
    data = _parse_product_payload(request.get_json(silent=True) or {})
    if data["kind"] not in ("product", "service") or not data["name"] or not data["description"]:
        return jsonify({"success": False, "error": "กรุณากรอกประเภท ชื่อ และรายละเอียดให้ครบถ้วน"}), 400

    db = get_db()
    cursor = db.execute(
        "INSERT INTO products (kind, name, description, price_text, image_path, sort_order, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (data["kind"], data["name"], data["description"], data["price_text"], data["image_path"],
         data["sort_order"], datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    return jsonify({"success": True, "id": cursor.lastrowid}), 201


@app.put("/api/products/<int:product_id>")
@require_admin
def update_product(product_id):
    data = _parse_product_payload(request.get_json(silent=True) or {})
    if data["kind"] not in ("product", "service") or not data["name"] or not data["description"]:
        return jsonify({"success": False, "error": "กรุณากรอกประเภท ชื่อ และรายละเอียดให้ครบถ้วน"}), 400

    db = get_db()
    result = db.execute(
        "UPDATE products SET kind = ?, name = ?, description = ?, price_text = ?, image_path = ?, sort_order = ? "
        "WHERE id = ?",
        (data["kind"], data["name"], data["description"], data["price_text"], data["image_path"],
         data["sort_order"], product_id),
    )
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบรายการนี้"}), 404
    return jsonify({"success": True})


@app.delete("/api/products/<int:product_id>")
@require_admin
def delete_product(product_id):
    db = get_db()
    result = db.execute("DELETE FROM products WHERE id = ?", (product_id,))
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบรายการนี้"}), 404
    return jsonify({"success": True})


# ============ ATTRACTIONS ============

@app.get("/api/attractions")
def list_attractions():
    db = get_db()
    rows = db.execute("SELECT * FROM attractions ORDER BY sort_order, id").fetchall()
    return jsonify([dict(row) for row in rows])


def _parse_attraction_payload(payload):
    return {
        "category": (payload.get("category") or "").strip(),
        "name": (payload.get("name") or "").strip(),
        "tag": (payload.get("tag") or "").strip() or None,
        "description": (payload.get("description") or "").strip(),
        "image_path": (payload.get("image_path") or "").strip() or None,
        "sort_order": int(payload.get("sort_order") or 0),
    }


@app.post("/api/attractions")
@require_admin
def create_attraction():
    data = _parse_attraction_payload(request.get_json(silent=True) or {})
    if data["category"] not in ("nature", "culture") or not data["name"] or not data["description"]:
        return jsonify({"success": False, "error": "กรุณากรอกหมวดหมู่ ชื่อ และรายละเอียดให้ครบถ้วน"}), 400

    db = get_db()
    cursor = db.execute(
        "INSERT INTO attractions (category, name, tag, description, image_path, sort_order, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (data["category"], data["name"], data["tag"], data["description"], data["image_path"],
         data["sort_order"], datetime.now(timezone.utc).isoformat()),
    )
    db.commit()
    return jsonify({"success": True, "id": cursor.lastrowid}), 201


@app.put("/api/attractions/<int:attraction_id>")
@require_admin
def update_attraction(attraction_id):
    data = _parse_attraction_payload(request.get_json(silent=True) or {})
    if data["category"] not in ("nature", "culture") or not data["name"] or not data["description"]:
        return jsonify({"success": False, "error": "กรุณากรอกหมวดหมู่ ชื่อ และรายละเอียดให้ครบถ้วน"}), 400

    db = get_db()
    result = db.execute(
        "UPDATE attractions SET category = ?, name = ?, tag = ?, description = ?, image_path = ?, "
        "sort_order = ? WHERE id = ?",
        (data["category"], data["name"], data["tag"], data["description"], data["image_path"],
         data["sort_order"], attraction_id),
    )
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบแหล่งท่องเที่ยวนี้"}), 404
    return jsonify({"success": True})


@app.delete("/api/attractions/<int:attraction_id>")
@require_admin
def delete_attraction(attraction_id):
    db = get_db()
    result = db.execute("DELETE FROM attractions WHERE id = ?", (attraction_id,))
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบแหล่งท่องเที่ยวนี้"}), 404
    return jsonify({"success": True})


# ============ CALENDAR (12 MONTHS) ============

@app.get("/api/calendar")
def list_calendar():
    db = get_db()
    rows = db.execute("SELECT * FROM calendar_months ORDER BY month_index").fetchall()
    return jsonify([dict(row) for row in rows])


@app.put("/api/calendar/<int:month_index>")
@require_admin
def update_calendar_month(month_index):
    if not 0 <= month_index <= 11:
        return jsonify({"success": False, "error": "เดือนไม่ถูกต้อง"}), 400

    payload = request.get_json(silent=True) or {}
    tradition_title = (payload.get("tradition_title") or "").strip() or None
    tradition_desc = (payload.get("tradition_desc") or "").strip() or None
    activity_title = (payload.get("activity_title") or "").strip() or None
    activity_desc = (payload.get("activity_desc") or "").strip() or None
    products = (payload.get("products") or "").strip() or None

    db = get_db()
    result = db.execute(
        "UPDATE calendar_months SET tradition_title = ?, tradition_desc = ?, activity_title = ?, "
        "activity_desc = ?, products = ? WHERE month_index = ?",
        (tradition_title, tradition_desc, activity_title, activity_desc, products, month_index),
    )
    db.commit()
    if result.rowcount == 0:
        return jsonify({"success": False, "error": "ไม่พบเดือนนี้"}), 404
    return jsonify({"success": True})


# Runs at import time too (not just when launched directly), so a
# production WSGI server (gunicorn, PythonAnywhere, etc.) that imports
# this module without running it as __main__ still gets the database
# created and seeded.
init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5050"))
    app.run(host="0.0.0.0", port=port, debug=False)
