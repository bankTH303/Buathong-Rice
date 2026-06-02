const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { db } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// โฟลเดอร์สำหรับเก็บรูปภาพ
const UPLOAD_DIR = path.join(__dirname, 'data', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(cors());
// ขยายลิมิตการอัปโหลดไฟล์เป็น 50MB ป้องกันไฟล์รูปภาพขนาดใหญ่
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR)); // เปิดให้อ่านไฟล์รูปภาพได้

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'buathong2024';

function checkAdmin(req, res, next) {
  if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
  }
  next();
}

// ===== PUBLIC API =====
app.get('/api/products', (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY created_at ASC').all();
    res.json(products.map(p => ({ ...p, active: p.active === 1 })));
  } catch(e) { res.status(500).json({ error: 'โหลดสินค้าไม่ได้' }); }
});

app.post('/api/orders', (req, res) => {
  try {
    const { customer_name, customer_phone, customer_addr, note, items, total } = req.body;
    
    const insertOrder = db.transaction((orderData, itemsData) => {
      const stmt = db.prepare(`INSERT INTO orders (customer_name, customer_phone, customer_addr, note, total) VALUES (?, ?, ?, ?, ?)`);
      const info = stmt.run(orderData.name, orderData.phone, orderData.addr, orderData.note, orderData.total);
      
      const insertItem = db.prepare(`INSERT INTO order_items (order_id, product_id, name, emoji, image, qty, price) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      itemsData.forEach(item => {
        insertItem.run(info.lastInsertRowid, item.id, item.name, item.emoji, item.image || null, item.qty, item.price);
      });
      return info.lastInsertRowid;
    });

    const orderId = insertOrder({ name: customer_name, phone: customer_phone, addr: customer_addr, note: note || '', total }, items);
    res.json({ success: true, order_id: orderId, message: `รับออเดอร์เรียบร้อยแล้ว!` });
  } catch(e) { 
    console.error(e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); 
  }
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
    
    // ค้นหาออเดอร์ที่ตรงกับเบอร์โทร
    const orders = db.prepare('SELECT id, total, status, created_at FROM orders WHERE customer_phone = ? ORDER BY created_at DESC').all(phone);
    
    // ดึงรายการสินค้าในแต่ละออเดอร์
    const result = orders.map(o => {
      const items = db.prepare('SELECT name, qty, price FROM order_items WHERE order_id = ?').all(o.id);
      return { ...o, items, created_at: new Date(o.created_at).toLocaleString('th-TH') };
    });
    
    res.json(result);
  } catch(e) {
    res.status(500).json({ error: 'ระบบขัดข้อง' });
  }
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

// API สำหรับรับไฟล์รูปภาพจากแอดมิน
app.post('/api/admin/upload', checkAdmin, (req, res) => {
  try {
    const { imageBase64, fileName } = req.body;
    if (!imageBase64) return res.status(400).json({ error: 'ไม่มีรูปภาพ' });
    
    const ext = path.extname(fileName) || '.jpg';
    const filename = Date.now() + ext;
    const filepath = path.join(UPLOAD_DIR, filename);
    
    // แปลง Base64 เป็นไฟล์ภาพบันทึกลงระบบ
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(filepath, base64Data, 'base64');
    
    res.json({ success: true, url: '/uploads/' + filename });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: 'อัปโหลดไม่ได้' });
  }
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
