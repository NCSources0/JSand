const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const tmpCanvas = document.createElement('canvas');
const tmpCTX = tmpCanvas.getContext('2d');
let tmpImg = {data: []};
const preAlpha = 1;

let currentId = 0;
let pxScale = 16;
let brush = 3;

const brushSize = document.querySelector('input#brush');
const brushSizeDisplay = document.querySelector('span#brush');
brushSizeDisplay.innerHTML = brushSize.value = brush;

const pixelSize = document.querySelector('input#pixel');
const pixelSizeDisplay = document.querySelector('span#pixel');
pixelSizeDisplay.innerHTML = pixelSize.value = pxScale;

const materialSelect = document.querySelector('select#material');

const c = { w: 1, h: 1 };
let mouse = {x:0,y:0,down:false};
let m = [0, 0];
let keys = {};

// {color}
let datas = [];
// id
let ids = [];
// [x, y]
let pxs = [];

/*
{
  name: 'Name'
  color: ['rgb' or 'hsv', [c1, c2, c3], [c1, c2, c3](optional)]
  rules: [move [x, y] if not, move [x, y] if not, move [x, y]...]
  effects: [['kill', [x, y], id], ['die', [time1, time2]]]
}
*/
const materials = [
  {
    name: 'Eraser',
    color: ['rgb', [255, 0, 0]],
    rules: [],
    effects: [['die', [0, 0]]]
  },
  {
    name: 'Wall',
    color: ['hsv', [0, 0, 20]],
    rules: []
  },
  {
    name: 'Sand',
    color: ['rgb', [255, 255, 200], [255, 255, 255]],
    rules: [[0, 1], [[-1, 1], [1, 1]]]
  },
  {
    name: 'Stone',
    color: ['hsv', [0, 0, 30], [0, 0, 50]],
    rules: [[0, 1]]
  },
  {
    name: 'Water',
    color: ['rgb', [0, 0, 100], [0, 0, 150]],
    rules: [[0, 1], [[-1, 0], [1, 0]]]
  },
  {
    name: 'Acid',
    color: ['rgb', [0, 100, 0], [0, 0, 100]],
    rules: [[0, 1], [[1, 0], [-1, 0]]],
    effects: [['die', [2000, 3000]], ['kill', [0, 1], '!5'], ['kill', [0, -1], '!5'], ['kill', [1, -1], '!5'], ['kill', [-1, -1], '!5'], ['kill', [1, 0], '!5'], ['kill', [-1, 0], '!5']]
  },
  {
    name: 'Fire',
    color: ['rgb', [255, 255, 0], [255, 0, 0]],
    rules: [[0, -1]],
    effects: [['die', [2000, 10000]], ['kill', [0, -1], '!6 !4'], ['kill', [1, 0], '!6 !4'], ['kill', [-1, 0], '!6 !4'], ['move', [1, 0], 0.1], ['move', [-1, 0], 0.1]]
  },
  {
    name: 'Void',
    color: ['rgb', [20, 0, 20]],
    rules: [],
    effects: [['kill', [0, -1], '!7'], ['kill', [0, 1], '!7'], ['kill', [-1, 0], '!7'], ['kill', [1, 0], '!7']]
  }
]

for (let i = 0; i < materials.length; i++) {
  const mat = materials[i];
  const material = document.createElement('option');
  material.value = i;
  material.innerHTML = mat.name;
  const [type, r, g, b] = HSVtoRGB([mat.color[0], ...mat.color[1]]);
  material.style.background = rgb(r, g, b);
  material.style.color = (r+g+b) / 3 > 127.5 ? rgb(0, 0, 0) : rgb(255, 255, 255);
  materialSelect.append(material);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  c.w = Math.ceil(canvas.width / pxScale);
  c.h = Math.ceil(canvas.height / pxScale);
  
  tmpCanvas.width = c.w;
  tmpCanvas.height = c.h;
}

function rgb(r, g, b) {
  return `rgb(${r}, ${g}, ${b})`;
}

function rand([n1, n2]) {
  const min = Math.min(n1, n2);
  const max = Math.max(n1, n2);
  return min + Math.random() * (max - min)
}

function HSVtoRGB([type, h, s, v]) {
  if (type != 'hsv') return [type, h, s, v];
  s /= 100;
  v /= 100;

  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;

  let rgb;
  if (h >= 0 && h < 60)         rgb = [c, x, 0];
  else if (h >= 60 && h < 120)  rgb = [x, c, 0];
  else if (h >= 120 && h < 180) rgb = [0, c, x];
  else if (h >= 180 && h < 240) rgb = [0, x, c];
  else if (h >= 240 && h < 300) rgb = [x, 0, c];
  else                          rgb = [c, 0, x];

  [r, g, b] = rgb.map(v => (v + m) * 255);
  return ['rgb', r, g, b];
}

function find([x, y]) {
  return pxs.findIndex(p => p[0] === x && p[1] === y);
}

function findID([x, y]) {
  return ids[find([x, y])];
}

function edit([x, y], id, remove) {
  const i = find([x, y]);
  if (i > -1) {
    pxs.splice(i, 1);
    ids.splice(i, 1);
    datas.splice(i, 1);
  };

  if (remove) return i;

  const col = materials[id].color;
  let [r, g, b] = col[1];
  if (col.length > 2) {
    r = rand([r, col[2][0]]);
    g = rand([g, col[2][1]]);
    b = rand([b, col[2][2]]);
  }

  pxs.push([x, y]);
  ids.push(id);
  datas.push({color: [col[0], r, g, b], created: Date.now()})
}

function formatColor([type, r, g, b]) {
  if (type == 'hsv') [type, r, g, b] = HSVtoRGB([type, r, g, b]);
  if (type == 'rgb') return `rgb(${r}, ${g}, ${b})`;
}

