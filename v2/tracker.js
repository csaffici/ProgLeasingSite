// Amperity Event Stream tracker for ProgressiveHoldings_EventStream
// Replace INGEST_STREAM_ID and API_KEY before deploying
(function () {
  var CONFIG = {
    ingestStreamId: 'INGEST_STREAM_ID',   // e.g. is-xxxxxxxx
    apiKey: 'API_KEY',                     // from Amperity Settings > Security > API Keys
    site: 'ProgressiveL',
    buSource: 'ProgLeasingSite_v2',
    endpoint: function () {
      return 'https://ingest.amperity.com/stream/v1/' + this.ingestStreamId;
    }
  };

  function getEmail() {
    // Returns email from localStorage if set (e.g. after login)
    return localStorage.getItem('pl_email') || null;
  }

  function send(payload) {
    if (!CONFIG.ingestStreamId || CONFIG.ingestStreamId === 'INGEST_STREAM_ID') {
      console.warn('[Amperity] ingestStreamId not configured');
      return;
    }
    payload.timestamp = new Date().toISOString();
    payload.site = CONFIG.site;
    payload.bu_source = CONFIG.buSource;
    payload.page_url = window.location.href;
    payload.platform = 'web';

    var xhr = new XMLHttpRequest();
    xhr.open('POST', CONFIG.endpoint(), true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('x-api-key', CONFIG.apiKey);
    xhr.send(JSON.stringify(payload));
  }

  // Page view event — fired on every page
  function trackPageView() {
    var email = getEmail();
    if (!email) return; // email is required by PL_Product_View schema
    send({
      event_type: 'PL_Product_View',
      email: email
    });
  }

  // Product view event — fired on the product detail page
  window.trackProductView = function (productName, productCategory) {
    var email = getEmail();
    if (!email) return;
    send({
      event_type: 'PL_Product_View',
      email: email,
      product_name: productName || document.title,
      product_category: productCategory || ''
    });
  };

  // Expose config so the API key + stream ID can be set at runtime if needed
  window.AmpTracker = CONFIG;

  // Auto-fire page view on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageView);
  } else {
    trackPageView();
  }
})();
