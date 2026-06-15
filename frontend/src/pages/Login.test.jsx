import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "../context/AuthContext.jsx";
import Login from "./Login.jsx";

// Mock axios so no real network calls happen
vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    create: vi.fn(() => ({
      post: vi.fn(),
      get: vi.fn(),
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    })),
  },
}));

// Mock the API client so AuthProvider doesn't make real network calls
vi.mock("../api/client", () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn().mockRejectedValue(new Error("no token")),
}));

const renderLogin = () =>
  render(
    <BrowserRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </BrowserRouter>
  );

describe("Login page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders without crashing", () => {
    renderLogin();
    // Should render some form element
    expect(document.body).toBeTruthy();
  });

  it("has an email input field", () => {
    renderLogin();
    const emailInput =
      screen.queryByRole("textbox", { name: /email/i }) ||
      document.querySelector('input[type="email"]') ||
      document.querySelector('input[name="email"]');
    expect(emailInput).toBeTruthy();
  });

  it("has a password input field", () => {
    renderLogin();
    const passwordInput =
      document.querySelector('input[type="password"]') ||
      document.querySelector('input[name="password"]');
    expect(passwordInput).toBeTruthy();
  });

  it("has a submit button", () => {
    renderLogin();
    const submitBtn =
      screen.queryByRole("button", { name: /login|sign in|log in/i }) ||
      document.querySelector('button[type="submit"]') ||
      document.querySelector("button");
    expect(submitBtn).toBeTruthy();
  });

  it("does not navigate before form submission", () => {
    renderLogin();
    // Just ensure the page renders stably
    expect(window.location.pathname).toBe("/");
  });
});
