// database.js — จัดการ database ด้วย NeDB (Pure JavaScript, ไม่ต้อง compile)
const Datastore = require('@seald-io/nedb');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
require('fs').mkdirSync(DATA_DIR, { recursive: true });

// สร้าง 3 ตาราง (collections)
const db = {
  products: new Datastore({ filename: path.join(DATA_DIR, 'products.db'), autoload: true }),
  orders:   new Datastore({ filename: path.join(DATA_DIR, 'orders.db'),   autoload: true }),
  contacts: new Datastore({ filename: path.join(DATA_DIR, 'contacts.db'), autoload: true }),
};

// Helper: wrap NeDB callbacks → Promise
const p = (fn) => new Promise((resolve, reject) => fn((err, result) => err ? reject(err) : resolve(result)));

// Seed สินค้าเริ่มต้น
async function seedProducts() {
  const count = await p(cb => db.products.count({}, cb));
  if (count > 0) return;

  const products = [
    { name: 'ข้าวหอมมะลิ 100% ตรา ดอกบัวรวง', category: 'jasmine', price: 320, unit: 'กระสอบ 5 กก.', min_order: 10, emoji: '🌾', badge: 'ขายดีสุด', badge_type: 'hot', description: 'ข้าวหอมมะลิแท้ 100% จากทุ่งกุลาร้องไห้ หุงขึ้นหม้อ นุ่มหอม น่ารับประทาน', active: true, createdAt: new Date() },
    { name: 'ข้าวปลายทอนหอมมะลิ พรีเมียม', category: 'jasmine', price: 420, unit: 'กระสอบ 5 กก.', min_order: 5, emoji: '🌿', badge: 'ใหม่', badge_type: 'new', description: 'ข้าวปลายทอนหอมมะลิ ราคาประหยัด เหมาะสำหรับร้านข้าวและครัวเรือน', active: true, createdAt: new Date() },
    { name: 'ข้าวเสาไห้ ตราดอกบัว', category: 'saohai', price: 370, unit: 'กระสอบ 5 กก.', min_order: 10, emoji: '🌻', badge: null, badge_type: null, description: 'ข้าวเสาไห้แท้ หุงนุ่ม เมล็ดสวย ไม่แฉะ เหมาะสำหรับร้านอาหารทุกประเภท', active: true, createdAt: new Date() },
    { name: 'ข้าวเหนียวขาวคุณภาพสูง', category: 'sticky', price: 350, unit: 'กระสอบ 5 กก.', min_order: 10, emoji: '🌸', badge: 'นิยม', badge_type: 'popular', description: 'ข้าวเหนียวขาวเกรดพรีเมียม นึ่งสุกเร็ว เหนียวนุ่ม เหมาะสำหรับขายข้าวเหนียวและร้านส้มตำ', active: true, createdAt: new Date() },
    { name: 'ข้าวกล้องออร์แกนิค', category: 'other', price: 580, unit: 'กระสอบ 5 กก.', min_order: 5, emoji: '💎', badge: 'พรีเมียม', badge_type: 'new', description: 'ข้าวกล้องออร์แกนิคแท้ ไม่ผ่านการขัดสี อุดมไปด้วยสารอาหารและไฟเบอร์สูง', active: true, createdAt: new Date() },
    { name: 'ข้าวขาวพิเศษ ตราทอง', category: 'other', price: 290, unit: 'กระสอบ 5 กก.', min_order: 20, emoji: '🏆', badge: 'ราคาดีสุด', badge_type: 'hot', description: 'ข้าวขาวทั่วไป คุณภาพมาตรฐาน ราคาประหยัด เหมาะสำหรับซื้อขายส่งปริมาณมาก', active: true, createdAt: new Date() },
  ];

  for (const product of products) {
    await p(cb => db.products.insert(product, cb));
  }
  console.log('✅ เพิ่มสินค้าเริ่มต้นเรียบร้อย');
}

seedProducts().catch(console.error);

module.exports = { db, p };
