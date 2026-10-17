"use strict";
(function(root) {
  // Escape bounded fragments instead of allocating a second copy of every XML
  // document and one enormous JSON string on the UI thread.
  const STREAM_TEXT = Symbol('private streamed text');
  function textSource(read) { return { [STREAM_TEXT]: read }; }
  async function* fragments(value) {
    if (value && value[STREAM_TEXT]) {
      yield '"';
      for await (const part of value[STREAM_TEXT]()) {
        for (let start = 0; start < part.length; start += 16384) yield JSON.stringify(part.slice(start, start + 16384)).slice(1, -1);
      }
      yield '"';
    } else if (typeof value === 'string') {
      yield '"';
      for (let start = 0; start < value.length;) {
        let end = Math.min(value.length, start + 16384);
        const last = value.charCodeAt(end - 1);
        if (end < value.length && last >= 0xd800 && last <= 0xdbff) end++;
        yield JSON.stringify(value.slice(start, end)).slice(1, -1); start = end;
      }
      yield '"';
    } else if (Array.isArray(value)) {
      yield '[';
      for (let i = 0; i < value.length; i++) { if (i) yield ','; yield* fragments(value[i] === undefined ? null : value[i]); }
      yield ']';
    } else if (value && typeof value === 'object') {
      yield '{'; let first = true;
      for (const [key, item] of Object.entries(value)) {
        if (item === undefined) continue;
        if (!first) yield ','; first = false;
        yield JSON.stringify(key) + ':'; yield* fragments(item);
      }
      yield '}';
    } else yield JSON.stringify(value) || 'null';
  }
  async function* chunks(value) {
    let pending = '', count = 0;
    for await (const piece of fragments(value)) {
      if (pending.length + piece.length > 65536 && pending) { yield pending; pending = ''; }
      pending += piece;
      if (++count % 32 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    if (pending) yield pending;
  }
  const api = { chunks, textSource };
  if (typeof module !== 'undefined') module.exports = api; else root.TCLVBackup = api;
})(globalThis);
