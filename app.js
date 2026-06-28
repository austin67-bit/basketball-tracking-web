/**
 * Basketball Tracking — WebCV Edition
 * Inspired by: https://github.com/Basket-Analytics/BasketTracking
 *
 * Uses WebRTC (getUserMedia) + Canvas API for real-time detection simulation.
 * For production-grade detection, connect to a Python backend running
 * Detectron2 + OpenCV via WebSocket (see README.md).
 */

/* ============================================================
   State
   ============================================================ */
const state = {
  stream: null,
  animId: null,
  lastTime: 0,
  frameCount: 0,
  startTime: null,
  trajectories: {},
  settings: {
    bbox:  true,
    traj:  true,
    label: true,
    map:   true,
    sensitivity: 50,
    trajLen: 30,
  },
};

/* ============================================================
   DOM refs
   ============================================================ */
const video        = document.getElementById('videoEl');
const canvas       = document.getElementById('canvasEl');
const ctx          = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimapCanvas');
const mCtx         = minimapCanvas.getContext('2d');

/* ============================================================
   Court drawing
   ============================================================ */
function drawCourt(c, w, h) {
  c.fillStyle = '#7a4f2d';
  c.fillRect(0, 0, w, h);

  c.save();
  c.strokeStyle = 'rgba(255,255,255,0.85)';
  c.lineWidth = Math.max(1, w / 160);

  // Boundary
  c.strokeRect(2, 2, w - 4, h - 4);

  // Centre line
  c.beginPath(); c.moveTo(w / 2, 2); c.lineTo(w / 2, h - 2); c.stroke();

  // Centre circle
  c.beginPath(); c.arc(w / 2, h / 2, h * 0.15, 0, Math.PI * 2); c.stroke();

  // Key areas
  const kw = w * 0.24, kh = h * 0.56;
  c.strokeRect(2, (h - kh) / 2, kw, kh);
  c.strokeRect(w - 2 - kw, (h - kh) / 2, kw, kh);

  // Free-throw arcs
  c.beginPath(); c.arc(kw + 2, h / 2, kh * 0.22, Math.PI * 1.5, Math.PI * 0.5); c.stroke();
  c.beginPath(); c.arc(w - kw - 2, h / 2, kh * 0.22, Math.PI * 0.5, Math.PI * 1.5); c.stroke();

  // Baskets
  c.fillStyle = 'rgba(249,115,22,0.9)';
  c.fillRect(w / 2 - 2, 2, 4, h * 0.06);
  c.fillRect(w / 2 - 2, h - h * 0.06 - 2, 4, h * 0.06);

  c.restore();
}

function initMinimap() {
  drawCourt(mCtx, minimapCanvas.width, minimapCanvas.height);
}

function updateMinimap(objects) {
  drawCourt(mCtx, minimapCanvas.width, minimapCanvas.height);
  if (!state.settings.map || !objects.length) return;

  objects.forEach(o => {
    const mx = (o.cx / canvas.width)  * minimapCanvas.width;
    const my = (o.cy / canvas.height) * minimapCanvas.height;
    const r  = o.type === 'ball' ? 4 : 6;

    mCtx.beginPath();
    mCtx.arc(mx, my, r, 0, Math.PI * 2);
    mCtx.fillStyle = o.color;
    mCtx.fill();
    mCtx.strokeStyle = 'rgba(255,255,255,0.7)';
    mCtx.lineWidth = 1;
    mCtx.stroke();

    // Trajectory on minimap
    const traj = state.trajectories[o.id];
    if (state.settings.traj && traj && traj.length > 1) {
      mCtx.beginPath();
      traj.forEach((pt, i) => {
        const tx = (pt.x / canvas.width)  * minimapCanvas.width;
        const ty = (pt.y / canvas.height) * minimapCanvas.height;
        i === 0 ? mCtx.moveTo(tx, ty) : mCtx.lineTo(tx, ty);
      });
      mCtx.strokeStyle = o.color + '66';
      mCtx.lineWidth = 1.5;
      mCtx.stroke();
    }
  });
}

/* ============================================================
   Simulated detection (replace with backend call for real AI)
   ============================================================ */
