// Cosmetic catalogue: a fixed, finishable set. Looks only, never power.
// In the iOS app, bundles are also sold via StoreKit; here everything is Goo.

export const SKINS = [
  { id: 'classic', name: 'Classic Dex', price: 0, body: '#f6e8cf', belly: '#ead3ab', stripe: '#d8bd8f', outline: '#8a6b4a' },
  { id: 'minty', name: 'Minty Fresh', price: 60, body: '#cdf4e3', belly: '#a9e6cd', stripe: '#83d2b5', outline: '#3d8a6f' },
  { id: 'bubblegum', name: 'Bubblegum', price: 120, body: '#ffd0e6', belly: '#ffb3d6', stripe: '#f48dbf', outline: '#b04a7f' },
  { id: 'alien', name: 'Alien', price: 200, body: '#b6f28a', belly: '#97e06a', stripe: '#6fc24a', outline: '#3c7a24', extra: 'antennae' },
  { id: 'troll', name: 'Troll', price: 260, body: '#b8c7ff', belly: '#9cb0ff', stripe: '#7f95ee', outline: '#4757a8', extra: 'tuft' },
  { id: 'robot', name: 'Rusty Robot', price: 320, body: '#d39a6a', belly: '#bf8456', stripe: '#9d6a43', outline: '#5e3e26', extra: 'robot' },
  { id: 'golden', name: 'Golden Pus', earn: 'streak20', desc: 'Earn-only · hit a 20-Perfect streak', body: '#ffe066', belly: '#ffd23a', stripe: '#f0b81c', outline: '#a87a06', extra: 'glow' },
  { id: 'fullypopped', name: 'Fully Popped', earn: 'collection', desc: 'Earn-only · own every other skin', body: '#ffffff', belly: '#f2f2f2', stripe: 'rainbow', outline: '#7a5aa8', extra: 'crown' },
];

export function skinById(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0];
}

const RAINBOW = ['#ff6b6b', '#ffb84d', '#ffe156', '#6be37a', '#5cc8ff', '#a77bff'];

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

/**
 * Draws Dex with the feet at the origin, facing +x, in a y-down canvas.
 * o: { skin, legPhase, squash (+ squash / − stretch), angle, look (-1..1), mut, t, alpha, ghost }
 */
