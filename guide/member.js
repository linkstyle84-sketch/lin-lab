(function () {
  var SESSION_KEY = 'dg-member-session';

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
    localStorage.removeItem(SESSION_KEY);
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
        context: 'signin'
      });
      googleReady = true;
    }
    google.accounts.id.renderButton(el, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: (options && options.text) || 'signin_with',
      shape: 'rectangular',
      width: (options && options.width) || 320,
      locale: 'ko'
    });
  }

  window.DgMember = {
    connected: connected,
    call: call,
    renderGoogle: renderGoogle,
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession
  };
})();