function formatColorA([type, r, g, b, a]) {
  if (type == 'hsv') [type, r, g, b] = HSVtoRGB([type, r, g, b]);
  if (type == 'rgb') return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function px(x, y, [type, r, g, b]) {
  if (type == 'hsv') [type, r, g, b] = HSVtoRGB([type, r, g, b]);
  const px = (y * c.w + x) * 4;
  tmpImg.data[px]   = r;
  tmpImg.data[px+1] = g;
  tmpImg.data[px+2] = b;
  tmpImg.data[px+3] = 255;
}

function redraw() {
  const preID = currentId;
  if              (keys['`']) currentId = 0;
  else if         (keys['1']) currentId = 1;
  else if         (keys['2']) currentId = 2;
  else if         (keys['3']) currentId = 3;
  else if         (keys['4']) currentId = 4;
  else if         (keys['5']) currentId = 5;
  else if         (keys['6']) currentId = 6;
  else if         (keys['7']) currentId = 7;
  else if         (keys['8']) currentId = 8;
  else if         (keys['9']) currentId = 9;
  else if         (keys['0']) currentId = 10;
  else if         (keys['-']) currentId = 11;
  else if         (keys['=']) currentId = 12;
  else if (keys['Backspace']) currentId = 13;

  if (preID != currentId) materialSelect.value = currentId;

  resizeCanvas();
  tmpImg = ctx.createImageData(c.w, c.h);

  // Add Brush
  const half = brush/2|0;
  if (mouse.down) {
    for (let x = -half; x <= half - (brush-1) % 2; x++) {
      for (let y = -half; y <= half - (brush-1) % 2; y++) {
        const nx = m[0] + x;
        const ny = m[1] + y;
        if (nx >= 0 && ny >= 0 && nx < c.w && ny < c.h) edit([nx, ny], currentId, currentId == 0);
      }
    }
  }

  // Update pixels
  for (let i = 0; i < pxs.length; i++) {
    if (!pxs[i]) continue;
    let [x, y] = pxs[i];
    let id = ids[i];
    let {color, created} = datas[i];
    let {rules, effects} = materials[id];

    if (x >= c.w || y >= c.h) continue;

    function move([nx, ny]) {
      const fx = x+nx;
      const fy = y+ny;
      const ox = x;
      const oy = y;
      if (find([fx, fy]) != -1) return false;
      x = Math.max(0, Math.min(c.w - 1, fx));
      y = Math.max(0, Math.min(c.h - 1, fy));
      if (x != fx || y != fy) {
        x = ox;
        y = oy;
        return false;
      };
      return true;
    }

    let stop = false;
    if (effects) {
      for (let effect of effects) {
        // EFFECT KILL
        if (effect[0] == 'kill' && effect.length > 1) {
          const epos = [x + effect[1][0], y + effect[1][1]];
          const targetID = findID(epos);
          const targets = effect[2].split(' ');

          for (let t of targets) {
            if (t.startsWith('!') ? targetID != t.slice(1) : targetID == t) {
              const pxi = edit(epos, 0, true);
              if (effect[1][0] == 0 && effect[1][1] == 0) stop = true;
              if (pxi != -1 && pxi < i) i--;
            }
          }
          continue;
        }

        // EFFECT DIE
        if (effect[0] == 'die' && effect.length > 1){
          if (Date.now() - created > rand(effect[1])) {
            edit([x, y], 0, true);
            stop = true;
          }
          continue;
        }
        
        // EFFECT MOVE
        if (effect[0] == 'move' && effect.length > 2) {
          if (Math.random() < effect[2]) {
            move([effect[1][0], effect[1][1]]);
          }
          continue;
        }
      }

      if (stop) continue;
    }

    for (let rule of rules) {
      let choice;
      if (typeof rule[0] == 'number') choice = rule;
      else choice = rule[Math.floor(Math.random()*rule.length)];

      if (move(choice)) break;
    }

    pxs[i][0] = x;
    pxs[i][1] = y;
    px(pxs[i][0], pxs[i][1], color)
  }

  // Draw background
  tmpCTX.putImageData(tmpImg, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const scale = [c.w * pxScale, c.h * pxScale]
  const offset = [(canvas.width - scale[0]) / 2, (canvas.height - scale[1]) / 2]
  ctx.drawImage(tmpCanvas, offset[0], offset[1], scale[0], scale[1]);

  const scaledHalf = half * pxScale;
  const scaledBrush = brush * pxScale
  const preScale = [m[0] * pxScale + offset[0] - scaledHalf, m[1] * pxScale + offset[1] - scaledHalf, scaledBrush, scaledBrush]
  // Item preview
  const col = materials[currentId].color;
  ctx.fillStyle = formatColorA([col[0], ...col[1], preAlpha]);
  ctx.fillRect(...preScale);

  // Item border
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(...preScale);
}

document.addEventListener('mousemove', e => {
  mouse.x = e.pageX;
  mouse.y = e.pageY;
  m[0] = (mouse.x - (canvas.width - c.w * pxScale) / 2) / pxScale | 0;
  m[1] = (mouse.y - (canvas.height - c.h * pxScale) / 2) / pxScale | 0;
});

canvas.addEventListener('mousedown', () => mouse.down = true);
document.addEventListener('mouseup', () => mouse.down = false);

document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => delete keys[e.key]);

brushSize.addEventListener('input', e => brushSizeDisplay.innerHTML = brush = brushSize.value);
pixelSize.addEventListener('input', e => pixelSizeDisplay.innerHTML = pxScale = pixelSize.value);
materialSelect.addEventListener('input', e => currentId = materialSelect.value);

setInterval(redraw, 1/60);