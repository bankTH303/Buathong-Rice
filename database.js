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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    customer_name TEXT, customer_phone TEXT, customer_addr TEXT,
    note TEXT, total REAL, status TEXT DEFAULT 'รอดำเนินการ', 
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
`);

// อัปเดตตารางเก่าให้รองรับฟีเจอร์ใหม่
try { db.prepare('ALTER TABLE products ADD COLUMN image TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE order_items ADD COLUMN image TEXT').run(); } catch (e) {}
try { db.prepare('ALTER TABLE products ADD COLUMN price_tiers TEXT DEFAULT "[]"').run(); } catch (e) {}
try { db.prepare('ALTER TABLE orders ADD COLUMN user_id INTEGER').run(); } catch (e) {}
try { db.prepare('ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0').run(); } catch (e) {}

// เพิ่มข้อมูลสินค้าเริ่มต้น
const checkProducts = db.prepare('SELECT COUNT(*) as count FROM products').get();
if (checkProducts.count === 0) {
  const insertStmt = db.prepare(`INSERT INTO products (name, category, price, unit, min_order, emoji, badge, badge_type, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  
  const initialProducts = [
    ['ข้าวหอมมะลิ 100% ตรา ดอกบัวรวง', 'jasmine', 320, 'กระสอบ 5 กก.', 10, '🌾', 'ขายดีสุด', 'hot', 'ข้าวหอมมะลิแท้ 100% จากทุ่งกุลาร้องไห้', 1],
    ['ข้าวเสาไห้ ตราดอกบัว', 'saohai', 370, 'กระสอบ 5 กก.', 10, '🌻', null, null, 'ข้าวเสาไห้แท้ หุงนุ่ม เมล็ดสวย', 2]
  ];

  initialProducts.forEach(p => insertStmt.run(p));
}

module.exports = { db };
