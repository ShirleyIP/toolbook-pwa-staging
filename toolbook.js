/* ============================================================
   Toolbook 共用層
   ------------------------------------------------------------
   九個工具本來各自把紀錄存在自己的 localStorage key 裡，首頁一行都沒讀，
   所以使用者看不出自己用過哪一個、上次的結論是什麼。

   這支檔案只做四件事，不碰各工具內部的流程：
     1. 工具與內容的登記表——一處改，全站跟著改
     2. 讀出每個工具的使用次數、最後日期、上次的結論
     3. 匯出／匯入全部紀錄（資料只在瀏覽器，清掉就沒了）
     4. 兩個共用元件：目錄選單、完成後的意見小調查

   為什麼要獨立成一支：這些東西如果讓九個檔案各寫一份，一定走鐘。
   GA 事件命名就是這樣分裂成兩批，事後要花一整輪去統一。

   純前端，不連伺服器。唯一會送出東西的地方是意見調查，而且送出前明講。
   ============================================================ */
(function (global) {
  'use strict';

  var FORM_ENDPOINT = 'https://formspree.io/f/mlgkgveq';
  var EXPORT_VERSION = 1;

  /* ---------- 1. 登記表 ---------- */

  // sum：拿哪一個欄位當「上次的結論」。找不到就往後退一個欄位。
  var TOOLS = [
    { id: 'goal_clarifier', no: '01', name: '目標釐清器', file: 'tool.html',
      key: 'toolbook_direction_cards_v1', draft: 'toolbook_goal_clarifier_v1',
      sum: ['want'], sumLabel: '你要的' },
    { id: 'result_lock_card', no: '02', name: '成果鎖定卡', file: 'tool-result-lock.html',
      key: 'toolbook_result_lock_history_v1', draft: 'toolbook_result_lock_v1',
      sum: ['outcome'], sumLabel: '鎖定的成果' },
    { id: 'review_card', no: '03', name: '復盤卡', file: 'tool-review.html',
      key: 'toolbook_review_history_v1', draft: 'toolbook_review_v1',
      sum: ['onething', 'lesson'], sumLabel: '只改這一件' },
    { id: 'fear_card', no: '04', name: '恐懼拆解卡', file: 'tool-fear.html',
      key: 'toolbook_fear_history_v1', draft: 'toolbook_fear_v1',
      sum: ['ministep', 'backText', 'worstText'], sumLabel: '最小的一步' },
    { id: 'pilot_card', no: '05', name: '小規模試驗卡', file: 'tool-pilot.html',
      key: 'toolbook_pilot_history_v1', draft: 'toolbook_pilot_v1',
      sum: ['pilot', 'decision'], sumLabel: '要跑的試驗' },
    { id: 'leisure_card', no: '06', name: '空下來之後', file: 'tool-leisure.html',
      key: 'toolbook_leisure_history_v1', draft: 'toolbook_leisure_v1',
      sum: ['thing', 'firstStep'], sumLabel: '在乎的那件事' },
    { id: 'subtract_card', no: '07', name: '減法掃描卡', file: 'tool-subtract.html',
      key: 'toolbook_subtract_history_v1', draft: 'toolbook_subtract_v1',
      sum: ['action'], sumLabel: '要動的那一項' },
    // unit：這一支數的是天，不是卡片。其餘工具預設「筆」。
    { id: 'two_slots', no: '08', name: '今天兩格', file: 'tool-two.html',
      key: 'toolbook_two_v1', shape: 'byDate', unit: '天',
      sum: ['one'], sumLabel: '最近一天寫的' },
    { id: 'cycle_executor', no: '09', name: '週期執行器', file: 'tool-cycle.html',
      key: 'toolbook_cycle_history_v1', draft: 'toolbook_cycle_v1',
      sum: ['deliver', 'want'], sumLabel: '這一輪要交出的' },
    { id: 'after_talk', no: '10', name: '講完話之後', file: 'tool-after-talk.html',
      key: 'toolbook_after_talk_history_v1', draft: 'toolbook_after_talk_v1',
      sum: ['answer'], sumLabel: '上次留下的那一題' }
  ];

  // tools：這一頁上實際列出／指向的工具。
  // 只在這裡宣告一次，工具那一邊的「這張卡出自哪裡」用反向對應算出來（見 sourcesFor）。
  // 不列第二份清單——人腦列兩份一定有一份會漏，GA 參數就是這樣漏掉五個的。
  var MAPS = [
    { name: '《人生效率手冊》', file: 'book-efficiency-handbook.html',
      tools: ['result_lock_card', 'review_card'] },
    { name: '《一週工作 4 小時》', file: 'book-four-hour-workweek.html',
      tools: ['fear_card', 'pilot_card', 'leisure_card', 'subtract_card', 'two_slots'] },
    { name: '《12週做完一年工作》', file: 'book-twelve-week-year.html',
      tools: ['review_card', 'cycle_executor'] },
    { name: '《非暴力溝通》', file: 'book-nonviolent-communication.html',
      tools: ['after_talk'] }
  ];

  var ARTICLES = [
    { name: '為什麼你定了一堆目標，卻還是迷茫？', file: 'article.html',
      tools: ['goal_clarifier'] },
    { name: '為甚麼每天很忙，仍然沒有進展？', file: 'article-busy.html',
      tools: ['result_lock_card'] },
    { name: '這本效率書最有名的三個數字，沒有一個站得住', file: 'article-three-numbers.html',
      tools: ['result_lock_card'] },
    // 這篇拆的是《12週做完一年工作》，所以那本書的工具也算相關，
    // 即使文章正文的按鈕只指向復盤卡。
    { name: '那個 85%，其實有兩個版本', file: 'article-two-standards.html',
      tools: ['review_card', 'cycle_executor'] },
    { name: '你量什麼，就只會改變什麼', file: 'article-measure.html',
      tools: ['review_card'] },
    { name: '這套溝通方法，不承諾你學得會', file: 'article-no-promise.html',
      tools: ['goal_clarifier', 'review_card', 'after_talk'] }
  ];

  /* ---------- 2. 讀出使用狀況 ---------- */

  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (_) { return fallback; }
  }

  function firstFilled(obj, fields) {
    if (!obj) return '';
    for (var i = 0; i < fields.length; i++) {
      var v = obj[fields[i]];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  }

  // 一行摘要：太長就截斷，保留看得懂的長度。
  function oneLine(text, max) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    max = max || 40;
    return t.length > max ? t.slice(0, max) + '…' : t;
  }

  function parseDay(k) {
    // 今天兩格的 key 是 2026-08-18 這種格式
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k || ''));
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }

  // 回傳 {count, unit, lastAt(Date|null), summary, summaryLabel, extra}
  function usage(tool) {
    var unit = tool.unit || '筆';
    var blank = { count: 0, unit: unit, lastAt: null, summary: '', summaryLabel: tool.sumLabel, extra: '' };

    if (tool.shape === 'byDate') {
      var store = readJSON(tool.key, {});
      if (!store || typeof store !== 'object' || Array.isArray(store)) return blank;
      var days = Object.keys(store).filter(function (k) {
        var d = store[k];
        return d && ((d.one || '').trim() || (d.two || '').trim());
      }).sort().reverse();
      if (!days.length) return blank;
      var latest = store[days[0]];
      return {
        count: days.length,
        unit: unit,
        lastAt: parseDay(days[0]),
        summary: oneLine(latest.one || latest.two),
        summaryLabel: tool.sumLabel,
        extra: ''
      };
    }

    var cards = readJSON(tool.key, []);
    if (!Array.isArray(cards) || !cards.length) return blank;
    var newest = cards[0];
    var at = new Date(newest.updatedAt || newest.createdAt || '');
    var extra = '';
    if (Array.isArray(newest.logs) && newest.logs.length) {
      extra = '記到第 ' + newest.logs.length + ' 週';   // 週期執行器獨有
    }
    return {
      count: cards.length,
      unit: unit,
      lastAt: isNaN(at.getTime()) ? null : at,
      summary: oneLine(firstFilled(newest, tool.sum)),
      summaryLabel: tool.sumLabel,
      extra: extra
    };
  }

  function allUsage() {
    return TOOLS.map(function (t) {
      var u = usage(t);
      u.tool = t;
      return u;
    });
  }

  function fmtDate(d) {
    if (!d) return '';
    try {
      return d.toLocaleDateString('zh-HK', { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch (_) { return ''; }
  }

  /* ---------- 3. 匯出／匯入 ---------- */

  // 為什麼要有這個：資料只在這個瀏覽器，清一次快取就全部沒了。
  // 現在不做帳號，所以至少要讓人自己帶得走。
  function collect() {
    var data = {};
    TOOLS.forEach(function (t) {
      [t.key, t.draft].forEach(function (k) {
        if (!k) return;
        var raw = null;
        try { raw = localStorage.getItem(k); } catch (_) { return; }
        if (raw != null) data[k] = raw;
      });
    });
    return data;
  }

  function exportAll() {
    var payload = {
      format: 'toolbook-records',
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      data: collect()
    };
    var stamp = new Date().toISOString().slice(0, 10);
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'toolbook-紀錄-' + stamp + '.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    track('records_export', { record_keys: Object.keys(payload.data).length });
    return Object.keys(payload.data).length;
  }

  // 合併：同一張卡以 id 比對，兩邊都有就留較新的那張。
  // 這樣在兩部裝置之間來回匯入不會互相蓋掉。
  function mergeArrays(mine, theirs) {
    var byId = {}, order = [];
    function put(c) {
      if (!c || typeof c !== 'object') return;
      var id = c.id || ('_' + order.length);
      var old = byId[id];
      if (!old) { byId[id] = c; order.push(id); return; }
      var a = new Date(c.updatedAt || c.createdAt || 0).getTime();
      var b = new Date(old.updatedAt || old.createdAt || 0).getTime();
      if (a > b) byId[id] = c;
    }
    (theirs || []).forEach(put);
    (mine || []).forEach(put);
    return order.map(function (id) { return byId[id]; })
      .sort(function (x, y) {
        return new Date(y.updatedAt || y.createdAt || 0) - new Date(x.updatedAt || x.createdAt || 0);
      })
      .slice(0, 50);
  }

  // 回傳 {ok, restored, skipped, error}
  function importAll(payload, mode) {
    if (!payload || payload.format !== 'toolbook-records' || !payload.data) {
      return { ok: false, error: '這不是 Toolbook 的紀錄檔。' };
    }
    var restored = 0, skipped = 0;
    var knownKeys = {};
    TOOLS.forEach(function (t) {
      knownKeys[t.key] = t;
      if (t.draft) knownKeys[t.draft] = t;
    });

    Object.keys(payload.data).forEach(function (k) {
      if (!knownKeys[k]) { skipped++; return; }
      var incomingRaw = payload.data[k];
      try {
        if (mode === 'replace') {
          localStorage.setItem(k, incomingRaw);
          restored++;
          return;
        }
        var incoming = JSON.parse(incomingRaw);
        var existing = readJSON(k, null);
        var merged;
        if (Array.isArray(incoming)) {
          merged = mergeArrays(Array.isArray(existing) ? existing : [], incoming);
        } else if (incoming && typeof incoming === 'object') {
          // 今天兩格與草稿：同一天／同一份以本機為主，缺的補上
          merged = Object.assign({}, incoming, (existing && typeof existing === 'object') ? existing : {});
        } else {
          skipped++;
          return;
        }
        localStorage.setItem(k, JSON.stringify(merged));
        restored++;
      } catch (_) { skipped++; }
    });

    track('records_import', { record_keys: restored, mode: mode === 'replace' ? 'replace' : 'merge' });
    return { ok: true, restored: restored, skipped: skipped };
  }

  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        try { resolve(JSON.parse(String(fr.result))); }
        catch (_) { reject(new Error('檔案讀不出來，可能不是 JSON。')); }
      };
      fr.onerror = function () { reject(new Error('檔案讀取失敗。')); };
      fr.readAsText(file);
    });
  }

  /* ---------- 共用小工具 ---------- */

  function track(name, data) {
    if (typeof global.gtag === 'function') {
      global.gtag('event', name, data || {});
    }
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>'"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c];
    });
  }

  function here() {
    var p = location.pathname.split('/').pop();
    return p || 'index.html';
  }

  function injectStyle(id, css) {
    if (document.getElementById(id)) return;
    var s = document.createElement('style');
    s.id = id;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ---------- 4a. 目錄選單 ---------- */

  var DIR_CSS = [
    '.tb-dir-btn{border:0;background:transparent;color:var(--muted,#938b78);font-family:inherit;cursor:pointer;line-height:1;padding:0}',
    '.tb-dir-sheet{position:fixed;inset:0;z-index:60;background:rgba(44,40,32,.4);display:none}',
    '.tb-dir-sheet.open{display:block}',
    '.tb-dir-inner{width:min(100%,460px);height:100%;margin:0 auto;background:var(--bg,#ece5d8);overflow-y:auto;padding:20px 24px 40px;font-family:-apple-system,"PingFang TC",sans-serif;line-height:1.7}',
    '.tb-dir-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}',
    '.tb-dir-head b{font-family:var(--serif,serif);font-size:20px;font-weight:600;color:var(--ink,#2c2820)}',
    '.tb-dir-x{border:0;background:transparent;color:var(--muted,#938b78);font-size:22px;cursor:pointer;padding:6px}',
    '.tb-dir-note{font-size:12px;color:var(--muted,#938b78);margin-bottom:14px}',
    '.tb-dir-k{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--muted,#938b78);margin:20px 0 6px}',
    '.tb-dir-a{display:flex;align-items:baseline;gap:10px;text-decoration:none;color:var(--ink,#2c2820);padding:10px 2px;border-bottom:1px solid var(--line,#d6cdba);font-size:14.5px}',
    '.tb-dir-a .tb-n{font-family:var(--serif,serif);font-size:11px;letter-spacing:1px;color:var(--accent,#8a6f44);width:26px;flex:none}',
    '.tb-dir-a .tb-t{flex:1}',
    '.tb-dir-a .tb-u{font-size:10.5px;color:var(--accent,#8a6f44);flex:none;letter-spacing:.5px}',
    '.tb-dir-a[aria-current="page"] .tb-t{color:var(--accent,#8a6f44);font-weight:600}',
    '.tb-dir-a:hover .tb-t{color:var(--accent,#8a6f44)}',
    /* 導覽列本來就是滿的，所以窄螢幕要把「EDITIONS」這個裝飾性副標收起來，
       否則品牌名會被頂到第二行。

       斷點原本是 430px。加上「目錄」兩個字之後重量一次，發現真正擠的不是小螢幕，
       是 431–470 那一段——副標在那裡會回來，品牌從 139px 變 217px，首頁的導覽列
       剛好被塞滿、餘裕為 0；而 375px 反而有 56px 餘裕。所以斷點提到 470，讓副標
       晚一點回來，換「目錄」兩個字在每一個寬度都看得到。
       副標是裝飾，那兩個字是入口——只有一個 ☰ 的話，沒有人會知道點下去有自己的紀錄。 */
    '@media(max-width:470px){nav .brand .sub,nav .brand small{display:none}}',
    '.tb-dir-link{margin-left:14px !important}',
    '.tb-dir-word{font-size:12.5px;letter-spacing:2px;margin-left:6px;vertical-align:1px}'
  ].join('');

  function dirLink(file, label, no, usedNote) {
    return '<a class="tb-dir-a" href="' + esc(file) + '"' +
      (file === here() ? ' aria-current="page"' : '') + '>' +
      '<span class="tb-n">' + esc(no || '') + '</span>' +
      '<span class="tb-t">' + esc(label) + '</span>' +
      '<span class="tb-u">' + esc(usedNote || '') + '</span></a>';
  }

  function buildDirectory() {
    var used = {}, usedTools = 0;
    allUsage().forEach(function (u) {
      // unit 用登記表宣告的那個：「今天兩格」數的是天，寫「1 次」對不上它自己的頁面。
      used[u.tool.id] = u.count ? ('用過 ' + u.count + ' ' + (u.unit === '天' ? '天' : '次')) : '';
      if (u.count) usedTools++;
    });

    var html = '<div class="tb-dir-inner" role="dialog" aria-label="目錄">' +
      '<div class="tb-dir-head"><b>目錄</b>' +
      '<button class="tb-dir-x" type="button" data-tb-close aria-label="關閉">✕</button></div>' +
      '<div class="tb-dir-note">全站一頁一工具，答案存在你這部裝置。</div>' +
      dirLink('index.html', '首頁', '', '') +
      dirLink('records.html', '我的紀錄', '',
        usedTools ? ('用過 ' + usedTools + ' 個工具') : '還沒有紀錄') +
      '<div class="tb-dir-k">工具</div>' +
      TOOLS.map(function (t) { return dirLink(t.file, t.name, t.no, used[t.id]); }).join('') +
      '<div class="tb-dir-k">工具地圖</div>' +
      MAPS.map(function (m) { return dirLink(m.file, m.name, '', ''); }).join('') +
      '<div class="tb-dir-k">文章</div>' +
      ARTICLES.map(function (a) { return dirLink(a.file, a.name, '', ''); }).join('') +
      '</div>';

    var sheet = document.createElement('aside');
    sheet.className = 'tb-dir-sheet';
    sheet.id = 'tbDirectory';
    sheet.setAttribute('aria-hidden', 'true');
    sheet.innerHTML = html;
    document.body.appendChild(sheet);

    sheet.addEventListener('click', function (e) {
      if (e.target === sheet || e.target.closest('[data-tb-close]')) closeDirectory();
    });
    return sheet;
  }

  function openDirectory() {
    var s = document.getElementById('tbDirectory') || buildDirectory();
    s.classList.add('open');
    s.setAttribute('aria-hidden', 'false');
    track('view_directory', { from_page: here() });
  }

  function closeDirectory() {
    var s = document.getElementById('tbDirectory');
    if (!s) return;
    s.classList.remove('open');
    s.setAttribute('aria-hidden', 'true');
  }

  // 工具頁：塞進既有的 .topbar（那裡本來只有一個 ✕）
  // 文章／地圖頁：塞進 nav .links
  function mountDirectory() {
    injectStyle('tb-dir-css', DIR_CSS);

    var bar = document.querySelector('.topbar');
    if (bar && !bar.querySelector('.tb-dir-btn')) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tb-dir-btn';
      b.setAttribute('aria-label', '目錄');
      b.style.cssText = 'font-size:17px;margin-left:auto;margin-right:16px';
      b.innerHTML = '☰<span class="tb-dir-word">目錄</span>';
      var home = bar.querySelector('.home');
      if (home) { home.style.marginLeft = '0'; bar.insertBefore(b, home); }
      else bar.appendChild(b);
      b.addEventListener('click', openDirectory);
    }

    // 文章與地圖頁：用 ☰ 而不是「目錄」兩個字。
    // 那些頁的 nav 本來就有兩三個連結，390px 下再加兩個中文字會換行、把品牌名頂下去。
    var links = document.querySelector('nav .links') || document.querySelector('nav');
    if (links && !links.querySelector('.tb-dir-link')) {
      var a = document.createElement('a');
      a.href = '#';
      a.className = 'tb-dir-link';
      a.setAttribute('aria-label', '目錄');
      a.title = '目錄';
      a.innerHTML = '☰<span class="tb-dir-word">目錄</span>';
      a.style.cssText = 'font-size:16px;line-height:1;letter-spacing:0';
      a.addEventListener('click', function (e) { e.preventDefault(); openDirectory(); });
      links.appendChild(a);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDirectory();
    });
  }

  /* ---------- 4b. 完成後的意見小調查 ---------- */

  /* 為什麼要有這一段：九個工具裡本來只有成果鎖定卡問過使用者一句話，
     其餘八個完成畫面就只有儲存圖片／分享／回首頁。工具全部憑判斷做出來、
     一筆真實回饋都沒有，這是最該補的一個缺口。

     三個選項用點的，不打字；文字欄與 Email 都可以留空。
     這裡不送卡片內容——只送工具名、三個選擇與那句自由文字。 */

  var ASK_CSS = [
    '.tb-ask{border:1px solid var(--line,#d6cdba);border-radius:4px;background:rgba(245,240,230,.55);padding:20px 19px;margin-top:26px}',
    '.tb-ask h4{font-family:var(--serif,serif);font-size:16.5px;font-weight:600;margin:0 0 5px;color:var(--ink,#2c2820)}',
    '.tb-ask .tb-ask-sub{font-size:12.5px;color:var(--muted,#938b78);line-height:1.8;margin-bottom:16px}',
    '.tb-q{margin-bottom:15px}',
    '.tb-q>span{display:block;font-family:var(--serif,serif);font-size:13.5px;color:#5d564a;margin-bottom:7px}',
    '.tb-opts{display:flex;flex-wrap:wrap;gap:6px}',
    '.tb-opts button{border:1px solid var(--line,#d6cdba);background:var(--card,#f5f0e6);border-radius:3px;padding:9px 12px;font-family:inherit;font-size:12.5px;color:#5d564a;cursor:pointer;line-height:1.4}',
    '.tb-opts button.on{border-color:var(--accent,#8a6f44);color:var(--accent,#8a6f44);background:rgba(138,111,68,.08);font-weight:600}',
    '.tb-ask textarea,.tb-ask input{width:100%;border:1px solid var(--line,#d6cdba);background:var(--card,#f5f0e6);border-radius:3px;padding:11px 13px;font-size:13.5px;font-family:inherit;color:var(--ink,#2c2820);resize:vertical}',
    '.tb-ask textarea{min-height:74px;line-height:1.8}',
    '.tb-ask textarea:focus,.tb-ask input:focus{outline:none;border-color:var(--accent,#8a6f44)}',
    '.tb-ask .tb-send{width:100%;margin-top:12px;border:1px solid var(--accent,#8a6f44);background:var(--accent,#8a6f44);color:var(--onAccent,#f5f0e6);border-radius:3px;padding:13px;font-family:inherit;font-size:13.5px;font-weight:600;letter-spacing:1px;cursor:pointer}',
    '.tb-ask .tb-send:disabled{opacity:.4;cursor:not-allowed}',
    '.tb-ask .tb-priv{font-size:11px;color:var(--muted,#938b78);line-height:1.75;margin-top:11px}',
    '.tb-ask .tb-status{font-size:12.5px;color:var(--accent,#8a6f44);min-height:18px;margin-top:8px}',
    '.tb-ask.done{text-align:left}'
  ].join('');

  var QUESTIONS = [
    { name: 'helped', label: '這張卡對你有用嗎？',
      opts: [['yes', '有用'], ['half', '一半一半'], ['no', '沒有用']] },
    { name: 'as_app', label: '你希望它變成手機 app 嗎？',
      opts: [['app', '想要 app'], ['web', '網頁就夠'], ['unsure', '說不上來']] },
    { name: 'would_pay', label: '如果要收費，你會怎麼想？',
      opts: [['yes', '願意付'], ['depends', '看價錢'], ['no', '不會付']] }
  ];

  function mountFeedback(opts) {
    opts = opts || {};
    var toolId = opts.toolId || '';
    var toolName = opts.toolName || '';

    // into 收的是選擇器；同時符合多個就取最後一個。
    // 八個有步驟的工具都是一連串 .screen，最後一個就是完成畫面——
    // 把調查放進那一格，它自然只在完成後才看得到，不必另外判斷狀態。
    var host = opts.into;
    if (typeof host === 'string') {
      var all = document.querySelectorAll(host);
      host = all.length ? all[all.length - 1] : null;
    }
    if (!host || document.getElementById('tbAsk')) return;

    injectStyle('tb-ask-css', ASK_CSS);

    // compact：成果鎖定卡那一頁已經有一個問「下一個工具」並收 Email 的表單，
    // 同一畫面出現兩個 Email 欄只會讓人困惑，所以那裡只留三個選項。
    var compact = !!opts.compact;

    var box = document.createElement('div');
    box.className = 'tb-ask';
    box.id = 'tbAsk';
    box.innerHTML =
      '<h4>做完了，我想問你三句</h4>' +
      '<div class="tb-ask-sub">這些工具全部是我憑自己的判斷做出來的，到現在還沒有一個人告訴我它到底有沒有用。點三下就好，不用打字。</div>' +
      QUESTIONS.map(function (q) {
        return '<div class="tb-q" data-q="' + esc(q.name) + '"><span>' + esc(q.label) + '</span>' +
          '<div class="tb-opts">' + q.opts.map(function (o) {
            return '<button type="button" data-v="' + esc(o[0]) + '">' + esc(o[1]) + '</button>';
          }).join('') + '</div></div>' ;
      }).join('') +
      (compact ? '' :
        '<div class="tb-q"><span>下一個工具，你希望它解決什麼？（可留空）</span>' +
        '<textarea id="tbAskText" maxlength="500" placeholder="例如：幫我把一個模糊的想法拆成今天就能開始的第一步"></textarea></div>' +
        '<div class="tb-q"><span>Email（可留空，只在你想收到新工具通知時填）</span>' +
        '<input type="email" id="tbAskEmail" maxlength="120" placeholder="name@example.com"></div>') +
      '<button class="tb-send" id="tbAskSend" type="button" disabled>送出</button>' +
      '<div class="tb-status" id="tbAskStatus" role="status"></div>' +
      '<p class="tb-priv">送出的只有：工具名稱' +
      (compact ? '與上面三個選擇。' : '、上面三個選擇、那句文字，以及你自己填的 Email。') +
      '<b>卡片內容不會送出</b>，它留在這部裝置。</p>';

    host.appendChild(box);

    // 出口放在調查下面，不放上面。放上面等於在問問題之前先給一條離開的路，
    // 而這個站最缺的東西是回饋，不是流量。
    mountExits(host, toolId);

    var picked = {};
    box.querySelectorAll('.tb-q[data-q]').forEach(function (q) {
      q.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () {
          picked[q.dataset.q] = b.dataset.v;
          q.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on');
          // 三題答完一題就可以送，不強迫全答
          document.getElementById('tbAskSend').disabled = false;
        });
      });
    });

    var textEl = document.getElementById('tbAskText');
    if (textEl) {
      textEl.addEventListener('input', function () {
        if (textEl.value.trim()) document.getElementById('tbAskSend').disabled = false;
      });
    }

    document.getElementById('tbAskSend').addEventListener('click', async function () {
      var btn = this, status = document.getElementById('tbAskStatus');
      var emailEl = document.getElementById('tbAskEmail');
      var email = emailEl ? (emailEl.value || '').trim() : '';
      var wish = textEl ? textEl.value.trim() : '';
      btn.disabled = true;
      status.textContent = '送出中…';

      var fd = new FormData();
      fd.append('_subject', 'Toolbook 工具回饋 · ' + toolName);
      fd.append('submission_type', '工具完成後回饋');
      fd.append('tool_name', toolId);
      fd.append('tool_label', toolName);
      QUESTIONS.forEach(function (q) { fd.append(q.name, picked[q.name] || ''); });
      if (wish) fd.append('requested_tool', wish);
      if (email) fd.append('email', email);
      fd.append('submitted_at', new Date().toISOString());

      try {
        var r = await fetch(FORM_ENDPOINT, {
          method: 'POST', headers: { Accept: 'application/json' }, body: fd
        });
        if (!r.ok) throw new Error('bad status');
        box.classList.add('done');
        box.innerHTML = '<h4>收到了，謝謝</h4>' +
          '<div class="tb-ask-sub">你是第一批告訴我這件事的人。之後有新工具，' +
          (email ? '我會用你留的 Email 通知你。' : '可以在首頁留 Email。') + '</div>';
        track('tool_feedback', {
          tool_name: toolId,
          helped: picked.helped || '(not set)',
          as_app: picked.as_app || '(not set)',
          would_pay: picked.would_pay || '(not set)',
          has_request: wish ? 'yes' : 'no'
        });
        if (email) track('sign_up', { method: 'tool_feedback' });
      } catch (_) {
        btn.disabled = false;
        status.textContent = '沒送出去，稍後再試一次。';
      }
    });
  }

  /* ---------- 4c. 完成畫面的出口 ---------- */

  /* 為什麼要有這一段：十個工具的完成畫面只連得到別的工具，一條回文章或工具地圖的
     路都沒有。使用者的原話是「用完很久以後忘記了工具的作用，但是再看文章會有時間
     成本」——回去的路本來就不存在，不是他沒找到。

     對應關係只宣告在 MAPS／ARTICLES 的 tools 欄，這裡算反向對應。 */

  function sourcesFor(toolId) {
    function has(x) { return (x.tools || []).indexOf(toolId) > -1; }
    return { maps: MAPS.filter(has), articles: ARTICLES.filter(has) };
  }

  var EXIT_CSS = [
    /* 刻意不給邊框與底色：調查框已經是一個框，再來一個框會變成兩塊互相搶的東西。
       這一塊是收尾，用一條分隔線就夠。 */
    '.tb-exit{border-top:1px solid var(--line,#d6cdba);margin-top:26px;padding-top:20px;font-family:-apple-system,"PingFang TC",sans-serif}',
    '.tb-exit h4{font-family:var(--serif,serif);font-size:16.5px;font-weight:600;margin:0 0 5px;color:var(--ink,#2c2820)}',
    '.tb-exit-sub{font-size:12.5px;color:var(--muted,#938b78);line-height:1.8;margin-bottom:10px}',
    '.tb-exit-k{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--muted,#938b78);margin:16px 0 2px}',
    '.tb-exit-a{display:flex;align-items:baseline;gap:10px;text-decoration:none;color:var(--ink,#2c2820);padding:11px 2px;border-bottom:1px solid var(--line,#d6cdba);font-size:14.5px;line-height:1.6}',
    '.tb-exit-a .tb-exit-t{flex:1}',
    '.tb-exit-a .tb-exit-m{font-size:10.5px;color:var(--accent,#8a6f44);flex:none;letter-spacing:.5px}',
    '.tb-exit-a:hover .tb-exit-t{color:var(--accent,#8a6f44)}'
  ].join('');

  function exitLink(file, label, meta, type) {
    return '<a class="tb-exit-a" href="' + esc(file) + '"' +
      ' data-tb-exit="' + esc(type) + '" data-tb-file="' + esc(file) + '">' +
      '<span class="tb-exit-t">' + esc(label) + '</span>' +
      '<span class="tb-exit-m">' + esc(meta) + '</span></a>';
  }

  function mountExits(host, toolId) {
    if (!host || document.getElementById('tbExit')) return;
    var src = sourcesFor(toolId);
    if (!src.maps.length && !src.articles.length) return;

    injectStyle('tb-exit-css', EXIT_CSS);

    var rows = '';
    if (src.maps.length) {
      rows += '<div class="tb-exit-k">出自</div>' + src.maps.map(function (m) {
        return exitLink(m.file, m.name, '工具地圖', 'book_map');
      }).join('');
    }
    if (src.articles.length) {
      rows += '<div class="tb-exit-k">寫過的</div>' + src.articles.map(function (a) {
        return exitLink(a.file, a.name, '文章', 'article');
      }).join('');
    }

    var box = document.createElement('div');
    box.className = 'tb-exit';
    box.id = 'tbExit';
    box.innerHTML = '<h4>這張卡是從哪裡來的</h4>' +
      '<div class="tb-exit-sub">隔一段時間回來、忘了它要解決什麼的時候，' +
      '從這裡看比把整篇重讀一遍快。</div>' + rows;
    host.appendChild(box);

    // 事件沿用站上既有的 select_content ＋ content_type／item_id 慣例，
    // 沒有新參數，所以不需要再去 GA4 後台開維度。
    box.addEventListener('click', function (e) {
      var a = e.target.closest('[data-tb-exit]');
      if (!a) return;
      track('select_content', {
        content_type: a.getAttribute('data-tb-exit'),
        item_id: a.getAttribute('data-tb-file'),
        tool_name: toolId
      });
    });
  }

  /* ---------- 對外 ---------- */

  global.Toolbook = {
    TOOLS: TOOLS,
    MAPS: MAPS,
    ARTICLES: ARTICLES,
    usage: usage,
    allUsage: allUsage,
    fmtDate: fmtDate,
    oneLine: oneLine,
    esc: esc,
    sourcesFor: sourcesFor,
    exportAll: exportAll,
    importAll: importAll,
    readFile: readFile,
    mountDirectory: mountDirectory,
    mountFeedback: mountFeedback,
    mountExits: mountExits,
    openDirectory: openDirectory
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountDirectory);
  } else {
    mountDirectory();
  }
})(window);
