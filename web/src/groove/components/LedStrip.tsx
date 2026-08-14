import { STEPS } from "../types";

export function LedStrip({ current }: { current: number }) {
  return (
    <div className="leds">
      {Array.from({ length: STEPS }, (_, i) => (
        <span
          key={i}
          className={`led${i === current ? " on" : ""}${i % 4 === 0 ? " beat" : ""}`}
        />
      ))}
    </div>
  );
}
