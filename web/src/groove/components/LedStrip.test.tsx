import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { LedStrip } from "./LedStrip";
import { STEPS } from "../types";

function leds(container: HTMLElement) {
  return [...container.querySelectorAll(".led")];
}

describe("LedStrip", () => {
  it("lights only the current step", () => {
    const { container } = render(<LedStrip current={5} />);
    const lit = leds(container).filter((led) => led.classList.contains("on"));
    expect(lit).toHaveLength(1);
    expect(leds(container).indexOf(lit[0])).toBe(5);
  });

  it("marks every fourth step as a beat", () => {
    const { container } = render(<LedStrip current={0} />);
    const beats = leds(container)
      .map((led, i) => (led.classList.contains("beat") ? i : -1))
      .filter((i) => i >= 0);
    expect(leds(container)).toHaveLength(STEPS);
    expect(beats).toEqual([0, 4, 8, 12]);
  });
});
