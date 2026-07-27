/* ============================================================
   app.js — NYT Connections Daily Word Viewer
   Freeform drag with snap-to-grid (slot-based layout)
   ============================================================ */

// ── Grid constants ─────────────────────────────────────────
const GRID_COLS   = 8;
const GRID_ROWS   = 4;
const TOTAL_SLOTS = GRID_COLS * GRID_ROWS; // 32

// ── Other constants ────────────────────────────────────────
const COLOR_CYCLE = ['white', 'yellow', 'green', 'blue', 'purple'];
const STORAGE_KEY = 'nyt_connections_tiles_v3';

// ── Demo puzzle ────────────────────────────────────────────
const DEMO_PUZZLE = {
  print_date : 'Demo Puzzle',
  id         : 0,
  editor     : 'Demo',
  categories : [
    { title: 'CONTRACT',
      cards: [
        { content: 'AGREEMENT',     position: 13 },
        { content: 'BARGAIN',       position:  8 },
        { content: 'DEAL',          position:  6 },
        { content: 'UNDERSTANDING', position: 10 }
      ]
    },
    { title: 'EDIT MENU OPTIONS',
      cards: [
        { content: 'COPY',  position:  7 },
        { content: 'CUT',   position:  5 },
        { content: 'FIND',  position: 15 },
        { content: 'PASTE', position:  2 }
      ]
    },
    { title: 'SHADE OF ORANGE',
      cards: [
        { content: 'AMBER',     position:  0 },
        { content: 'CORAL',     position: 14 },
        { content: 'RUST',      position:  1 },
        { content: 'TANGERINE', position:  3 }
      ]
    },
    { title: '___ FISH',
      cards: [
        { content: 'BLOW',    position:  4 },
        { content: 'CATFISH', position:  9 },
        { content: 'STAR',    position: 11 },
        { content: 'SWORD',   position: 12 }
      ]
    }
  ]
};

// ── App state ──────────────────────────────────────────────
let activeColor = 'white';
let tileColors  = {};   // { puzzlePosition: colorName }
let slotMap     = {};   // { slotIndex: puzzlePosition | null }
let puzzleDate  = '';

// ── DOM refs ───────────────────────────────────────────────
const loaderContainer = document.getElementById('loaderContainer');
const errorContainer  = document.getElementById('errorContainer');
const puzzleArea      = document.getElementById('puzzleArea');
const tileGrid        = document.getElementById('tileGrid');
const dateBadge       = document.getElementById('dateBadge');
const errorMsg        = document.getElementById('errorMsg');
const retryBtn        = document.getElementById('retryBtn');
const demoBtn         = document.getElementById('demoBtn');
const resetAllBtn     = document.getElementById('resetAll');
const resetOrderBtn   = document.getElementById('resetOrder');

// ── Date helpers ───────────────────────────────────────────
function todayString() {
  const d = new Date();
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()]
    .map((n, i) => i === 0 ? n : String(n).padStart(2,'0'))
    .join('-');
}
function formatDate(ds) {
  if (!ds || ds === 'Demo Puzzle') return ds;
  const [y, m, d] = ds.split('-');
  return `${d}/${m}/${y}`;
}

// ── Default slot map ───────────────────────────────────────
// Places tiles in the inner 4 columns (cols 2-5 of 0-7), 2 empty cols each side.
function getDefaultSlotMap(sortedPositions) {
  const map = {};
  for (let i = 0; i < TOTAL_SLOTS; i++) map[i] = null;
  let ti = 0;
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 2; col <= 5; col++) {
      if (ti < sortedPositions.length) {
        map[row * GRID_COLS + col] = sortedPositions[ti++];
      }
    }
  }
  return map;
}

// ── LocalStorage ───────────────────────────────────────────
function saveState() {
  const currentMap = {};
  document.querySelectorAll('.slot').forEach(slot => {
    const idx  = Number(slot.dataset.slot);
    const tile = slot.querySelector('.tile');
    currentMap[idx] = tile ? Number(tile.dataset.position) : null;
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      date: puzzleDate, colors: tileColors, slotMap: currentMap
    }));
  } catch (_) {}
}

function loadState(date, defaultMap) {
  tileColors = {};
  slotMap    = { ...defaultMap };
  try {
    const p = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!p || p.date !== date) return;
    if (typeof p.colors === 'object')  tileColors = p.colors;
    if (p.slotMap && Object.keys(p.slotMap).length === TOTAL_SLOTS) slotMap = p.slotMap;
  } catch (_) {}
}

