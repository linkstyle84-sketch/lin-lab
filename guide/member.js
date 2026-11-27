(function () {
  var SESSION_KEY = 'dg-member-session';
  var CHARACTER_KEY = 'dg-character';
  var DPS_KEY = 'lin-dps-html-v2';
  var KEEP_LOGIN_KEY = 'dg-keep-login';
  var AUTH_INTENT_KEY = 'dg-auth-intent';
  var client = null;

  function config() {
    return window.MEMBER_CONFIG || {};
  }

  function connected() {
    var cfg = config();
    var key = String(cfg.supabaseAnonKey || '');
    return !!(cfg.supabaseUrl && key && key.indexOf('PASTE_') !== 0 && window.supabase);
  }

  function sb() {
    if (!connected()) throw new Error('Supabase 설정(URL/anon 키)을 확인해 주세요.');
    if (!client) {
      var cfg = config();
      client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    }
    return client;
  }

  function getKeepLogin() {
    try {
      var v = localStorage.getItem(KEEP_LOGIN_KEY);
      if (v === null || v === undefined || v === '') return true;
      return v !== '0';
    } catch (e) {
      return true;
    }
  }

  function setKeepLogin(on) {
    try {
      localStorage.setItem(KEEP_LOGIN_KEY, on ? '1' : '0');
    } catch (e) {}
  }

  function authStore() {
    return getKeepLogin() ? localStorage : sessionStorage;
  }

  function readJsonStore(store, key) {
    try {
      var raw = store.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function getSession() {
    var data = readJsonStore(authStore(), SESSION_KEY);
    if ((!data || !data.email) && authStore() !== localStorage) {
      data = readJsonStore(localStorage, SESSION_KEY);
    }
    if ((!data || !data.email) && authStore() !== sessionStorage) {
      data = readJsonStore(sessionStorage, SESSION_KEY);
    }
    if (!data || !data.email) return null;
    return data;
  }

  function setSession(member) {
    var email = String((member && member.email) || '').trim().toLowerCase();
    if (!email) return;
    var payload = JSON.stringify({
      email: email,
      name: String((member && member.name) || '').slice(0, 80),
      id: member && member.id ? member.id : '',
      at: Date.now()
    });
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e2) {}
    try { authStore().setItem(SESSION_KEY, payload); } catch (e3) {}
  }

  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e2) {}
    try { localStorage.removeItem(AUTH_INTENT_KEY); } catch (e3) {}
    try { sessionStorage.removeItem(AUTH_INTENT_KEY); } catch (e4) {}
    if (connected()) {
      try { sb().auth.signOut(); } catch (e5) {}
    }
  }

  function getIdToken() {
    return '';
  }
  function setIdToken() {}
  function clearIdToken() {}

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
      name: '', cls: '요정', level: 1, exp: 0, hp: 14, hpMax: 14, mp: 2, mpMax: 2,
      ac: 10, weight: 4, food: 7, str: 11, dex: 12, con: 12, int: 12, wis: 12, cha: 9,
      magicLevel: 0, magicBonus: 0, resistEarth: 0, resistWater: 0, resistFire: 0, resistWind: 0,
      alignment: '뉴트럴', er: 0, weaponEnchant: 0,
      elixir: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      buffs: {},
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
      arrow: 'mithril', elfRanged: null, elfStatMode: 'dex', extraDmg: 0, extraDr: 0,
      buffs: {}, buffsElf: null, buffsKnight: null, buffsElfMelee: null,
      rows: [], rowsElf: null, rowsKnight: null, selectedElf: null, selectedKnight: null,
      seq: 1, sortKey: null, sortDir: null, selectedId: null, materials: {}
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
    if (s.buffs && typeof s.buffs === 'object') {
      out.buffs = Object.assign({}, s.buffs);
      if (cls === '기사') out.buffsKnight = Object.assign({}, s.buffs);
      else out.buffsElf = Object.assign({}, s.buffs);
      var list = (typeof window !== 'undefined' && window.DBBUFFS) ? window.DBBUFFS : [];
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        if (!out.buffs[b.id]) continue;
        var addStr = Number(b.str);
        var addDex = Number(b.dex);
        if (Number.isFinite(addStr) && addStr > 0) {
          out.str += addStr;
          out.knightStat += addStr;
          if (cls === '기사') out.stat += addStr;
        }
        if (Number.isFinite(addDex) && addDex > 0) {
          out.dex += addDex;
          if (cls !== '기사') out.stat += addDex;
        }
      }
    }
    out.dollBonus = (function () {
      var raw = s.gear && s.gear.doll;
      if (!raw) return null;
      var id = typeof raw === 'string' ? raw : raw.id;
      if (!id) return null;
      var dolls = (typeof window !== 'undefined' && window.DBDOLLS) ? window.DBDOLLS : [];
      for (var di = 0; di < dolls.length; di++) {
        if (dolls[di].id === id) {
          var d = dolls[di];
          return {
            dmg: Number(d.dmg) || 0,
            acc: Number(d.acc) || 0,
            meleeDmg: Number(d.meleeDmg) || 0,
            meleeAcc: Number(d.meleeAcc) || 0,
            rangedDmg: Number(d.rangedDmg) || 0,
            rangedAcc: Number(d.rangedAcc) || 0,
            sp: Number(d.sp) || 0
          };
        }
      }
      return null;
    })();
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
      sheet: source.sheet || null, cls: source.cls, level: source.level, stat: source.stat,
      ac: source.ac, er: source.er, arrow: source.arrow, elfRanged: source.elfRanged,
      elfStatMode: source.elfStatMode, dex: source.dex, str: source.str, knightStat: source.knightStat,
      extraDmg: source.extraDmg, extraDr: source.extraDr, buffs: source.buffs,
      buffsElf: source.buffsElf, buffsKnight: source.buffsKnight, buffsElfMelee: source.buffsElfMelee,
      rows: source.rows, rowsElf: source.rowsElf, rowsKnight: source.rowsKnight,
      selectedElf: source.selectedElf, selectedKnight: source.selectedKnight,
      seq: source.seq, sortKey: source.sortKey, sortDir: source.sortDir,
      selectedId: source.selectedId, materials: source.materials || {},
      dollBonus: source.dollBonus || null
    };
  }

  function userMeta(user) {
    var meta = (user && user.user_metadata) || {};
    return {
      id: user.id,
      email: String(user.email || '').toLowerCase(),
      name: String(meta.full_name || meta.name || user.email || '').slice(0, 80),
      sub: String(meta.sub || meta.provider_id || user.id || '')
    };
  }

  function upsertMember(user, opts) {
    var info = userMeta(user);
    var row = {
      email: info.email,
      name: info.name,
      google_sub: info.sub,
      last_seen: new Date().toISOString()
    };
    if (opts && opts.age14) row.age14 = true;
    return sb().from('members').upsert(row, { onConflict: 'email' }).select().maybeSingle()
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return {
          email: info.email,
          name: (res.data && res.data.name) || info.name,
          id: info.id,
          joined_at: res.data && res.data.joined_at
        };
      });
  }

  function requireUser() {
    return sb().auth.getUser().then(function (res) {
      if (res.error) throw new Error(res.error.message);
      if (!res.data || !res.data.user) throw new Error('로그인이 필요합니다.');
      return res.data.user;
    });
  }

  function startGoogleAuth(mode, extra) {
    if (!connected()) return Promise.reject(new Error('Supabase 키 설정을 먼저 완료해 주세요.'));
    var intent = { mode: mode || 'login', at: Date.now() };
    if (extra && extra.age14) intent.age14 = true;
    try { sessionStorage.setItem(AUTH_INTENT_KEY, JSON.stringify(intent)); } catch (e) {}
    var redirectTo = location.origin + '/guide/join.html';
    return sb().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo,
        queryParams: { prompt: 'select_account' }
      }
    }).then(function (res) {
      if (res.error) throw new Error(res.error.message);
      if (res.data && res.data.url) {
        location.assign(res.data.url);
      }
      return res;
    });
  }

  function memberFromUser(user) {
    var info = userMeta(user);
    return { email: info.email, name: info.name, id: info.id };
  }

  function finishAuthFromRedirect() {
    if (!connected()) return Promise.resolve(null);
    return sb().auth.getSession().then(function (res) {
      if (res.error) throw new Error(res.error.message);
      var session = res.data && res.data.session;
      if (!session || !session.user) return null;
      var intent = null;
      try { intent = JSON.parse(sessionStorage.getItem(AUTH_INTENT_KEY) || 'null'); } catch (e) {}
      var hadIntent = !!intent;
      try { sessionStorage.removeItem(AUTH_INTENT_KEY); } catch (e2) {}
      var age14 = !!(intent && intent.age14);
      var fallback = memberFromUser(session.user);
      return upsertMember(session.user, { age14: age14 }).then(function (member) {
        setSession(member);
        return { member: member, intent: hadIntent ? intent : null };
      }).catch(function (err) {
        /* members 권한/RLS 실패해도 Auth 세션이 있으면 로그인 유지 */
        setSession(fallback);
        console.warn('[DgMember] members upsert failed:', err && err.message);
        return { member: fallback, intent: hadIntent ? intent : null, warn: err && err.message };
      });
    });
  }

  function boardList(board) {
    return sb().from('posts')
      .select('id,board,title,author_name,author_email,created_at,updated_at,images')
      .eq('board', board)
      .order('created_at', { ascending: false })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        var posts = (res.data || []).map(function (row) {
          var images = row.images;
          if (typeof images === 'string') {
            try { images = JSON.parse(images); } catch (e) { images = []; }
          }
          if (!Array.isArray(images)) images = [];
          return {
            id: row.id,
            board: row.board,
            title: row.title,
            author_name: row.author_name || '회원',
            author_email: row.author_email || '',
            created_at: row.created_at,
            updated_at: row.updated_at,
            has_image: images.length > 0
          };
        });
        return { ok: true, board: board, posts: posts };
      });
  }

  function boardGet(id) {
    return sb().from('posts').select('*').eq('id', id).maybeSingle().then(function (res) {
      if (res.error) throw new Error(res.error.message);
      if (!res.data) throw new Error('글을 찾을 수 없습니다.');
      var row = res.data;
      var images = row.images;
      if (typeof images === 'string') {
        try { images = JSON.parse(images); } catch (e) { images = []; }
      }
      if (!Array.isArray(images)) images = [];
      return {
        ok: true,
        post: {
          id: row.id,
          board: row.board,
          title: row.title,
          body: row.body,
          images: images,
          author_name: row.author_name || '회원',
          author_email: row.author_email || '',
          author_sub: row.author_sub || '',
          created_at: row.created_at,
          updated_at: row.updated_at,
          has_image: images.length > 0
        }
      };
    });
  }

  function boardCreate(payload) {
    return requireUser().then(function (user) {
      var info = userMeta(user);
      var title = String(payload.title || '').trim().slice(0, 80);
      var body = String(payload.body || '').trim().slice(0, 8000);
      var images = Array.isArray(payload.images) ? payload.images.slice(0, 3) : [];
      if (!title) throw new Error('제목을 입력해 주세요.');
      if (!body) throw new Error('내용을 입력해 주세요.');
      return sb().from('posts').insert({
        board: payload.board,
        title: title,
        body: body,
        images: images,
        author_id: info.id,
        author_email: info.email,
        author_name: info.name,
        author_sub: info.sub
      }).select().single().then(function (res) {
        if (res.error) throw new Error(res.error.message);
        var row = res.data;
        return {
          ok: true,
          post: {
            id: row.id,
            board: row.board,
            title: row.title,
            body: row.body,
            images: images,
            author_name: row.author_name,
            author_email: row.author_email,
            author_sub: row.author_sub,
            created_at: row.created_at,
            updated_at: row.updated_at,
            has_image: images.length > 0
          }
        };
      });
    });
  }

  function boardUpdate(payload) {
    return requireUser().then(function (user) {
      var title = String(payload.title || '').trim().slice(0, 80);
      var body = String(payload.body || '').trim().slice(0, 8000);
      var images = Array.isArray(payload.images) ? payload.images.slice(0, 3) : [];
      if (!title) throw new Error('제목을 입력해 주세요.');
      if (!body) throw new Error('내용을 입력해 주세요.');
      return sb().from('posts').update({
        title: title,
        body: body,
        images: images,
        updated_at: new Date().toISOString()
      }).eq('id', payload.id).eq('author_id', user.id).select().maybeSingle()
        .then(function (res) {
          if (res.error) throw new Error(res.error.message);
          if (!res.data) throw new Error('본인 글만 수정할 수 있습니다.');
          var row = res.data;
          return {
            ok: true,
            post: {
              id: row.id,
              board: row.board,
              title: row.title,
              body: row.body,
              images: images,
              author_name: row.author_name,
              author_email: row.author_email,
              author_sub: row.author_sub,
              created_at: row.created_at,
              updated_at: row.updated_at,
              has_image: images.length > 0
            }
          };
        });
    });
  }

  function boardDelete(payload) {
    return requireUser().then(function (user) {
      return sb().from('posts').delete().eq('id', payload.id).eq('author_id', user.id)
        .then(function (res) {
          if (res.error) throw new Error(res.error.message);
          return { ok: true };
        });
    });
  }

  function commentList(postId) {
    return sb().from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return {
          ok: true,
          post_id: postId,
          comments: (res.data || []).map(function (row) {
            return {
              id: row.id,
              post_id: row.post_id,
              board: row.board,
              body: row.body,
              author_name: row.author_name || '회원',
              author_email: row.author_email || '',
              author_sub: row.author_sub || '',
              created_at: row.created_at
            };
          })
        };
      });
  }

  function commentCreate(payload) {
    return requireUser().then(function (user) {
      var info = userMeta(user);
      var body = String(payload.body || '').trim().slice(0, 1000);
      if (!body) throw new Error('댓글 내용을 입력해 주세요.');
      return sb().from('posts').select('id,board').eq('id', payload.post_id).maybeSingle()
        .then(function (postRes) {
          if (postRes.error) throw new Error(postRes.error.message);
          if (!postRes.data) throw new Error('글을 찾을 수 없습니다.');
          return sb().from('comments').insert({
            post_id: payload.post_id,
            board: postRes.data.board,
            body: body,
            author_id: info.id,
            author_email: info.email,
            author_name: info.name,
            author_sub: info.sub
          }).select().single();
        }).then(function (res) {
          if (res.error) throw new Error(res.error.message);
          var row = res.data;
          return {
            ok: true,
            comment: {
              id: row.id,
              post_id: row.post_id,
              board: row.board,
              body: row.body,
              author_name: row.author_name,
              author_email: row.author_email,
              author_sub: row.author_sub,
              created_at: row.created_at
            }
          };
        });
    });
  }

  function commentDelete(payload) {
    return requireUser().then(function (user) {
      return sb().from('comments').delete().eq('id', payload.id).eq('author_id', user.id)
        .then(function (res) {
          if (res.error) throw new Error(res.error.message);
          return { ok: true };
        });
    });
  }

  function characterSave(payload) {
    return requireUser().then(function (user) {
      var info = userMeta(user);
      var data = payload.character;
      if (!data || typeof data !== 'object') throw new Error('캐릭터 데이터가 없습니다.');
      var now = new Date().toISOString();
      return sb().from('characters').upsert({
        user_id: info.id,
        email: info.email,
        data: data,
        updated_at: now
      }, { onConflict: 'email' }).select().maybeSingle().then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return { ok: true, updated_at: now, character: data };
      });
    });
  }

  function characterLoad() {
    return requireUser().then(function (user) {
      return sb().from('characters').select('data,updated_at').eq('email', user.email).maybeSingle()
        .then(function (res) {
          if (res.error) throw new Error(res.error.message);
          if (!res.data) return { ok: true, character: null, updated_at: '' };
          return { ok: true, character: res.data.data, updated_at: res.data.updated_at };
        });
    });
  }

  function characterClear() {
    return requireUser().then(function (user) {
      return sb().from('characters').delete().eq('email', user.email).then(function (res) {
        if (res.error) throw new Error(res.error.message);
        return { ok: true };
      });
    });
  }

  function listMembers() {
    return requireUser().then(function (user) {
      if (String(user.email || '').toLowerCase() !== 'linkstyle84@gmail.com') {
        throw new Error('관리자만 볼 수 있습니다.');
      }
      return sb().from('members')
        .select('google_sub,email,name,age14,joined_at,last_seen')
        .order('joined_at', { ascending: false })
        .then(function (res) {
          if (res.error) throw new Error(res.error.message);
          return {
            ok: true,
            members: (res.data || []).map(function (r) {
              return {
                sub: r.google_sub || r.email,
                email: r.email,
                name: r.name,
                age14: r.age14 ? '예' : '',
                joined_at: r.joined_at,
                last_seen: r.last_seen
              };
            })
          };
        });
    });
  }

  function removeMember(payload) {
    return requireUser().then(function (user) {
      if (String(user.email || '').toLowerCase() !== 'linkstyle84@gmail.com') {
        throw new Error('관리자만 볼 수 있습니다.');
      }
      var key = String(payload.sub || payload.email || '');
      return sb().from('members').delete().or('google_sub.eq.' + key + ',email.eq.' + key)
        .then(function (res) {
          if (res.error) throw new Error(res.error.message);
          return { ok: true };
        });
    });
  }

  function leave() {
    return requireUser().then(function (user) {
      return sb().from('characters').delete().eq('user_id', user.id).then(function () {
        return sb().from('members').delete().eq('email', user.email);
      }).then(function (res) {
        /* members 본인 삭제 정책이 없으면 로컬만 정리 */
        if (res.error && !/policy|permission|RLS/i.test(res.error.message || '')) {
          throw new Error(res.error.message);
        }
        clearSession();
        clearCharacterCache();
        return { ok: true };
      });
    });
  }

  function call(payload) {
    var action = payload && payload.action;
    if (action === 'join' || action === 'login') {
      return startGoogleAuth(action === 'join' ? 'join' : 'login', { age14: !!payload.age14 })
        .then(function () { return { ok: true, redirect: true }; });
    }
    if (action === 'leave') return leave();
    if (action === 'list') return listMembers();
    if (action === 'remove') return removeMember(payload);
    if (action === 'character_save') return characterSave(payload);
    if (action === 'character_load') return characterLoad();
    if (action === 'character_clear') return characterClear();
    if (action === 'board_list') return boardList(payload.board);
    if (action === 'board_get') return boardGet(payload.id);
    if (action === 'board_create') return boardCreate(payload);
    if (action === 'board_update') return boardUpdate(payload);
    if (action === 'board_delete') return boardDelete(payload);
    if (action === 'comment_list') return commentList(payload.post_id || payload.id);
    if (action === 'comment_create') return commentCreate(payload);
    if (action === 'comment_delete') return commentDelete(payload);
    return Promise.reject(new Error('알 수 없는 요청입니다.'));
  }

  function callJsonp(params) {
    var action = params && params.action;
    if (action === 'board_list') return boardList(params.board);
    if (action === 'board_get') return boardGet(params.id);
    if (action === 'comment_list') return commentList(params.post_id || params.id);
    return Promise.reject(new Error('지원하지 않는 공개 요청입니다.'));
  }

  function prefetchBoardList(board) {
    return boardList(board).then(function (data) {
      try {
        localStorage.setItem('dg-board-list:' + board, JSON.stringify({
          at: Date.now(),
          posts: data.posts || []
        }));
      } catch (e) {}
      return data;
    });
  }

  function renderGoogle(el, callback, options) {
    var textKey = (options && options.text) || 'signin_with';
    var label = textKey === 'signup_with' ? 'Google 계정으로 가입하기' : 'Google 계정으로 로그인';
    var width = (options && options.width) || 320;
    el.innerHTML = '';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.cssText = 'width:' + width + 'px;max-width:100%;height:44px;border:1px solid #dadce0;border-radius:4px;background:#fff;color:#3c4043;font:700 14px/1 "Noto Sans KR",sans-serif;cursor:pointer;';
    btn.addEventListener('click', function () {
      var mode = textKey === 'signup_with' ? 'join' : 'login';
      startGoogleAuth(mode, { age14: mode === 'join' }).catch(function (err) {
        if (callback) callback(null, err);
        else alert(err.message);
      });
    });
    el.appendChild(btn);
  }

  function isDpsHref(href) {
    if (!href) return false;
    try {
      var u = new URL(href, location.href);
      return /\/dps\/?$/.test(u.pathname);
    } catch (e) {
      return href === '/dps/' || href === '/dps';
    }
  }

  function ensureLoginPrompt() {
    var el = document.getElementById('dg-login-need');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'dg-login-need';
    el.hidden = true;
    el.setAttribute('style', 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.72);');
    el.innerHTML =
      '<div role="dialog" aria-modal="true" style="width:min(420px,100%);padding:26px 22px 22px;border:1px solid rgba(228,195,106,.35);border-radius:14px;background:#16120c;color:#e4c36a;text-align:center;">' +
      '<h2 style="margin:0 0 10px;font:900 22px/1.25 \'Noto Sans KR\',sans-serif;letter-spacing:-.03em;">회원 전용 기능입니다</h2>' +
      '<p style="margin:0 0 18px;color:#cbb994;font:700 14px/1.65 \'Noto Sans KR\',sans-serif;">무기 DPS 측정기는 가입 회원만 이용할 수 있습니다.<br>지금 가입하시면 바로 사용할 수 있어요.</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">' +
      '<a href="/guide/join.html#join" style="display:inline-block;border:2px solid #e4c36a;border-radius:12px;padding:10px 16px;background:rgba(228,195,106,.14);color:#e4c36a;font:900 14px/1 \'Noto Sans KR\',sans-serif;text-decoration:none;">회원가입</a>' +
      '<a href="/guide/join.html#login" style="display:inline-block;border:2px solid #8a7340;border-radius:12px;padding:10px 16px;background:transparent;color:#e8d9a8;font:900 14px/1 \'Noto Sans KR\',sans-serif;text-decoration:none;">로그인</a>' +
      '<a href="#" data-close="1" style="display:inline-block;border:2px solid #8a7340;border-radius:12px;padding:10px 16px;background:transparent;color:#e8d9a8;font:900 14px/1 \'Noto Sans KR\',sans-serif;text-decoration:none;">닫기</a>' +
      '</div></div>';
    el.addEventListener('click', function (e) {
      if (e.target === el || (e.target && e.target.getAttribute('data-close') === '1')) {
        e.preventDefault();
        el.hidden = true;
        el.style.display = 'none';
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        el.hidden = true;
        el.style.display = 'none';
      }
    });
    document.body.appendChild(el);
    return el;
  }

  function showLoginPrompt() {
    var el = ensureLoginPrompt();
    el.hidden = false;
    el.style.display = 'flex';
  }

  function installDpsClickGate() {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      if (!isDpsHref(a.getAttribute('href') || a.href)) return;
      if (a.id === 'dps-tool-link') return; /* 홈은 전용 팝업 사용 */
      var s = getSession();
      if (s && s.email) return;
      e.preventDefault();
      e.stopPropagation();
      showLoginPrompt();
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installDpsClickGate);
  } else {
    installDpsClickGate();
  }

  window.DgMember = {
    connected: connected,
    call: call,
    callJsonp: callJsonp,
    prefetchBoardList: prefetchBoardList,
    renderGoogle: renderGoogle,
    startGoogleAuth: startGoogleAuth,
    finishAuthFromRedirect: finishAuthFromRedirect,
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
    getKeepLogin: getKeepLogin,
    setKeepLogin: setKeepLogin,
    getIdToken: getIdToken,
    setIdToken: setIdToken,
    clearIdToken: clearIdToken,
    getCharacterCache: getCharacterCache,
    setCharacterCache: setCharacterCache,
    clearCharacterCache: clearCharacterCache,
    readDpsLocal: readDpsLocal,
    writeDpsLocal: writeDpsLocal,
    characterSnapshot: characterSnapshot,
    defaultSheet: defaultSheet,
    dpsFromSheet: dpsFromSheet,
    mapClsForDps: mapClsForDps,
    sb: function () { return connected() ? sb() : null; }
  };
})();
