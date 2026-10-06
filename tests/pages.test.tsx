import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Home from "../src/app/page";
import Methodology from "../src/app/methodology/page";

test("home renders and links to the methodology route", () => {
  const html = renderToStaticMarkup(createElement(Home));
  assert.match(html, /<h1>/);
  assert.match(html, /href="\/methodology"/);
});

test("methodology renders a single page heading", () => {
  const html = renderToStaticMarkup(createElement(Methodology));
  assert.equal((html.match(/<h1>/g) ?? []).length, 1);
});
