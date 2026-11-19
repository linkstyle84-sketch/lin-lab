(function () {
  var ADMIN_EMAIL = 'linkstyle84@gmail.com';
  var BOARDS = {
    tips: { title: '팁 & 노하우 게시판', note: '사냥·제작·운영 팁을 공유하는 게시판입니다.' },
    free: { title: '자유게시판', note: '자유롭게 이야기하는 게시판입니다.' },
    feedback: { title: '피드백 게시판', note: '건의·버그·오류 제보를 올리는 게시판입니다.' },
    'class-prince': { title: '군주 게시판', note: '군주 클래스 이야기와 팁을 올리는 게시판입니다.' },
    'class-knight': { title: '기사 게시판', note: '기사 클래스 이야기와 팁을 올리는 게시판입니다.' },
    'class-elf': { title: '요정 게시판', note: '요정 클래스 이야기와 팁을 올리는 게시판입니다.' },
    'class-mage': { title: '마법사 게시판', note: '마법사 클래스 이야기와 팁을 올리는 게시판입니다.' }
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
    var btnWrite = document.getElementById('btn-write');
    var btnAddImage = document.getElementById('btn-add-image');
    var btnPublish = document.getElementById('btn-publish');
    var btnUpdate = document.getElementById('btn-update');
    var btnDelete = document.getElementById('btn-delete');
    var btnCancel = document.getElementById('btn-cancel');
    var detailTitle = document.getElementById('detail-title');
    var detailMeta = document.getElementById('detail-meta');
    var detailBody = document.getElementById('detail-body');
    var detailImages = document.getElementById('detail-images');
    var detailActions = document.getElementById('detail-actions');

    titleEl.textContent = meta.title;
    noteEl.textContent = meta.note;
    document.title = meta.title + ' · 도건 게임 연구소';

    var token = '';
    var images = [];
    var editingId = '';
    var currentPost = null;

    function say(msg) {
      statusEl.textContent = msg || '';
    }

    function show(view) {
      listView.hidden = view !== 'list';
      composeView.hidden = view !== 'compose';
      detailView.hidden = view !== 'detail';
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
        googleBox.innerHTML = '<p class="hint">글을 올리려면 구글 로그인을 한 번 더 확인해 주세요.</p><div id="gis-slot"></div>';
      } else {
        googleBox.innerHTML = '<p class="hint">작성자: <b></b> · 게시/수정/삭제 전에 구글 확인이 필요합니다.</p><div id="gis-slot"></div>';
        googleBox.querySelector('b').textContent = s.name || s.email;
      }
      try {
        DgMember.renderGoogle(document.getElementById('gis-slot'), function (idToken) {
          token = idToken;
          say('구글 확인됨. 게시·수정·삭제를 눌러 주세요.');
        }, { text: 'signin_with', width: 280 });
      } catch (e) {
        googleBox.innerHTML = '<p class="hint">' + escapeHtml(e.message) + '</p>';
      }
    }

    function openCompose(post) {
      editingId = post && post.id ? post.id : '';
      titleInput.value = post ? post.title : '';
      bodyInput.value = post ? post.body : '';
      images = post && Array.isArray(post.images) ? post.images.slice() : [];
      paintImages();
      btnPublish.hidden = !!editingId;
      btnUpdate.hidden = !editingId;
      btnDelete.hidden = !editingId;
      ensureGoogle();
      show('compose');
      say(editingId ? '글을 수정합니다.' : '새 글을 작성합니다.');
      titleInput.focus();
    }

    function openDetail(post) {
      currentPost = post;
      detailTitle.textContent = post.title;
      detailMeta.textContent = (post.author_name || '회원') + ' · ' + fmtDate(post.created_at);
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
        edit.addEventListener('click', function () { openCompose(post); });
        var del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn danger';
        del.textContent = '삭제';
        del.addEventListener('click', function () {
          if (!confirm('이 글을 삭제할까요?')) return;
          ensureGoogle();
          show('compose');
          editingId = post.id;
          titleInput.value = post.title;
          bodyInput.value = post.body;
          images = (post.images || []).slice();
          paintImages();
          btnPublish.hidden = true;
          btnUpdate.hidden = false;
          btnDelete.hidden = false;
          say('삭제하려면 구글 확인 후 삭제를 다시 눌러 주세요.');
        });
        detailActions.appendChild(edit);
        detailActions.appendChild(del);
      }
      show('detail');
    }

    function loadList() {
      show('list');
      say('글 목록을 불러오는 중입니다.');
      listEl.innerHTML = '';
      DgMember.call({ action: 'board_list', board: board }).then(function (data) {
        var posts = data.posts || [];
        countEl.textContent = posts.length + '개';
        if (!posts.length) {
          listEl.innerHTML = '<li class="empty">아직 글이 없습니다. 첫 글을 남겨 보세요.</li>';
          say('');
          return;
        }
        posts.forEach(function (p) {
          var li = document.createElement('li');
          li.innerHTML = '<button type="button" class="row"><span class="t"></span><span class="m"></span></button>';
          li.querySelector('.t').textContent = (p.has_image ? '[사진] ' : '') + p.title;
          li.querySelector('.m').textContent = (p.author_name || '회원') + ' · ' + fmtDate(p.created_at);
          li.querySelector('button').addEventListener('click', function () {
            say('글을 불러오는 중입니다.');
            DgMember.call({ action: 'board_get', id: p.id }).then(function (res) {
              say('');
              openDetail(res.post);
            }).catch(function (err) { say(err.message); });
          });
          listEl.appendChild(li);
        });
        say('');
      }).catch(function (err) {
        say(err.message);
        listEl.innerHTML = '<li class="empty">목록을 불러오지 못했습니다.</li>';
      });
    }

    function requireToken() {
      if (!token) {
        say('먼저 구글 로그인 확인 버튼을 눌러 주세요.');
        ensureGoogle();
        return false;
      }
      return true;
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
      if (!file) return;
      if (!/^image\//.test(file.type)) {
        say('이미지 파일만 올릴 수 있습니다.');
        return;
      }
      say('이미지를 준비하는 중입니다.');
      compressImage(file).then(function (dataUrl) {
        images.push(dataUrl);
        paintImages();
        say('이미지를 추가했습니다.');
      }).catch(function (err) {
        say(err.message);
      });
    });

    btnPublish.addEventListener('click', function () {
      if (!requireToken()) return;
      btnPublish.disabled = true;
      say('게시하는 중입니다.');
      DgMember.call({
        action: 'board_create',
        idToken: token,
        board: board,
        title: titleInput.value,
        body: bodyInput.value,
        images: images
      }).then(function () {
        token = '';
        loadList();
      }).catch(function (err) {
        say(err.message);
      }).then(function () {
        btnPublish.disabled = false;
      });
    });

    btnUpdate.addEventListener('click', function () {
      if (!requireToken() || !editingId) return;
      btnUpdate.disabled = true;
      say('수정하는 중입니다.');
      DgMember.call({
        action: 'board_update',
        idToken: token,
        id: editingId,
        title: titleInput.value,
        body: bodyInput.value,
        images: images
      }).then(function () {
        token = '';
        loadList();
      }).catch(function (err) {
        say(err.message);
      }).then(function () {
        btnUpdate.disabled = false;
      });
    });

    btnDelete.addEventListener('click', function () {
      if (!requireToken() || !editingId) return;
      if (!confirm('이 글을 삭제할까요?')) return;
      btnDelete.disabled = true;
      say('삭제하는 중입니다.');
      DgMember.call({
        action: 'board_delete',
        idToken: token,
        id: editingId
      }).then(function () {
        token = '';
        loadList();
      }).catch(function (err) {
        say(err.message);
      }).then(function () {
        btnDelete.disabled = false;
      });
    });

    if (!window.DgMember || !DgMember.connected()) {
      say('회원 저장 서버 연결 후 글을 불러올 수 있습니다.');
    }
    loadList();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