// ── Colour toolbar ─────────────────────────────────────────
function selectColor(color) {
  activeColor = color;
  document.querySelectorAll('.swatch').forEach(b =>
    b.classList.toggle('active', b.dataset.color === color)
  );
}
document.querySelectorAll('.swatch').forEach(b =>
  b.addEventListener('click', () => selectColor(b.dataset.color))
);

resetAllBtn.addEventListener('click', () => {
  tileColors = {};
  document.querySelectorAll('.tile').forEach(t => applyColor(t, 'white'));
  saveState();
});

resetOrderBtn.addEventListener('click', () => {
  // Collect all tiles, sort by puzzle position
  const tiles = [...document.querySelectorAll('.tile')]
    .sort((a,b) => Number(a.dataset.position) - Number(b.dataset.position));

  // Clear slots
  document.querySelectorAll('.slot').forEach(s => {
    s.innerHTML = '';
    s.classList.remove('occupied');
  });

  // Re-place in default pattern (inner 4 cols)
  let ti = 0;
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 2; col <= 5; col++) {
      const slot = document.querySelector(`.slot[data-slot="${row * GRID_COLS + col}"]`);
      if (slot && tiles[ti]) {
        slot.appendChild(tiles[ti]);
        slot.classList.add('occupied');
        ti++;
      }
    }
  }
  saveState();
});

retryBtn.addEventListener('click', () => { showLoader(); fetchPuzzle(); });
demoBtn.addEventListener('click',  () => { showLoader(); renderPuzzle(DEMO_PUZZLE); });