function simulateDetections() {
  const t    = Date.now() / 1000;
  const W    = canvas.width;
  const H    = canvas.height;
  const sens = state.settings.sensitivity / 100;
  const objects = [];

  const playerCount = Math.random() < (sens * 1.2)
    ? Math.floor(2 + Math.random() * 4) : 0;

  const playerColors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'];

  for (let i = 0; i < playerCount; i++) {
    const seed = i * 137.5 + t * (0.2 + i * 0.05);
    const cx   = W * 0.1 + Math.abs(Math.sin(seed) * 0.8) * W * 0.8;
    const cy   = H * 0.12 + Math.abs(Math.cos(seed * 0.7) * 0.76) * H * 0.76;
    const bw   = W * 0.065 + Math.random() * W * 0.02;
    const bh   = H * 0.22  + Math.random() * H * 0.04;
    objects.push({
      type: 'player',
      id:   'P' + (i + 1),
      cx, cy,
      x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh,
      color: playerColors[i % playerColors.length],
      conf: 0.68 + Math.random() * 0.28,
    });
  }

  if (Math.random() < sens * 0.88) {
    const bx = W * 0.15 + Math.sin(t * 0.9) * W * 0.65;
    const by = H * 0.2  + Math.cos(t * 1.2) * H * 0.55;
    const br = W * 0.027;
    objects.push({
      type: 'ball',
      id:   'Ball',
      cx: bx, cy: by,
      x: bx - br, y: by - br, w: br * 2, h: br * 2,
      color: '#f97316',
      conf: 0.55 + Math.random() * 0.4,
    });
  }

  return objects;
}

/* ============================================================
   Drawing
   ============================================================ */
function drawFrame(objects) {
  canvas.width  = video.videoWidth  || canvas.width;
  canvas.height = video.videoHeight || canvas.height;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  objects.forEach(o => {
    // Trajectory update
    if (!state.trajectories[o.id]) state.trajectories[o.id] = [];
    state.trajectories[o.id].push({ x: o.cx, y: o.cy });
    if (state.trajectories[o.id].length > state.settings.trajLen)
      state.trajectories[o.id].shift();

    // Draw trajectory
    if (state.settings.traj) {
      const traj = state.trajectories[o.id];
      if (traj.length > 1) {
        ctx.beginPath();
        traj.forEach((pt, i) =>
          i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
        ctx.strokeStyle = o.color + '99';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Draw bounding box / circle
    if (state.settings.bbox) {
      if (o.type === 'ball') {
        ctx.beginPath();
        ctx.arc(o.cx, o.cy, o.w / 2, 0, Math.PI * 2);
        ctx.strokeStyle = o.color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // Crosshair
        ctx.beginPath();
        ctx.moveTo(o.cx - o.w * 0.7, o.cy);
        ctx.lineTo(o.cx + o.w * 0.7, o.cy);
        ctx.moveTo(o.cx, o.cy - o.h * 0.7);
        ctx.lineTo(o.cx, o.cy + o.h * 0.7);
        ctx.strokeStyle = o.color + 'aa';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.strokeStyle = o.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(o.x, o.y, o.w, o.h);
        // Corner accents
        const cs = Math.min(o.w, o.h) * 0.2;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        [[o.x, o.y], [o.x + o.w, o.y], [o.x, o.y + o.h], [o.x + o.w, o.y + o.h]].forEach(([cx2, cy2]) => {
          const sx = cx2 === o.x ? 1 : -1;
          const sy = cy2 === o.y ? 1 : -1;
          ctx.beginPath();
          ctx.moveTo(cx2 + sx * cs, cy2);
          ctx.lineTo(cx2, cy2);
          ctx.lineTo(cx2, cy2 + sy * cs);
          ctx.stroke();
        });
      }
    }

    // Label
    if (state.settings.label) {
      const label   = `${o.id}  ${Math.round(o.conf * 100)}%`;
      const padding = 4;
      ctx.font = '500 11px -apple-system,sans-serif';
      const tw  = ctx.measureText(label).width + padding * 2;
      const lx  = o.x;
      const ly  = o.y - 18;
      ctx.fillStyle = o.color + 'dd';
      ctx.beginPath();
      ctx.roundRect(lx, ly, tw, 16, 3);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(label, lx + padding, ly + 11);
    }
  });

  // FPS overlay
  const now = performance.now();
  const fps = state.lastTime ? Math.round(1000 / (now - state.lastTime)) : 0;
  state.lastTime = now;

  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.beginPath();
  ctx.roundRect(8, 8, 72, 22, 4);
  ctx.fill();
  ctx.fillStyle = fps > 24 ? '#22c55e' : fps > 12 ? '#f59e0b' : '#ef4444';
  ctx.font = '600 12px monospace';
  ctx.fillText(`${fps} fps`, 14, 23);

  document.getElementById('fpsVal').textContent = fps + ' fps';
}

/* ============================================================
   UI updates
   ============================================================ */
function updateStats(objects) {
  const players = objects.filter(o => o.type === 'player');
  const balls   = objects.filter(o => o.type === 'ball');

  document.getElementById('playerCount').textContent = players.length;
  document.getElementById('ballCount').textContent   = balls.length;
  document.getElementById('frameCount').textContent  = state.frameCount;

  if (state.startTime) {
    const s = Math.floor((Date.now() - state.startTime) / 1000);
    const m = Math.floor(s / 60);
    document.getElementById('elapsed').textContent =
      m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  }

  const list = document.getElementById('detectionList');
  if (!objects.length) {
    list.innerHTML = '<div class="detection-empty">ไม่พบวัตถุในเฟรมนี้</div>';
    return;
  }
  list.innerHTML = objects.map(o => `
    <div class="detection-item">
      <div class="det-dot" style="background:${o.color}"></div>
      <div class="det-info">${o.id} — ${o.type === 'ball' ? 'ลูกบาส' : 'ผู้เล่น'}</div>
      <div class="det-conf">${Math.round(o.conf * 100)}%</div>
    </div>
  `).join('');
}

/* ============================================================
   Main loop
   ============================================================ */
function loop() {
  if (!state.stream) return;
  state.frameCount++;
  const objects = simulateDetections();
  drawFrame(objects);
  updateStats(objects);
  updateMinimap(objects);
  state.animId = requestAnimationFrame(loop);
}

/* ============================================================
   Camera controls
   ============================================================ */
async function startCamera() {
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'environment' },
      audio: false,
    });
    video.srcObject = state.stream;
    video.style.display = 'block';
    document.getElementById('placeholder').style.display = 'none';
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('stopBtn').style.display  = 'flex';
    document.getElementById('statusDot').classList.add('active');

    state.startTime  = Date.now();
    state.frameCount = 0;
    state.trajectories = {};

    video.onloadedmetadata = () => {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      document.getElementById('resolutionInfo').textContent =
        `${video.videoWidth} × ${video.videoHeight}`;
      loop();
    };
  } catch (err) {
    const msg = err.name === 'NotAllowedError'
      ? 'กรุณาอนุญาตการเข้าถึงกล้องในเบราว์เซอร์'
      : err.name === 'NotFoundError'
      ? 'ไม่พบกล้องในอุปกรณ์นี้'
      : 'เปิดกล้องไม่สำเร็จ: ' + err.message;
    alert(msg);
  }
}

