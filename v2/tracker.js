// Amperity integration for ProgressiveHoldings demo site
(function () {

  var CONFIG = {
    ingestStreamId: 'INGEST_STREAM_ID',
    apiKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IiZBSyIsImtpZCI6ImRzayIsInRlbmFudCI6ImFjbWUyIn0.eyJhbXAta2V5LWNvZGUiOiJiMmVmYmRmNS01MTFhLTRmYjEtOWEzZC1lNGNkNTdmZDViOTAiLCJzdWIiOiJ0YWstNUNqUTJKcUVROUgiLCJhdWQiOiJkN2ExY2NlYmNhOTQ0NTI4OWFkZWMwMWYwM2MzYzRjMyIsImlzcyI6Imh0dHBzOi8vYXBwLmFtcGVyaXR5LmNvbS8iLCJpYXQiOjE3NzgyNTg0ODQsImV4cCI6MTgwOTc5NDQ4NH0.UpmDtNXHLqDZw63ZyDi_tuJ2leogtdyZ8XyEG5Yx7LE',
    profileCollectionId: 'apc-2RmUSqd9N',
    site: 'ProgressiveL',
    buSource: 'progressive_leasing',
    sessionId: 'sess_' + Math.random().toString(36).substr(2, 12),
    ingestEndpoint: function () {
      return 'https://ingest.amperity.com/stream/v1/' + this.ingestStreamId;
    },
    profileEndpoint: function (email) {
      return 'https://app.amperity.com/profile-api/v1/collections/' + this.profileCollectionId + '/profiles?email=' + encodeURIComponent(email);
    }
  };

  // ── Session helpers ──────────────────────────────────────────────────
  function getEmail()      { return localStorage.getItem('pl_email') || null; }
  function getAmpId()      { return localStorage.getItem('pl_amperity_id') || null; }
  function setEmail(e)     { localStorage.setItem('pl_email', e); }
  function setAmpId(id)    { localStorage.setItem('pl_amperity_id', id); }
  function clearSession()  { localStorage.removeItem('pl_email'); localStorage.removeItem('pl_amperity_id'); localStorage.removeItem('pl_profile'); }

  // ── Event Stream send ────────────────────────────────────────────────
  function send(payload) {
    if (!CONFIG.ingestStreamId || CONFIG.ingestStreamId === 'INGEST_STREAM_ID') {
      console.warn('[Amperity] ingestStreamId not configured — event not sent:', payload.event_type);
      return;
    }
    payload.timestamp  = new Date().toISOString();
    payload.site       = CONFIG.site;
    payload.bu_source  = CONFIG.buSource;
    payload.platform   = payload.platform || 'web';
    if (!payload.page_url) payload.page_url = window.location.href;
    var ampId = getAmpId();
    if (ampId && !payload.amperity_id) payload.amperity_id = ampId;

    var xhr = new XMLHttpRequest();
    xhr.open('POST', CONFIG.ingestEndpoint(), true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'Bearer ' + CONFIG.apiKey);
    xhr.send(JSON.stringify(payload));
  }

  // ── Event helpers ────────────────────────────────────────────────────
  function trackProductView(productName, productCategory) {
    var email = getEmail();
    if (!email) return;
    send({ event_type: 'PL_Product_View', email: email, product_name: productName || '', product_category: productCategory || '' });
  }

  function trackCheckoutStarted(productName, productCategory, leaseAmount, installmentCount) {
    var email = getEmail();
    if (!email) return;
    send({
      event_type: 'PL_Checkout_Started',
      email: email,
      product_name: productName || '',
      product_category: productCategory || '',
      lease_amount: leaseAmount || null,
      installment_count: installmentCount || null
    });
  }

  function trackAppOpen() {
    var email = getEmail();
    if (!email) return;
    send({ event_type: 'PL_App_Open', email: email, session_id: CONFIG.sessionId });
  }

  // ── Profile API ──────────────────────────────────────────────────────
  function fetchProfile(email, callback) {
    var cached = localStorage.getItem('pl_profile');
    if (cached) { try { return callback(JSON.parse(cached)); } catch(e) {} }

    var xhr = new XMLHttpRequest();
    xhr.open('GET', CONFIG.profileEndpoint(email), true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + CONFIG.apiKey);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          var profile = (data.profiles && data.profiles[0]) ? data.profiles[0] : (data.attributes || data);
          localStorage.setItem('pl_profile', JSON.stringify(profile));
          if (profile.amperity_id) setAmpId(profile.amperity_id);
          callback(profile);
        } catch(e) { callback(null); }
      } else {
        callback(null);
      }
    };
    xhr.onerror = function () { callback(null); };
    xhr.send();
  }

  // ── Profile UI rendering ─────────────────────────────────────────────
  function renderProfilePanel(profile) {
    var panel = document.getElementById('amp-profile-panel');
    if (!panel) return;

    if (!profile) {
      panel.innerHTML = '<p style="color:#666;font-size:13px;">Profile not yet available — attributes not yet configured in Amperity.</p>';
      panel.style.display = 'block';
      return;
    }

    var tierColor = { HOT: '#e63946', WARM: '#f4a261', COLD: '#90e0ef' };
    var readinessTier = profile.Cross_Sell_Readiness_Tier || '';
    var dot = tierColor[readinessTier] ? '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + tierColor[readinessTier] + ';margin-right:6px;"></span>' : '';

    panel.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
        '<h3 style="font-size:16px;font-weight:700;margin:0;">Welcome back, ' + (profile.FirstName || 'Customer') + '</h3>' +
        '<button onclick="AmpTracker.logout()" style="font-size:12px;color:#999;background:none;border:none;cursor:pointer;">Sign out</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">' +
        '<div style="background:#f0f8ff;border-radius:6px;padding:12px;">' +
          '<p style="font-size:11px;color:#666;margin-bottom:4px;">ACTIVE PRODUCTS</p>' +
          '<p style="font-weight:700;font-size:15px;">' + (profile.Products_Active || '—') + '</p>' +
        '</div>' +
        '<div style="background:#f0f8ff;border-radius:6px;padding:12px;">' +
          '<p style="font-size:11px;color:#666;margin-bottom:4px;">MESH SCORE</p>' +
          '<p style="font-weight:700;font-size:15px;">' + (profile.Mesh_Score ? parseFloat(profile.Mesh_Score).toFixed(2) : '—') + '</p>' +
        '</div>' +
        '<div style="background:#f0f8ff;border-radius:6px;padding:12px;">' +
          '<p style="font-size:11px;color:#666;margin-bottom:4px;">LIFECYCLE STATUS</p>' +
          '<p style="font-weight:700;font-size:15px;">' + (profile.Customer_Lifecycle_Status || '—') + '</p>' +
        '</div>' +
        '<div style="background:#f0f8ff;border-radius:6px;padding:12px;">' +
          '<p style="font-size:11px;color:#666;margin-bottom:4px;">CREDIT TIER</p>' +
          '<p style="font-weight:700;font-size:15px;">' + (profile.Credit_Tier || '—') + '</p>' +
        '</div>' +
      '</div>' +
      (profile.Next_Best_Product ? renderCrossSellBanner(profile) : '');

    panel.style.display = 'block';
  }

  function renderCrossSellBanner(profile) {
    var tierColor = { HOT: '#e63946', WARM: '#f4a261', COLD: '#90e0ef' };
    var tier = profile.Cross_Sell_Readiness_Tier || 'WARM';
    var color = tierColor[tier] || '#0096c7';
    return '<div style="background:' + color + '20;border:1px solid ' + color + ';border-radius:8px;padding:14px;">' +
      '<p style="font-size:11px;font-weight:700;color:' + color + ';margin-bottom:4px;">RECOMMENDED FOR YOU (' + tier + ')</p>' +
      '<p style="font-weight:700;font-size:15px;margin-bottom:8px;">' + profile.Next_Best_Product + '</p>' +
      '<button onclick="AmpTracker.trackProductView(\'' + profile.Next_Best_Product + '\', \'Cross-Sell\')" ' +
        'style="background:' + color + ';color:#fff;border:none;padding:8px 16px;border-radius:4px;font-weight:700;font-size:13px;cursor:pointer;">' +
        'Learn More' +
      '</button>' +
    '</div>';
  }

  // ── Login modal ──────────────────────────────────────────────────────
  function showLoginModal() {
    var existing = document.getElementById('amp-login-modal');
    if (existing) { existing.style.display = 'flex'; return; }

    var modal = document.createElement('div');
    modal.id = 'amp-login-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML =
      '<div style="background:#fff;border-radius:12px;padding:32px;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);">' +
        '<h2 style="font-size:20px;font-weight:700;margin-bottom:8px;">Sign In</h2>' +
        '<p style="font-size:13px;color:#666;margin-bottom:20px;">Enter your email to access your personalized dashboard.</p>' +
        '<input id="amp-email-input" type="email" placeholder="your@email.com" style="width:100%;padding:12px;border:1px solid #ccc;border-radius:6px;font-size:14px;margin-bottom:12px;box-sizing:border-box;">' +
        '<p id="amp-login-error" style="color:#e63946;font-size:12px;margin-bottom:8px;display:none;">Please enter a valid email.</p>' +
        '<button onclick="AmpTracker.submitLogin()" style="width:100%;background:#0096c7;color:#fff;border:none;padding:13px;border-radius:6px;font-size:15px;font-weight:700;cursor:pointer;margin-bottom:10px;">Continue</button>' +
        '<button onclick="AmpTracker.closeLogin()" style="width:100%;background:none;border:none;color:#999;font-size:13px;cursor:pointer;">Cancel</button>' +
      '</div>';
    document.body.appendChild(modal);

    document.getElementById('amp-email-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') AmpTracker.submitLogin();
    });
  }

  function submitLogin() {
    var input = document.getElementById('amp-email-input');
    var err   = document.getElementById('amp-login-error');
    if (!input) return;
    var email = input.value.trim();
    if (!email || !email.includes('@')) { err.style.display = 'block'; return; }
    err.style.display = 'none';
    setEmail(email);
    closeLogin();
    trackAppOpen();
    fetchProfile(email, function(profile) {
      renderProfilePanel(profile);
      updateNavForLoggedIn(email);
    });
  }

  function closeLogin() {
    var modal = document.getElementById('amp-login-modal');
    if (modal) modal.style.display = 'none';
  }

  function logout() {
    clearSession();
    var panel = document.getElementById('amp-profile-panel');
    if (panel) panel.style.display = 'none';
    updateNavForLoggedOut();
  }

  function updateNavForLoggedIn(email) {
    var btn = document.getElementById('amp-nav-login-btn');
    if (btn) { btn.textContent = email.split('@')[0]; btn.onclick = AmpTracker.logout; }
  }

  function updateNavForLoggedOut() {
    var btn = document.getElementById('amp-nav-login-btn');
    if (btn) { btn.textContent = 'Sign In'; btn.onclick = AmpTracker.showLoginModal; }
  }

  // ── Auto-init ────────────────────────────────────────────────────────
  function init() {
    var email = getEmail();
    if (email) {
      fetchProfile(email, function(profile) {
        renderProfilePanel(profile);
        updateNavForLoggedIn(email);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Public API ───────────────────────────────────────────────────────
  window.AmpTracker = {
    config: CONFIG,
    trackProductView: trackProductView,
    trackCheckoutStarted: trackCheckoutStarted,
    trackAppOpen: trackAppOpen,
    fetchProfile: fetchProfile,
    showLoginModal: showLoginModal,
    submitLogin: submitLogin,
    closeLogin: closeLogin,
    logout: logout
  };

})();
