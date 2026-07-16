// Meta Pixel — WEB ONLY, on purpose.
// It never loads inside the wrapped iOS/Android app: the app would then be
// tracking for ads, which contradicts the "no tracking" App Privacy we filed
// with Apple and would require the App Tracking Transparency prompt.
// Nothing is lost by this — ads point at the website, and signup + payment both
// happen there, so the web pixel sees the whole funnel.

const PIXEL_ID = "1057464993904809";
let started = false;

export function initPixel() {
  if (started || typeof window === "undefined" || window.fbq) return;
  started = true;

  /* Meta's standard base snippet */
  /* eslint-disable */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n;
    n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */

  window.fbq("init", PIXEL_ID);
  window.fbq("track", "PageView");
}

// No-ops when the pixel isn't loaded (i.e. inside the app) — safe to call anywhere.
export function trackPixel(event, params) {
  if (typeof window !== "undefined" && window.fbq) window.fbq("track", event, params);
}