function stopCamera() {
  if (state.stream)  { state.stream.getTracks().forEach(t => t.stop()); state.stream = null; }
  if (state.animId)  { cancelAnimationFrame(state.animId); state.animId = null; }

  video.style.display = 'none';
  document.getElementById('placeholder').style.display = 'flex';
  document.getElementById('startBtn').style.display    = 'flex';
  document.getElementById('stopBtn').style.display     = 'none';
  document.getElementById('statusDot').classList.remove('active');
  document.getElementById('fpsVal').textContent = '--';

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  state.startTime = null;
  state.trajectories = {};
  initMinimap();
  updateStats([]);
}

/* ============================================================
   Utility controls
   ============================================================ */
function takeSnapshot() {
  if (!state.stream) { alert('เปิดกล้องก่อนจับภาพ'); return; }
  const snap = document.createElement('canvas');
  snap.width  = canvas.width;
  snap.height = canvas.height;
  snap.getContext('2d').drawImage(canvas, 0, 0);
  const a = document.createElement('a');
  a.href     = snap.toDataURL('image/png');
  a.download = `basketball-tracking-${Date.now()}.png`;
  a.click();
}

function resetStats() {
  state.frameCount   = 0;
  state.startTime    = state.stream ? Date.now() : null;
  state.trajectories = {};
  document.getElementById('frameCount').textContent = '0';
  document.getElementById('elapsed').textContent    = '0s';
}

function toggleFullscreen() {
  const el = document.getElementById('videoWrapper');
  if (!document.fullscreenElement) el.requestFullscreen?.();
  else document.exitFullscreen?.();
}

/* ============================================================
   Settings
   ============================================================ */
function toggleSetting(key) {
  state.settings[key] = !state.settings[key];
  const id  = 'toggle' + key.charAt(0).toUpperCase() + key.slice(1);
  const el  = document.getElementById(id);
  if (el) el.classList.toggle('on', state.settings[key]);
  if (key === 'map' && !state.settings.map) initMinimap();
}

function setSens(v) {
  state.settings.sensitivity = parseInt(v, 10);
  document.getElementById('sensVal').textContent = v + '%';
}

function setTrajLen(v) {
  state.settings.trajLen = parseInt(v, 10);
  document.getElementById('trajLenVal').textContent = v;
}

/* ============================================================
   Init
   ============================================================ */
initMinimap();
