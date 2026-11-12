/* global Event, EventTarget */
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
function section(first, last) {
  const start = source.indexOf(first), end = source.indexOf(last, start);
  if (start < 0 || end < 0) throw new Error("Missing runtime section");
  return source.slice(start, end);
}

describe("reused locale time formatters", () => {
  it("keeps both languages correct with only one formatter per locale", () => {
    const constructor = vi.fn(function(...args) { return new Intl.DateTimeFormat(...args); });
    const state = { language: "sk" };
    const context = vm.createContext({ state, Intl: { DateTimeFormat: constructor } });
    vm.runInContext(section("const timeFormatters =", "function floorToHalfHour("), context);
    const date = new Date("2026-11-11T13:05:00Z");
    for (const language of ["sk", "en", "sk"]) {
      state.language = language;
      const expected = new Intl.DateTimeFormat(language === "sk" ? "sk-SK" : "en-US", { hour: "2-digit", minute: "2-digit" }).format(date);
      for (let i = 0; i < 1000; i++) expect(context.formatTime(date)).toBe(expected);
    }
    expect(constructor).toHaveBeenCalledTimes(2);
  });
});

describe("video status event lifecycle", () => {
  function runtime() {
    const state = { selectedChannelId: "one" }, status = vi.fn(), native = vi.fn();
    const context = vm.createContext({ state, setStreamStatus: status, syncAndroidPlaybackActive: native, AbortController });
    vm.runInContext(section("const videoStatusBindings =", "async function addXtreamSource("), context);
    const video = new EventTarget();
    video.error = null;
    video.currentTime = 1;
    return { state, status, native, video, bind: context.bindVideoStatusEvents };
  }
  it("does not accumulate callbacks while repeatedly switching the same channel", () => {
    const { video, status, bind } = runtime();
    for (let i = 0; i < 1000; i++) bind(video, "one");
    video.dispatchEvent(new Event("playing"));
    expect(status).toHaveBeenCalledExactlyOnceWith("one", "ok");
    video.error = { code: 4 };
    video.dispatchEvent(new Event("error"));
    expect(status).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenLastCalledWith("one", "error");
  });
  it("ignores a queued old-source error after load clears MediaError, but keeps the new error handler", () => {
    const { video, status, native, bind } = runtime();
    bind(video, "one");
    video.dispatchEvent(new Event("error"));
    expect(status).not.toHaveBeenCalled();
    expect(native).not.toHaveBeenCalled();
    video.error = { code: 4 };
    video.dispatchEvent(new Event("error"));
    expect(status).toHaveBeenCalledExactlyOnceWith("one", "error");
    expect(native).toHaveBeenCalledWith(false);
  });
  it("replaces old-channel listeners and does not accept a result for an unselected channel", () => {
    const { video, state, status, bind } = runtime();
    bind(video, "old");
    bind(video, "one");
    video.dispatchEvent(new Event("canplay"));
    expect(status).toHaveBeenCalledExactlyOnceWith("one", "ok");
    state.selectedChannelId = "different";
    video.error = { code: 4 };
    video.dispatchEvent(new Event("error"));
    expect(status).toHaveBeenCalledTimes(1);
  });
});

it("updates channel status without treating a channel ID as a CSS selector", () => {
  const id = 'channel["odd"]';
  const dot = {};
  const card = { dataset: { channelId: id }, querySelector: () => dot };
  const context = vm.createContext({
    state: { streamStatus: { [id]: "ok" } },
    dom: { channelGrid: { querySelectorAll: () => [card] } },
  });
  vm.runInContext(section("function updateChannelStatusDot(", "function syncAndroidPlaybackActive("), context);
  expect(() => context.updateChannelStatusDot(id)).not.toThrow();
  expect(dot.className).toBe("status-dot ok");
});

describe("ArtPlayer formats that need MSE", () => {
  function runtime(type) {
    const created = [], players = [];
    const state = { selectedChannelId: "one", artPlayer: null, mpegtsPlayer: null };
    class Artplayer {
      constructor(options) { this.options = options; this.handlers = new Map(); created.push(this); }
      on(name, callback) { this.handlers.set(name, callback); }
      destroy() {}
    }
    const mpegts = {
      Events: { ERROR: "error" },
      isSupported: () => true,
      createPlayer: vi.fn(config => {
        const player = { config, handlers: new Map(), on(name, callback) { this.handlers.set(name, callback); }, attachMediaElement: vi.fn(), load: vi.fn() };
        players.push(player);
        return player;
      }),
    };
    const status = vi.fn(), destroyHls = vi.fn(), ensureMpegts = vi.fn();
    const context = vm.createContext({
      state, window: { Artplayer, mpegts, Hls: { isSupported: () => true } },
      dom: { video: { pause: vi.fn(), removeAttribute: vi.fn(), load: vi.fn(), style: {} }, artPlayerHost: { style: {} } },
      getStreamType: () => type, streamUrl: url => url, showMessage: vi.fn(), t: key => key,
      stopVideoJs: vi.fn(), ensureArtPlayer: vi.fn(), ensureHls: vi.fn(), ensureMpegts, destroyHls, setStreamStatus: status,
    });
    vm.runInContext(section("async function playArtPlayer(", "function setPlayerActive("), context);
    return { context, created, players, mpegts, state, status, destroyHls, ensureMpegts };
  }
  it.each([["ts", "mpegts"], ["flv", "flv"]])("plays %s through mpegts.js instead of the native video element", async (type, library) => {
    const { context, created, players, state, status, destroyHls, ensureMpegts } = runtime(type);
    await context.playArtPlayer({ id: "one", url: "/api/stream?url=x" });
    expect(ensureMpegts).toHaveBeenCalled();
    const art = created[0].options;
    expect(art.type).toBe("mpegts");
    const video = {};
    art.customType.mpegts(video, art.url);
    expect(destroyHls).toHaveBeenCalled();
    expect(players[0].config).toEqual({ type: library, isLive: true, url: "/api/stream?url=x" });
    expect(players[0].attachMediaElement).toHaveBeenCalledWith(video);
    expect(players[0].load).toHaveBeenCalled();
    expect(state.mpegtsPlayer).toBe(players[0]);
    players[0].handlers.get("error")();
    expect(status).toHaveBeenCalledWith("one", "error");
  });
  it("leaves formats the browser plays itself to ArtPlayer", async () => {
    const { context, created, ensureMpegts } = runtime("mp4");
    await context.playArtPlayer({ id: "one", url: "https://provider.example/movie.mp4" });
    expect(ensureMpegts).not.toHaveBeenCalled();
    expect(created[0].options.type).toBe("");
    expect(created[0].options.customType).toBeUndefined();
  });
});
