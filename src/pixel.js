// Web analytics — Meta Pixel + Google Analytics. WEB ONLY, on purpose.
// Neither loads inside the wrapped iOS/Android app: the app would then be
// tracking for ads, which contradicts the "no tracking" App Privacy we filed
// with Apple and would require the App Tracking Transparency prompt.
// Nothing is lost by this — ads point at the website, and signup + payment both
// happen there, so the web side sees the whole funnel.

const PIXEL_ID = "1057464993904809";
const GA_ID = "G-63JBQ02NV5";
let started = false;
let gaStarted = false;

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

export function initGoogleTag() {
  if (gaStarted || typeof window === "undefined" || window.gtag) return;
  gaStarted = true;

  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID);
}

// Both no-op when the scripts aren't loaded (i.e. inside the app) — safe anywhere.
export function trackPixel(event, params) {
  if (typeof window !== "undefined" && window.fbq) window.fbq("track", event, params);
}

export function trackGa(event, params) {
  if (typeof window !== "undefined" && window.gtag) window.gtag("event", event, params);
}
