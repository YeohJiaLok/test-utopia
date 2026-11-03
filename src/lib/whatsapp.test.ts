import { describe, expect, it } from "vitest";
import { jobDoneMessage, toWhatsAppNumber, whatsappLink } from "@/lib/whatsapp";
import { formatMYR, maskPhone } from "@/lib/format";

describe("WhatsApp deep links", () => {
  it("normalises Malaysian numbers to international format", () => {
    expect(toWhatsAppNumber("012-345 6789")).toBe("60123456789");
    expect(toWhatsAppNumber("+60 12-345 6789")).toBe("60123456789");
    expect(toWhatsAppNumber("011-2345 6620")).toBe("601123456620");
  });

  it("renders the assessment's Job Done message template", () => {
    const msg = jobDoneMessage({ customerName: "Ahmad", orderNo: "SJK-2611-01024", technicianName: "Ali", time: "03 Nov 2026, 04:30 PM" });
    expect(msg).toBe(
      "Hi Ahmad,\nJob SJK-2611-01024 has been completed by Technician Ali at 03 Nov 2026, 04:30 PM.\nPlease check and leave feedback.\nThank you!",
    );
  });

  it("builds an encoded wa.me URL", () => {
    expect(whatsappLink("012-345 6789", "Hi Ahmad,\nOK")).toBe("https://wa.me/60123456789?text=Hi%20Ahmad%2C%0AOK");
  });
});

describe("formatting", () => {
  it("formats ringgit", () => {
    expect(formatMYR(1234.5)).toMatch(/RM\s?1,234\.50/);
  });
  it("masks phone numbers for AI tool output", () => {
    expect(maskPhone("012-345 6789")).toBe("012-***6789");
  });
});
