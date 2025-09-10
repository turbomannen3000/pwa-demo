const $ = (sel) => document.querySelector(sel);

const state = {
  puzzle: null,
  selection: { row: 0, col: 0, dir: "across" }, // across | down
};

// ======== PWA: SW + Update prompt ========
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    const bar = $('#updatebar'); const btn = $('#reload');
    function showUpdate() { bar.hidden = false; btn.onclick = () => reg.waiting?.postMessage({ type: 'SKIP_WAITING' }); }
    if (reg.waiting) showUpdate();
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) { showUpdate(); }
      });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
  });
}

// ======== Optional: Install, Share, Wake Lock ========
let deferredPrompt;
$('#share')?.addEventListener('click', async () => {
  if (navigator.share) {
    try { await navigator.share({ title: document.title, url: location.href }); } catch {}
  } else { alert('Dela stöds inte.'); }
});
$('#wakelock')?.addEventListener('click', async () => {
  try {
    if (!('wakeLock' in navigator)) return alert('Wake Lock saknas.');
    const btn = $('#wakelock');
    if (!window._wakeLock) {
      window._wakeLock = await navigator.wakeLock.request('screen');
      btn.textContent = 'Skärm av';
      window._wakeLock.addEventListener('release', () => { btn.textContent = 'Skärm på'; window._wakeLock = null; });
    } else {
      await window._wakeLock.release();
    }
  } catch { alert('Kunde inte ändra Wake Lock.'); }
});
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('#install').hidden = false; });
$('#install')?.addEventListener('click', async () => { $('#install').hidden = true; if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; });

// ======== Puzzle Loading ========
const sel = $('#puzzleSelect');
sel?.addEventListener('change', () => loadPuzzle('./puzzles/' + sel.value));

async function loadPuzzle(url) {
  const res = await fetch(url);
  const puzzle = await res.json();
  state.puzzle = puzzle;
  buildGrid(puzzle);
  renderClues(puzzle);
  restoreProgress();
  selectFirst();
}

function isBlock(r,c){ return state.puzzle.blocks.includes(`${r},${c}`); }

function buildGrid(puzzle){
  const grid = $('#grid');
  grid.style.gridTemplateColumns = `repeat(${puzzle.width}, 40px)`;
  grid.innerHTML = "";
  state.cells = [];
  for(let r=0;r<puzzle.height;r++){
    for(let c=0;c<puzzle.width;c++){
      const cell = document.createElement('div');
      cell.className = 'cell' + (isBlock(r,c) ? ' block' : '');
      cell.dataset.r = r; cell.dataset.c = c;
      if(!isBlock(r,c)){
        const input = document.createElement('input');
        input.maxLength = 1; input.inputMode = "latin";
        input.addEventListener('input', (e)=>{
          e.target.value = normalize(e.target.value);
          saveProgress();
          highlightWord();
          jumpAdvance();
        });
        input.addEventListener('focus', ()=>selectCell(r,c));
        input.addEventListener('keydown', (e)=>{
          if(e.key === ' '){ e.preventDefault(); toggleDir(); }
        });
        cell.appendChild(input);
        const num = startNumber(r,c);
        if(num) {
          const small = document.createElement('div');
          small.className = 'num'; small.textContent = num;
          cell.appendChild(small);
        }
      }
      grid.appendChild(cell);
      state.cells.push(cell);
    }
  }
}

function normalize(ch){
  return (ch || "").toLocaleUpperCase('sv-SE');
}

function hasAcross(r,c){
  return c+1 < state.puzzle.width && !isBlock(r,c+1);
}
function hasDown(r,c){
  return r+1 < state.puzzle.height && !isBlock(r+1,c);
}
function findClueAt(r,c,dir){
  const list = state.puzzle.clues[dir];
  return list.find(cl => cl.row===r && cl.col===c);
}
function startNumber(r,c){
  if(isBlock(r,c)) return null;
  const leftBlocked = c===0 || isBlock(r,c-1);
  const upBlocked   = r===0 || isBlock(r-1,c);
  if(leftBlocked && hasAcross(r,c)) {
    const clue = findClueAt(r,c,"across");
    return clue?.number || null;
  }
  if(upBlocked && hasDown(r,c)) {
    const clue = findClueAt(r,c,"down");
    return clue?.number || null;
  }
  return null;
}

function renderClues(puzzle){
  const a = $('#clues-across'); const d = $('#clues-down');
  a.innerHTML=""; d.innerHTML="";
  for(const cl of puzzle.clues.across){
    const li = document.createElement('li');
    li.textContent = `${cl.number}. ${cl.text}`;
    li.addEventListener('click', ()=>{ selectCell(cl.row, cl.col, "across"); focusCell(cl.row, cl.col); });
    a.appendChild(li);
  }
  for(const cl of puzzle.clues.down){
    const li = document.createElement('li');
    li.textContent = `${cl.number}. ${cl.text}`;
    li.addEventListener('click', ()=>{ selectCell(cl.row, cl.col, "down"); focusCell(cl.row, cl.col); });
    d.appendChild(li);
  }
}

function focusCell(r,c){ document.querySelector(`.cell[data-r="${r}"][data-c="${c}"] input`)?.focus(); }

