/* ========= 全局 ========= */
const MAX_IMAGES = 9, MIN_IMAGES = 2;
const MAX_CANVAS_SIDE = 16000, MAX_CANVAS_PIXELS = 250000000;
const MAX_FILE_BYTES = 50*1024*1024, MAX_EXPORT_BYTES = 50*1024*1024;
const $ = id => document.getElementById(id);

let images = [];      // { img, name, url }
let lastBlob = null;
let mode = 'grid';
let gridPreviewTimer=0, gridRevision=0, gridExportBusy=false;
let pendingImageCount=0, imageUploadRevision=0;

// 表格状态
let tRows = 3, tCols = 3;
let cells = [];       // cells[r][c] = srcIdx 或 null
function initCells(){ cells = []; for(let r=0;r<tRows;r++){ cells.push(new Array(tCols).fill(null)); } }
initCells();

/* ========= 顶部流水屏 ========= */
function initFlowScreen(){
  const canvas = $('flowCanvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let w=0,h=0,dpr=1,t=0;
  function resize(){
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w*dpr);
    canvas.height = Math.floor(h*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function waterLine(yBase,amp,speed,thick,alpha,phase){
    ctx.beginPath();
    for(let x=-80;x<=w+80;x+=12){
      const y = yBase
        + Math.sin(x*.009 + t*speed + phase)*amp
        + Math.sin(x*.023 - t*speed*.52 + phase*1.4)*amp*.28;
      if(x===-80) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    const g = ctx.createLinearGradient(0,yBase-60,w,yBase+60);
    g.addColorStop(0,'rgba(255,255,255,0)');
    g.addColorStop(.35,`rgba(196,248,255,${alpha*.65})`);
    g.addColorStop(.58,`rgba(255,255,255,${alpha})`);
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = thick;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(166,244,255,.35)';
    ctx.shadowBlur = thick*1.4;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  function pebbleShimmer(){
    for(let i=0;i<90;i++){
      const x = (i*83 + Math.sin(t*.6+i)*22) % (w+80) - 40;
      const y = h*(.62 + ((i*47)%34)/100);
      const s = .8 + (i%4)*.45;
      const a = .05 + ((i*17)%22)/100;
      ctx.fillStyle = `rgba(255,255,230,${a})`;
      ctx.beginPath();
      ctx.ellipse(x,y,s*1.8,s,.4,0,Math.PI*2);
      ctx.fill();
    }
  }
  function waveBand(yBase,amp,speed,height,alpha,phase){
    const top=[];
    const bottom=[];
    for(let x=-100;x<=w+100;x+=16){
      const y = yBase
        + Math.sin(x*.007 + t*speed + phase)*amp
        + Math.sin(x*.019 - t*speed*.7 + phase)*amp*.35;
      top.push([x,y]);
      bottom.push([x,y+height+Math.sin(x*.013+t*speed*.5+phase)*amp*.25]);
    }
    ctx.beginPath();
    top.forEach((p,i)=> i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
    bottom.reverse().forEach(p=>ctx.lineTo(p[0],p[1]));
    ctx.closePath();
    const g=ctx.createLinearGradient(0,yBase-height,w,yBase+height*2);
    g.addColorStop(0,'rgba(255,255,255,0)');
    g.addColorStop(.42,`rgba(132,238,255,${alpha})`);
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g;
    ctx.fill();
  }
  function draw(){
    t += .016;
    ctx.clearRect(0,0,w,h);
    const bg = ctx.createLinearGradient(0,0,0,h);
    bg.addColorStop(0,'rgba(255,255,255,.02)');
    bg.addColorStop(.55,'rgba(20,130,155,.035)');
    bg.addColorStop(1,'rgba(0,70,90,.10)');
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation='screen';
    waveBand(h*.55,22,.82,24,.10,0);
    waveBand(h*.68,28,1.05,34,.14,2.4);
    waveBand(h*.82,20,1.32,24,.12,5.1);
    waterLine(h*.42,16,.90,1.8,.22,0);
    waterLine(h*.52,22,1.05,2.2,.28,2.1);
    waterLine(h*.64,28,1.22,2.8,.34,4.4);
    waterLine(h*.75,24,1.45,2.2,.30,6.2);
    waterLine(h*.88,18,1.65,1.7,.24,7.8);
    pebbleShimmer();
    ctx.globalCompositeOperation='source-over';
    const glintX = (Math.sin(t*.32)*.5+.5)*w;
    const glint = ctx.createRadialGradient(glintX,h*.58,0,glintX,h*.58,w*.34);
    glint.addColorStop(0,'rgba(255,255,255,.10)');
    glint.addColorStop(.5,'rgba(140,235,255,.035)');
    glint.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle = glint;
    ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation='screen';
    for(let i=0;i<7;i++){
      const y=h*(.48+i*.075)+Math.sin(t*.9+i)*10;
      const x=((t*70+i*180)%(w+420))-420;
      const streak=ctx.createLinearGradient(x,y,x+420,y+18);
      streak.addColorStop(0,'rgba(255,255,255,0)');
      streak.addColorStop(.5,'rgba(210,250,255,.18)');
      streak.addColorStop(1,'rgba(255,255,255,0)');
      ctx.strokeStyle=streak;
      ctx.lineWidth=1.4+i*.12;
      ctx.beginPath();
      ctx.moveTo(x,y);
      ctx.quadraticCurveTo(x+210,y+Math.sin(t+i)*18,x+420,y+6);
      ctx.stroke();
    }
    ctx.globalCompositeOperation='source-over';
    requestAnimationFrame(draw);
  }
  resize();
  window.addEventListener('resize',resize);
  requestAnimationFrame(draw);
}
// 暗夜版使用静态深色背景，避免在图片处理时占用额外动画资源。

/* ========= 模式切换 ========= */
document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active'); mode = tab.dataset.mode;
    const g = mode==='grid';
    const tableMode = mode==='table';
    const inspectMode = mode==='inspect';
    const paintMode = mode==='paint';
    const portraitMode = mode==='portrait';
    $('assetPanel').classList.toggle('hidden',inspectMode || paintMode || portraitMode);
    $('inspectPanel').classList.toggle('hidden',!inspectMode);
    $('paintPanel').classList.toggle('hidden',!paintMode);
    $('portraitPanel').classList.toggle('hidden',!portraitMode);
    $('gridControls').classList.toggle('hidden',!g);
    $('gridDesignControls').classList.toggle('hidden',!g);
    $('gridPreviewPanel').classList.toggle('hidden',!g);
    $('tableControls').classList.toggle('hidden',!tableMode);
    $('tableStagePanel').classList.toggle('hidden',!tableMode);
    if(g || inspectMode || paintMode || portraitMode) $('previewPanel').classList.add('hidden');
    if(!inspectMode && !paintMode && !portraitMode) $('uploadHint').textContent = g
      ? '支持 PNG / JPG / WEBP · 自动网格 2-9 张 · 单图 ≤ 50MB'
      : '支持 PNG / JPG / WEBP · 表格不限张数 · 单图 ≤ 50MB · 拖缩略图进格子或点格子 +';
    render(); if(tableMode) requestAnimationFrame(()=>renderTable());
  });
});

/* ========= 上传 ========= */
const uploadArea = $('uploadArea'), fileInput = $('fileInput');
uploadArea.addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',e=>{ handleFiles(e.target.files); fileInput.value=''; });
uploadArea.addEventListener('dragover',e=>{ e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave',()=>uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop',e=>{ e.preventDefault(); uploadArea.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });

async function handleFiles(files){
  let arr = Array.from(files).filter(f=>f.type.startsWith('image/'));
  const big = arr.filter(f=>f.size>MAX_FILE_BYTES);
  if(big.length){ alert('图片上传失败：图片文件不能超过 50MB\n\n超限：\n'+big.map(f=>`· ${f.name}（${(f.size/1048576).toFixed(1)} MB）`).join('\n')); arr = arr.filter(f=>f.size<=MAX_FILE_BYTES); }
  if(mode==='grid'){
    const rem = MAX_IMAGES-images.length-pendingImageCount;
    if(rem<=0){ alert(`自动网格最多 ${MAX_IMAGES} 张`); return; }
    if(arr.length>rem){ alert(`自动网格超出 ${MAX_IMAGES} 张，已取前 ${rem} 张`); arr = arr.slice(0,rem); }
  }
  const revision=imageUploadRevision;
  pendingImageCount+=arr.length;
  // Decode in parallel but append in the user's selection order, not load order.
  const loaded=await Promise.all(arr.map(file=>new Promise(resolve=>{
    const url=URL.createObjectURL(file), img=new Image();
    img.onload=()=>resolve({img,name:file.name,url,thumbUrl:makeThumb(img)});
    img.onerror=()=>{ URL.revokeObjectURL(url); resolve(null); };
    img.src=url;
  })));
  pendingImageCount=Math.max(0,pendingImageCount-arr.length);
  const valid=loaded.filter(Boolean);
  if(revision!==imageUploadRevision){ valid.forEach(item=>URL.revokeObjectURL(item.url)); return; }
  images.push(...valid);
  render();
  if(mode==='table') renderTable();
  if(valid.length<arr.length) alert('部分图片无法读取，请确认图片文件有效。');
}

/* 生成显示用缩略图（最大边 THUMB_MAX），大幅降低渲染开销；导出仍用原图 */
const THUMB_MAX = 300;
function makeThumb(img){
  const r = Math.min(THUMB_MAX/img.naturalWidth, THUMB_MAX/img.naturalHeight, 1);
  if(r>=1) return img.src; // 原图本就小，直接用
  const w=Math.max(1,Math.round(img.naturalWidth*r)), h=Math.max(1,Math.round(img.naturalHeight*r));
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const ctx=c.getContext('2d'); ctx.imageSmoothingQuality='medium'; ctx.drawImage(img,0,0,w,h);
  try{ return c.toDataURL('image/jpeg',0.82); }catch(e){ return img.src; }
}
function thumbOf(idx){ const it=images[idx]; return it.thumbUrl||it.url; }

/* ========= 缩略图 ========= */
const thumbnailsEl = $('thumbnails'), statusEl = $('status');
function imageUsedInTable(idx){ for(let r=0;r<tRows;r++)for(let c=0;c<tCols;c++) if(cells[r][c]===idx) return true; return false; }

function render(){
  thumbnailsEl.innerHTML='';
  images.forEach((item,idx)=>{
    const used = mode==='table' && imageUsedInTable(idx);
    const div = document.createElement('div');
    div.className='thumb'+(used?' used':''); div.draggable=true; div.dataset.idx=idx;
    div.innerHTML=`<span class="order">${idx+1}</span><button class="remove" data-idx="${idx}">×</button><img src="${item.thumbUrl||item.url}">`;
    thumbnailsEl.appendChild(div);
  });
  thumbnailsEl.querySelectorAll('.remove').forEach(btn=>{
    btn.addEventListener('click',e=>{ e.stopPropagation(); removeImage(+btn.dataset.idx); });
  });
  if(mode==='grid') setupGridDragSort();
  else if(mode==='table') setupThumbDragForTable();

  const n = images.length;
  if(mode==='grid'){
    const plan=n>=MIN_IMAGES ? getGridPlan() : null;
    const label=$('gridLayout').selectedOptions[0].textContent;
    const gi=plan?`<span class="grid-info">${label} · ${plan.width}×${plan.height}</span>`:'';
    statusEl.innerHTML=`已选 <strong>${n} / ${MAX_IMAGES}</strong> 张 ${gi}`;
    $('generateBtn').disabled = n<MIN_IMAGES||gridExportBusy; $('downloadBtn').disabled=true; lastBlob=null;
    gridRevision++;
    scheduleGridPreview();
  } else if(mode==='table') {
    let filled=0; for(let r=0;r<tRows;r++)for(let c=0;c<tCols;c++) if(cells[r][c]!==null) filled++;
    statusEl.innerHTML=`素材 <strong>${n}</strong> 张 · 表格 ${tRows}×${tCols} · 已填 <strong>${filled}</strong> 格`;
    $('exportAutoBtn').disabled = filled===0;
  }
}

function removeImage(i){
  // 表格里引用 i 的清空，>i 的下标整体 -1
  for(let r=0;r<tRows;r++)for(let c=0;c<tCols;c++){
    if(cells[r][c]===i) cells[r][c]=null;
    else if(cells[r][c]!==null && cells[r][c]>i) cells[r][c]--;
  }
  URL.revokeObjectURL(images[i].url);
  images.splice(i,1);
  render(); if(mode==='table') renderTable();
}

/* ========= 自动网格：排序 ========= */
function setupGridDragSort(){
  let d=null;
  thumbnailsEl.querySelectorAll('.thumb').forEach(t=>{
    t.addEventListener('dragstart',()=>{ d=+t.dataset.idx; t.classList.add('dragging'); });
    t.addEventListener('dragend',()=>t.classList.remove('dragging'));
    t.addEventListener('dragover',e=>e.preventDefault());
    t.addEventListener('drop',e=>{ e.preventDefault(); const dp=+t.dataset.idx; if(d===null||d===dp)return; const[m]=images.splice(d,1); images.splice(dp,0,m); render(); });
  });
}

/* ========= 拼图排版、比例、适配与实时预览 ========= */
function getGridPlan(){
  const selected=$('gridRatio').value;
  const ratio=selected==='auto' ? 'auto' : selected==='custom'
    ? Math.max(1,Number($('gridRatioW').value)||1)/Math.max(1,Number($('gridRatioH').value)||1)
    : selected.split(':').map(Number).reduce((w,h)=>w/h);
  return CollageLayout.plan(images.length,{
    layout:$('gridLayout').value,ratio,gap:$('gap').value,longEdge:$('gridLongEdge').value,
    sizes:images.map(item=>({width:item.img.naturalWidth,height:item.img.naturalHeight}))
  });
}

function drawGrid(canvas,plan,items,fit,bg,maxEdge=Infinity){
  const scale=Math.min(1,maxEdge/Math.max(plan.width,plan.height));
  canvas.width=Math.max(1,Math.round(plan.width*scale));
  canvas.height=Math.max(1,Math.round(plan.height*scale));
  const ctx=canvas.getContext('2d');
  ctx.fillStyle=bg;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.imageSmoothingQuality='high';
  plan.cells.forEach((cell,index)=>{
    const x=Math.round(cell.x*scale),y=Math.round(cell.y*scale);
    const scaled={x,y,width:Math.round((cell.x+cell.width)*scale)-x,height:Math.round((cell.y+cell.height)*scale)-y};
    const img=items[index].img;
    const p=CollageLayout.placement(img.naturalWidth,img.naturalHeight,scaled,fit);
    ctx.save();
    ctx.beginPath(); ctx.rect(scaled.x,scaled.y,scaled.width,scaled.height); ctx.clip();
    ctx.drawImage(img,p.sx,p.sy,p.sw,p.sh,p.dx,p.dy,p.dw,p.dh);
    ctx.restore();
  });
}

function scheduleGridPreview(){
  clearTimeout(gridPreviewTimer);
  gridPreviewTimer=setTimeout(()=>{
    if(mode!=='grid') return;
    const cv=$('previewCanvas');
    if(images.length<MIN_IMAGES){ cv.style.display='none'; $('emptyHint').style.display='grid'; return; }
    try{
      const plan=getGridPlan();
      drawGrid(cv,plan,images,$('gridFit').value,$('bgColor').value,1280);
      cv.dataset.outputWidth=plan.width; cv.dataset.outputHeight=plan.height;
      cv.style.display='block'; $('emptyHint').style.display='none';
    }catch(error){ alert('预览失败：'+error.message); }
  },100);
}

function updateGridSettings(){
  $('gridCustomRatio').hidden=$('gridRatio').value!=='custom';
  const notes={cover:'图片等比铺满格子，会裁切边缘，不会拉伸变形。',contain:'保留整张图片，不裁切；比例不同的图片可能出现留边。',stretch:'图片铺满格子且不裁切，但比例不同时会拉伸变形。'};
  $('gridFitHint').textContent=notes[$('gridFit').value]+' 拖动缩略图可调整顺序；主图布局使用第一张图片。';
  render();
}
['gridLayout','gridRatio','gridFit','gridLongEdge','gridRatioW','gridRatioH','gap','bgColor','format','quality'].forEach(id=>{
  $(id).addEventListener('input',updateGridSettings);
});

function generate(){
  if(images.length<MIN_IMAGES||gridExportBusy) return;
  const revision=gridRevision,items=images.slice(),plan=getGridPlan();
  const fit=$('gridFit').value,bg=$('bgColor').value,format=$('format').value,quality=parseInt($('quality').value)||95;
  const btn=$('generateBtn');
  gridExportBusy=true; btn.disabled=true; btn.textContent='生成中...'; $('downloadBtn').disabled=true; lastBlob=null;
  const finish=()=>{ gridExportBusy=false; btn.disabled=images.length<MIN_IMAGES; btn.textContent='生成拼图'; };
  setTimeout(()=>{ try{
    const output=document.createElement('canvas');
    drawGrid(output,plan,items,fit,bg);
    btn.textContent='编码中...';
    exportUnder50(output,format,quality,res=>{
      finish();
      // Changes made while encoding invalidate the old export, not the new preview.
      if(revision!==gridRevision||mode!=='grid') return;
      if(!res){ alert('生成失败：画布超出编码能力。'); return; }
      lastBlob=res; $('downloadBtn').disabled=false;
      statusEl.innerHTML=statusEl.innerHTML.replace(/\s·\s输出.*$/,'')+` · 输出 ${res.w}×${res.h} · ${(res.blob.size/1048576).toFixed(2)} MB${res.note?' · '+res.note:''}`;
    });
  }catch(err){ finish(); alert('生成失败：'+(err.message||err)); } },50);
}

/* ========= 限制大小导出（默认 50MB，可传入更小目标）========= */
function exportUnder50(srcCanvas,preferFormat,jpgQuality,cb,targetBytes){
  const limit = targetBytes || MAX_EXPORT_BYTES;
  const w0=srcCanvas.width,h0=srcCanvas.height;
  srcCanvas.toBlob(blob=>{
    if(!blob){ cb(null); return; }
    if(blob.size<=limit){ cb({blob,format:preferFormat,w:w0,h:h0}); return; }
    tryJpgLadder(srcCanvas,w0,h0,cb,limit);
  },preferFormat,Math.max(1,Math.min(100,jpgQuality))/100);
}
function tryJpgLadder(src,w0,h0,cb,limit){
  limit = limit || MAX_EXPORT_BYTES;
  const mb = (limit/1048576).toFixed(limit%1048576?1:0);
  const Q=[0.92,0.85,0.75,0.65,0.55,0.45,0.35]; let i=0;
  const step=()=>{ if(i>=Q.length){ scaleDownLadder(src,w0,h0,cb,limit); return; } const q=Q[i++];
    src.toBlob(b=>{ if(b&&b.size<=limit) cb({blob:b,format:'image/jpeg',w:w0,h:h0,note:`已转JPG·质量${Math.round(q*100)}保≤${mb}MB`}); else step(); },'image/jpeg',q); };
  step();
}
function scaleDownLadder(src,w0,h0,cb,limit){
  limit = limit || MAX_EXPORT_BYTES;
  const mb = (limit/1048576).toFixed(limit%1048576?1:0);
  const S=[0.9,0.8,0.7,0.6,0.5,0.4,0.3,0.2,0.15,0.1]; let i=0; const tmp=document.createElement('canvas');
  const step=()=>{ if(i>=S.length){ cb(null); return; } const s=S[i++];
    tmp.width=Math.round(w0*s); tmp.height=Math.round(h0*s); const ctx=tmp.getContext('2d'); ctx.imageSmoothingQuality='high'; ctx.drawImage(src,0,0,tmp.width,tmp.height);
    tmp.toBlob(b=>{ if(b&&b.size<=limit) cb({blob:b,format:'image/jpeg',w:tmp.width,h:tmp.height,note:`已缩至${Math.round(s*100)}%+JPG保≤${mb}MB`}); else step(); },'image/jpeg',0.8); };
  step();
}
function downloadBlob(res,prefix){
  if(!res||!res.blob){ alert('当前没有可下载的图。'); return; }
  const ext=res.format==='image/jpeg'?'jpg':'png';
  const url=URL.createObjectURL(res.blob); const a=document.createElement('a');
  a.href=url; a.download=`${prefix}_${Date.now()}.${ext}`; document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

$('generateBtn').addEventListener('click',generate);
$('downloadBtn').addEventListener('click',()=>downloadBlob(lastBlob,`多宫格拼图_${images.length}张`));
$('clearBtn').addEventListener('click',()=>{ if(images.length&&!confirm('确定清空所有图片？'))return; imageUploadRevision++; images.forEach(it=>URL.revokeObjectURL(it.url)); images=[]; initCells(); lastBlob=null; $('previewCanvas').style.display='none'; $('emptyHint').style.display='grid'; render(); renderTable(); });

/* ========= 网格表格画布 ========= */
/* ========= 网格表格画布 ========= */
const tableStage = $('tableStage');
let pendingCell = null;          // 点 + 时记录目标格 {r,c}
let selecting = false;           // 自选导出框选中
const cellFileInput = $('cellFileInput');
const CELL_DISPLAY_MAX = 200;    // 每格显示上限(px)，仅影响预览，不影响导出

// —— 导出用：原始像素 列宽/行高 ——
function computeColW(){
  const w=[]; for(let c=0;c<tCols;c++){ let m=0; for(let r=0;r<tRows;r++){ const i=cells[r][c]; if(i!==null) m=Math.max(m,images[i].img.naturalWidth);} w[c]=m||CELL_DISPLAY_MAX; } return w;
}
function computeRowH(){
  const h=[]; for(let r=0;r<tRows;r++){ let m=0; for(let c=0;c<tCols;c++){ const i=cells[r][c]; if(i!==null) m=Math.max(m,images[i].img.naturalHeight);} h[r]=m||CELL_DISPLAY_MAX; } return h;
}
// —— 显示用：每格按 200px 上限保比例缩放后的尺寸 ——
// 每张图先算出"贴合 200×200 后"的显示宽高，列显示宽=该列最大显示宽，行显示高=该行最大显示高
function dispImgSize(idx){
  const im=images[idx].img;
  const r=Math.min(CELL_DISPLAY_MAX/im.naturalWidth, CELL_DISPLAY_MAX/im.naturalHeight, 1);
  return { w: im.naturalWidth*r, h: im.naturalHeight*r };
}
function computeDispColW(){
  const w=[]; for(let c=0;c<tCols;c++){ let m=0; for(let r=0;r<tRows;r++){ const i=cells[r][c]; if(i!==null) m=Math.max(m,dispImgSize(i).w);} w[c]=Math.max(m, 90); } return w;
}
function computeDispRowH(){
  const h=[]; for(let r=0;r<tRows;r++){ let m=0; for(let c=0;c<tCols;c++){ const i=cells[r][c]; if(i!==null) m=Math.max(m,dispImgSize(i).h);} h[r]=Math.max(m, 90); } return h;
}

/* ====== CSS Grid 渲染 + DOM 复用 + 事件委托（高性能） ====== */
let tableEl=null;          // grid 容器
let cellEls=[];            // cellEls[r][c] = td 元素，复用
let edgeColEl=null, edgeRowEl=null;

function ensureTable(){
  if(tableEl) return;
  tableEl=document.createElement('div'); tableEl.className='gridflex';
  tableStage.insertBefore(tableEl,$('autoBox'));
  bindTableDelegation(tableEl);
}

// 只在行列结构变化时重建格子骨架；尺寸/内容变化只改 style/src（不重建）
function renderTable(){
  ensureTable();
  let dColW=computeDispColW(), dRowH=computeDispRowH();
  const SP=10;
  const totalW=dColW.reduce((a,b)=>a+b,0)+SP*(tCols+1)+44;
  const wrapW=$('tableWrap').clientWidth-36;
  let fit=1; if(totalW>0&&wrapW>0) fit=wrapW/totalW;
  fit=Math.max(0.2,Math.min(fit,4));
  dColW=dColW.map(w=>w*fit); dRowH=dRowH.map(h=>h*fit);
  tableStage.dataset.fit=fit;

  // grid 模板
  tableEl.style.gridTemplateColumns = dColW.map(w=>w+'px').join(' ') + ' 40px';
  tableEl.style.gridTemplateRows = dRowH.map(h=>h+'px').join(' ') + ' 40px';

  // 结构变化检测：行列数或单元格总数不符 → 重建骨架
  const needRebuild = cellEls.length!==tRows || (cellEls[0]&&cellEls[0].length!==tCols) || !edgeColEl;
  if(needRebuild) buildSkeleton();

  // 更新每格内容（复用 DOM）
  for(let r=0;r<tRows;r++)for(let c=0;c<tCols;c++) updateCell(r,c);
  updateAutoBox();
}

function buildSkeleton(){
  tableEl.innerHTML=''; cellEls=[];
  for(let r=0;r<tRows;r++){
    cellEls.push([]);
    for(let c=0;c<tCols;c++){
      const td=document.createElement('div'); td.className='gcell';
      td.dataset.r=r; td.dataset.c=c;
      td.style.gridRow=(r+1); td.style.gridColumn=(c+1);
      tableEl.appendChild(td); cellEls[r].push(td);
    }
  }
  // 右侧加列条（跨所有行）
  edgeColEl=document.createElement('div'); edgeColEl.className='gedge';
  edgeColEl.style.gridColumn=(tCols+1); edgeColEl.style.gridRow='1 / '+(tRows+1);
  edgeColEl.dataset.act='addcol'; edgeColEl.innerHTML='<div class="cell-inner">＋</div>';
  tableEl.appendChild(edgeColEl);
  // 底部加行条（跨所有列+角）
  edgeRowEl=document.createElement('div'); edgeRowEl.className='gedge';
  edgeRowEl.style.gridRow=(tRows+1); edgeRowEl.style.gridColumn='1 / '+(tCols+2);
  edgeRowEl.dataset.act='addrow'; edgeRowEl.innerHTML='<div class="cell-inner">＋</div>';
  tableEl.appendChild(edgeRowEl);
}

// 更新单格：只在内容真的变化时改 DOM
function updateCell(r,c){
  const td=cellEls[r][c]; if(!td) return;
  const idx=cells[r][c];
  const cur=td.dataset.idx===undefined?'∅':td.dataset.idx;
  const next=idx===null?'∅':String(idx);
  if(cur===next && td._built) return; // 无变化，跳过
  td.dataset.idx = idx===null?'':idx;
  td._built=true;
  if(idx===null){
    td.className='gcell cell-empty';
    td.draggable=false;
    td.innerHTML='<div class="cell-inner"><div class="add-btn">+</div></div>';
  } else {
    td.className='gcell cell-filled';
    td.draggable=true;
    td.innerHTML=`<div class="cell-inner" style="background:${$('tableBgColor').value}"><img class="cell-img" src="${thumbOf(idx)}"></div><div class="cell-del">×</div>`;
  }
}

// 事件委托：整张表只绑一次
function bindTableDelegation(root){
  root.addEventListener('click',e=>{
    const edge=e.target.closest('.gedge');
    if(edge){ if(edge.dataset.act==='addcol'){ tCols++; cells.forEach(row=>row.push(null)); renderTable(); render(); } else { tRows++; cells.push(new Array(tCols).fill(null)); renderTable(); render(); } return; }
    const td=e.target.closest('.gcell'); if(!td) return;
    const r=+td.dataset.r,c=+td.dataset.c;
    if(e.target.closest('.cell-del')){ cells[r][c]=null; updateCell(r,c); updateAutoBox(); render(); return; }
    if(e.target.closest('.add-btn')){ pendingCell={r,c}; cellFileInput.click(); return; }
  });
  // 拖拽：dragstart/dragover/drop/dragend 全委托
  root.addEventListener('dragstart',e=>{
    const td=e.target.closest('.gcell.cell-filled'); if(!td) return;
    const r=+td.dataset.r,c=+td.dataset.c;
    e.dataTransfer.setData('text/fromCell',r+','+c); e.dataTransfer.effectAllowed='move';
    const blank=document.createElement('canvas'); blank.width=blank.height=1; e.dataTransfer.setDragImage(blank,0,0);
    dragGhostImg.src=thumbOf(cells[r][c]); dragGhost.style.display='block';
  });
  root.addEventListener('drag',e=>{ if(e.clientX||e.clientY){ dragGhost.style.left=(e.clientX+14)+'px'; dragGhost.style.top=(e.clientY+14)+'px'; } });
  root.addEventListener('dragend',()=>{ dragGhost.style.display='none'; dragGhostImg.src=''; document.querySelectorAll('.gcell.drop-target').forEach(x=>x.classList.remove('drop-target')); });
  root.addEventListener('dragover',e=>{ const td=e.target.closest('.gcell'); if(!td)return; e.preventDefault(); td.classList.add('drop-target'); });
  root.addEventListener('dragleave',e=>{ const td=e.target.closest('.gcell'); if(td) td.classList.remove('drop-target'); });
  root.addEventListener('drop',e=>{
    const td=e.target.closest('.gcell'); if(!td)return; e.preventDefault(); td.classList.remove('drop-target');
    const r=+td.dataset.r,c=+td.dataset.c;
    const fromThumb=e.dataTransfer.getData('text/fromThumb');
    const fromCell=e.dataTransfer.getData('text/fromCell');
    if(fromThumb!==''){ cells[r][c]=+fromThumb; updateCell(r,c); updateAutoBox(); render(); }
    else if(fromCell!==''){ const[fr,fc]=fromCell.split(',').map(Number); const t=cells[r][c]; cells[r][c]=cells[fr][fc]; cells[fr][fc]=t; updateCell(r,c); updateCell(fr,fc); updateAutoBox(); render(); }
    hideDragGhost();
  });
}

// 强制隐藏拖拽光圈（多重保险，防卡死）
function hideDragGhost(){ dragGhost.style.display='none'; dragGhostImg.src=''; document.querySelectorAll('.gcell.drop-target').forEach(x=>x.classList.remove('drop-target')); }
// 全局兜底：任何拖拽结束/放下/松手/ESC/拖出窗口，都关掉光圈
document.addEventListener('dragend',hideDragGhost,true);
document.addEventListener('drop',hideDragGhost,true);
document.addEventListener('mouseup',()=>{ if(dragGhost.style.display==='block') hideDragGhost(); });
document.addEventListener('dragleave',e=>{ if(e.clientX<=0||e.clientY<=0||e.clientX>=window.innerWidth||e.clientY>=window.innerHeight) hideDragGhost(); });
window.addEventListener('blur',hideDragGhost);
document.addEventListener('keydown',e=>{ if(e.key==='Escape') hideDragGhost(); });

// + 号选图回填
cellFileInput.addEventListener('change',e=>{
  const file=e.target.files[0]; cellFileInput.value='';
  if(!file||!pendingCell) return;
  if(file.size>MAX_FILE_BYTES){ alert('图片上传失败：图片文件不能超过 50MB'); return; }
  const url=URL.createObjectURL(file); const img=new Image();
  img.onload=()=>{ images.push({img,name:file.name,url}); cells[pendingCell.r][pendingCell.c]=images.length-1; pendingCell=null; render(); renderTable(); };
  img.src=url;
});

/* 缩略图拖进格子 */
function setupThumbDragForTable(){
  if(mode!=='table') return;
  thumbnailsEl.querySelectorAll('.thumb').forEach(t=>{
    t.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/fromThumb',t.dataset.idx); });
  });
}
const dragGhost=$('dragGhost'), dragGhostImg=dragGhost.querySelector('img');

/* 行列增减：结构变化 → renderTable 内部会重建骨架 */
function rebuildAll(){ cellEls=[]; if(tableEl){tableEl.innerHTML='';} edgeColEl=null; renderTable(); render(); }
$('addRowBtn').addEventListener('click',()=>{ tRows++; cells.push(new Array(tCols).fill(null)); rebuildAll(); });
$('addColBtn').addEventListener('click',()=>{ tCols++; cells.forEach(row=>row.push(null)); rebuildAll(); });
$('delRowBtn').addEventListener('click',()=>{ if(tRows<=1)return; const last=cells[tRows-1]; if(last.some(v=>v!==null)&&!confirm('最后一行有图片，确定删除该行？'))return; tRows--; cells.pop(); rebuildAll(); });
$('delColBtn').addEventListener('click',()=>{ if(tCols<=1)return; const hasImg=cells.some(row=>row[tCols-1]!==null); if(hasImg&&!confirm('最后一列有图片，确定删除该列？'))return; tCols--; cells.forEach(row=>row.pop()); rebuildAll(); });
$('tableBgColor').addEventListener('input',()=>{ for(let r=0;r<tRows;r++)for(let c=0;c<tCols;c++){ if(cells[r][c]!==null){ const inner=cellEls[r]&&cellEls[r][c]&&cellEls[r][c].querySelector('.cell-inner'); if(inner) inner.style.background=$('tableBgColor').value; } } });
$('tableClearBtn').addEventListener('click',()=>{ if(!confirm('确定清空所有格子？（素材保留）'))return; initCells(); rebuildAll(); });
let resizeTimer=null;
window.addEventListener('resize',()=>{ if(mode!=='table')return; clearTimeout(resizeTimer); resizeTimer=setTimeout(renderTable,150); });

/* ========= 自动导出范围（绿框） ========= */
// 有图区域最小外接矩形：从第0行0列 到 (最大有图列, 最大有图行)
function getAutoBounds(){
  let maxR=-1,maxC=-1;
  for(let r=0;r<tRows;r++)for(let c=0;c<tCols;c++) if(cells[r][c]!==null){ if(r>maxR)maxR=r; if(c>maxC)maxC=c; }
  if(maxR<0) return null;
  return {r0:0,c0:0,r1:maxR,c1:maxC};
}
function updateAutoBox(){
  // 绿框已移除：自选导出改为整格吸附，不再需要范围提示框
  $('autoBox').style.display='none';
}

/* 把表格按真实像素绘制到离屏 canvas，可裁某矩形（像素坐标）*/
function renderTableToCanvas(clipPx){
  const colW=computeColW(), rowH=computeRowH();
  const colX=[0]; for(let c=0;c<tCols;c++) colX.push(colX[c]+colW[c]);
  const rowY=[0]; for(let r=0;r<tRows;r++) rowY.push(rowY[r]+rowH[r]);
  let ox=0,oy=0,W,H;
  if(clipPx){ ox=clipPx.x; oy=clipPx.y; W=clipPx.w; H=clipPx.h; }
  else { W=colX[tCols]; H=rowY[tRows]; }
  let scale=Math.min(MAX_CANVAS_SIDE/W,MAX_CANVAS_SIDE/H,Math.sqrt(MAX_CANVAS_PIXELS/(W*H)),1);
  const cw=Math.round(W*scale),ch=Math.round(H*scale);
  const cv=document.createElement('canvas'); cv.width=cw; cv.height=ch;
  const ctx=cv.getContext('2d'); ctx.fillStyle=$('tableBgColor').value; ctx.fillRect(0,0,cw,ch);
  for(let r=0;r<tRows;r++)for(let c=0;c<tCols;c++){
    const idx=cells[r][c]; if(idx===null) continue;
    const im=images[idx].img;
    const cellX=colX[c], cellY=rowY[r], cellW=colW[c], cellH=rowH[r];
    // 保比例完整显示：原图<=格则1:1，超出格则等比缩进
    let dw=im.naturalWidth, dh=im.naturalHeight;
    if(dw>cellW||dh>cellH){ const rr=Math.min(cellW/dw,cellH/dh); dw*=rr; dh*=rr; }
    const dx=cellX+(cellW-dw)/2, dy=cellY+(cellH-dh)/2;
    ctx.drawImage(im,(dx-ox)*scale,(dy-oy)*scale,dw*scale,dh*scale);
  }
  return {cv,w:cw,h:ch};
}

$('exportAutoBtn').addEventListener('click',()=>{
  const b=getAutoBounds(); if(!b){ alert('画布还没有图片'); return; }
  const target=getCompressTarget(); if(target===false) return;
  const colW=computeColW(), rowH=computeRowH();
  let x=0; for(let c=0;c<b.c0;c++) x+=colW[c];
  let y=0; for(let r=0;r<b.r0;r++) y+=rowH[r];
  let w=0; for(let c=b.c0;c<=b.c1;c++) w+=colW[c];
  let h=0; for(let r=b.r0;r<=b.r1;r++) h+=rowH[r];
  const btn=$('exportAutoBtn'); btn.disabled=true; btn.textContent='导出中...';
  const limitMB = target ? (target/1048576).toFixed(target%1048576?1:0) : '50';
  setTimeout(()=>{ try{
    const {cv}=renderTableToCanvas({x,y,w,h}); btn.textContent='编码中...';
    exportUnder50(cv,$('tableFormat').value,95,res=>{ btn.disabled=false; btn.textContent='自动导出（<50MB）';
      if(!res){ alert(`导出失败：内容过大无法压到 ${limitMB}MB。`); return; }
      downloadBlob(res,'表格自动导出');
      $('tableHint').textContent=`已导出 ${res.w}×${res.h} · ${(res.blob.size/1048576).toFixed(2)} MB${res.note?' · '+res.note:''}`;
    },target);
  }catch(err){ btn.disabled=false; btn.textContent='自动导出（<50MB）'; alert('导出失败：'+(err.message||err)); } },50);
});

/* ========= 压缩大小下拉框 ========= */
const compressSel=$('compressSize'), compressCustom=$('compressCustom');
compressSel.addEventListener('change',()=>{
  compressCustom.style.display = compressSel.value==='custom' ? 'inline-block' : 'none';
  if(compressSel.value==='custom') compressCustom.focus();
});
// 返回目标字节数（number），不压缩返回 null，输入非法返回 false（中止导出）
// silent=true 时（用于预览）不弹确认框，直接返回目标值
function getCompressTarget(silent){
  const v=compressSel.value;
  if(v==='') return null;
  let mb;
  if(v==='custom'){
    mb=parseFloat(compressCustom.value);
    if(!(mb>0)){ if(!silent){ alert('请输入有效的压缩大小（MB，大于 0）'); compressCustom.focus(); } return silent?null:false; }
    if(mb>50){ if(!silent){ alert('压缩目标不能超过 50MB'); compressCustom.focus(); } return silent?null:false; }
  } else {
    mb=parseFloat(v);
  }
  const bytes=Math.round(mb*1048576);
  if(!silent && !confirm(`将把图片压缩到 ${mb}MB 以下，是否导出？`)) return false;
  return bytes;
}

/* ========= 自选导出（鼠标框选）========= */
const selBtn=$('selectExportBtn'), selRect=$('selectRect');
let selectMode='export';   // 'export'=框选后直接下载；'preview'=框选后生成预览
function startSelecting(mode){
  selectMode=mode;
  selecting=true;
  selBtn.classList.toggle('active', mode==='export');
  $('previewExportBtn').classList.toggle('active', mode==='preview');
  selBtn.textContent = mode==='export' ? '框选中…点击取消' : '自选导出';
  $('previewExportBtn').textContent = mode==='preview' ? '框选中…点击取消' : '导出预览';
  tableStage.classList.add('stage-selecting');
}
function stopSelecting(){
  selecting=false;
  selBtn.classList.remove('active'); selBtn.textContent='自选导出';
  $('previewExportBtn').classList.remove('active'); $('previewExportBtn').textContent='导出预览';
  tableStage.classList.remove('stage-selecting');
  selRect.style.display='none';
}
selBtn.addEventListener('click',()=>{
  if(selecting){ stopSelecting(); return; }
  startSelecting('export');
});
let selStart=null;
tableStage.addEventListener('mousedown',e=>{
  if(!selecting) return;
  const rect=tableStage.getBoundingClientRect();
  selStart={x:e.clientX-rect.left,y:e.clientY-rect.top};
  selRect.style.display='block'; selRect.style.left=selStart.x+'px'; selRect.style.top=selStart.y+'px'; selRect.style.width='0px'; selRect.style.height='0px';
  e.preventDefault();
});
tableStage.addEventListener('mousemove',e=>{
  if(!selecting||!selStart) return;
  const rect=tableStage.getBoundingClientRect();
  const cx=e.clientX-rect.left, cy=e.clientY-rect.top;
  const x=Math.min(cx,selStart.x), y=Math.min(cy,selStart.y), w=Math.abs(cx-selStart.x), h=Math.abs(cy-selStart.y);
  selRect.style.left=x+'px'; selRect.style.top=y+'px'; selRect.style.width=w+'px'; selRect.style.height=h+'px';
});
window.addEventListener('mouseup',e=>{
  if(!selecting||!selStart) return;
  const rect=tableStage.getBoundingClientRect();
  const cx=e.clientX-rect.left, cy=e.clientY-rect.top;
  let x=Math.min(cx,selStart.x), y=Math.min(cy,selStart.y), w=Math.abs(cx-selStart.x), h=Math.abs(cy-selStart.y);
  selStart=null;
  if(w<8||h<8){ selRect.style.display='none'; return; }
  // 整格吸附：框到哪些格就完整导出哪些格，不切半张图
  const hit=dispRectToCellPx(x,y,w,h);
  const mode=selectMode;
  stopSelecting();
  if(!hit){ alert('框选范围内没有格子，请框住至少一个格子。'); return; }
  const px=hit.px;
  if(mode==='preview'){
    setTimeout(()=>{ try{
      const {cv}=renderTableToCanvas(px);
      exportUnder50(cv,$('tableFormat').value,95,res=>{
        if(!res){ alert('预览失败：内容过大无法压到 50MB。'); return; }
        showExportPreview(res,'表格自选导出');
      },getCompressTarget(true));
    }catch(err){ alert('预览失败：'+(err.message||err)); } },50);
    return;
  }
  setTimeout(()=>{ try{
    const {cv}=renderTableToCanvas(px);
    exportUnder50(cv,$('tableFormat').value,95,res=>{ selRect.style.display='none';
      if(!res){ alert('导出失败：内容过大无法压到 50MB。'); return; }
      downloadBlob(res,'表格自选导出');
      $('tableHint').textContent=`自选导出 ${res.w}×${res.h} · ${(res.blob.size/1048576).toFixed(2)} MB${res.note?' · '+res.note:''}`;
    });
  }catch(err){ selRect.style.display='none'; alert('导出失败：'+(err.message||err)); } },50);
});

/* ========= 导出预览（内嵌）=========
   操作和自选导出一致：点亮「导出预览」→ 在表格上框选 → 松手即在下方预览区出图（不下载）→ 满意再点「确认下载」 */
let previewRes=null, previewPrefix='表格导出', previewUrl=null;
$('previewExportBtn').addEventListener('click',()=>{
  if(selecting){ stopSelecting(); $('tableHint').textContent='已退出导出预览。'; return; }
  if(!getAutoBounds()){ alert('画布还没有图片'); return; }
  startSelecting('preview');
  $('tableHint').textContent='框选要导出的区域并松手，下方即可预览导出效果；满意后点「确认下载」。';
});
// 关闭预览区
$('previewCloseBtn').addEventListener('click',()=>{ $('previewPanel').classList.add('hidden'); });
// 确认下载：直接用预览时已生成的同一张图，所见即所得
$('previewDownloadBtn').addEventListener('click',()=>{
  if(!previewRes){ alert('当前没有可下载的预览图。'); return; }
  downloadBlob(previewRes,previewPrefix);
  $('tableHint').textContent=`已下载 ${previewRes.w}×${previewRes.h} · ${(previewRes.blob.size/1048576).toFixed(2)} MB${previewRes.note?' · '+previewRes.note:''}`;
});
// 把导出结果渲染到内嵌预览区
function showExportPreview(res,prefix){
  previewRes=res; previewPrefix=prefix||'表格导出';
  if(previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl=URL.createObjectURL(res.blob);
  const imgEl=$('exportPreviewImg');
  imgEl.src=previewUrl; imgEl.style.display='block';
  $('previewEmptyHint').style.display='none';
  const ext=res.format==='image/jpeg'?'JPG':'PNG';
  $('previewMeta').textContent=`${res.w}×${res.h} · ${(res.blob.size/1048576).toFixed(2)} MB · ${ext}${res.note?' · '+res.note:''}`;
  $('previewDownloadBtn').disabled=false;
  $('previewPanel').classList.remove('hidden');
  $('previewPanel').scrollIntoView({behavior:'smooth',block:'nearest'});
}

/* ========= 图片取色与矩形涂抹 ========= */
let paintImage = null;
let paintFileName = 'image';
let paintObjectUrl = null;
let paintTool = 'extract';
let paintColor = null;
let paintOps = [];
let paintDrag = null;

const paintUploadArea = $('paintUploadArea');
const paintFileInput = $('paintFileInput');
const paintCanvas = $('paintCanvas');
const paintCtx = paintCanvas.getContext('2d',{willReadFrequently:true});
const paintSelection = $('paintSelection');

paintUploadArea.addEventListener('click',()=>paintFileInput.click());
paintFileInput.addEventListener('change',e=>{
  const file=e.target.files&&e.target.files[0];
  if(file) loadPaintImage(file);
  paintFileInput.value='';
});
paintUploadArea.addEventListener('dragover',e=>{ e.preventDefault(); paintUploadArea.classList.add('dragover'); });
paintUploadArea.addEventListener('dragleave',()=>paintUploadArea.classList.remove('dragover'));
paintUploadArea.addEventListener('drop',e=>{
  e.preventDefault(); paintUploadArea.classList.remove('dragover');
  const file=Array.from(e.dataTransfer.files||[]).find(f=>f.type.startsWith('image/'));
  if(file) loadPaintImage(file); else alert('请拖入有效的图片文件。');
});

function loadPaintImage(file){
  if(!file.type.startsWith('image/')){ alert('请选择图片文件。'); return; }
  if(file.size>MAX_FILE_BYTES){ alert('图片上传失败：图片文件不能超过 50MB。'); return; }
  const newUrl=URL.createObjectURL(file);
  const img=new Image();
  img.onload=()=>{
    const pixels=img.naturalWidth*img.naturalHeight;
    if(img.naturalWidth>MAX_CANVAS_SIDE || img.naturalHeight>MAX_CANVAS_SIDE || pixels>MAX_CANVAS_PIXELS){
      URL.revokeObjectURL(newUrl);
      alert(`图片像素过大（${img.naturalWidth}×${img.naturalHeight}），无法安全载入涂抹画布。`);
      return;
    }
    if(paintObjectUrl) URL.revokeObjectURL(paintObjectUrl);
    paintObjectUrl=newUrl;
    paintImage=img;
    paintFileName=file.name;
    paintOps=[];
    paintColor=null;
    paintCanvas.width=img.naturalWidth;
    paintCanvas.height=img.naturalHeight;
    redrawPaintCanvas();
    $('paintWorkspace').classList.remove('hidden');
    $('paintColorChip').style.background='#ffffff';
    $('paintColorText').textContent='尚未提取颜色';
    updatePaintHistoryButtons();
    setPaintTool('extract');
    $('paintStatus').textContent=`已载入 ${file.name} · ${img.naturalWidth}×${img.naturalHeight}px，请用奶瓶点击图片取色。`;
    requestAnimationFrame(()=>$('paintStage').scrollIntoView({behavior:'smooth',block:'nearest'}));
  };
  img.onerror=()=>{ URL.revokeObjectURL(newUrl); alert('图片读取失败，请换一张图片重试。'); };
  img.src=newUrl;
}

function redrawPaintCanvas(){
  if(!paintImage) return;
  paintCtx.clearRect(0,0,paintCanvas.width,paintCanvas.height);
  paintCtx.drawImage(paintImage,0,0,paintCanvas.width,paintCanvas.height);
  paintOps.forEach(op=>{
    paintCtx.fillStyle=op.color;
    paintCtx.fillRect(op.x,op.y,op.w,op.h);
  });
}

function bottleCursor(color){
  const fill=color||'#ffffff';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><path d="M12 3h8v5l3 4v13c0 3-2 5-5 5h-4c-3 0-5-2-5-5V12l3-4z" fill="${fill}" stroke="#07111b" stroke-width="2"/><path d="M12 8h8M10 14h12" stroke="#dcecff" stroke-width="2"/><path d="M14 1h4v4h-4z" fill="#a9bacb" stroke="#07111b" stroke-width="1.5"/><circle cx="16" cy="30" r="1.5" fill="#7ff4ff"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 16 30, crosshair`;
}

function setPaintTool(tool){
  if(!paintImage) return;
  if(tool==='paint' && !paintColor){
    alert('请先点击「提取」，再用奶瓶从图片中提取一种颜色。');
    tool='extract';
  }
  paintTool=tool;
  $('extractColorBtn').classList.toggle('active',tool==='extract');
  $('paintRectBtn').classList.toggle('active',tool==='paint');
  paintCanvas.style.cursor=tool==='extract' ? bottleCursor(paintColor) : 'crosshair';
  $('paintStatus').textContent=tool==='extract'
    ? '提取模式：奶瓶尖端对准图片并点击，可连续提取新的颜色。'
    : `涂抹模式：当前颜色 ${$('paintColorText').textContent}，按住鼠标拖动框选矩形。`;
}

function pointerOnPaint(e){
  const rect=paintCanvas.getBoundingClientRect();
  const dx=Math.max(0,Math.min(rect.width,e.clientX-rect.left));
  const dy=Math.max(0,Math.min(rect.height,e.clientY-rect.top));
  return {
    x:dx*(paintCanvas.width/rect.width),
    y:dy*(paintCanvas.height/rect.height),
    dx,dy
  };
}

function colorHex(r,g,b){ return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase(); }

function samplePaintColor(point){
  const x=Math.max(0,Math.min(paintCanvas.width-1,Math.floor(point.x)));
  const y=Math.max(0,Math.min(paintCanvas.height-1,Math.floor(point.y)));
  const [r,g,b,a]=paintCtx.getImageData(x,y,1,1).data;
  const hex=colorHex(r,g,b);
  paintColor=a===255 ? hex : `rgba(${r},${g},${b},${(a/255).toFixed(3)})`;
  $('paintColorChip').style.background=paintColor;
  $('paintColorText').textContent=a===255 ? `${hex} · RGB(${r}, ${g}, ${b})` : `${hex} · RGBA(${r}, ${g}, ${b}, ${a})`;
  paintCanvas.style.cursor=bottleCursor(paintColor);
  $('paintStatus').textContent=`已提取坐标 (${x}, ${y}) 的颜色 ${hex}；可继续点击换色，或点击「涂抹」。`;
}

function showPaintSelection(a,b){
  paintSelection.style.display='block';
  paintSelection.style.left=Math.min(a.dx,b.dx)+'px';
  paintSelection.style.top=Math.min(a.dy,b.dy)+'px';
  paintSelection.style.width=Math.abs(b.dx-a.dx)+'px';
  paintSelection.style.height=Math.abs(b.dy-a.dy)+'px';
}

function finishPaintDrag(e){
  if(!paintDrag || (e.pointerId!==undefined && e.pointerId!==paintDrag.pointerId)) return;
  const end=pointerOnPaint(e);
  const start=paintDrag.start;
  const x=Math.max(0,Math.floor(Math.min(start.x,end.x)));
  const y=Math.max(0,Math.floor(Math.min(start.y,end.y)));
  const x2=Math.min(paintCanvas.width,Math.ceil(Math.max(start.x,end.x)));
  const y2=Math.min(paintCanvas.height,Math.ceil(Math.max(start.y,end.y)));
  const w=Math.max(1,x2-x);
  const h=Math.max(1,y2-y);
  paintOps.push({x,y,w,h,color:paintColor});
  paintCtx.fillStyle=paintColor;
  paintCtx.fillRect(x,y,w,h);
  paintDrag=null;
  paintSelection.style.display='none';
  updatePaintHistoryButtons();
  $('paintStatus').textContent=`已涂抹矩形：(${x}, ${y}) · ${w}×${h}px；可继续框选。`;
}

paintCanvas.addEventListener('pointerdown',e=>{
  if(!paintImage) return;
  e.preventDefault();
  const point=pointerOnPaint(e);
  if(paintTool==='extract'){
    samplePaintColor(point);
    return;
  }
  if(!paintColor) return;
  paintDrag={pointerId:e.pointerId,start:point};
  paintCanvas.setPointerCapture(e.pointerId);
  showPaintSelection(point,point);
});
paintCanvas.addEventListener('pointermove',e=>{
  if(!paintDrag || e.pointerId!==paintDrag.pointerId) return;
  showPaintSelection(paintDrag.start,pointerOnPaint(e));
});
paintCanvas.addEventListener('pointerup',finishPaintDrag);
paintCanvas.addEventListener('pointercancel',()=>{
  paintDrag=null;
  paintSelection.style.display='none';
});

function updatePaintHistoryButtons(){
  const changed=paintOps.length>0;
  $('paintUndoBtn').disabled=!changed;
  $('paintResetBtn').disabled=!changed;
  $('paintDownloadBtn').disabled=!paintImage;
}

$('extractColorBtn').addEventListener('click',()=>setPaintTool('extract'));
$('paintRectBtn').addEventListener('click',()=>setPaintTool('paint'));
$('paintUndoBtn').addEventListener('click',()=>{
  if(!paintOps.length) return;
  paintOps.pop(); redrawPaintCanvas(); updatePaintHistoryButtons();
  $('paintStatus').textContent=paintOps.length ? `已撤销，剩余 ${paintOps.length} 个涂抹矩形。` : '已撤销全部涂抹，当前为原图。';
});
$('paintResetBtn').addEventListener('click',()=>{
  if(!paintOps.length || !confirm('确定恢复原图并清除全部涂抹矩形？')) return;
  paintOps=[]; redrawPaintCanvas(); updatePaintHistoryButtons();
  $('paintStatus').textContent='已恢复原图，提取的颜色仍然保留。';
});
$('paintDownloadBtn').addEventListener('click',()=>{
  if(!paintImage) return;
  const btn=$('paintDownloadBtn'); btn.disabled=true; btn.textContent='正在生成…';
  paintCanvas.toBlob(blob=>{
    btn.disabled=false; btn.textContent='下载涂抹图';
    if(!blob){ alert('图片导出失败。'); return; }
    downloadBlob({blob,format:'image/png',w:paintCanvas.width,h:paintCanvas.height},`涂抹_${stripExt(paintFileName)}`);
    $('paintStatus').textContent=`已导出 ${paintCanvas.width}×${paintCanvas.height}px PNG 图片。`;
  },'image/png');
});
$('paintClearBtn').addEventListener('click',()=>{
  if(!paintImage) return;
  if(paintOps.length && !confirm('确定移除当前图片？尚未下载的涂抹内容会丢失。')) return;
  if(paintObjectUrl) URL.revokeObjectURL(paintObjectUrl);
  paintObjectUrl=null; paintImage=null; paintFileName='image'; paintOps=[]; paintColor=null; paintDrag=null;
  paintCanvas.width=0; paintCanvas.height=0;
  paintSelection.style.display='none';
  $('paintWorkspace').classList.add('hidden');
  $('paintColorChip').style.background='#ffffff';
  $('paintColorText').textContent='尚未提取颜色';
  updatePaintHistoryButtons();
});

/* ========= 图片检测 ========= */
let inspectItems = []; // {file,img,url,thumbUrl,checked,issues}
const inspectUploadArea = $('inspectUploadArea');
const inspectFileInput = $('inspectFileInput');
const inspectBody = $('inspectTableBody');

inspectUploadArea.addEventListener('click',()=>inspectFileInput.click());
inspectFileInput.addEventListener('change',e=>{ handleInspectFiles(e.target.files); inspectFileInput.value=''; });
inspectUploadArea.addEventListener('dragover',e=>{ e.preventDefault(); inspectUploadArea.classList.add('dragover'); });
inspectUploadArea.addEventListener('dragleave',()=>inspectUploadArea.classList.remove('dragover'));
inspectUploadArea.addEventListener('drop',e=>{ e.preventDefault(); inspectUploadArea.classList.remove('dragover'); handleInspectFiles(e.dataTransfer.files); });

function handleInspectFiles(files){
  const arr = Array.from(files).filter(f=>f.type.startsWith('image/'));
  if(!arr.length){ alert('请选择图片文件。'); return; }
  $('inspectStatus').textContent = `正在读取 ${arr.length} 张图片...`;
  arr.forEach(file=>{
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = ()=>{
      inspectItems.push({
        file,
        img,
        url,
        thumbUrl:makeThumb(img),
        checked:false,
        issues:[]
      });
      renderInspectTable();
    };
    img.onerror = ()=>{
      URL.revokeObjectURL(url);
      $('inspectStatus').textContent = `读取失败：${file.name}`;
    };
    img.src = url;
  });
}

function runInspect(){
  inspectItems.forEach(item=>{
    item.issues = getInspectIssues(item);
    item.checked = true;
  });
  renderInspectTable();
}

function getInspectIssues(item){
  const issues = [];
  const sizeMode = $('sizeRuleMode').value;
  const sizeValue = parseFloat($('sizeRuleValue').value);
  const sizeUnit = $('sizeRuleUnit').value;
  if(sizeMode && sizeValue > 0){
    const limit = sizeValue * (sizeUnit==='KB' ? 1024 : 1048576);
    if(sizeMode==='max' && item.file.size > limit) issues.push(`文件超过 ${sizeValue}${sizeUnit}`);
    if(sizeMode==='min' && item.file.size < limit) issues.push(`文件低于 ${sizeValue}${sizeUnit}`);
  }
  const pixelMode = $('pixelRuleMode').value;
  const targetW = parseInt($('pixelRuleW').value)||0;
  const targetH = parseInt($('pixelRuleH').value)||0;
  const w = item.img.naturalWidth, h = item.img.naturalHeight;
  if(pixelMode && targetW > 0 && targetH > 0){
    if(pixelMode==='range' && (w<targetW || h<targetW || w>targetH || h>targetH)) issues.push(`像素不在 ${targetW}-${targetH} 范围`);
    if(pixelMode==='exact' && (w!==targetW || h!==targetH)) issues.push(`像素不是 ${targetW}×${targetH}`);
    if(pixelMode==='max' && (w>targetW || h>targetH)) issues.push(`像素超过 ${targetW}×${targetH}`);
    if(pixelMode==='min' && (w<targetW || h<targetH)) issues.push(`像素低于 ${targetW}×${targetH}`);
  }
  return issues;
}

function renderInspectTable(){
  const total = inspectItems.length;
  const flagged = inspectItems.filter(x=>x.checked && x.issues.length).length;
  $('inspectTotal').textContent = total;
  $('inspectFlagged').textContent = flagged;
  $('inspectMaxSize').textContent = total ? formatBytes(Math.max(...inspectItems.map(x=>x.file.size))) : '-';
  $('inspectMaxPixels').textContent = total ? maxPixelText() : '-';
  $('inspectStatus').textContent = total
    ? `已载入 ${total} 张图片${inspectItems.some(x=>x.checked) ? `，标记 ${flagged} 张` : '，点击「开始检测」应用当前规则'}`
    : '尚未上传检测图片';
  if(!total){
    inspectBody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#718399;padding:34px;">上传图片后点击「开始检测」</td></tr>';
    return;
  }
  inspectBody.innerHTML = inspectItems.map((item,idx)=>inspectRowHtml(item,idx)).join('');
  inspectBody.querySelectorAll('[data-act]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const idx = +btn.dataset.idx;
      const act = btn.dataset.act;
      if(act==='compress') compressInspectItem(idx);
      if(act==='resize') resizeInspectItem(idx);
      if(act==='remove') removeInspectItem(idx);
    });
  });
}

function inspectRowHtml(item,idx){
  const w = item.img.naturalWidth, h = item.img.naturalHeight;
  const ratio = formatRatio(w,h);
  const format = imageFormatLabel(item.file);
  const hasIssue = item.checked && item.issues.length>0;
  const state = !item.checked
    ? '<span class="pill wait">待检测</span>'
    : hasIssue
      ? `<span class="pill bad">${item.issues.join('；')}</span>`
      : '<span class="pill good">符合规则</span>';
  return `<tr class="${hasIssue?'inspect-row-bad':(item.checked?'inspect-row-good':'')}">
    <td><img class="inspect-preview" src="${item.thumbUrl||item.url}" alt=""></td>
    <td class="file-cell"><strong title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</strong><span>${escapeHtml(item.file.type||'未知 MIME')}</span></td>
    <td>${format}</td>
    <td>${formatBytes(item.file.size)}</td>
    <td>${w}×${h}<br><span style="color:#8498ae;">${(w*h/1000000).toFixed(2)} MP</span></td>
    <td>${ratio}</td>
    <td>${state}</td>
    <td><div class="mini-actions">
      <button class="secondary" data-act="compress" data-idx="${idx}">压缩</button>
      <button class="secondary" data-act="resize" data-idx="${idx}">改像素</button>
      <button class="danger" data-act="remove" data-idx="${idx}">移除</button>
    </div></td>
  </tr>`;
}

function removeInspectItem(idx){
  const item = inspectItems[idx];
  if(item) URL.revokeObjectURL(item.url);
  inspectItems.splice(idx,1);
  renderInspectTable();
}

function clearInspectItems(){
  if(inspectItems.length && !confirm('确定清空检测列表？')) return;
  inspectItems.forEach(item=>URL.revokeObjectURL(item.url));
  inspectItems = [];
  renderInspectTable();
}

function getFlaggedInspectItems(){
  const flagged = inspectItems.map((item,idx)=>({item,idx})).filter(x=>x.item.checked && x.item.issues.length);
  if(flagged.length) return flagged;
  alert('没有标记项。请先点击「开始检测」，或调整规则后重新检测。');
  return [];
}

function getTargetBytesFromInspect(){
  const mb = parseFloat($('processTargetMB').value);
  if(!(mb>0)){ alert('请输入有效的压缩目标 MB。'); $('processTargetMB').focus(); return false; }
  return Math.round(mb*1048576);
}

function getResizeSettings(){
  const w = parseInt($('processWidth').value)||0;
  const h = parseInt($('processHeight').value)||0;
  if(w<1 || h<1){ alert('请输入有效的目标宽高。'); return null; }
  return {w,h,mode:$('resizeMode').value};
}

function imageToCanvas(img){
  const cv = document.createElement('canvas');
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img,0,0,cv.width,cv.height);
  return cv;
}

function resizeImageToCanvas(img,w,h,resizeMode){
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0,0,w,h);
  const sw = img.naturalWidth, sh = img.naturalHeight;
  if(resizeMode==='stretch'){
    ctx.drawImage(img,0,0,w,h);
  } else {
    const scale = resizeMode==='cover' ? Math.max(w/sw,h/sh) : Math.min(w/sw,h/sh);
    const dw = sw*scale, dh = sh*scale;
    ctx.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);
  }
  return cv;
}

function compressInspectItem(idx){
  const item = inspectItems[idx];
  if(!item) return;
  const target = getTargetBytesFromInspect();
  if(target===false) return;
  $('inspectStatus').textContent = `正在压缩：${item.file.name}`;
  const cv = imageToCanvas(item.img);
  exportUnder50(cv,'image/jpeg',92,res=>{
    if(!res){ alert('压缩失败：无法达到目标大小。'); $('inspectStatus').textContent='压缩失败'; return; }
    downloadBlob(res,`压缩_${stripExt(item.file.name)}`);
    $('inspectStatus').textContent = `已压缩 ${item.file.name} → ${(res.blob.size/1048576).toFixed(2)} MB`;
  },target);
}

function resizeInspectItem(idx){
  const item = inspectItems[idx];
  if(!item) return;
  const setting = getResizeSettings();
  if(!setting) return;
  $('inspectStatus').textContent = `正在修改尺寸：${item.file.name}`;
  const cv = resizeImageToCanvas(item.img,setting.w,setting.h,setting.mode);
  cv.toBlob(blob=>{
    if(!blob){ alert('改尺寸失败：浏览器无法编码该图片。'); return; }
    downloadBlob({blob,format:'image/jpeg',w:setting.w,h:setting.h},`改尺寸_${stripExt(item.file.name)}`);
    $('inspectStatus').textContent = `已导出 ${item.file.name} → ${setting.w}×${setting.h}`;
  },'image/jpeg',0.92);
}

async function batchProcess(list,worker,doneText){
  if(!list.length) return;
  if(list.length>1 && !confirm(`将连续下载 ${list.length} 个文件，是否继续？`)) return;
  for(const entry of list){
    await new Promise(resolve=>worker(entry.idx,resolve));
    await sleep(180);
  }
  $('inspectStatus').textContent = doneText;
}

function batchCompressFlagged(){
  const list = getFlaggedInspectItems();
  const target = getTargetBytesFromInspect();
  if(!list.length || target===false) return;
  batchProcess(list,(idx,resolve)=>{
    const item = inspectItems[idx];
    if(!item){ resolve(); return; }
    $('inspectStatus').textContent = `批量压缩中：${item.file.name}`;
    const cv = imageToCanvas(item.img);
    exportUnder50(cv,'image/jpeg',92,res=>{
      if(res) downloadBlob(res,`压缩_${stripExt(item.file.name)}`);
      resolve();
    },target);
  },`批量压缩完成：${list.length} 张`);
}

function batchResize(list,label){
  const setting = getResizeSettings();
  if(!setting || !list.length) return;
  batchProcess(list,(idx,resolve)=>{
    const item = inspectItems[idx];
    if(!item){ resolve(); return; }
    $('inspectStatus').textContent = `${label}：${item.file.name}`;
    const cv = resizeImageToCanvas(item.img,setting.w,setting.h,setting.mode);
    cv.toBlob(blob=>{
      if(blob) downloadBlob({blob,format:'image/jpeg',w:setting.w,h:setting.h},`改尺寸_${stripExt(item.file.name)}`);
      resolve();
    },'image/jpeg',0.92);
  },`${label}完成：${list.length} 张`);
}

function imageFormatLabel(file){
  const mime = file.type || '';
  if(mime.includes('/')) return mime.split('/')[1].toUpperCase();
  const ext = (file.name.split('.').pop()||'').toUpperCase();
  return ext || '未知';
}

function formatBytes(bytes){
  if(bytes>=1048576) return `${(bytes/1048576).toFixed(2)} MB`;
  if(bytes>=1024) return `${(bytes/1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatRatio(w,h){
  const g = gcd(w,h);
  return `${Math.round(w/g)}:${Math.round(h/g)}`;
}

function gcd(a,b){ while(b){ const t=b; b=a%b; a=t; } return a||1; }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function stripExt(name){ return name.replace(/\.[^.]+$/,'') || 'image'; }
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g,ch=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
}
function maxPixelText(){
  let best = inspectItems[0];
  inspectItems.forEach(item=>{ if(item.img.naturalWidth*item.img.naturalHeight > best.img.naturalWidth*best.img.naturalHeight) best=item; });
  return `${best.img.naturalWidth}×${best.img.naturalHeight}`;
}

$('runInspectBtn').addEventListener('click',runInspect);
$('inspectClearBtn').addEventListener('click',clearInspectItems);
$('batchCompressFlaggedBtn').addEventListener('click',batchCompressFlagged);
$('batchResizeFlaggedBtn').addEventListener('click',()=>batchResize(getFlaggedInspectItems(),'批量改尺寸标记项'));
$('batchResizeAllBtn').addEventListener('click',()=>{
  if(!inspectItems.length){ alert('请先上传检测图片。'); return; }
  batchResize(inspectItems.map((item,idx)=>({item,idx})),'批量改尺寸全部');
});
$('changePixelsBtn').addEventListener('click',()=>{
  if(!inspectItems.length){ alert('请先上传需要更改像素的图片。'); return; }
  if(inspectItems.length===1){ resizeInspectItem(0); return; }
  batchResize(inspectItems.map((item,idx)=>({item,idx})),'更改图片像素');
});
['sizeRuleMode','sizeRuleValue','sizeRuleUnit','pixelRuleMode','pixelRuleW','pixelRuleH'].forEach(id=>{
  $(id).addEventListener('change',()=>{ if(inspectItems.some(x=>x.checked)) runInspect(); });
  $(id).addEventListener('input',()=>{ if(inspectItems.some(x=>x.checked)) runInspect(); });
});

// 显示矩形 → 原始像素矩形（分段线性映射）
// 关键：显示坐标带 grid gap（SP），导出像素坐标不带 gap。
// 累加显示边界时必须把 gap 算进去，否则越往右/下偏差越大，框选会切错位。
function dispRectToPx(dx,dy,dw,dh){
  const fit=parseFloat(tableStage.dataset.fit)||1;
  const SP=10*fit;  // 显示态的 grid gap（与 renderTable 的 SP=10 对应，乘 fit 缩放）
  const dColW=computeDispColW().map(w=>w*fit), dRowH=computeDispRowH().map(h=>h*fit);
  const pColW=computeColW(), pRowH=computeRowH();
  // 显示边界：每列之间含一个 gap；导出像素边界：无 gap
  const dColX=[0]; for(let c=0;c<tCols;c++) dColX.push(dColX[c]+dColW[c]+(c<tCols-1?SP:0));
  const pColX=[0]; for(let c=0;c<tCols;c++) pColX.push(pColX[c]+pColW[c]);
  const dRowY=[0]; for(let r=0;r<tRows;r++) dRowY.push(dRowY[r]+dRowH[r]+(r<tRows-1?SP:0));
  const pRowY=[0]; for(let r=0;r<tRows;r++) pRowY.push(pRowY[r]+pRowH[r]);
  // 段内归一化：落在 gap 区间的点截到 [0,1]，避免把间隙映射成像素
  const mapX=d=>{ d=Math.max(0,Math.min(d,dColX[tCols])); for(let c=0;c<tCols;c++){ if(d<=dColX[c+1]||c===tCols-1){ const f=dColW[c]?Math.max(0,Math.min(1,(d-dColX[c])/dColW[c])):0; return pColX[c]+f*pColW[c]; } } return pColX[tCols]; };
  const mapY=d=>{ d=Math.max(0,Math.min(d,dRowY[tRows])); for(let r=0;r<tRows;r++){ if(d<=dRowY[r+1]||r===tRows-1){ const f=dRowH[r]?Math.max(0,Math.min(1,(d-dRowY[r])/dRowH[r])):0; return pRowY[r]+f*pRowH[r]; } } return pRowY[tRows]; };
  const x0=mapX(dx), y0=mapY(dy), x1=mapX(dx+dw), y1=mapY(dy+dh);
  return { x:x0, y:y0, w:Math.max(1,x1-x0), h:Math.max(1,y1-y0) };
}

/* 框选显示矩形 → 命中的整格范围（行列索引）→ 原始像素矩形。
   只要框选碰到某格（有重叠），该格整格纳入，绝不切半张图。
   返回 { px:{x,y,w,h}, rows:[r0,r1], cols:[c0,c1] } 或 null（没碰到任何格） */
function dispRectToCellPx(dx,dy,dw,dh){
  const fit=parseFloat(tableStage.dataset.fit)||1;
  const SP=10*fit;
  const dColW=computeDispColW().map(w=>w*fit), dRowH=computeDispRowH().map(h=>h*fit);
  // 每格显示区间 [start,end]（含 gap 布局）
  const dColX=[0]; for(let c=0;c<tCols;c++) dColX.push(dColX[c]+dColW[c]+(c<tCols-1?SP:0));
  const dRowY=[0]; for(let r=0;r<tRows;r++) dRowY.push(dRowY[r]+dRowH[r]+(r<tRows-1?SP:0));
  const selX0=dx, selX1=dx+dw, selY0=dy, selY1=dy+dh;
  // 命中列：框选区间与该列显示区间有重叠
  let c0=-1,c1=-1;
  for(let c=0;c<tCols;c++){ const a=dColX[c], b=dColX[c]+dColW[c]; if(selX1>a && selX0<b){ if(c0<0)c0=c; c1=c; } }
  let r0=-1,r1=-1;
  for(let r=0;r<tRows;r++){ const a=dRowY[r], b=dRowY[r]+dRowH[r]; if(selY1>a && selY0<b){ if(r0<0)r0=r; r1=r; } }
  if(c0<0||r0<0) return null;
  // 整格范围 → 原始像素矩形
  const pColW=computeColW(), pRowH=computeRowH();
  let x=0; for(let c=0;c<c0;c++) x+=pColW[c];
  let y=0; for(let r=0;r<r0;r++) y+=pRowH[r];
  let w=0; for(let c=c0;c<=c1;c++) w+=pColW[c];
  let h=0; for(let r=r0;r<=r1;r++) h+=pRowH[r];
  return { px:{x,y,w:Math.max(1,w),h:Math.max(1,h)}, rows:[r0,r1], cols:[c0,c1] };
}

/* ========= 独立人像抠图（内置轻量模型，纯本地） ========= */
const PORTRAIT_MODEL_SIZE=320;
const PORTRAIT_MAX_SIDE=10000;
const PORTRAIT_MAX_PIXELS=64000000;
let portraitFile=null;
let portraitSourceUrl=null;
let portraitResultBlob=null;
let portraitResultUrl=null;
let portraitSessionPromise=null;
let portraitRuntimePromise=null;
let portraitWasmUrl=null;
let portraitBusy=false;

const portraitUploadArea=$('portraitUploadArea');
const portraitFileInput=$('portraitFileInput');

function setPortraitStatus(message,state=''){
  const el=$('portraitStatus');
  el.textContent=message;
  el.className='portrait-status'+(state?' '+state:'');
}

function setPortraitBusy(busy){
  portraitBusy=busy;
  $('portraitProcessBtn').disabled=busy||!portraitFile;
  $('portraitResetBtn').disabled=busy;
  $('portraitRemoveBtn').disabled=busy||!portraitFile;
  portraitFileInput.disabled=busy;
  $('portraitSoftEdges').disabled=busy;
  $('portraitProgress').classList.toggle('busy',busy);
  $('portraitProcessBtn').textContent=busy?'正在本机抠图…':'开始人像抠图';
}

function clearPortraitResult(){
  if(portraitResultUrl) URL.revokeObjectURL(portraitResultUrl);
  portraitResultUrl=null;
  portraitResultBlob=null;
  $('portraitResultImg').removeAttribute('src');
  $('portraitResultImg').classList.remove('ready');
  $('portraitResultPlaceholder').style.display='block';
  $('portraitResultMeta').textContent='等待处理';
  $('portraitDownloadBtn').disabled=true;
}

function resetPortrait(openPicker=false){
  if(portraitBusy) return;
  clearPortraitResult();
  if(portraitSourceUrl) URL.revokeObjectURL(portraitSourceUrl);
  portraitSourceUrl=null;
  portraitFile=null;
  $('portraitSourceImg').removeAttribute('src');
  $('portraitSourceImg').classList.remove('ready');
  $('portraitSourcePlaceholder').style.display='block';
  $('portraitSourceMeta').textContent='尚未选择';
  $('portraitUploadTitle').textContent='选择或拖入一张人物照片';
  $('portraitProcessBtn').disabled=true;
  $('portraitRemoveBtn').disabled=true;
  setPortraitStatus('选择一张人物照片后即可开始。内置模型只在本机运行。');
  if(openPicker) portraitFileInput.click();
}

function acceptPortraitFile(file){
  if(portraitBusy||!file) return;
  if(!file.type.startsWith('image/')){
    setPortraitStatus('请选择 PNG、JPG、WEBP 或 BMP 图片。','error');
    return;
  }
  if(file.size>MAX_FILE_BYTES){
    setPortraitStatus(`图片超过 50MB：${file.name}`,'error');
    return;
  }
  clearPortraitResult();
  if(portraitSourceUrl) URL.revokeObjectURL(portraitSourceUrl);
  portraitFile=file;
  portraitSourceUrl=URL.createObjectURL(file);
  const preview=$('portraitSourceImg');
  preview.onload=()=>{
    if(preview.src!==portraitSourceUrl) return;
    $('portraitSourceMeta').textContent=`${preview.naturalWidth}×${preview.naturalHeight} · ${(file.size/1048576).toFixed(2)} MB`;
  };
  preview.onerror=()=>setPortraitStatus('图片无法读取，请换一张常见格式的图片。','error');
  preview.src=portraitSourceUrl;
  preview.classList.add('ready');
  $('portraitSourcePlaceholder').style.display='none';
  $('portraitUploadTitle').textContent=file.name;
  $('portraitProcessBtn').disabled=false;
  $('portraitRemoveBtn').disabled=false;
  setPortraitStatus(`已选择 ${file.name}。点击“开始人像抠图”，模型会自动运行。`);
}

function base64ToBytes(base64){
  const binary=atob(base64);
  const bytes=new Uint8Array(binary.length);
  const chunk=32768;
  for(let start=0;start<binary.length;start+=chunk){
    const end=Math.min(start+chunk,binary.length);
    for(let i=start;i<end;i++) bytes[i]=binary.charCodeAt(i);
  }
  return bytes;
}

function loadPortraitScript(src){
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[data-portrait-src="${src}"]`);
    if(existing){
      if(existing.dataset.loaded==='true') resolve();
      else{
        existing.addEventListener('load',resolve,{once:true});
        existing.addEventListener('error',()=>reject(new Error(`无法加载 ${src}`)),{once:true});
      }
      return;
    }
    const script=document.createElement('script');
    script.src=src;
    script.async=false;
    script.dataset.portraitSrc=src;
    script.addEventListener('load',()=>{ script.dataset.loaded='true'; resolve(); },{once:true});
    script.addEventListener('error',()=>{ script.remove(); reject(new Error(`无法加载 ${src}`)); },{once:true});
    document.head.appendChild(script);
  });
}

function ensurePortraitRuntime(){
  if(window.ort&&window.__PORTRAIT_ORT_WASM_BASE64&&window.__PORTRAIT_MODEL_BASE64) return Promise.resolve();
  if(portraitRuntimePromise) return portraitRuntimePromise;
  setPortraitStatus('正在准备本地抠图模型，首次使用需要稍等…');
  portraitRuntimePromise=loadPortraitScript('assets/portrait/ort.min.js')
    .then(()=>loadPortraitScript('assets/portrait/ort-wasm-data.js'))
    .then(()=>loadPortraitScript('assets/portrait/portrait-model-data.js'))
    .catch(error=>{
      portraitRuntimePromise=null;
      throw error;
    });
  return portraitRuntimePromise;
}

async function getPortraitSession(){
  if(portraitSessionPromise) return portraitSessionPromise;
  portraitSessionPromise=(async()=>{
    await ensurePortraitRuntime();
    if(!window.ort) throw new Error('内置推理程序未加载，请确认 assets/portrait 文件夹完整。');
    if(!window.__PORTRAIT_ORT_WASM_BASE64||!window.__PORTRAIT_MODEL_BASE64){
      throw new Error('内置轻量模型资源不完整，请重新完整解压工具文件夹。');
    }
    setPortraitStatus('正在加载内置轻量模型，首次需要稍等…');
    const wasmBytes=base64ToBytes(window.__PORTRAIT_ORT_WASM_BASE64);
    portraitWasmUrl=URL.createObjectURL(new Blob([wasmBytes],{type:'application/wasm'}));
    ort.env.wasm.numThreads=1;
    ort.env.wasm.simd=true;
    ort.env.wasm.proxy=false;
    ort.env.wasm.initTimeout=120000;
    ort.env.wasm.wasmPaths={'ort-wasm-simd.wasm':portraitWasmUrl};
    const modelBytes=base64ToBytes(window.__PORTRAIT_MODEL_BASE64);
    const session=await ort.InferenceSession.create(modelBytes,{
      executionProviders:['wasm'],
      executionMode:'sequential',
      graphOptimizationLevel:'all'
    });
    window.__PORTRAIT_ORT_WASM_BASE64=null;
    window.__PORTRAIT_MODEL_BASE64=null;
    return session;
  })().catch(error=>{
    portraitSessionPromise=null;
    if(portraitWasmUrl){ URL.revokeObjectURL(portraitWasmUrl); portraitWasmUrl=null; }
    throw error;
  });
  return portraitSessionPromise;
}

async function decodePortraitImage(file){
  if('createImageBitmap' in window) return createImageBitmap(file);
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();
    img.src=url;
    await img.decode();
    return img;
  }finally{
    URL.revokeObjectURL(url);
  }
}

function portraitCanvasBlob(canvas){
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('无法生成透明 PNG。')),'image/png'));
}

function describePortraitError(error){
  const message=String(error?.message||error||'未知错误');
  if(/memory|alloc|Aborted|out of bounds/i.test(message)) return '浏览器可用内存不足。请关闭其他大型网页，或改用尺寸较小的照片后重试。';
  if(/model|protobuf|resource|assets\/portrait/i.test(message)) return `${message} 请确认 assets/portrait 文件夹与 HTML 放在一起。`;
  return message;
}

async function runPortraitCutout(){
  if(!portraitFile||portraitBusy) return;
  setPortraitBusy(true);
  clearPortraitResult();
  const started=performance.now();
  try{
    const session=await getPortraitSession();
    setPortraitStatus('模型已就绪，正在分析人物轮廓与发丝边缘…');
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const image=await decodePortraitImage(portraitFile);
    const sourceWidth=image.width||image.naturalWidth;
    const sourceHeight=image.height||image.naturalHeight;
    if(!sourceWidth||!sourceHeight) throw new Error('图片尺寸无效。');

    const inputCanvas=document.createElement('canvas');
    inputCanvas.width=PORTRAIT_MODEL_SIZE;
    inputCanvas.height=PORTRAIT_MODEL_SIZE;
    const inputContext=inputCanvas.getContext('2d',{willReadFrequently:true});
    inputContext.imageSmoothingEnabled=true;
    inputContext.imageSmoothingQuality='high';
    inputContext.drawImage(image,0,0,PORTRAIT_MODEL_SIZE,PORTRAIT_MODEL_SIZE);
    const rgba=inputContext.getImageData(0,0,PORTRAIT_MODEL_SIZE,PORTRAIT_MODEL_SIZE).data;
    let maxChannel=1;
    for(let i=0;i<rgba.length;i+=4) maxChannel=Math.max(maxChannel,rgba[i],rgba[i+1],rgba[i+2]);
    const plane=PORTRAIT_MODEL_SIZE*PORTRAIT_MODEL_SIZE;
    const input=new Float32Array(plane*3);
    const means=[.485,.456,.406],stds=[.229,.224,.225];
    for(let pixel=0,offset=0;pixel<plane;pixel++,offset+=4){
      input[pixel]=(rgba[offset]/maxChannel-means[0])/stds[0];
      input[plane+pixel]=(rgba[offset+1]/maxChannel-means[1])/stds[1];
      input[plane*2+pixel]=(rgba[offset+2]/maxChannel-means[2])/stds[2];
    }
    const tensor=new ort.Tensor('float32',input,[1,3,PORTRAIT_MODEL_SIZE,PORTRAIT_MODEL_SIZE]);
    const outputMap=await session.run({[session.inputNames[0]]:tensor});
    const maskValues=outputMap[session.outputNames[0]].data;
    let min=Infinity,max=-Infinity;
    for(let i=0;i<maskValues.length;i++){
      const value=maskValues[i];
      if(value<min) min=value;
      if(value>max) max=value;
    }
    const range=Math.max(max-min,1e-6);
    const softEdges=$('portraitSoftEdges').checked;
    const maskCanvas=document.createElement('canvas');
    maskCanvas.width=PORTRAIT_MODEL_SIZE;
    maskCanvas.height=PORTRAIT_MODEL_SIZE;
    const maskContext=maskCanvas.getContext('2d');
    const maskImage=maskContext.createImageData(PORTRAIT_MODEL_SIZE,PORTRAIT_MODEL_SIZE);
    for(let i=0;i<plane;i++){
      let value=Math.max(0,Math.min(1,(maskValues[i]-min)/range));
      value=softEdges?(value<.015?0:Math.pow(value,.82)):(value>=.5?1:0);
      const alpha=Math.round(value*255);
      const offset=i*4;
      maskImage.data[offset]=255;
      maskImage.data[offset+1]=255;
      maskImage.data[offset+2]=255;
      maskImage.data[offset+3]=alpha;
    }
    maskContext.putImageData(maskImage,0,0);

    const safeScale=Math.min(1,PORTRAIT_MAX_SIDE/sourceWidth,PORTRAIT_MAX_SIDE/sourceHeight,Math.sqrt(PORTRAIT_MAX_PIXELS/(sourceWidth*sourceHeight)));
    const outputWidth=Math.max(1,Math.round(sourceWidth*safeScale));
    const outputHeight=Math.max(1,Math.round(sourceHeight*safeScale));
    const outputCanvas=document.createElement('canvas');
    outputCanvas.width=outputWidth;
    outputCanvas.height=outputHeight;
    const outputContext=outputCanvas.getContext('2d');
    outputContext.imageSmoothingEnabled=true;
    outputContext.imageSmoothingQuality='high';
    outputContext.drawImage(image,0,0,outputWidth,outputHeight);
    outputContext.globalCompositeOperation='destination-in';
    outputContext.drawImage(maskCanvas,0,0,outputWidth,outputHeight);
    outputContext.globalCompositeOperation='source-over';
    if(typeof image.close==='function') image.close();

    portraitResultBlob=await portraitCanvasBlob(outputCanvas);
    portraitResultUrl=URL.createObjectURL(portraitResultBlob);
    const resultImg=$('portraitResultImg');
    resultImg.onload=()=>{
      $('portraitResultMeta').textContent=`${outputWidth}×${outputHeight} · ${(portraitResultBlob.size/1048576).toFixed(2)} MB`;
    };
    resultImg.src=portraitResultUrl;
    resultImg.classList.add('ready');
    $('portraitResultPlaceholder').style.display='none';
    $('portraitDownloadBtn').disabled=false;
    const elapsed=((performance.now()-started)/1000).toFixed(1);
    const resized=safeScale<.999?` 为保证浏览器稳定，结果已安全缩放为 ${outputWidth}×${outputHeight}。`:'';
    setPortraitStatus(`人像抠图完成，用时 ${elapsed} 秒。${resized}`,'success');
  }catch(error){
    console.error('Portrait cutout failed:',error);
    setPortraitStatus(`人像抠图失败：${describePortraitError(error)}`,'error');
  }finally{
    setPortraitBusy(false);
  }
}

portraitUploadArea.addEventListener('click',()=>{ if(!portraitBusy) portraitFileInput.click(); });
portraitUploadArea.addEventListener('keydown',event=>{
  if((event.key==='Enter'||event.key===' ')&&!portraitBusy){ event.preventDefault(); portraitFileInput.click(); }
});
portraitFileInput.addEventListener('change',event=>{
  acceptPortraitFile(event.target.files?.[0]);
  portraitFileInput.value='';
});
portraitUploadArea.addEventListener('dragover',event=>{ event.preventDefault(); portraitUploadArea.classList.add('dragover'); });
portraitUploadArea.addEventListener('dragleave',()=>portraitUploadArea.classList.remove('dragover'));
portraitUploadArea.addEventListener('drop',event=>{
  event.preventDefault();
  portraitUploadArea.classList.remove('dragover');
  acceptPortraitFile(Array.from(event.dataTransfer?.files||[]).find(file=>file.type.startsWith('image/')));
});
document.addEventListener('paste',event=>{
  if(mode!=='portrait'||portraitBusy) return;
  const file=Array.from(event.clipboardData?.files||[]).find(item=>item.type.startsWith('image/'));
  if(file){ event.preventDefault(); acceptPortraitFile(file); }
});
$('portraitProcessBtn').addEventListener('click',runPortraitCutout);
$('portraitResetBtn').addEventListener('click',()=>resetPortrait(false));
$('portraitRemoveBtn').addEventListener('click',()=>resetPortrait(true));
$('portraitDownloadBtn').addEventListener('click',()=>{
  if(!portraitResultBlob) return;
  downloadBlob({blob:portraitResultBlob,format:'image/png',w:0,h:0},`人像抠图_${stripExt(portraitFile?.name||'portrait')}`);
});

render();

/* ========= 暗夜版侧栏与小黑龙 ========= */
document.querySelectorAll('.side-nav-item').forEach(item=>{
  item.addEventListener('click',()=>{
    const target=document.querySelector(`.tab[data-mode="${item.dataset.modeTarget}"]`);
    if(target) target.click();
  });
});
document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.side-nav-item').forEach(item=>{
      item.classList.toggle('active',item.dataset.modeTarget===tab.dataset.mode);
    });
  });
});

/* ========= 玻璃龙影版：小黑龙逐帧动画与视频背景 ========= */
const dragonActions=[
  {label:'小黑龙正在休息',src:'assets/dragon/dragon-rest-v15.webp'},
  {label:'小黑龙飞起来喷火',src:'assets/dragon/dragon-fly-fire-v15.webp'},
  {label:'小黑龙正在警戒',src:'assets/dragon/dragon-threaten-v15.webp'},
  {label:'小黑龙害羞低头',src:'assets/dragon/dragon-shy-v15.webp'}
];
const dragonStateLabel=$('dragonStateLabel');
const dragonStage=document.querySelector('.dragon-stage');
const dragonCanvas=$('dragonCanvas');
const dragonContext=dragonCanvas.getContext('2d');
const dragonImages=dragonActions.map(action=>{
  const image=new Image();
  image.decoding='async';
  return image;
});
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const actionDuration=4800;
const dragonFrameDelay=1000/12;
let dragonAnimationStart=performance.now();
let visibleDragonAction=-1;
let dragonTimerId=0;
let dragonRafId=0;

function stopDragonAnimation(){
  window.clearTimeout(dragonTimerId);
  cancelAnimationFrame(dragonRafId);
  dragonTimerId=0;
  dragonRafId=0;
}

function scheduleDragonFrame(){
  if(document.hidden||reduceMotion.matches) return;
  dragonTimerId=window.setTimeout(()=>{
    dragonRafId=requestAnimationFrame(renderDragon);
  },dragonFrameDelay);
}

function startDragonAnimation(){
  stopDragonAnimation();
  dragonAnimationStart=performance.now();
  dragonRafId=requestAnimationFrame(renderDragon);
}

function drawDragonFrame(image,actionIndex,progress,alpha=1){
  if(!image.complete||!image.naturalWidth){
    image=dragonImages.find(frame=>frame.complete&&frame.naturalWidth);
    if(!image) return;
  }
  const stepped=Math.floor(progress*18)/18;
  const pulse=Math.sin(stepped*Math.PI*2);
  let x=128,y=128,scale=1,rotation=0;
  if(actionIndex===0){
    y+=2+Math.max(0,pulse)*2;
    scale=1+Math.max(0,pulse)*.018;
  }else if(actionIndex===1){
    x+=8+Math.sin(stepped*Math.PI*4)*5;
    y-=12+Math.abs(Math.sin(stepped*Math.PI*3))*11;
    scale=1.04+Math.abs(Math.sin(stepped*Math.PI*2))*.05;
    rotation=(-2+Math.sin(stepped*Math.PI*4)*3)*Math.PI/180;
  }else if(actionIndex===2){
    const warning=stepped>.18&&stepped<.76?Math.sin(stepped*Math.PI*18)*3:0;
    x+=warning;
    scale=1.025+(stepped>.2&&stepped<.72?.045:0);
    rotation=Math.sin(stepped*Math.PI*10)*.7*Math.PI/180;
  }else{
    y+=5+Math.abs(Math.sin(stepped*Math.PI*2))*5;
    scale=.985-Math.max(0,pulse)*.02;
    rotation=(1+Math.sin(stepped*Math.PI*2)*.8)*Math.PI/180;
  }
  dragonContext.save();
  dragonContext.globalAlpha=alpha;
  dragonContext.translate(x,y);
  dragonContext.rotate(rotation);
  dragonContext.scale(scale,scale);
  dragonContext.drawImage(image,-128,-128,256,256);
  dragonContext.restore();
}

function renderDragon(now){
  dragonContext.clearRect(0,0,dragonCanvas.width,dragonCanvas.height);
  if(reduceMotion.matches){
    if(visibleDragonAction!==0){
      visibleDragonAction=0;
      dragonStage.dataset.dragonState='0';
      dragonStateLabel.textContent=dragonActions[0].label;
    }
    drawDragonFrame(dragonImages[0],0,0,1);
    return;
  }
  const elapsed=Math.max(0,now-dragonAnimationStart);
  const actionIndex=Math.floor(elapsed/actionDuration)%dragonActions.length;
  const progress=(elapsed%actionDuration)/actionDuration;
  if(actionIndex!==visibleDragonAction){
    visibleDragonAction=actionIndex;
    dragonStage.dataset.dragonState=String(actionIndex);
    dragonStateLabel.textContent=dragonActions[actionIndex].label;
  }
  const transitionStart=.88;
  if(progress<transitionStart){
    drawDragonFrame(dragonImages[actionIndex],actionIndex,progress/transitionStart,1);
  }else{
    const mix=(progress-transitionStart)/(1-transitionStart);
    const nextIndex=(actionIndex+1)%dragonActions.length;
    drawDragonFrame(dragonImages[actionIndex],actionIndex,1,1-mix);
    drawDragonFrame(dragonImages[nextIndex],nextIndex,0,mix);
  }
  scheduleDragonFrame();
}
// Start as soon as one frame is ready; slow or failed later frames cannot hold it up.
let dragonHasStarted=false;
dragonImages.forEach((image,index)=>{
  image.onload=()=>{
    if(!dragonHasStarted){
      dragonHasStarted=true;
      dragonStage.classList.add('dragon-ready');
      startDragonAnimation();
    }
  };
  if(index===0) image.src=dragonActions[index].src;
  else window.setTimeout(()=>{ image.src=dragonActions[index].src; },index*600);
});

const cinematicBg=$('cinematicBg');
const videoToggle=$('videoToggle');
let videoUserPaused=false;
let cinematicStarted=false;
function startCinematicBackground(){
  if(cinematicStarted||document.hidden||reduceMotion.matches) return;
  cinematicStarted=true;
  const source=cinematicBg.querySelector('source');
  source.src=source.dataset.src;
  cinematicBg.load();
  if(!videoUserPaused) cinematicBg.play().catch(()=>syncVideoToggle());
}
function syncVideoToggle(){
  const paused=cinematicBg.paused;
  videoToggle.setAttribute('aria-pressed',String(paused));
  videoToggle.querySelector('i').className=paused?'bi bi-play-fill':'bi bi-pause-fill';
  videoToggle.querySelector('span').textContent=paused?'播放背景':'暂停背景';
}
videoToggle.addEventListener('click',async()=>{
  if(cinematicBg.paused){
    videoUserPaused=false;
    startCinematicBackground();
    try{ await cinematicBg.play(); }catch(error){}
  }else{
    videoUserPaused=true;
    cinematicBg.pause();
  }
  syncVideoToggle();
});
cinematicBg.addEventListener('play',syncVideoToggle);
cinematicBg.addEventListener('pause',syncVideoToggle);
// Keep the tool usable before beginning the film download.
if(!reduceMotion.matches){ window.setTimeout(startCinematicBackground,350); }
syncVideoToggle();

document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    stopDragonAnimation();
    cinematicBg.pause();
    return;
  }
  startDragonAnimation();
  startCinematicBackground();
  if(!videoUserPaused&&!reduceMotion.matches){ cinematicBg.play().catch(()=>syncVideoToggle()); }
});
if(reduceMotion.addEventListener){
  reduceMotion.addEventListener('change',()=>{
    if(reduceMotion.matches){
      stopDragonAnimation();
      cinematicBg.pause();
      renderDragon(performance.now());
    }else{
      startDragonAnimation();
      startCinematicBackground();
      if(!videoUserPaused){ cinematicBg.play().catch(()=>syncVideoToggle()); }
    }
  });
}

