import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "@tribeos/ui";

import { Wordmark } from "@/components/layout/wordmark";

describe("frontend foundation", () => {
  it("renders a UI primitive from @tribeos/ui", () => {
    render(<Button>Continue</Button>);
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("renders the brand wordmark", () => {
    const { container } = render(<Wordmark />);
    expect(container.textContent).toBe("TR!BE");
  });
});
