import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("application shell", () => {
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