export function drawDex(ctx, o) {
  const s = o.skin;
  const t = o.t || 0;
  ctx.save();
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.rotate(o.angle || 0);
  const sq = o.squash || 0;
  ctx.scale(1 + 0.32 * sq, 1 - 0.32 * sq);
  const lp = o.legPhase || 0;
  const ghost = !!o.ghost;
  const body = ghost ? 'rgba(255,255,255,0.9)' : s.body;
  const outline = ghost ? 'rgba(120,160,220,0.9)' : s.outline;

  if (s.extra === 'glow' && !ghost) {
    const g = ctx.createRadialGradient(0, -13, 4, 0, -13, 38);
    g.addColorStop(0, 'rgba(255,230,120,0.55)');
    g.addColorStop(1, 'rgba(255,230,120,0)');
    ctx.fillStyle = g;
    ellipse(ctx, 0, -13, 38, 30);
    ctx.fill();
  }

  if (o.mut === 'wings') {
    const flap = Math.sin(t * 28) * 0.5;
    ctx.fillStyle = 'rgba(200,235,255,0.6)';
    ctx.strokeStyle = 'rgba(120,180,230,0.9)';
    ctx.lineWidth = 1;
    for (const off of [-0.25, 0.15]) {
      ctx.save();
      ctx.translate(2, -20);
      ctx.rotate(-1.2 + flap + off);
      ellipse(ctx, 12, 0, 13, 5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // far legs
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 4; i++) {
    const lx = 2 + i * 5;
    const sw = Math.sin(lp + i * 1.6) * 4;
    ctx.beginPath();
    ctx.moveTo(lx, -8);
    ctx.lineTo(lx + sw - 2, 0);
    ctx.stroke();
  }

  // tail (opisthosoma) with rings
  ctx.fillStyle = body;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.8;
  ellipse(ctx, -9, -12, 21, 9, -0.04);
  ctx.fill();
  ctx.stroke();
  if (!ghost) {
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      const x = -25 + i * 5.5;
      ctx.strokeStyle = s.stripe === 'rainbow' ? RAINBOW[i] : s.stripe;
      ctx.beginPath();
      ctx.moveTo(x, -18.5 + i * 0.4);
      ctx.quadraticCurveTo(x - 2.2, -12, x, -5.2);
      ctx.stroke();
    }
  }

  // front body (podosoma)
  ctx.fillStyle = body;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.8;
  ellipse(ctx, 9, -13, 12, 10.5);
  ctx.fill();
  ctx.stroke();
  if (!ghost) {
    ctx.fillStyle = s.belly;
    ellipse(ctx, 8, -7.5, 9, 3.6);
    ctx.fill();
  }

  // near legs
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.6;
  for (let i = 0; i < 4; i++) {
    const lx = 4 + i * 5;
    const sw = Math.sin(lp + i * 1.6 + Math.PI) * 4;
    ctx.beginPath();
    ctx.moveTo(lx, -6);
    ctx.lineTo(lx + sw + 1, 0.5);
    ctx.stroke();
  }
  if (o.mut === 'sticky') {
    ctx.fillStyle = 'rgba(150,230,100,0.9)';
    for (let i = 0; i < 4; i++) {
      ellipse(ctx, 5 + i * 5, 0.5, 2.6, 1.6);
      ctx.fill();
    }
  }

  // snout
  ctx.fillStyle = ghost ? body : s.belly;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.4;
  ellipse(ctx, 20.5, -10, 3.8, 2.8);
  ctx.fill();
  ctx.stroke();

  // eyes
  const look = o.look || 0;
  for (const [ex, ey, r] of [[11, -18.5, 4.8], [17.6, -17.4, 4.3]]) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.3;
    ellipse(ctx, ex, ey, r, r);
    ctx.fill();
    ctx.stroke();
    if (!ghost) {
      ctx.fillStyle = '#20150f';
      ellipse(ctx, ex + 1.5, ey - look * 1.4, r * 0.46, r * 0.46);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ellipse(ctx, ex + 0.6, ey - look * 1.4 - 1.1, r * 0.16, r * 0.16);
      ctx.fill();
    }
  }

  if (!ghost) {
    switch (s.extra) {
      case 'antennae':
        ctx.strokeStyle = s.outline;
        ctx.lineWidth = 1.6;
        for (const [bx, tx] of [[8, 4], [14, 16]]) {
          ctx.beginPath();
          ctx.moveTo(bx, -22);
          ctx.quadraticCurveTo(bx - 1, -30, tx, -33);
          ctx.stroke();
          ctx.fillStyle = '#e8ff9a';
          ellipse(ctx, tx, -33, 2.4, 2.4);
          ctx.fill();
        }
        break;
      case 'tuft':
        ctx.fillStyle = '#ff5fa2';
        ctx.beginPath();
        ctx.moveTo(4, -21);
        ctx.lineTo(1, -36);
        ctx.lineTo(8, -26);
        ctx.lineTo(10, -40);
        ctx.lineTo(13, -26);
        ctx.lineTo(19, -35);
        ctx.lineTo(16, -21);
        ctx.closePath();
        ctx.fill();
        break;
      case 'robot':
        ctx.fillStyle = '#7a5434';
        for (let i = 0; i < 4; i++) {
          ellipse(ctx, -22 + i * 9, -12, 1.3, 1.3);
          ctx.fill();
        }
        ctx.strokeStyle = '#5e3e26';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(10, -23);
        ctx.lineTo(10, -31);
        ctx.stroke();
        ctx.fillStyle = Math.sin(t * 6) > 0 ? '#ff4d4d' : '#ffb0a0';
        ellipse(ctx, 10, -32, 2.2, 2.2);
        ctx.fill();
        break;
      case 'crown':
        ctx.fillStyle = '#ffd23a';
        ctx.strokeStyle = '#a87a06';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(4, -22);
        ctx.lineTo(5, -31);
        ctx.lineTo(9, -26);
        ctx.lineTo(12, -33);
        ctx.lineTo(15, -26);
        ctx.lineTo(19, -31);
        ctx.lineTo(18, -21);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
    }
  }

  if (o.mut === 'shell') {
    const g = ctx.createLinearGradient(0, -28, 0, -2);
    g.addColorStop(0, 'rgba(255,214,120,0.75)');
    g.addColorStop(1, 'rgba(214,140,40,0.55)');
    ctx.fillStyle = g;
    ctx.strokeStyle = 'rgba(150,90,20,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(-3, -8, 28, 20, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150,90,20,0.5)';
    ctx.beginPath();
    ctx.moveTo(-17, -9);
    ctx.lineTo(-10, -24);
    ctx.moveTo(4, -9);
    ctx.lineTo(4, -27);
    ctx.stroke();
  }
  if (o.mut === 'spores') {
    for (let i = 0; i < 7; i++) {
      const a = t * 3 + i * 0.9;
      ctx.fillStyle = `rgba(197,140,255,${0.5 + 0.3 * Math.sin(a * 2)})`;
      ellipse(ctx, Math.cos(a) * 28 - 2, -13 + Math.sin(a * 1.3) * 18, 2.2, 2.2);
      ctx.fill();
    }
  }
  ctx.restore();
}
