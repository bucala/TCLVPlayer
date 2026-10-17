import { describe, it, expect } from "vitest";
import parsers from "../lib/parsers.js";
const {
  normalizeId,
  uniqueId,
  attr,
  parseM3U,
  parseXmlTvDate,
  sanitizeLogoUrl,
  hashCode,
} = parsers;

describe("normalizeId", () => {
  it("lowercases and strips special chars", () => {
    expect(normalizeId("Markíza HD")).toBe("mark-za-hd");
  });

  it("returns empty string for null/undefined", () => {
    expect(normalizeId(null)).toBe("");
    expect(normalizeId(undefined)).toBe("");
  });

  it("trims leading/trailing hyphens", () => {
    expect(normalizeId("--test--")).toBe("test");
  });
});

describe("uniqueId", () => {
  it("returns base id when no conflicts", () => {
    expect(uniqueId("jednotka", [])).toBe("jednotka");
  });

  it("appends counter on conflict", () => {
    const existing = [{ id: "jednotka" }];
    expect(uniqueId("jednotka", existing)).toBe("jednotka-2");
  });

  it("increments counter for multiple conflicts", () => {
    const existing = [{ id: "ch" }, { id: "ch-2" }, { id: "ch-3" }];
    expect(uniqueId("ch", existing)).toBe("ch-4");
  });

  it("falls back to 'channel' for empty seed", () => {
    expect(uniqueId("", [])).toBe("channel");
  });
});

describe("attr", () => {
  it("extracts double-quoted attribute", () => {
    const line = '#EXTINF:-1 tvg-id="jednotka.sk" tvg-name="Jednotka"';
    expect(attr(line, "tvg-id")).toBe("jednotka.sk");
    expect(attr(line, "tvg-name")).toBe("Jednotka");
  });

  it("extracts single-quoted attribute", () => {
    expect(attr("tvg-logo='logo.png'", "tvg-logo")).toBe("logo.png");
  });

  it("extracts unquoted attribute", () => {
    expect(attr("group-title=News", "group-title")).toBe("News");
  });

  it("returns empty string for missing attribute", () => {
    expect(attr("#EXTINF:-1", "tvg-id")).toBe("");
  });
});

