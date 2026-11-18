(function () {
  function config() {
    return window.MEMBER_CONFIG || {};
  }

  function connected() {
    var cfg = config();
    return !!(cfg.clientId && cfg.scriptUrl);
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

  function renderGoogle(el, callback) {
    var cfg = config();
    if (!window.google || !google.accounts || !google.accounts.id) {
      throw new Error('구글 로그인 버튼을 불러오지 못했습니다.');
    }
    google.accounts.id.initialize({
      client_id: cfg.clientId,
      callback: function (resp) {
        if (resp && resp.credential) callback(resp.credential);
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      ux_mode: 'popup',
      context: 'signup'
    });
    google.accounts.id.renderButton(el, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'signup_with',
      shape: 'rectangular',
      width: 280,
      locale: 'ko'
    });
  }

  window.DgMember = {
    connected: connected,
    call: call,
    renderGoogle: renderGoogle
  };
})();
