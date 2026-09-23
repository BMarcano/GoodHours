import test from "node:test";
import assert from "node:assert/strict";
import handler, { findUrl, summarizePage } from "./extract-spot.js";

test("findUrl pulls the first http(s) link out of pasted text", () => {
  assert.equal(findUrl("look at this https://www.instagram.com/p/abc123/?igsh=xyz so cute"), "https://www.instagram.com/p/abc123/?igsh=xyz");
  assert.equal(findUrl("Brooklyn Children's Museum, Sat 10am"), null);
  assert.equal(findUrl("ftp://nope.com/file"), null);
});

test("summarizePage prefers OG tags and strips scripts from the text slice", () => {
  const html = `<html><head><title>Fallback Title</title>
    <meta property="og:title" content="Little Gym &amp; Play" />
    <meta content="Open play for toddlers" property="og:description">
    <meta property="og:site_name" content="Instagram"></head>
    <body><script>var x = "should not appear";</script><h1>Hello</h1><p>123 Main St</p></body></html>`;
  const page = summarizePage(html);
  assert.equal(page.title, "Little Gym & Play");
  assert.equal(page.description, "Open play for toddlers");
  assert.equal(page.siteName, "Instagram");
  assert.doesNotMatch(page.text, /should not appear/);
  assert.match(page.text, /123 Main St/);
  assert.equal(summarizePage("<html><head><title> Only title </title></head></html>").title, "Only title");
});

function fakeRes() {
  const out = { statusCode: null, body: null };
  return {
    out,
    status(code) { out.statusCode = code; return this; },
    json(payload) { out.body = payload; return this; },
  };
}

test("handler rejects non-POST and anonymous calls before touching any provider", async () => {
  const get = fakeRes();
  await handler({ method: "GET", headers: {}, body: {} }, get);
  assert.equal(get.out.statusCode, 405);

  const anon = fakeRes();
  await handler({ method: "POST", headers: {}, body: { text: "https://example.com" } }, anon);
  assert.equal(anon.out.statusCode, 401);
});
