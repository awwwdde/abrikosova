import { describe, expect, it } from "vitest";
import {
  DEFAULT_REQUESTS,
  parseRequests,
  requestActions,
  requestsApiParams,
  requestsQueryString,
  tabOfRequest,
} from "./admin-requests";

describe("заявки: фильтры и переходы", () => {
  it("адрес туда и обратно", () => {
    const query = {
      ...DEFAULT_REQUESTS,
      tab: "work" as const,
      occasion: "wedding",
      period: "custom" as const,
      from: "2026-10-01",
      to: "2026-12-31",
      source: "custom_cake" as const,
      page: 2,
    };
    expect(parseRequests(new URLSearchParams(requestsQueryString(query)))).toEqual(query);
    expect(requestsQueryString(DEFAULT_REQUESTS)).toBe("");
  });

  it("параметры API", () => {
    expect(requestsApiParams({ ...DEFAULT_REQUESTS, period: "week" }, 20)).toBe(
      "tab=new&page=1&page_size=20&period=week",
    );
  });

  it("кнопки статуса как на бэкенде", () => {
    expect(requestActions("new").map((a) => a.status)).toEqual(["contacted", "completed"]);
    expect(requestActions("contacted").map((a) => a.label)).toEqual(["Закрыть"]);
    expect(requestActions("completed")).toEqual([]);
    expect(tabOfRequest("contacted")).toBe("work");
  });
});
