/* ============================================================
   account.js — the shape of an account, and nothing more
   Deliberately does not pretend to authenticate. A sign-in written
   in the browser can be read, disabled or bypassed by anyone who
   opens the page source, so this stores an address and says so.
   ============================================================ */
(function () {
  'use strict';
  var S = window.Store, el = S.el;
  var K = 'ncfc.account.v1';

  function read() { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { return {}; } }
  function write(d) { try { localStorage.setItem(K, JSON.stringify(d)); } catch (e) {} }

  var STEPS = [
    ['Somewhere to keep the accounts',
     'A database on the host, with an email, a hashed password and what the person has paid for. Hostinger gives you MySQL, so this is available rather than something to go and buy.'],
    ['A server that checks them',
     'PHP on the same host. The browser never decides whether you are signed in; the server does, and sends back a session cookie. This is the part that makes it real rather than decorative.'],
    ['Passwords stored properly',
     'Hashed with the language\u2019s own password function, never encrypted and never in plain text. If this is the part you write yourself, it is the part to get right.'],
    ['Password reset',
     'An emailed one-time link that expires. Every account system needs it on day one, because people forget passwords on day two.'],
    ['Billing that agrees with access',
     'Stripe holds the subscription and tells your server when it starts, lapses or is cancelled. Your server decides what a lapsed account can still open.'],
    ['A decision about the data',
     'The app keeps everything on the device today, which is why there is nothing to breach. If a subscription means their sessions follow them between devices, that data comes to your server and you become responsible for it: retention, deletion, breach notification, and for under-13s in the US, COPPA.']
  ];

  var ALT = [
    ['Buy it once, host it yourself',
     'No accounts, no subscription, no server. They pay, they get the folder, they deploy it. You never touch their data. This is the version that needs nothing built.'],
    ['A hosted auth provider',
     'Auth0, Clerk, Supabase Auth. They handle passwords, reset and sessions; you handle what a signed-in person can see. Less to get wrong than writing it yourself.'],
    ['Password on the whole site',
     'One shared password at the server, no accounts. Fine for a handful of club coaches, useless for selling.']
  ];

  function renderReality() {
    var host = document.getElementById('reality');
    host.innerHTML = '';
    host.appendChild(el('p', { class: 'hint', style: 'margin:0 0 14px',
      text: 'A sign-in box is the easy part. These are the pieces behind it, in the order they are usually built.' }));
    var ol = el('ol', { class: 'chain' });
    STEPS.forEach(function (s) {
      ol.appendChild(el('li', {}, [el('b', { text: s[0] }), el('span', { text: s[1] })]));
    });
    host.appendChild(ol);
    host.appendChild(el('p', { class: 'eyebrow', style: 'margin:22px 0 8px', text: 'Ways round it' }));
    var g = el('div', { class: 'lgrid' });
    ALT.forEach(function (a) {
      g.appendChild(el('div', { class: 'lcard' }, [el('b', { text: a[0] }), el('p', { text: a[1] })]));
    });
    host.appendChild(g);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var d = read();
    if (d.interest) {
      document.getElementById('f_interest').value = d.interest;
      document.getElementById('f_role').value = d.role || '';
      document.getElementById('interestNote').textContent =
        'Saved in this browser on ' + S.fmt((d.at || '').slice(0, 10)) +
        '. Nothing was sent anywhere, because there is nowhere to send it yet.';
    }

    function refuse() {
      document.getElementById('authNote').textContent =
        'There is nothing behind this yet. Signing in here would check nothing and grant nothing.';
    }
    document.getElementById('btnSignIn').addEventListener('click', refuse);
    document.getElementById('btnRegister').addEventListener('click', refuse);

    document.getElementById('btnInterest').addEventListener('click', function () {
      var em = document.getElementById('f_interest').value.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { S.toast('That does not look like an email address.'); return; }
      write({ interest: em, role: document.getElementById('f_role').value.trim(), at: new Date().toISOString() });
      document.getElementById('interestNote').textContent =
        'Kept in this browser only. Once there is a mailing list it can be posted somewhere; for now it is a note to yourself.';
      S.toast('Saved locally.');
    });

    renderReality();
  });
})();
