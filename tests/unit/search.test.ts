import { describe, expect, it } from "vitest";

import type { MeetupCardData } from "@/lib/meetups/queries";
import { normalizeQuery, searchMeetups } from "@/lib/meetups/search";

const session = (area: string, venue: string) => ({ id: "s", starts_at: "2026-12-01T10:00:00Z", ends_at: "2026-12-01T12:00:00Z", area, venue_name: venue, capacity: 6, reserved_count: 0, status: "open" });
const m = (title: string, host: string, occupation: string, category: string, area: string) =>
  ({ id: title, title, summary: "", price: 0, category_slug: category, cover_image_url: null, is_sample: false,
    host: { user_id: "h", display_name: host, occupation, headline: "", slug: null, is_sample: false },
    nextSession: session(area, "작업실"), upcomingSessions: [session(area, "작업실")] }) as unknown as MeetupCardData;

const list = [
  m("휴대폰으로 찍는 골목 사진", "양승효", "사진작가", "photo", "용산"),
  m("떨지 않고 3분 말하기", "홍지완", "스피치 강사", "career", "용산"),
  m("내 목소리 찾기", "주찬욱", "보컬 트레이너", "music", "성수동"),
];
const names = { photo: "사진·영상", career: "커리어", music: "음악" } as Record<string, string>;
const search = (q: string) => searchMeetups(list, q, { categoryName: (s) => names[s] }).map((x) => x.title);

describe("프로그램 검색", () => {
  it("제목·크리에이터·직업·분야·동네에서 찾는다", () => {
    expect(search("사진")).toEqual(["휴대폰으로 찍는 골목 사진"]);
    expect(search("홍지완")).toEqual(["떨지 않고 3분 말하기"]);
    expect(search("보컬")).toEqual(["내 목소리 찾기"]);
    expect(search("음악")).toEqual(["내 목소리 찾기"]);
    expect(search("성수")).toEqual(["내 목소리 찾기"]);
  });
  it("여러 단어는 모두 맞아야 하고, 띄어쓰기·대소문자는 무시", () => {
    expect(search("용산 사진")).toEqual(["휴대폰으로 찍는 골목 사진"]);
    expect(search("골목사진")).toEqual(["휴대폰으로 찍는 골목 사진"]);
    expect(search("용산")).toHaveLength(2);
    expect(search("없는단어")).toEqual([]);
  });
  it("빈 검색어는 전체, 검색어는 40자까지", () => {
    expect(search("  ")).toHaveLength(3);
    expect(normalizeQuery("가".repeat(60))).toHaveLength(40);
    expect(normalizeQuery(["배열"])).toBe("");
  });
});