document.addEventListener('keydown', e => {
  const map = { '1':'white','2':'yellow','3':'green','4':'blue','5':'purple' };
  if (map[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) selectColor(map[e.key]);
});

// ── UI visibility ──────────────────────────────────────────
function showLoader() {
  loaderContainer.style.display = 'flex';
  errorContainer.style.display  = 'none';
  puzzleArea.style.display      = 'none';
}
function showError(msg) {
  loaderContainer.style.display = 'none';
  errorContainer.style.display  = 'flex';
  puzzleArea.style.display      = 'none';
  errorMsg.textContent = msg;
}
function showPuzzle() {
  loaderContainer.style.display = 'none';
  errorContainer.style.display  = 'none';
  puzzleArea.style.display = 'flex';
}

// ── Colour application ─────────────────────────────────────
function applyColor(tile, color) {
  COLOR_CYCLE.forEach(c => tile.classList.remove(`color-${c}`));
  tile.classList.add(`color-${color}`);
}

// ══════════════════════════════════════════════════════════
//  FREEFORM DRAG WITH SNAP-TO-GRID
//
//  Tiles live inside .slot elements (grid cells).
//  On drag:
//    • Tile is removed from its slot → slot becomes empty (border shown).
//    • A ghost clone (position:fixed) follows the cursor freely.
//    • The nearest slot is highlighted as the drop target.
//  On release:
//    • Ghost snaps (CSS transition) to the target slot's position.
//    • Real tile is placed in target slot.
//    • If target was occupied, that tile moves to the origin slot (swap).
// ══════════════════════════════════════════════════════════

const drag = {
  active      : false,
  tile        : null,
  ghost       : null,
  originSlot  : null,
  targetSlot  : null,
  pointerOffX : 0,
  pointerOffY : 0,
  didMove     : false,
};

// ── Find nearest slot to (x, y) ───────────────────────────
function findNearestSlot(x, y) {
  let nearest = null;
  let minDist = Infinity;
  document.querySelectorAll('.slot').forEach(slot => {
    const r  = slot.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    const d  = Math.hypot(x - cx, y - cy);
    if (d < minDist) { minDist = d; nearest = slot; }
  });
  return nearest;
}

// ── Slot highlight helpers ─────────────────────────────────
function highlightSlot(slot) {
  clearSlotHighlights();
  if (slot) slot.classList.add('drag-over');
}
function clearSlotHighlights() {
  document.querySelectorAll('.slot.drag-over').forEach(s => s.classList.remove('drag-over'));
}

// ── Drag start ─────────────────────────────────────────────
function dragStart(e, tile) {
  if (e.button !== undefined && e.button !== 0) return;
  e.preventDefault();

  const slot = tile.parentElement; // the .slot this tile lives in
  const rect = tile.getBoundingClientRect();

  // Remove tile from slot so slot shows as empty
  tile.remove();
  slot.classList.remove('occupied');

  // Build fixed-position ghost clone
  const ghost = tile.cloneNode(true);
  Object.assign(ghost.style, {
    position     : 'fixed',
    left         : rect.left   + 'px',
    top          : rect.top    + 'px',
    width        : rect.width  + 'px',
    height       : rect.height + 'px',
    margin       : '0',
    pointerEvents: 'none',
    zIndex       : '99999',
    opacity      : '0.9',
    transition   : 'none',
    boxShadow    : '0 8px 32px rgba(0,0,0,0.6)',
    borderRadius : getComputedStyle(tile).borderRadius,
  });
  ghost.classList.add('drag-ghost');
  document.body.appendChild(ghost);

  Object.assign(drag, {
    active      : true,
    tile,
    ghost,
    originSlot  : slot,
    targetSlot  : null,
    pointerOffX : e.clientX - rect.left,
    pointerOffY : e.clientY - rect.top,
    didMove     : false,
  });

  // Highlight origin slot so user sees where they picked up from
  slot.classList.add('drag-over');

  document.addEventListener('pointermove',   onDragMove,   { passive: false });
  document.addEventListener('pointerup',     onDragEnd);
  document.addEventListener('pointercancel', onDragEnd);
}

// ── Drag move ──────────────────────────────────────────────
function onDragMove(e) {
  if (!drag.active) return;
  e.preventDefault();
  drag.didMove = true;

  // Ghost follows cursor freely
  drag.ghost.style.left = (e.clientX - drag.pointerOffX) + 'px';
  drag.ghost.style.top  = (e.clientY - drag.pointerOffY) + 'px';

  // Find slot under cursor (ghost is pointerEvents:none, so this works)
  const el   = document.elementFromPoint(e.clientX, e.clientY);
  const slot = el?.closest?.('.slot') || findNearestSlot(e.clientX, e.clientY);

  if (slot !== drag.targetSlot) {
    drag.targetSlot = slot;
    highlightSlot(slot);
  }
}

// ── Drag end / drop ────────────────────────────────────────
function onDragEnd(e) {
  if (!drag.active) return;

  document.removeEventListener('pointermove',   onDragMove);
  document.removeEventListener('pointerup',     onDragEnd);
  document.removeEventListener('pointercancel', onDragEnd);
  clearSlotHighlights();

  // ── Pure click (no movement) → apply colour ──────────────
  if (!drag.didMove) {
    drag.originSlot.appendChild(drag.tile);
    drag.originSlot.classList.add('occupied');
    drag.ghost.remove();
    const pos = Number(drag.tile.dataset.position);
    tileColors[pos] = activeColor;
    applyColor(drag.tile, activeColor);
    saveState();
    resetDragState();
    return;
  }

  // ── Determine landing slot ───────────────────────────────
  const landSlot = drag.targetSlot || drag.originSlot;

  // If landing slot is occupied, pull that tile out for swapping
  let swapTile = null;
  if (landSlot.classList.contains('occupied')) {
    swapTile = landSlot.querySelector('.tile');
    swapTile.remove();
    landSlot.classList.remove('occupied');
  }

  // ── Snap ghost to landing slot ───────────────────────────
  const lr = landSlot.getBoundingClientRect();
  drag.ghost.style.transition =
    'left 0.20s cubic-bezier(.4,0,.2,1), top 0.20s cubic-bezier(.4,0,.2,1)';
  drag.ghost.style.left      = lr.left + 'px';
  drag.ghost.style.top       = lr.top  + 'px';

  // After snap animation completes, place real tile & clean up
  setTimeout(() => {
    drag.ghost.remove();

    // Place dragged tile in landing slot
    landSlot.appendChild(drag.tile);
    landSlot.classList.add('occupied');

    // If swap: place displaced tile in origin slot
    if (swapTile) {
      drag.originSlot.appendChild(swapTile);
      drag.originSlot.classList.add('occupied');
    }

    saveState();
    resetDragState();
  }, 210);
}


function resetDragState() {
  drag.active      = false;
  drag.tile        = null;
  drag.ghost       = null;
  drag.originSlot  = null;
  drag.targetSlot  = null;
  drag.didMove     = false;
}

// ── Tile factory ───────────────────────────────────────────
function createTile(word, position) {
  const tile = document.createElement('div');
  tile.className = 'tile';
  tile.setAttribute('role', 'gridcell');
  tile.setAttribute('tabindex', '0');
  tile.setAttribute('aria-label', word);
  tile.dataset.position  = position;
  tile.style.touchAction = 'none';

  const wordSpan = document.createElement('span');
  wordSpan.className   = 'tile-word';
  wordSpan.textContent = word;
  tile.appendChild(wordSpan);

  applyColor(tile, tileColors[position] || 'white');

  // Drag
  tile.addEventListener('pointerdown', e => dragStart(e, tile));

  // Right-click → clear colour
  tile.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (drag.active) return;
    tileColors[position] = 'white';
    applyColor(tile, 'white');
    saveState();
  });

  // Keyboard
  tile.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      tileColors[position] = activeColor;
      applyColor(tile, activeColor);
      saveState();
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      tileColors[position] = 'white';
      applyColor(tile, 'white');
      saveState();
    }
  });

  return tile;
}

