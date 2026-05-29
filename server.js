// server.js — Backend บัวทองไรซ์
const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, p } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== Admin Password =====
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'buathong2024';

function checkAdmin(req, res, next) {
  if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
  }
  next();
}

// ===========================
// PUBLIC API
// ===========================

// GET สินค้า
app.get('/api/products', async (req, res) => {
  try {
    const products = await p(cb => db.products.find({ active: true }).sort({ createdAt: 1 }).exec(cb));
    res.json(products);
  } catch(e) { res.status(500).json({ error: 'โหลดสินค้าไม่ได้' }); }
});

// POST ออเดอร์ใหม่
app.post('/api/orders', async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_addr, note, items, total } = req.body;
    if (!customer_name || !customer_phone || !customer_addr || !items?.length) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ' });
    }
    const order = await p(cb => db.orders.insert({
      customer_name, customer_phone, customer_addr,
      note: note || '', items, total,
      status: 'รอดำเนินการ',
      createdAt: new Date()
    }, cb));
    res.json({ success: true, order_id: order._id, message: `✅ รับออเดอร์เรียบร้อยแล้ว!` });
  } catch(e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// POST ติดต่อสอบถาม
app.post('/api/contacts', async (req, res) => {
  try {
    const { name, phone, business, message } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'กรุณากรอกชื่อและเบอร์โทร' });
    await p(cb => db.contacts.insert({ name, phone, business: business||'', message: message||'', createdAt: new Date() }, cb));
    res.json({ success: true, message: 'ส่งข้อมูลเรียบร้อย ทีมงานจะติดต่อกลับภายใน 24 ชั่วโมง' });
  } catch(e) { res.status(500).json({ error: 'เกิดข้อผิดพลาด' }); }
});

// ===========================
// ADMIN API
// ===========================

app.post('/api/admin/login', (req, res) => {
  req.body.password === ADMIN_PASSWORD
    ? res.json({ success: true })
    : res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
});

app.get('/api/admin/orders', checkAdmin, async (req, res) => {
  try {
    const orders = await p(cb => db.orders.find({}).sort({ createdAt: -1 }).exec(cb));
    res.json(orders.map(o => ({ ...o, id: o._id, created_at: new Date(o.createdAt).toLocaleString('th-TH') })));
  } catch(e) { res.status(500).json({ error: 'โหลดออเดอร์ไม่ได้' }); }
});

app.patch('/api/admin/orders/:id', checkAdmin, async (req, res) => {
  try {
    const valid = ['รอดำเนินการ','ยืนยันแล้ว','กำลังจัดส่ง','จัดส่งแล้ว','ยกเลิก'];
    if (!valid.includes(req.body.status)) return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
    await p(cb => db.orders.update({ _id: req.params.id }, { $set: { status: req.body.status } }, {}, cb));
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'อัปเดตไม่ได้' }); }
});

app.get('/api/admin/products', checkAdmin, async (req, res) => {
  try {
    const products = await p(cb => db.products.find({}).sort({ createdAt: 1 }).exec(cb));
    res.json(products.map(p => ({ ...p, id: p._id })));
  } catch(e) { res.status(500).json({ error: 'โหลดสินค้าไม่ได้' }); }
});

app.patch('/api/admin/products/:id', checkAdmin, async (req, res) => {
  try {
    const { price, name, description, min_order, active } = req.body;
    const update = {};
    if (price !== undefined) update.price = price;
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (min_order !== undefined) update.min_order = min_order;
    if (active !== undefined) update.active = active === 1 || active === true;
    await p(cb => db.products.update({ _id: req.params.id }, { $set: update }, {}, cb));
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: 'อัปเดตไม่ได้' }); }
});

app.post('/api/admin/products', checkAdmin, async (req, res) => {
  try {
    const { name, category, price, unit, min_order, emoji, badge, badge_type, description } = req.body;
    if (!name || !category || !price) return res.status(400).json({ error: 'กรุณากรอกชื่อ หมวดหมู่ และราคา' });
    const prod = await p(cb => db.products.insert({
      name, category, price, unit: unit||'กระสอบ 5 กก.',
      min_order: min_order||1, emoji: emoji||'🌾',
      badge: badge||null, badge_type: badge_type||null,
      description: description||'', active: true, createdAt: new Date()
    }, cb));
    res.json({ success: true, id: prod._id });
  } catch(e) { res.status(500).json({ error: 'เพิ่มสินค้าไม่ได้' }); }
});

app.get('/api/admin/contacts', checkAdmin, async (req, res) => {
  try {
    const contacts = await p(cb => db.contacts.find({}).sort({ createdAt: -1 }).exec(cb));
    res.json(contacts.map(c => ({ ...c, id: c._id, created_at: new Date(c.createdAt).toLocaleString('th-TH') })));
  } catch(e) { res.status(500).json({ error: 'โหลดข้อมูลไม่ได้' }); }
});

app.get('/api/admin/stats', checkAdmin, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const [totalOrders, pendingOrders, todayOrders, allOrders, totalContacts] = await Promise.all([
      p(cb => db.orders.count({}, cb)),
      p(cb => db.orders.count({ status: 'รอดำเนินการ' }, cb)),
      p(cb => db.orders.count({ createdAt: { $gte: today } }, cb)),
      p(cb => db.orders.find({ status: { $ne: 'ยกเลิก' } }, cb)),
      p(cb => db.contacts.count({}, cb)),
    ]);
    const totalRevenue = allOrders.reduce((s, o) => s + (o.total || 0), 0);
    res.json({ totalOrders, pendingOrders, todayOrders, totalRevenue, totalContacts });
  } catch(e) { res.status(500).json({ error: 'โหลดสถิติไม่ได้' }); }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('');
  console.log('🌾 ===============================');
  console.log('   บัวทองไรซ์ Backend พร้อมใช้งาน!');
  console.log(`   🌐 เว็บ:  http://localhost:${PORT}`);
  console.log(`   🔐 Admin: http://localhost:${PORT}/admin.html`);
  console.log(`   🔑 Password: ${ADMIN_PASSWORD}`);
  console.log('================================');
});
