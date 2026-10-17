(function () {
  'use strict';
  var MESSAGES = {
    cancelled: 'Sign-in was cancelled. You can try again whenever you are ready.',
    expired: 'That sign-in attempt expired. Please start again.',
    failed: 'We could not complete sign-in. Please try again.',
    unverified: 'Your Google email address is not verified, so it cannot be used to sign in.',
    domain: 'This Google account is not allowed to use this app. Please sign in with an approved account.',
    rate_limited: 'Too many attempts. Please wait a few minutes and try again.',
    signed_out: 'You have been signed out.'
  };
  var params = new URLSearchParams(location.search);
  var code = params.get('error') || params.get('notice');
  var box = document.getElementById('msg');
  if (code && Object.prototype.hasOwnProperty.call(MESSAGES, code)) {
    box.textContent = MESSAGES[code];
    if (code === 'signed_out') box.classList.add('info');
    box.hidden = false;
  }
  var btn = document.getElementById('gbtn');
  var next = params.get('next');
  if (next) btn.setAttribute('href', '/auth/google?next=' + encodeURIComponent(next));
  btn.addEventListener('click', function () { btn.setAttribute('aria-busy', 'true'); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) btn.removeAttribute('aria-busy'); });
})();
