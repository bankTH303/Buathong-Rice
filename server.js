const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken'); // 🛡️ นำเข้าไลบรารีความปลอดภัย
const { db } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOAD_DIR = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'buathong2024';
const JWT_SECRET = process.env.JWT_SECRET || 'BUATHONG_SUPER_SECRET_KEY_2026'; // 🔑 กุญแจเข้ารหัสลับ

function checkAdmin(req, res, next) {
  if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
  }
  next();
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// 🛡️ ระบบนายทวาร: ตรวจสอบบัตรผ่าน (Token) ก่อนอนุญาตให้ดึงข้อมูล
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'ไม่พบ Token การยืนยันตัวตน' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token ไม่ถูกต้องหรือหมดอายุ โปรดล็อกอินใหม่' });
    req.user = user; // ถ้าบัตรผ่านถูกต้อง ให้แนบชื่อคนที่ถือบัตรไปกับระบบ
    next();
  });
}

// ===== AUTH & USER API =====
app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, phone, password, province, district, subdistrict, zipcode, address_detail } = req.body;
    const hashedPw = hashPassword(password);
    const info = db.prepare(`INSERT INTO users (name, email, phone, password, province, district, subdistrict, zipcode, address_detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(name, email, phone, hashedPw, province, district, subdistrict, zipcode, address_detail);
    
    // สร้าง Token อายุ 7 วัน
    const token = jwt.sign({ id: info.lastInsertRowid, email }, JWT_SECRET, { expiresIn: '7d' }); 
    
    res.json({ success: true, user: { id: info.lastInsertRowid, name, email, phone, province, district, subdistrict, zipcode, address_detail }, token });
  } catch(e) {
    if(e.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'อีเมลนี้ถูกสมัครสมาชิกไปแล้ว' });
    } else {
      res.status(500).json({ error: 'สมัครสมาชิกไม่สำเร็จ' });
    }
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    const hashedPw = hashPassword(password);
    const user = db.prepare('SELECT id, name, email, phone, province, district, subdistrict, zipcode, address_detail FROM users WHERE email = ? AND password = ?').get(email, hashedPw);
    
    if(user) {
      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ success: true, user, token });
    }
    else res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
  } catch(e) { res.status(500).json({ error: 'ระบบขัดข้อง' }); }
});

// 🛡️ ปิดช่องโหว่ IDOR: บังคับเช็ค Token และ ID ต้องตรงกันเท่านั้น
app.patch('/api/user/:id', authenticateToken, (req, res) => {
  if (req.user.id !== parseInt(req.params.id)) return res.status(403).json({ error: '🚨 ปฏิเสธการเข้าถึง!' });
  try {
    const { name, phone, province, district, subdistrict, zipcode, address_detail } = req.body;
    db.prepare(`UPDATE users SET name=?, phone=?, province=?, district=?, subdistrict=?, zipcode=?, address_detail=? WHERE id=?`)
      .run(name, phone, province, district, subdistrict, zipcode, address_detail, req.params.id);
    const user = db.prepare('SELECT id, name, email, phone, province, district, subdistrict, zipcode, address_detail FROM users WHERE id = ?').get(req.params.id);
    res.json({ success: true, user });
  } catch(e) { res.status(500).json({ error: 'อัปเดตข้อมูลไม่สำเร็จ' }); }
});

app.get('/api/user/:id/orders', authenticateToken, (req, res) => {
  if (req.user.id !== parseInt(req.params.id)) return res.status(403).json({ error: '🚨 ปฏิเสธการเข้าถึง!' });
  try {
    const orders = db.prepare('SELECT id, total, status, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.params.id);
    const result = orders.map(o => {
      const items = db.prepare('SELECT name, qty, price, image, emoji FROM order_items WHERE order_id = ?').all(o.id);
      return { ...o, items, created_at: new Date(o.created_at).toLocaleString('th-TH') };
    });
    res.json(result);
  } catch(e) { res.status(500).json({ error: 'โหลดประวัติไม่ได้' }); }
});

// ===== PUBLIC API =====
app.get('/api/products', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY created_at ASC').all();
    res.json(products.map(p => ({ ...p, active: p.active === 1 })));
  } catch(e) { res.status(500).json({ error: 'โหลดสินค้าไม่ได้' }); }
});

app.post('/api/orders', (req, res) => {
  try {
    const { user_id, customer_name, customer_phone, customer_addr, note, items, total } = req.body;
    const authHeader = req.headers['authorization'];
    let finalUserId = null;

    if (user_id) {
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ error: 'ไม่พบ Token การยืนยันตัวตน' });
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.id !== parseInt(user_id)) return res.status(403).json({ error: '🚨 ปฏิเสธการเข้าถึง!' });
        finalUserId = decoded.id;
      } catch(err) { return res.status(403).json({ error: 'Token ไม่ถูกต้อง' }); }
    }
    
    const insertOrder = db.transaction((orderData, itemsData) => {
      const stmt = db.prepare(`INSERT INTO orders (user_id, customer_name, customer_phone, customer_addr, note, total) VALUES (?, ?, ?, ?, ?, ?)`);
      const info = stmt.run(orderData.user_id, orderData.name, orderData.phone, orderData.addr, orderData.note, orderData.total);
      
      const insertItem = db.prepare(`INSERT INTO order_items (order_id, product_id, name, emoji, image, qty, price) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      itemsData.forEach(item => {
        insertItem.run(info.lastInsertRowid, item.id, item.name, item.emoji, item.image || null, item.qty, item.price);
      });
      return info.lastInsertRowid;
    });

    const orderId = insertOrder({ user_id: finalUserId, name: customer_name, phone: customer_phone, addr: customer_addr, note: note || '', total }, items);
    res.json({ success: true, order_id: orderId, message: `รับออเดอร์เรียบร้อยแล้ว!` });
  } catch(e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

app.post('/api/contacts', (req, res) => {
  try {
    const { name, phone, business, message } = req.body;
    db.prepare(`INSERT INTO contacts (name, phone, business, message) VALUES (?, ?, ?, ?)`).run(name, phone, business||'', message||'');
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

app.get('/api/track/:phone', (req, res) => {
  try {
    const phone = req.params.phone.replace(/[^0-9]/g, '');
    if(phone.length !== 10) return res.status(400).json({ error: 'เบอร์โทรไม่ถูกต้อง' });
    const orders = db.prepare('SELECT id, total, status, created_at FROM orders WHERE customer_phone = ? ORDER BY created_at DESC').all(phone);
    const result = orders.map(o => {
      const items = db.prepare('SELECT name, qty, price FROM order_items WHERE order_id = ?').all(o.id);
      return { ...o, items, created_at: new Date(o.created_at).toLocaleString('th-TH') };
    });
    res.json(result);
  } catch(e) { res.status(500).json({ error: 'ระบบขัดข้อง' }); }
});

// ===== ADMIN API =====
app.post('/api/admin/login', (req, res) => {
  req.body.password === ADMIN_PASSWORD ? res.json({ success: true }) : res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
});

app.get('/api/admin/orders', checkAdmin, (req, res) => {
  try {
    const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
    const result = orders.map(o => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
      return { ...o, items, created_at: new Date(o.created_at).toLocaleString('th-TH') };
    });
    res.json(result);
  } catch(e) { res.status(500).json({ error: 'โหลดออเดอร์ไม่ได้' }); }
});

app.patch('/api/admin/orders/:id', checkAdmin, (req, res) => {
  try {
    db.prepare(`UPDATE orders SET status = ? WHERE id = ?`).run(req.body.status, req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'อัปเดตไม่ได้' }); }
});

app.get('/api/admin/products', checkAdmin, (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products ORDER BY created_at ASC').all();
    res.json(products);
  } catch(e) { res.status(500).json({ error: 'โหลดสินค้าไม่ได้' }); }
});

app.patch('/api/admin/products/:id', checkAdmin, (req, res) => {
  try {
    const { name, price, unit, min_order, description, active, image, price_tiers } = req.body;
    db.prepare(`UPDATE products SET name=?, price=?, unit=?, min_order=?, description=?, active=?, image=?, price_tiers=? WHERE id=?`)
      .run(name, price, unit, min_order, description, active, image, price_tiers || "[]", req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'อัปเดตไม่ได้' }); }
});