describe("parseM3U", () => {
  const playlist = [
    "#EXTM3U",
    '#EXTINF:-1 tvg-id="jednotka.sk" tvg-logo="https://logo.tv/j.png" group-title="Slovakia",Jednotka',
    "https://stream.example.com/jednotka.m3u8",
    '#EXTINF:-1 tvg-id="dvojka.sk" group-title="Slovakia",Dvojka',
    "https://stream.example.com/dvojka.m3u8",
  ].join("\n");

  it("parses correct number of channels", () => {
    const channels = parseM3U(playlist);
    expect(channels).toHaveLength(2);
  });

  it("extracts channel metadata", () => {
    const channels = parseM3U(playlist);
    expect(channels[0].name).toBe("Jednotka");
    expect(channels[0].tvgId).toBe("jednotka.sk");
    expect(channels[0].group).toBe("Slovakia");
    expect(channels[0].logo).toBe("https://logo.tv/j.png");
    expect(channels[0].url).toBe("https://stream.example.com/jednotka.m3u8");
  });

  it("generates unique ids", () => {
    const channels = parseM3U(playlist);
    const ids = channels.map((ch) => ch.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("handles BOM prefix", () => {
    const bom = "﻿#EXTM3U\n#EXTINF:-1,Test\nhttps://test.com/s.m3u8";
    const channels = parseM3U(bom);
    expect(channels).toHaveLength(1);
    expect(channels[0].name).toBe("Test");
  });

  it("handles lines without EXTINF", () => {
    const bare = "https://stream.example.com/bare.m3u8";
    const channels = parseM3U(bare);
    expect(channels).toHaveLength(1);
    expect(channels[0].url).toBe("https://stream.example.com/bare.m3u8");
  });

  it("skips comment lines", () => {
    const withComments = "#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:-1,Ch1\nhttps://a.com/1\n#Some comment\n#EXTINF:-1,Ch2\nhttps://a.com/2";
    const channels = parseM3U(withComments);
    expect(channels).toHaveLength(2);
  });

  it("handles Windows-style line endings", () => {
    const crlf = "#EXTM3U\r\n#EXTINF:-1,Test\r\nhttps://test.com/s.m3u8\r\n";
    const channels = parseM3U(crlf);
    expect(channels).toHaveLength(1);
  });
});

describe("parseXmlTvDate", () => {
  it("parses date without offset", () => {
    const date = parseXmlTvDate("20250615120000");
    expect(date).toBeInstanceOf(Date);
    expect(date.toISOString()).toBe("2025-06-15T12:00:00.000Z");
  });

  it("parses date with positive offset", () => {
    const date = parseXmlTvDate("20250615140000 +0200");
    expect(date.toISOString()).toBe("2025-06-15T12:00:00.000Z");
  });

  it("parses date with negative offset", () => {
    const date = parseXmlTvDate("20250615070000 -0500");
    expect(date.toISOString()).toBe("2025-06-15T12:00:00.000Z");
  });

  it("returns null for invalid input", () => {
    expect(parseXmlTvDate("")).toBeNull();
    expect(parseXmlTvDate(null)).toBeNull();
    expect(parseXmlTvDate("not-a-date")).toBeNull();
  });
});

describe("sanitizeLogoUrl", () => {
  it("allows https URLs", () => {
    expect(sanitizeLogoUrl("https://logo.tv/img.png")).toBe("https://logo.tv/img.png");
  });

  it("allows http URLs", () => {
    expect(sanitizeLogoUrl("http://logo.tv/img.png")).toBe("http://logo.tv/img.png");
  });

  it("allows data:image URLs", () => {
    expect(sanitizeLogoUrl("data:image/png;base64,abc")).toBe("data:image/png;base64,abc");
  });

  it("blocks javascript: URLs", () => {
    expect(sanitizeLogoUrl("javascript:alert(1)")).toBeNull();
  });

  it("blocks file: URLs", () => {
    expect(sanitizeLogoUrl("file:///etc/passwd")).toBeNull();
  });

  it("returns null for empty/null", () => {
    expect(sanitizeLogoUrl("")).toBeNull();
    expect(sanitizeLogoUrl(null)).toBeNull();
  });
});

describe("hashCode", () => {
  it("returns consistent hash for same input", () => {
    expect(hashCode("test")).toBe(hashCode("test"));
  });

  it("returns different hashes for different inputs", () => {
    expect(hashCode("abc")).not.toBe(hashCode("xyz"));
  });

  it("returns a number", () => {
    expect(typeof hashCode("hello")).toBe("number");
  });
});

describe('production parser scalability and archive metadata', () => {
  it('allocates stable unique IDs from one shared set including collisions', () => {
    const ids = new Set();
    expect(uniqueId('Fixture', ids)).toBe('fixture');
    expect(uniqueId('Fixture', ids)).toBe('fixture-2');
    expect(uniqueId('Fixture', ids)).toBe('fixture-3');
  });
  it('retains catchup attributes used by the actual application', () => {
    const [channel] = parseM3U('#EXTM3U\n#EXTINF:-1 catchup="append" catchup-source="https://media.example/archive?utc={utc}" catchup-days="7",Fixture\nhttps://media.example/live.m3u8');
    expect(channel.catchup).toBe('append'); expect(channel.catchupDays).toBe(7);
    expect(channel.catchupSource).toContain('{utc}');
  });
});


it('keeps ID suffixes stable when many stations share the same metadata', () => {
  const text = '#EXTM3U\n' + Array.from({ length: 1000 }, (_, i) => '#EXTINF:-1,Fixture\nhttps://media.example/' + i).join('\n');
  const result = parseM3U(text);
  expect(result[0].id).toBe('fixture'); expect(result[999].id).toBe('fixture-1000');
});

describe('playlist generator interoperability', () => {
  it('preserves EPG source/name/country and decodes exported XML attribute entities', () => {
    const [channel] = parseM3U('#EXTM3U\n#EXTINF:-1 group-title="News, local" tvg-id="Fíxture.sk" tvg-name="Fixture &amp; News" tvg-country="sk" tvg-url="https://source.example/guide.xml?x=1&amp;y=2" tvg-logo="https://logo.example/a?x=1&amp;y=2",Display\nhttps://media.example/live?x=1&y=2');
    expect(channel).toMatchObject({ tvgId: 'Fíxture.sk', tvgName: 'Fixture & News', name: 'Fixture & News', group: 'News, local', tvgCountry: 'sk', tvgUrl: 'https://source.example/guide.xml?x=1&y=2', logo: 'https://logo.example/a?x=1&y=2', url: 'https://media.example/live?x=1&y=2' });
  });
  it('does not mistake an HTML login/error page for channels', () => {
    expect(parseM3U('<!doctype html>\n<html>\nLogin required\n</html>')).toEqual([]);
    expect(parseM3U('#EXTM3U\n#EXTINF:-1,Unsafe\njavascript:alert(1)')).toEqual([]);
  });
});
