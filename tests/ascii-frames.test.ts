// The ASCII frames keep a fixed grid, so Paper Mono columns never jump while they animate.
import assert from "node:assert/strict";
import { test } from "node:test";
import { riverFrame, ticketLines, typed } from "../app/components/ascii-frames.ts";

test("river frames keep a fixed grid and lose the signal mid-crossing", () => {
  for (let ms = 0; ms < 9000; ms += 250) {
    const rows = riverFrame(ms, 62).split("\n");
    assert.equal(rows.length, 10);
    for (const r of rows) assert.equal(r.length, 62);
  }
  assert.match(riverFrame(0), /4G/);
  assert.match(riverFrame(6000), /NO SIGNAL/);
});

test("a ticket prints one character at a time and keeps its shape", () => {
  const full = ticketLines("No. 0007", "Amara's kiosk", "$3.50");
  const widths = new Set(full.split("\n").map((l) => l.length));
  assert.equal(widths.size, 1);
  assert.equal(typed(full, 0).trim(), "");
  assert.equal(typed(full, 60_000), full);
  assert.equal(typed(full, 500).length, full.length);
});