app.post('/api/admin/products', checkAdmin, (req, res) => {
  try {
    const { name, category, price, unit, min_order, emoji, image, badge, description, price_tiers } = req.body;
    const info = db.prepare(`INSERT INTO products (name, category, price, unit, min_order, emoji, image, badge, description, active, price_tiers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
      .run(name, category, price, unit||'กระสอบ 5 กก.', min_order||1, emoji||'🌾', image||null, badge||null, description||'', price_tiers || "[]");
    res.json({ success: true, id: info.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: 'เพิ่มสินค้าไม่ได้' }); }
});

app.post('/api/admin/upload', checkAdmin, (req, res) => {
  try {
    const { imageBase64, fileName } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'ไม่มีรูปภาพ' });
    const ext = path.extname(fileName) || '.jpg';
    const filename = Date.now() + ext;
    const filepath = path.join(UPLOAD_DIR, filename);
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(filepath, base64Data, 'base64');
    res.json({ success: true, url: '/uploads/' + filename });
  } catch(e) { res.status(500).json({ error: 'อัปโหลดไม่ได้' }); }
});

app.get('/api/admin/contacts', checkAdmin, (req, res) => {
  try {
    const contacts = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
    res.json(contacts.map(c => ({...c, created_at: new Date(c.created_at).toLocaleString('th-TH')})));
  } catch(e) { res.status(500).json({ error: 'โหลดข้อมูลไม่ได้' }); }
});

app.get('/api/admin/stats', checkAdmin, (req, res) => {
  try {
    const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c;
    const pendingOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status = 'รอดำเนินการ'").get().c;
    const todayOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE date(created_at) = date('now')").get().c;
    const totalContacts = db.prepare('SELECT COUNT(*) as c FROM contacts').get().c;
    const revenue = db.prepare("SELECT SUM(total) as s FROM orders WHERE status != 'ยกเลิก'").get().s || 0;
    res.json({ totalOrders, pendingOrders, todayOrders, totalRevenue: revenue, totalContacts });
  } catch(e) { res.status(500).json({ error: 'โหลดสถิติไม่ได้' }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.listen(PORT, () => console.log(`🚀 บัวทองไรซ์ Backend รันอยู่ที่พอร์ต ${PORT}`));
