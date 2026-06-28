# 🏀 Basketball Tracking — WebCV Edition

A browser-based basketball tracking web app inspired by [Basket-Analytics/BasketTracking](https://github.com/Basket-Analytics/BasketTracking).

**ไม่ต้องติดตั้งอะไรเลย** — เปิดในเบราว์เซอร์ได้ทันที ใช้ WebRTC เปิดกล้องและ Canvas API แสดงผล real-time

---

## ✨ ฟีเจอร์

| ฟีเจอร์ | รายละเอียด |
|---|---|
| 📷 เปิดกล้อง | WebRTC `getUserMedia` — รองรับ webcam และกล้องหลัง (มือถือ) |
| 🎯 Bounding Box | วาดกรอบรอบผู้เล่นและลูกบาสพร้อม confidence score |
| 🔵 Trajectory | แสดงเส้นทางการเคลื่อนที่ย้อนหลัง |
| 🏟️ Mini-map | Court projection แสดงตำแหน่งบนสนามบาสเกตบอล |
| 📸 Snapshot | บันทึกภาพพร้อม overlay ลงเครื่อง |
| ⚙️ ตั้งค่าได้ | เปิด/ปิด overlay ต่างๆ, ปรับความไวการตรวจจับ |
| 📱 Responsive | ใช้งานได้บน desktop และมือถือ |

---

## 🚀 วิธีเปิดใช้งาน

### วิธีที่ 1 — GitHub Pages (แนะนำ)

1. Fork repo นี้
2. ไปที่ **Settings → Pages → Source: main / root**
3. เปิด URL ที่ได้ — เสร็จแล้ว! 🎉

### วิธีที่ 2 — เปิดในเครื่อง

```bash
git clone https://github.com/YOUR_USERNAME/basketball-tracking-web.git
cd basketball-tracking-web

# ต้องใช้ server (getUserMedia ต้องการ HTTPS หรือ localhost)
npx serve .
# หรือ
python3 -m http.server 8080
```

เปิด `http://localhost:8080` ในเบราว์เซอร์

> ⚠️ **หมายเหตุ:** `getUserMedia` ไม่ทำงานบน `file://` ต้องใช้ผ่าน server เสมอ

---

## 📁 โครงสร้างไฟล์

```
basketball-tracking-web/
├── index.html      ← หน้าเว็บหลัก
├── style.css       ← สไตล์ทั้งหมด
├── app.js          ← logic กล้อง + tracking + drawing
├── docs/           ← เอกสารเพิ่มเติม
└── README.md
```

---

## 🔧 เชื่อมต่อกับ Python Backend (สำหรับ AI จริง)

เวอร์ชันนี้ใช้การ simulate การตรวจจับ สำหรับ AI จริงด้วย Detectron2:

### 1. ติดตั้ง Python dependencies

```bash
pip install flask flask-cors opencv-python torch detectron2
```

### 2. รัน backend server

```python
# backend.py
from flask import Flask, Response
from flask_cors import CORS
import cv2, json

app = Flask(__name__)
CORS(app)

@app.route('/detect', methods=['POST'])
def detect():
    # รับ frame จาก frontend → รัน Detectron2 → ส่ง JSON กลับ
    # ดู Basket-Analytics/BasketTracking สำหรับ full implementation
    results = run_detectron2(frame)
    return json.dumps(results)

if __name__ == '__main__':
    app.run(port=5000)
```

### 3. แก้ใน `app.js`

เปลี่ยน `simulateDetections()` เป็น:

```javascript
async function fetchDetections(frameData) {
  const res = await fetch('http://localhost:5000/detect', {
    method: 'POST',
    body: frameData,
  });
  return res.json(); // [{ type, id, cx, cy, x, y, w, h, conf }, ...]
}
```

---

## 🛠️ Tech Stack

- **WebRTC** — `getUserMedia` สำหรับเข้าถึงกล้อง
- **Canvas API** — วาด overlay และ trajectory
- **Vanilla JS** — ไม่มี framework ไม่มี build step
- **Tabler Icons** — icon set

---

## 📜 License

MIT — ใช้งานและดัดแปลงได้อย่างอิสระ

---

## 🙏 Credit

- Original Python tracking system: [Basket-Analytics/BasketTracking](https://github.com/Basket-Analytics/BasketTracking)
- Uses OpenCV, Detectron2, PyTorch concepts
