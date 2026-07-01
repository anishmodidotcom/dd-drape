import { describe, it, expect } from "vitest";
import { authMessage } from "@/components/AuthForm";

// authMessage is the single funnel every thrown value passes through before it can ever reach
// setError -> JSX. It must ALWAYS return a plain, non-empty string, no matter what is thrown, so a
// raw object/Error/symbol can never render as "{}" or "[object Object]" on the signup/login screen.
describe("authMessage (signup/login error hardening)", () => {
  it("a real Error uses its message", () => {
    expect(authMessage(new Error("Invalid login credentials"))).toContain("email or password");
  });

  it("a plain object with a message field is read, not rendered as an object", () => {
    expect(typeof authMessage({ message: "Email not confirmed" })).toBe("string");
    expect(authMessage({ message: "Email not confirmed" })).toContain("confirm your email");
  });

  it("a bare string throw is passed through", () => {
    expect(authMessage("network request failed")).toContain("reach the server");
  });

  it("an empty object, null, undefined, or a symbol NEVER renders as an object literal", () => {
    for (const v of [{}, null, undefined, Symbol("x"), 42, []]) {
      const msg = authMessage(v);
      expect(typeof msg).toBe("string");
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).not.toBe("{}");
      expect(msg).not.toContain("[object Object]");
    }
  });

  it("maps known Supabase auth errors to clean, on-brand copy", () => {
    expect(authMessage(new Error("User already registered"))).toContain("already exists");
    expect(authMessage(new Error("Email rate limit exceeded"))).toContain("Too many attempts");
  });

  it("never leaks a vendor name or a raw technical error code", () => {
    expect(authMessage(new Error("AuthApiError: unexpected_failure"))).toBe("Something went wrong. Please try again.");
    expect(authMessage(new Error("PGRST116"))).toBe("Something went wrong. Please try again.");
    const msg = authMessage(new Error("Invalid login credentials"));
    expect(msg.toLowerCase()).not.toContain("supabase");
  });

  it("shows a real specific sentence from the client as is", () => {
    expect(authMessage(new Error("Password should be at least 6 characters."))).toContain("6 characters");
  });

  it("a client-config failure (getBrowserClient's env-validation throw) never leaks to the user", () => {
    const msg = authMessage(new Error("client_config_error"));
    expect(msg).toBe("Something went wrong. Please try again.");
    expect(msg.toLowerCase()).not.toContain("supabase");
    expect(msg.toLowerCase()).not.toContain("env");
    expect(msg.toLowerCase()).not.toContain("config");
  });
});