function selectFirst(){
  for(let r=0;r<state.puzzle.height;r++){
    for(let c=0;c<state.puzzle.width;c++){
      if(!isBlock(r,c)) { selectCell(r,c,"across"); return; }
    }
  }
}

function selectCell(r,c,dir){
  state.selection = {row:r,col:c,dir:dir || state.selection.dir};
  document.querySelectorAll('.selected').forEach(el=>el.classList.remove('selected'));
  document.querySelectorAll('.word-highlight').forEach(el=>el.classList.remove('word-highlight'));
  const cell = queryCell(r,c);
  if(cell && !cell.classList.contains('block')) cell.classList.add('selected');
  highlightWord();
}

function toggleDir(){ state.selection.dir = state.selection.dir === "across" ? "down" : "across"; highlightWord(); }

function highlightWord(){
  const {row,col,dir} = state.selection;
  let r=row, c=col;
  // gå till start på ordet
  if(dir==="across"){ while(c>0 && !isBlock(r,c-1)) c--; }
  else { while(r>0 && !isBlock(r-1,c)) r--; }
  // markera ord
  while(r<state.puzzle.height && c<state.puzzle.width && !isBlock(r,c)){
    queryCell(r,c).classList.add('word-highlight');
    if(dir==="across") c++; else r++;
  }
}

function queryCell(r,c){ return document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`); }

document.addEventListener('keydown', e=>{
  const {row,col,dir} = state.selection;
  if(e.key==="ArrowRight") return selectCell(row, Math.min(col+1,state.puzzle.width-1), "across");
  if(e.key==="ArrowLeft")  return selectCell(row, Math.max(col-1,0), "across");
  if(e.key==="ArrowDown")  return selectCell(Math.min(row+1,state.puzzle.height-1), col, "down");
  if(e.key==="ArrowUp")    return selectCell(Math.max(row-1,0), col, "down");
  if(e.key==="Tab"){ e.preventDefault(); jumpToNextStart(); }
  if(e.key===" "){ e.preventDefault(); toggleDir(); }
});

function jumpToNextStart(){
  const starts = [...document.querySelectorAll('.num')].map(n=>n.parentElement);
  const idx = starts.indexOf(document.querySelector('.selected'));
  const next = starts[(idx+1 + starts.length) % starts.length];
  if(next){
    selectCell(+next.dataset.r, +next.dataset.c);
    next.querySelector('input')?.focus();
  }
}

function collectWordCells(row,col,dir){
  let r=row, c=col;
  if(dir==="across"){ while(c>0 && !isBlock(r,c-1)) c--; }
  else { while(r>0 && !isBlock(r-1,c)) r--; }
  const cells = [];
  while(r<state.puzzle.height && c<state.puzzle.width && !isBlock(r,c)){
    cells.push({r,c});
    if(dir==="across") c++; else r++;
  }
  return cells;
}

function saveProgress(){
  const values = [];
  for(let r=0;r<state.puzzle.height;r++){
    values[r]=[];
    for(let c=0;c<state.puzzle.width;c++){
      const inp = queryCell(r,c)?.querySelector('input');
      values[r][c] = inp ? (inp.value || "") : null;
    }
  }
  localStorage.setItem('progress:' + state.puzzle.id, JSON.stringify(values));
}
function restoreProgress(){
  const raw = localStorage.getItem('progress:' + state.puzzle.id);
  if(!raw) return;
  try{
    const values = JSON.parse(raw);
    for(let r=0;r<state.puzzle.height;r++){
      for(let c=0;c<state.puzzle.width;c++){
        const inp = queryCell(r,c)?.querySelector('input');
        if(inp && values[r] && values[r][c] != null){
          inp.value = normalize(values[r][c]);
        }
      }
    }
  }catch(_){}
}

function jumpAdvance(){
  // flytta fram ett steg i aktuell riktning efter input
  const {row,col,dir} = state.selection;
  const cells = collectWordCells(row,col,dir);
  // hitta index för nuvarande
  const idx = cells.findIndex(cc => cc.r===row && cc.c===col);
  const next = cells[idx+1];
  if(next) { selectCell(next.r, next.c, dir); focusCell(next.r, next.c); }
}

$('#check-all').addEventListener('click', ()=>{
  for(let r=0;r<state.puzzle.height;r++){
    for(let c=0;c<state.puzzle.width;c++){
      const inp = queryCell(r,c)?.querySelector('input');
      const sol = state.puzzle.solution?.[r]?.[c];
      if(inp && sol && sol !== "■"){
        inp.style.color = inp.value === sol ? "inherit" : "crimson";
      }
    }
  }
});

$('#check-word').addEventListener('click', ()=>{
  const {row,col,dir} = state.selection;
  const cells = collectWordCells(row,col,dir);
  for(const {r,c} of cells){
    const inp = queryCell(r,c)?.querySelector('input');
    const sol = state.puzzle.solution?.[r]?.[c];
    if(inp && sol && sol !== "■"){
      inp.style.color = inp.value === sol ? "inherit" : "crimson";
    }
  }
});

$('#clear').addEventListener('click', ()=>{
  document.querySelectorAll('.cell input').forEach(i=>{ i.value=""; i.style.color="inherit"; });
  localStorage.removeItem('progress:' + state.puzzle.id);
});

// Start
loadPuzzle('./puzzles/sample.json');
