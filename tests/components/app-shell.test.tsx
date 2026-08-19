import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";
import RootLayout from "@/app/layout";

describe("application shell", () => {
  it("uses the full-width site container for the page background treatment", () => {
    const layout = RootLayout({ children: <div /> });
    const body = layout.props.children;

    expect(body.type).toBe("body");
    expect(body.props.className).toBe("tceb-full-container tceb-full-container--soft");
  });

  it("renders the Thai product title and create action", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: "แผนงานจัดซื้อจัดจ้าง" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "สร้าง Timeline" }),
    ).toBeInTheDocument();
  });
});
