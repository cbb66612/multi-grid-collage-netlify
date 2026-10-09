(() => {
  const toolMeta = {
    grid: ['自动网格', '上传 2–9 张图片，调整间距和格式后生成拼图。'],
    inspect: ['图片检测', '批量检查大小与像素，并处理不符合规则的图片。'],
    table: ['网格画布', '自由安排网格、拖放图片并按区域导出。'],
    paint: ['图片涂抹', '从原图取色并遮盖需要隐藏的矩形区域。'],
    portrait: ['人像抠图', '在本机加载轻量模型，导出透明背景 PNG。']
  };

  const toastRegion = document.createElement('div');
  toastRegion.className = 'v14-toast-region';
  toastRegion.setAttribute('role', 'status');
  toastRegion.setAttribute('aria-live', 'polite');
  toastRegion.setAttribute('aria-atomic', 'true');
  document.body.appendChild(toastRegion);

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'v14-toast';
    toast.textContent = String(message);
    toastRegion.appendChild(toast);
    window.setTimeout(() => toast.remove(), 5200);
  }

  window.alert = showToast;

  const title = document.querySelector('h1');
  const subtitle = document.querySelector('.hero-subtitle');
  const navItems = [...document.querySelectorAll('.side-nav-item')];

  function reflectMode(nextMode) {
    const meta = toolMeta[nextMode] || toolMeta.grid;
    document.body.dataset.tool = nextMode;
    if (title) title.textContent = meta[0];
    if (subtitle) subtitle.innerHTML = `<i class="bi bi-shield-check" aria-hidden="true"></i><span>${meta[1]} 所有处理均在本地完成。</span>`;
    navItems.forEach(item => {
      const active = item.dataset.modeTarget === nextMode;
      item.setAttribute('aria-current', active ? 'page' : 'false');
    });
  }

  navItems.forEach(item => {
    const nextMode = item.dataset.modeTarget;
    const label = item.querySelector('span')?.textContent?.trim() || toolMeta[nextMode]?.[0] || '工具';
    item.title = label;
    item.addEventListener('click', () => {
      history.replaceState(null, '', `#${nextMode}`);
      reflectMode(nextMode);
    });
  });

  const initialMode = location.hash.slice(1);
  const initialItem = navItems.find(item => item.dataset.modeTarget === initialMode);
  if (initialItem) initialItem.click();
  else reflectMode('grid');

  window.addEventListener('hashchange', () => {
    const nextMode = location.hash.slice(1);
    const item = navItems.find(entry => entry.dataset.modeTarget === nextMode);
    if (item) item.click();
  });

  ['uploadArea', 'inspectUploadArea', 'paintUploadArea'].forEach(id => {
    const area = document.getElementById(id);
    if (!area) return;
    area.setAttribute('role', 'button');
    area.setAttribute('tabindex', '0');
    area.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        area.click();
      }
    });
  });

  ['status', 'inspectStatus', 'paintStatus', 'portraitStatus'].forEach(id => {
    const status = document.getElementById(id);
    if (status) status.setAttribute('aria-live', 'polite');
  });
})();

