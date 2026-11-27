(function () {
  var ADMIN_EMAIL = 'linkstyle84@gmail.com';
  var BOARDS = {
    tips: { title: '팁 & 노하우 게시판', note: '사냥·제작·운영 팁을 공유하는 게시판입니다.' },
    lab: { title: '도건 연구일지', note: '도건의 실험·연구 기록과 연구일지를 올리는 게시판입니다.' },
    experiment: { title: '리니지 실험요청', note: '리니지 클래식 실험·검증 요청을 올리는 게시판입니다.' },
    'lab-video': { title: '도건 실험영상', note: '도건의 실험·검증 영상을 올리는 게시판입니다.' },
    'lin-video': { title: '린저씨 실험영상', note: '린저씨의 실험·검증 영상을 올리는 게시판입니다.' },
    free: { title: '자유게시판', note: '자유롭게 이야기하는 게시판입니다.' },
    ask: { title: '도건형 질문있어요!', note: '도건에게 궁금한 점을 질문하는 게시판입니다.' },
    feedback: { title: '싸이트 이용중 불편사항 접수', note: '건의·버그·오류 제보를 올리는 게시판입니다.' }
  };

  function qs(name) {
    try {
      return new URLSearchParams(location.search).get(name) || '';
    } catch (e) {
      return '';
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function youtubeId(url) {
    var m = String(url).match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
    );
    return m ? m[1] : '';
  }

  function renderBody(text) {
    var raw = String(text || '');
    var parts = [];
    var re = /(https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?[^\s]+|embed\/[^\s]+|shorts\/[^\s]+)|youtu\.be\/[^\s]+))/gi;
    var last = 0;
    var m;
    while ((m = re.exec(raw))) {
      parts.push({ type: 'text', value: raw.slice(last, m.index) });
      parts.push({ type: 'url', value: m[1] });
      last = m.index + m[1].length;
    }
    parts.push({ type: 'text', value: raw.slice(last) });
    return parts.map(function (p) {
      if (p.type === 'text') return escapeHtml(p.value).replace(/\n/g, '<br>');
      var id = youtubeId(p.value);
      if (!id) {
        return '<a href="' + escapeHtml(p.value) + '" target="_blank" rel="noopener">' + escapeHtml(p.value) + '</a>';
      }
      return '<div class="yt-embed"><iframe src="https://www.youtube-nocookie.com/embed/' + id
        + '?rel=0" title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>';
    }).join('');
  }

  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 16);
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1).padStart(2, '0');
    var da = String(d.getDate()).padStart(2, '0');
    var h = String(d.getHours()).padStart(2, '0');
    var mi = String(d.getMinutes()).padStart(2, '0');
    return y + '-' + mo + '-' + da + ' ' + h + ':' + mi;
  }

  function fmtDateShort(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso).slice(0, 10);
    var now = new Date();
    var mo = String(d.getMonth() + 1).padStart(2, '0');
    var da = String(d.getDate()).padStart(2, '0');
    if (d.getFullYear() === now.getFullYear()) return mo + '-' + da;
    return String(d.getFullYear()).slice(2) + '-' + mo + '-' + da;
  }

  function viewKey(id) {
    return 'dg-board-views:' + id;
  }

  function getViews(id) {
    try {
      return Math.max(0, parseInt(localStorage.getItem(viewKey(id)) || '0', 10) || 0);
    } catch (e) {
      return 0;
    }
  }

  function bumpViews(id) {
    var n = getViews(id) + 1;
    try { localStorage.setItem(viewKey(id), String(n)); } catch (e) {}
    return n;
  }

  function session() {
    return window.DgMember && DgMember.getSession ? DgMember.getSession() : null;
  }

  function isOwner(post) {
    var s = session();
    if (!s || !post) return false;
    if (s.email && s.email.toLowerCase() === ADMIN_EMAIL) return true;
    if (post.author_email && s.email && post.author_email.toLowerCase() === s.email.toLowerCase()) return true;
    return false;
  }

  function isCommentOwner(comment) {
    var s = session();
    if (!s || !comment) return false;
    if (s.email && s.email.toLowerCase() === ADMIN_EMAIL) return true;
    if (comment.author_email && s.email && comment.author_email.toLowerCase() === s.email.toLowerCase()) return true;
    return false;
  }

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('이미지를 읽지 못했습니다.')); };
      reader.readAsDataURL(file);
    });
  }

  function compressImage(file) {
    return readFileAsDataUrl(file).then(function (dataUrl) {
      return new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
          var max = 960;
          var w = img.width;
          var h = img.height;
          if (w > max || h > max) {
            var scale = Math.min(max / w, max / h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          var out = canvas.toDataURL('image/jpeg', 0.82);
          if (out.length > 120000) {
            out = canvas.toDataURL('image/jpeg', 0.65);
          }
          if (out.length > 120000) {
            reject(new Error('이미지가 너무 큽니다. 더 작은 사진으로 넣어 주세요.'));
            return;
          }
          resolve(out);
        };
        img.onerror = function () { reject(new Error('이미지 형식을 읽지 못했습니다.')); };
        img.src = dataUrl;
      });
    });
  }

  function boot() {
    var board = qs('b');
    var meta = BOARDS[board];
    if (!meta) {
      location.replace('./');
      return;
    }

    var titleEl = document.getElementById('board-title');
    var noteEl = document.getElementById('board-note');
    var statusEl = document.getElementById('board-status');
    var listView = document.getElementById('view-list');
    var composeView = document.getElementById('view-compose');
    var detailView = document.getElementById('view-detail');
    var listEl = document.getElementById('post-list');
    var countEl = document.getElementById('post-count');
    var googleBox = document.getElementById('google-box');
    var titleInput = document.getElementById('post-title');
    var bodyInput = document.getElementById('post-body');
    var imageList = document.getElementById('image-list');
    var fileInput = document.getElementById('image-file');
    var composeHead = document.getElementById('compose-head');
    var btnWrite = document.getElementById('btn-write');
    var btnAddImage = document.getElementById('btn-add-image');
    var btnPublish = document.getElementById('btn-publish');
    var btnDelete = document.getElementById('btn-delete');
    var btnCancel = document.getElementById('btn-cancel');
    var detailTitle = document.getElementById('detail-title');
    var detailMeta = document.getElementById('detail-meta');
    var detailBody = document.getElementById('detail-body');
    var detailImages = document.getElementById('detail-images');
    var detailActions = document.getElementById('detail-actions');
    var commentListEl = document.getElementById('comment-list');
    var commentEmptyEl = document.getElementById('comment-empty');
    var commentCountEl = document.querySelector('#comments-box .c-count');
    var commentBodyInput = document.getElementById('comment-body');
    var commentHintEl = document.getElementById('comment-hint');
    var btnComment = document.getElementById('btn-comment');
    var commentsCache = {};

    titleEl.textContent = meta.title;
    noteEl.textContent = meta.note;
    document.title = meta.title + ' · 도건 게임 연구소';

    var token = (DgMember.getIdToken && DgMember.getIdToken()) || '';
    var images = [];
    var editingId = '';
    var currentPost = null;
    var listCacheKey = 'dg-board-list:' + board;
    var postCacheKey = 'dg-board-post:';

    function say(msg) {
      statusEl.textContent = msg || '';
    }

    function show(view) {
      listView.hidden = view !== 'list';
      composeView.hidden = view !== 'compose';
      detailView.hidden = view !== 'detail';
    }

    function readListCache() {
      try {
        var raw = localStorage.getItem(listCacheKey);
        if (!raw) return null;
        var data = JSON.parse(raw);
        return data && Array.isArray(data.posts) ? data.posts : null;
      } catch (e) {
        return null;
      }
    }

    function writeListCache(posts) {
      try {
        localStorage.setItem(listCacheKey, JSON.stringify({ at: Date.now(), posts: posts || [] }));
      } catch (e) {}
    }

    function readPostCache(id) {
      try {
        var raw = localStorage.getItem(postCacheKey + id);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }

    function writePostCache(post) {
      if (!post || !post.id) return;
      try {
        localStorage.setItem(postCacheKey + post.id, JSON.stringify(post));
      } catch (e) {}
    }

    function paintImages() {
      imageList.innerHTML = '';
      images.forEach(function (src, idx) {
        var fig = document.createElement('figure');
        fig.innerHTML = '<img alt=""><button type="button">제거</button>';
        fig.querySelector('img').src = src;
        fig.querySelector('button').addEventListener('click', function () {
          images.splice(idx, 1);
          paintImages();
        });
        imageList.appendChild(fig);
      });
    }

    function ensureGoogle() {
      if (!window.DgMember || !DgMember.connected()) {
        googleBox.innerHTML = '<p class="hint">글쓰기는 회원 로그인이 필요합니다. <a href="join.html#login">로그인</a></p>';
        return;
      }
      var s = session();
      if (!s) {
        googleBox.innerHTML = '<p class="hint">글을 올리려면 <a href="join.html#login">로그인</a>이 필요합니다.</p>';
        return;
      }
      token = 'session';
      googleBox.innerHTML = '<p class="hint">작성자: <b></b> · 로그인된 계정으로 바로 게시할 수 있습니다.</p>';
      googleBox.querySelector('b').textContent = s.name || s.email;
    }

    function openCompose(post) {
      editingId = post && post.id ? post.id : '';
      titleInput.value = post ? post.title : '';
      bodyInput.value = post ? post.body : '';
      images = post && Array.isArray(post.images) ? post.images.slice() : [];
      paintImages();
      btnPublish.hidden = false;
      btnPublish.textContent = editingId ? '수정 완료' : '등록';
      btnDelete.hidden = !editingId;
      if (composeHead) composeHead.textContent = editingId ? '글 수정' : '글쓰기';
      ensureGoogle();
      show('compose');
      say(editingId ? '글을 수정합니다.' : '새 글을 작성합니다.');
      titleInput.focus();
    }

    function syncCommentHint() {
      var s = session();
      if (!s) {
        commentHintEl.innerHTML = '댓글을 쓰려면 <a href="join.html#login">로그인</a>이 필요합니다.';
        commentBodyInput.disabled = true;
        btnComment.disabled = true;
        return;
      }
      commentBodyInput.disabled = false;
      btnComment.disabled = false;
      commentHintEl.textContent = (s.name || s.email) + ' 님으로 댓글이 등록됩니다.';
    }

    function paintComments(list) {
      var rows = list || [];
      if (commentCountEl) commentCountEl.textContent = rows.length + '개';
      commentListEl.innerHTML = '';
      if (!rows.length) {
        commentEmptyEl.hidden = false;
        return;
      }
      commentEmptyEl.hidden = true;
      rows.forEach(function (c) {
        var item = document.createElement('article');
        item.className = 'comment-item';
        item.innerHTML =
          '<div class="c-meta"><b></b><span></span></div>' +
          '<p class="c-body"></p>';
        item.querySelector('b').textContent = c.author_name || '회원';
        item.querySelector('.c-meta span').textContent = fmtDate(c.created_at);
        item.querySelector('.c-body').textContent = c.body || '';
        if (isCommentOwner(c)) {
          var del = document.createElement('button');
          del.type = 'button';
          del.className = 'c-del';
          del.textContent = '삭제';
          del.addEventListener('click', function () {
            if (!confirm('이 댓글을 삭제할까요?')) return;
            doCommentDelete(c.id);
          });
          item.querySelector('.c-meta').appendChild(del);
        }
        commentListEl.appendChild(item);
      });
    }

    function fetchComments(postId) {
      if (DgMember.callJsonp) {
        return DgMember.callJsonp({ action: 'comment_list', post_id: postId });
      }
      return DgMember.call({ action: 'comment_list', post_id: postId });
    }

    function loadComments(postId, opts) {
      var silent = opts && opts.silent;
      if (!postId) return;
      if (commentsCache[postId]) paintComments(commentsCache[postId]);
      else if (!silent) paintComments([]);
      fetchComments(postId).then(function (data) {
        var list = data.comments || [];
        commentsCache[postId] = list;
        if (currentPost && currentPost.id === postId) paintComments(list);
      }).catch(function (err) {
        if (!silent && currentPost && currentPost.id === postId) {
          say(err.message || '댓글을 불러오지 못했습니다.');
        }
      });
    }

    function doCommentCreate() {
      if (!currentPost || !currentPost.id) return;
      if (!session()) {
        location.href = 'join.html#login';
        return;
      }
      if (!requireToken()) return;
      var body = String(commentBodyInput.value || '').trim();
      if (!body) {
        say('댓글 내용을 입력해 주세요.');
        commentBodyInput.focus();
        return;
      }
      btnComment.disabled = true;
      say('댓글을 등록하는 중입니다.');
      DgMember.call({
        action: 'comment_create',
        idToken: token,
        post_id: currentPost.id,
        body: body
      }).then(function (res) {
        commentBodyInput.value = '';
        var list = (commentsCache[currentPost.id] || []).slice();
        if (res.comment) list.push(res.comment);
        commentsCache[currentPost.id] = list;
        paintComments(list);
        say('');
      }).catch(authFailed).then(function () {
        btnComment.disabled = false;
        syncCommentHint();
      });
    }

    function doCommentDelete(commentId) {
      if (!currentPost || !currentPost.id || !commentId) return;
      if (!requireToken()) return;
      say('댓글을 삭제하는 중입니다.');
      DgMember.call({
        action: 'comment_delete',
        idToken: token,
        id: commentId
      }).then(function () {
        var list = (commentsCache[currentPost.id] || []).filter(function (c) {
          return c.id !== commentId;
        });
        commentsCache[currentPost.id] = list;
        paintComments(list);
        say('');
      }).catch(authFailed);
    }

    function openDetail(post) {
      currentPost = post;
      writePostCache(post);
      var views = bumpViews(post.id);
      detailTitle.textContent = post.title;
      detailMeta.textContent = '글쓴이 ' + (post.author_name || '회원')
        + ' · 등록일 ' + fmtDate(post.created_at)
        + ' · 조회 ' + views;
      detailBody.innerHTML = renderBody(post.body);
      detailImages.innerHTML = '';
      (post.images || []).forEach(function (src) {
        var img = document.createElement('img');
        img.src = src;
        img.alt = '';
        detailImages.appendChild(img);
      });
      detailActions.innerHTML = '';
      if (isOwner(post)) {
        var edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'btn';
        edit.textContent = '수정';
        edit.addEventListener('click', function () {
          var needFull = !!(post.has_image || (post.body == null)) && !(post.images && post.images.length);
          if (needFull) {
            say('글 내용을 불러오는 중입니다.');
            fetchPostRemote(post.id).then(function (res) {
              openCompose(res.post || post);
            }).catch(function () {
              openCompose(post);
            });
            return;
          }
          openCompose(post);
        });
        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn danger';
        del.textContent = '삭제';
        del.addEventListener('click', function () {
          if (!confirm('이 글을 삭제할까요?')) return;
          editingId = post.id;
          doDelete();
        });
        detailActions.appendChild(edit);
        detailActions.appendChild(del);
      }
      syncCommentHint();
      loadComments(post.id);
      show('detail');
    }

    function openPost(id) {
      var cached = readPostCache(id);
      if (cached) {
        say('');
        openDetail(cached);
      }
      fetchPostLocal(id).then(function (res) {
        if (!res.post) return;
        if (cached && cached.images && cached.images.length && !(res.post.images && res.post.images.length)) {
          res.post.images = cached.images;
        }
        writePostCache(res.post);
        say('');
        openDetail(res.post);
      }).catch(function () {});
      fetchPostRemote(id).then(function (res) {
        say('');
        openDetail(res.post);
      }).catch(function (err) {
        if (!cached) say(err.message);
      });
    }

    function paintPosts(posts) {
      var rows = posts || [];
      countEl.textContent = String(rows.length);
      listEl.innerHTML = '';
      if (!rows.length) {
        listEl.innerHTML = '<tr class="empty"><td colspan="5">아직 글이 없습니다. 첫 글을 남겨 보세요.</td></tr>';
        return;
      }
      rows.forEach(function (p, i) {
        var tr = document.createElement('tr');
        var num = rows.length - i;
        var title = (p.has_image ? '<span class="pic">[사진]</span>' : '') + escapeHtml(p.title || '');
        tr.innerHTML =
          '<td class="num">' + num + '</td>' +
          '<td class="title">' + title + '</td>' +
          '<td class="author"></td>' +
          '<td class="date"></td>' +
          '<td class="views"></td>';
        tr.querySelector('.author').textContent = p.author_name || '회원';
        tr.querySelector('.date').textContent = fmtDateShort(p.created_at);
        tr.querySelector('.views').textContent = String(getViews(p.id));
        tr.addEventListener('click', function () {
          openPost(p.id);
        });
        listEl.appendChild(tr);
      });
    }

    function fetchListRemote() {
      if (DgMember.callJsonp) {
        return DgMember.callJsonp({ action: 'board_list', board: board });
      }
      return DgMember.call({ action: 'board_list', board: board });
    }

    /* 인벤처럼 같은 사이트 파일에서 즉시 읽기 (Apps Script 대기 없음) */
    function fetchListLocal() {
      return fetch('board-data/' + encodeURIComponent(board) + '.json', { cache: 'no-store' })
        .then(function (res) {
          if (!res.ok) throw new Error('local');
          return res.json();
        });
    }

    function fetchPostLocal(id) {
      return fetch('board-data/posts/' + encodeURIComponent(id) + '.json', { cache: 'no-store' })
        .then(function (res) {
          if (!res.ok) throw new Error('local');
          return res.json();
        });
    }

    function fetchPostRemote(id) {
      if (DgMember.callJsonp) {
        return DgMember.callJsonp({ action: 'board_get', id: id });
      }
      return DgMember.call({ action: 'board_get', id: id });
    }

    function applyList(posts) {
      writeListCache(posts || []);
      paintPosts(posts || []);
    }

    function loadList(opts) {
      var silent = opts && opts.silent;
      show('list');
      var cached = readListCache();
      paintPosts(cached || []);
      if (!silent) say('');

      fetchListLocal().then(function (data) {
        applyList(data.posts || []);
        say('');
      }).catch(function () {
        /* 로컬 스냅샷 없으면 캐시/빈 화면 유지 */
      });

      /* 백그라운드 동기화(느려도 화면은 이미 떠 있음) */
      fetchListRemote().then(function (data) {
        applyList(data.posts || []);
        say('');
      }).catch(function (err) {
        if (!cached && !silent) {
          /* 로컬도 실패했을 때만 상태 문구 */
        }
      });
    }

    function summaryFromPost(post) {
      return {
        id: post.id,
        board: post.board || board,
        title: post.title,
        author_name: post.author_name,
        author_email: post.author_email || '',
        created_at: post.created_at,
        updated_at: post.updated_at,
        has_image: !!(post.has_image || (post.images && post.images.length))
      };
    }

    function prependList(post) {
      var list = readListCache() || [];
      var sum = summaryFromPost(post);
      list = [sum].concat(list.filter(function (p) { return p.id !== sum.id; }));
      applyList(list);
    }

    function requireToken() {
      if (!session()) {
        say('로그인이 필요합니다.');
        ensureGoogle();
        return false;
      }
      token = 'session';
      return true;
    }

    function authFailed(err) {
      var msg = (err && err.message) || '';
      if (/로그인|구글|토큰|만료|확인하지/.test(msg)) {
        token = '';
        ensureGoogle();
      }
      say(msg);
    }

    function doDelete() {
      if (!requireToken() || !editingId) return;
      btnDelete.disabled = true;
      say('삭제하는 중입니다.');
      DgMember.call({
        action: 'board_delete',
        idToken: token,
        id: editingId
      }).then(function () {
        try { localStorage.removeItem(postCacheKey + editingId); } catch (e) {}
        var list = (readListCache() || []).filter(function (p) { return p.id !== editingId; });
        editingId = '';
        applyList(list);
        show('list');
        say('');
        loadList({ silent: true });
      }).catch(authFailed).then(function () {
        btnDelete.disabled = false;
      });
    }

    btnWrite.addEventListener('click', function () {
      if (!session()) {
        location.href = 'join.html#login';
        return;
      }
      openCompose(null);
    });

    btnCancel.addEventListener('click', function () {
      editingId = '';
      currentPost = null;
      loadList();
    });

    document.getElementById('btn-back-list').addEventListener('click', function () {
      loadList();
    });

    function addImageFile(file) {
      if (!file) return Promise.resolve(false);
      if (!/^image\//.test(file.type || '')) {
        say('이미지 파일만 올릴 수 있습니다.');
        return Promise.resolve(false);
      }
      if (images.length >= 3) {
        say('이미지는 최대 3장까지입니다.');
        return Promise.resolve(false);
      }
      say('이미지를 준비하는 중입니다.');
      return compressImage(file).then(function (dataUrl) {
        images.push(dataUrl);
        paintImages();
        say('이미지를 추가했습니다. (Ctrl+V로도 붙여넣을 수 있습니다)');
        return true;
      }).catch(function (err) {
        say(err.message);
        return false;
      });
    }

    btnAddImage.addEventListener('click', function () {
      if (images.length >= 3) {
        say('이미지는 최대 3장까지입니다.');
        return;
      }
      fileInput.click();
    });

    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      addImageFile(file);
    });

    /* 글쓰기 화면에서 클립보드 이미지 Ctrl+V / 우클릭 붙여넣기 (composeView 한 곳에서만 처리 — 버블링 중복 방지) */
    function onComposePaste(e) {
      if (composeView.hidden) return;
      var items = e.clipboardData && e.clipboardData.items;
      if (!items || !items.length) return;
      var file = null;
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        if (item.kind === 'file' && /^image\//.test(item.type || '')) {
          file = item.getAsFile();
          if (file) break;
        }
      }
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      addImageFile(file);
    }
    composeView.addEventListener('paste', onComposePaste);

    btnPublish.addEventListener('click', function () {
      if (!requireToken()) return;
      btnPublish.disabled = true;
      var isEdit = !!editingId;
      var editId = editingId;
      var localImages = images.slice();
      say(isEdit ? '수정하는 중입니다.' : '게시하는 중입니다.');
      var payload = isEdit
        ? {
            action: 'board_update',
            idToken: token,
            id: editId,
            title: titleInput.value,
            body: bodyInput.value,
            images: localImages
          }
        : {
            action: 'board_create',
            idToken: token,
            board: board,
            title: titleInput.value,
            body: bodyInput.value,
            images: localImages
          };
      DgMember.call(payload).then(function (res) {
        var post = res && res.post ? res.post : null;
        if (!post) {
          say('저장 응답을 확인하지 못했습니다. 잠시 뒤 목록에서 확인해 주세요.');
          loadList({ silent: true });
          return;
        }
        /* 서버 응답은 이미지를 비워 보냄 — 화면에 쓰던 로컬 이미지를 붙임 */
        if ((!post.images || !post.images.length) && localImages.length) {
          post.images = localImages;
          post.has_image = true;
        }
        writePostCache(post);
        prependList(post);
        editingId = '';
        say('');
        if (isEdit) {
          openDetail(post);
        } else {
          show('list');
          loadList({ silent: true });
        }
      }).catch(authFailed).then(function () {
        btnPublish.disabled = false;
      });
    });

    btnDelete.addEventListener('click', function () {
      if (!editingId) return;
      if (!confirm('이 글을 삭제할까요?')) return;
      doDelete();
    });

    btnComment.addEventListener('click', doCommentCreate);
    commentBodyInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        doCommentCreate();
      }
    });

    if (!window.DgMember || !DgMember.connected()) {
      say('회원 저장 서버 연결 후 글을 불러올 수 있습니다.');
    }
    show('list');
    loadList();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