// ── Build the slot grid ────────────────────────────────────
function buildGrid(byPos) {
  tileGrid.innerHTML = '';
  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const slot = document.createElement('div');
    slot.className   = 'slot';
    slot.dataset.slot = i;

    const pos = slotMap[i];
    if (pos !== null && pos !== undefined && byPos[pos]) {
      const tile = createTile(byPos[pos].content, pos);
      slot.appendChild(tile);
      slot.classList.add('occupied');
    }

    tileGrid.appendChild(slot);
  }
}

// ── Render puzzle ──────────────────────────────────────────
function renderPuzzle(data) {
  puzzleDate = data.print_date || 'Demo Puzzle';

  const allCards = [];
  data.categories.forEach(cat =>
    cat.cards.forEach(card =>
      allCards.push({ content: card.content, position: card.position })
    )
  );
  allCards.sort((a,b) => a.position - b.position);

  const defaultMap = getDefaultSlotMap(allCards.map(c => c.position));
  loadState(puzzleDate, defaultMap);

  dateBadge.textContent = puzzleDate === 'Demo Puzzle'
    ? 'Demo'
    : formatDate(puzzleDate);

  const byPos = {};
  allCards.forEach(c => { byPos[c.position] = c; });

  buildGrid(byPos);

  showPuzzle();
}


// ── Fetch helpers ──────────────────────────────────────────
const PUZZLE_CACHE_KEY = 'nyt_connections_puzzle_data_v1';


async function fetchWithTimeout(url, ms = 7000) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, mode: 'cors', cache: 'no-store' });
    clearTimeout(tid);
    return res;
  } catch (e) {
    clearTimeout(tid);
    throw e;
  }
}

async function fetchPuzzle() {
  const date = todayString();

  // Return cached puzzle data if it's from today
  try {
    const cached = JSON.parse(localStorage.getItem(PUZZLE_CACHE_KEY) || 'null');
    if (cached?.date === date && cached?.data?.categories?.length) {
      renderPuzzle(cached.data);
      return;
    }
  } catch (_) {}

  const nytUrl   = `https://www.nytimes.com/svc/connections/v2/${date}.json`;
  const encoded  = encodeURIComponent(nytUrl);

  const endpoints = [
    nytUrl,
    `https://corsproxy.io/?${nytUrl}`,
    `https://api.allorigins.win/raw?url=${encoded}`,
    `https://api.codetabs.com/v1/proxy?quest=${nytUrl}`,
    `https://thingproxy.freeboard.io/fetch/${nytUrl}`,
    `https://proxy.cors.sh/${nytUrl}`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.categories?.length) {
        // Cache so page reloads are instant
        try { localStorage.setItem(PUZZLE_CACHE_KEY, JSON.stringify({ date, data })); } catch (_) {}
        renderPuzzle(data);
        return;
      }
    } catch (err) { console.warn(`Failed [${url}]:`, err.message); }
  }

  showError(
    "Could not load today's puzzle from any source. " +
    "This usually happens when the puzzle hasn't been published yet, " +
    "or all proxy services are temporarily down. " +
    "Try again in a few minutes, or load the demo puzzle."
  );
}

// ── Init ───────────────────────────────────────────────────
(function init() {
  dateBadge.textContent = formatDate(todayString());
  selectColor('white');
  fetchPuzzle();
})();
