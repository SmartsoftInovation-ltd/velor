import { describe, expect, it } from "vitest";
import { taka, takaInWords } from "./printUtils";

describe("takaInWords", () => {
  it("writes amounts on the lakh and crore scale", () => {
    expect(takaInWords(0)).toBe("Zero taka only");
    expect(takaInWords(5000)).toBe("Five thousand taka only");
    expect(takaInWords(1250.5)).toBe("One thousand two hundred fifty taka and fifty paisa only");
    expect(takaInWords(345678)).toBe("Three lakh forty-five thousand six hundred seventy-eight taka only");
    expect(takaInWords(12500000)).toBe("One crore twenty-five lakh taka only");
  });
});

describe("taka", () => {
  it("always shows two decimals", () => {
    expect(taka(5000)).toBe("৳5,000.00");
    expect(taka(1234.567)).toBe("৳1,234.57");
  });
});
