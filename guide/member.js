(function () {
  var SESSION_KEY = 'dg-member-session';
  var CHARACTER_KEY = 'dg-character';
  var DPS_KEY = 'lin-dps-html-v2';

  function config() {
    return window.MEMBER_CONFIG || {};
  }

  function connected() {
    var cfg = config();
    return !!(cfg.clientId && cfg.scriptUrl);
  }

  function getSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.email) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function setSession(member) {
    var email = String((member && member.email) || '').trim().toLowerCase();
    if (!email) return;
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      email: email,
      name: String((member && member.name) || '').slice(0, 80),
      at: Date.now()
    }));
  }

  function clearSession() {
    var prev = getSession();
    localStorage.removeItem(SESSION_KEY);
    try {
      if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
        if (prev && prev.email) {
          google.accounts.id.revoke(prev.email, function () {});
        }
      }
    } catch (e) {}
  }

  function getCharacterCache() {
    try {
      var raw = localStorage.getItem(CHARACTER_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !data.data) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function setCharacterCache(memberEmail, character, updatedAt) {
    if (!character || typeof character !== 'object') return;
    localStorage.setItem(CHARACTER_KEY, JSON.stringify({
      email: String(memberEmail || '').trim().toLowerCase(),
      updatedAt: updatedAt || new Date().toISOString(),
      data: character
    }));
  }

  function clearCharacterCache() {
    localStorage.removeItem(CHARACTER_KEY);
  }

  function readDpsLocal() {
    try {
      var raw = localStorage.getItem(DPS_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.rows)) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  function writeDpsLocal(character) {
    if (!character || !Array.isArray(character.rows)) return false;
    localStorage.setItem(DPS_KEY, JSON.stringify(character));
    return true;
  }

  function mapClsForDps(cls) {
    if (cls === '기사' || cls === '군주') return '기사';
    return '요정';
  }

  function defaultSheet() {
    return {
      name: '',
      cls: '요정',
      level: 1,
      exp: 0,
      hp: 14,
      hpMax: 14,
      mp: 2,
      mpMax: 2,
      ac: 10,
      weight: 4,
      food: 100,
      str: 13,
      dex: 10,
      con: 10,
      int: 10,
      wis: 11,
      cha: 13,
      magicLevel: 0,
      magicBonus: 0,
      resistEarth: 0,
      resistWater: 0,
      resistFire: 0,
      resistWind: 0,
      alignment: '뉴트럴',
      er: 0,
      weaponEnchant: 0,
      gear: {
        helmet: '', necklace: '', shirt: '', armor: '', cloak: '',
        ring1: '', gloves: '', belt: '', shield: '', weapon: '',
        ring2: '', doll: '', boots: ''
      }
    };
  }

  function dpsFromSheet(sheet, base) {
    var s = sheet || defaultSheet();
    var out = characterSnapshot(base || readDpsLocal() || {}) || {
      arrow: 'mithril',
      elfRanged: null,
      elfStatMode: 'dex',
      extraDmg: 0,
      extraDr: 0,
      buffs: {},
      buffsElf: null,
      buffsKnight: null,
      buffsElfMelee: null,
      rows: [],
      rowsElf: null,
      rowsKnight: null,
      selectedElf: null,
      selectedKnight: null,
      seq: 1,
      sortKey: null,
      sortDir: null,
      selectedId: null,
      materials: {}
    };
    var cls = mapClsForDps(s.cls);
    var weaponRaw = s.gear && s.gear.weapon;
    var weaponName = !weaponRaw ? '' : (typeof weaponRaw === 'string' ? weaponRaw : (weaponRaw.name || weaponRaw.n || ''));
    var enchant = Number(s.weaponEnchant) || 0;
    if (!enchant && weaponRaw && typeof weaponRaw === 'object') enchant = Number(weaponRaw.enchant) || 0;
    out.sheet = s;
    out.cls = cls;
    out.level = Number(s.level) || 1;
    out.ac = Number(s.ac);
    if (!Number.isFinite(out.ac)) out.ac = 10;
    out.er = Number(s.er) || 0;
    out.str = Number(s.str) || 10;
    out.dex = Number(s.dex) || 10;
    out.knightStat = out.str;
    out.stat = cls === '기사' ? out.str : out.dex;
    out.elfStatMode = 'dex';
    if (weaponName) {
      var rows = Array.isArray(out.rows) ? out.rows.slice() : [];
      var found = rows.find(function (row) { return row && row.name === weaponName; });
      if (found) {
        found.enchant = enchant;
        out.selectedId = found.id;
      } else {
        var id = (out.seq || 1) + 1;
        out.seq = id;
        rows.unshift({ id: id, name: weaponName, enchant: enchant, transform: '' });
        out.selectedId = id;
      }
      out.rows = rows;
      if (cls === '기사') {
        out.rowsKnight = rows;
        out.selectedKnight = out.selectedId;
      } else {
        out.rowsElf = rows;
        out.selectedElf = out.selectedId;
      }
    }
    return out;
  }

  function characterSnapshot(source) {
    if (!source || typeof source !== 'object') return null;
    return {
      sheet: source.sheet || null,
      cls: source.cls,
      level: source.level,
      stat: source.stat,
      ac: source.ac,
      er: source.er,
      arrow: source.arrow,
      elfRanged: source.elfRanged,
      elfStatMode: source.elfStatMode,
      dex: source.dex,
      str: source.str,
      knightStat: source.knightStat,
      extraDmg: source.extraDmg,
      extraDr: source.extraDr,
      buffs: source.buffs,
      buffsElf: source.buffsElf,
      buffsKnight: source.buffsKnight,
      buffsElfMelee: source.buffsElfMelee,
      rows: source.rows,
      rowsElf: source.rowsElf,
      rowsKnight: source.rowsKnight,
      selectedElf: source.selectedElf,
      selectedKnight: source.selectedKnight,
      seq: source.seq,
      sortKey: source.sortKey,
      sortDir: source.sortDir,
      selectedId: source.selectedId,
      materials: source.materials || {}
    };
  }

  function call(payload) {
    var cfg = config();
    if (!connected()) return Promise.reject(new Error('회원 저장 서버가 아직 연결되지 않았습니다.'));
    return new Promise(function (resolve, reject) {
      var name = 'dg-member-' + Date.now();
      var iframe = document.createElement('iframe');
      iframe.name = name;
      iframe.hidden = true;
      iframe.setAttribute('aria-hidden', 'true');
      var form = document.createElement('form');
      form.method = 'POST';
      form.action = cfg.scriptUrl;
      form.target = name;
      form.acceptCharset = 'UTF-8';
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'payload';
      input.value = JSON.stringify(payload);
      form.appendChild(input);
      var done = false;
      function finish(err, data) {
        if (done) return;
        done = true;
        window.removeEventListener('message', onMessage);
        window.clearTimeout(timer);
        if (form.parentNode) form.parentNode.removeChild(form);
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        if (err) reject(err);
        else resolve(data);
      }
      function onMessage(event) {
        var data = event.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (e) { return; }
        }
        if (!data || data.source !== 'dg-member') return;
        if (data.ok) finish(null, data);
        else finish(new Error(data.error || '처리하지 못했습니다.'));
      }
      var timer = window.setTimeout(function () {
        finish(new Error('저장 서버에 연결하지 못했습니다. 잠시 뒤에 다시 눌러 주세요.'));
      }, 25000);
      window.addEventListener('message', onMessage);
      document.body.appendChild(iframe);
      document.body.appendChild(form);
      form.submit();
    });
  }

  var googleReady = false;
  var googleHandler = null;

  function renderGoogle(el, callback, options) {
    var cfg = config();
    if (!window.google || !google.accounts || !google.accounts.id) {
      throw new Error('구글 로그인 버튼을 불러오지 못했습니다.');
    }
    googleHandler = callback;
    if (!googleReady) {
      google.accounts.id.initialize({
        client_id: cfg.clientId,
        callback: function (resp) {
          if (googleHandler && resp && resp.credential) googleHandler(resp.credential);
        },
        auto_select: false,
        cancel_on_tap_outside: true,
        ux_mode: 'popup',
        context: 'signin',
        use_fedcm_for_prompt: false
      });
      googleReady = true;
    }
    try { google.accounts.id.disableAutoSelect(); } catch (e) {}

    var width = (options && options.width) || 320;
    var textKey = (options && options.text) || 'signin_with';
    var label = textKey === 'signup_with' ? 'Google 계정으로 가입하기' : 'Google 계정으로 로그인';
    el.innerHTML = '';
    el.style.position = 'relative';
    el.style.width = width + 'px';
    el.style.maxWidth = '100%';
    el.style.height = '44px';

    var face = document.createElement('div');
    face.setAttribute('aria-hidden', 'true');
    face.style.cssText = [
      'position:absolute', 'inset:0', 'display:flex', 'align-items:center', 'justify-content:center',
      'gap:10px', 'border:1px solid #dadce0', 'border-radius:4px', 'background:#fff',
      'color:#3c4043', 'font:500 14px/1 "Noto Sans KR", Arial, sans-serif',
      'box-shadow:0 1px 2px rgba(0,0,0,.08)', 'pointer-events:none', 'user-select:none'
    ].join(';');
    face.innerHTML = '<span style="width:18px;height:18px;display:inline-block;background:url(https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg) center/contain no-repeat"></span><span></span>';
    face.lastChild.textContent = label;

    var hit = document.createElement('div');
    hit.style.cssText = 'position:absolute;inset:0;opacity:0.02;overflow:hidden';
    el.appendChild(face);
    el.appendChild(hit);
    google.accounts.id.renderButton(hit, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: textKey,
      shape: 'rectangular',
      width: width,
      locale: 'ko'
    });
  }

  window.DgMember = {
    connected: connected,
    call: call,
    renderGoogle: renderGoogle,
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    getCharacterCache: getCharacterCache,
    setCharacterCache: setCharacterCache,
    clearCharacterCache: clearCharacterCache,
    readDpsLocal: readDpsLocal,
    writeDpsLocal: writeDpsLocal,
    characterSnapshot: characterSnapshot,
    defaultSheet: defaultSheet,
    dpsFromSheet: dpsFromSheet,
    mapClsForDps: mapClsForDps
  };
})();
