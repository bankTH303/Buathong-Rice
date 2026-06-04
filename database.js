const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// เชื่อมต่อฐานข้อมูล SQLite
const db = new Database(path.join(DATA_DIR, 'buathong.db'));

// สร้างตาราง (Tables)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, email TEXT UNIQUE, phone TEXT, password TEXT,
    province TEXT, district TEXT, subdistrict TEXT, zipcode TEXT, address_detail TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, category TEXT, price REAL, unit TEXT,
    min_order INTEGER, emoji TEXT, image TEXT, badge TEXT, badge_type TEXT,
    description TEXT, active INTEGER DEFAULT 1, price_tiers TEXT DEFAULT '[]',
    sort_order INTEGER DEFAULT 0,
    old_price REAL DEFAULT 0,
    badge_color TEXT DEFAULT '#E53E3E',
    badge_text_color TEXT DEFAULT '#FFFFFF',
    weight REAL DEFAULT 5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    customer_name TEXT, customer_phone TEXT, customer_addr TEXT,
    note TEXT, total REAL, status TEXT DEFAULT 'รอดำเนินการ', 
    tracking_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER, product_id INTEGER, name TEXT, emoji TEXT, image TEXT, qty INTEGER, price REAL,
    FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, phone TEXT, business TEXT, message TEXT, 
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- 📍 ตารางใหม่สำหรับเก็บการตั้งค่าหน้าเว็บ (Web Edit)
  CREATE TABLE IF NOT EXISTS web_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    slide1 TEXT, slide2 TEXT, slide3 TEXT,
    title TEXT, sub TEXT, desc TEXT,
    btn1_text TEXT, btn1_url TEXT,
    btn2_text TEXT, btn2_url TEXT
  );
`);

// อัปเดตตารางเก่าให้รองรับฟีเจอร์ใหม่
try { db.prepare('ALTER TABLE products ADD COLUMN image TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE order_items ADD COLUMN image TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE products ADD COLUMN price_tiers TEXT DEFAULT "[]"').run(); } catch (e) {}
try { db.prepare('ALTER TABLE orders ADD COLUMN user_id INTEGER').run(); } catch (e) {}
try { db.prepare('ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0').run(); } catch (e) {}
try { db.prepare('ALTER TABLE orders ADD COLUMN tracking_number TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE products ADD COLUMN old_price REAL DEFAULT 0').run(); } catch (e) {}
try { db.prepare('ALTER TABLE products ADD COLUMN badge_color TEXT DEFAULT "#E53E3E"').run(); } catch (e) {}
try { db.prepare('ALTER TABLE products ADD COLUMN badge_text_color TEXT DEFAULT "#FFFFFF"').run(); } catch (e) {}
try { db.prepare('ALTER TABLE products ADD COLUMN weight REAL DEFAULT 5').run(); } catch (e) {}

// 📍 ตั้งค่าเริ่มต้นของหน้าเว็บ (ถ้าเปิดระบบครั้งแรก)
const checkSettings = db.prepare('SELECT COUNT(*) as count FROM web_settings').get();
if (checkSettings.count === 0) {
  db.prepare(`INSERT INTO web_settings (id, slide1, slide2, slide3, title, sub, desc, btn1_text, btn1_url, btn2_text, btn2_url) 
              VALUES (1, 'BG.jpg', '', '', 'ข้าวสารคุณภาพ<span class="em">บัวทองไรซ์</span>', 'ส่งตรงจากโรงสี สู่มือคุณ', 'ข้าวหอมมะลิ ข้าวเสาไห้ ข้าวเหนียว และข้าวอีกหลากหลายชนิด คัดสรรคุณภาพทุกเมล็ด พร้อมบริการขายส่งและขายปลีกสำหรับร้านค้า ห้างสรรพสินค้า และครัวเรือนทั่วไป', '🌾 ดูสินค้าทั้งหมด', '#products', '📞 ติดต่อสั่งซื้อ', 'https://line.me/ti/p/8LkqNjSM_T')`).run();
}

// เพิ่มข้อมูลสินค้าเริ่มต้น
const checkProducts = db.prepare('SELECT COUNT(*) as count FROM products').get();
if (checkProducts.count === 0) {
  const insertStmt = db.prepare(`INSERT INTO products (name, category, price, unit, min_order, emoji, badge, badge_type, description, sort_order, old_price, badge_color, badge_text_color, weight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  
  const initialProducts = [
    ['ข้าวหอมมะลิ 100% ตรา ดอกบัวรวง', 'jasmine', 320, 'กระสอบ 5 กก.', 10, '🌾', 'ขายดีสุด', 'hot', 'ข้าวหอมมะลิแท้ 100% จากทุ่งกุลาร้องไห้', 1, 350, '#E53E3E', '#FFFFFF', 5],
    ['ข้าวเสาไห้ ตราดอกบัว', 'saohai', 370, 'กระสอบ 5 กก.', 10, '🌻', null, null, 'ข้าวเสาไห้แท้ หุงนุ่ม เมล็ดสวย', 2, 0, '#E53E3E', '#FFFFFF', 5]
  ];

  initialProducts.forEach(p => insertStmt.run(p));
}

module.exports = { db };
