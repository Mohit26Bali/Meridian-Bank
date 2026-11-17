import { describe, it, expect } from "vitest";
import { kycSubmissionSchema } from "./kyc";

const tinyPngDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function validPayload(overrides: Partial<Record<string, string>> = {}) {
  return {
    pan: "ABCDE1234F",
    aadhaar: "123412341234",
    panDocument: tinyPngDataUrl,
    aadhaarDocument: tinyPngDataUrl,
    selfie: tinyPngDataUrl,
    addressProof: tinyPngDataUrl,
    ...overrides,
  };
}

describe("kycSubmissionSchema", () => {
  it("accepts a well-formed submission", () => {
    const result = kycSubmissionSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it("uppercases and trims a lowercase PAN before validating", () => {
    const result = kycSubmissionSchema.safeParse(validPayload({ pan: " abcde1234f " }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.pan).toBe("ABCDE1234F");
  });

  it.each(["ABCDE1234", "ABCD1234FF", "12345ABCDE", ""])(
    "rejects a malformed PAN: %s",
    (pan) => {
      const result = kycSubmissionSchema.safeParse(validPayload({ pan }));
      expect(result.success).toBe(false);
    }
  );

  it.each(["12341234123", "1234123412345", "abcd12341234"])(
    "rejects a malformed Aadhaar: %s",
    (aadhaar) => {
      const result = kycSubmissionSchema.safeParse(validPayload({ aadhaar }));
      expect(result.success).toBe(false);
    }
  );

  it("rejects a document that isn't an image data URL", () => {
    const result = kycSubmissionSchema.safeParse(
      validPayload({ panDocument: "data:application/pdf;base64,JVBERi0xLjQ=" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects an oversized document", () => {
    const hugeDataUrl = "data:image/png;base64," + "A".repeat(3_600_000);
    const result = kycSubmissionSchema.safeParse(validPayload({ panDocument: hugeDataUrl }));
    expect(result.success).toBe(false);
  });
});
