import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { AccessibleTabList } from "@/components/ui/AccessibleTabList";

const tabs = [
  { id: "first", label: "First", contentId: "panel-first" },
  { id: "second", label: "Second", contentId: "panel-second" },
  { id: "third", label: "Third", contentId: "panel-third" },
] as const;

function Harness() {
  const [selected, setSelected] = useState<(typeof tabs)[number]["id"]>("first");
  return (
    <>
      <AccessibleTabList
        ariaLabel="Example views"
        idPrefix="example"
        selected={selected}
        tabs={tabs}
        onSelect={setSelected}
      />
      {tabs.map((tab) => (
        <section
          key={tab.id}
          id={tab.contentId}
          role="tabpanel"
          aria-labelledby={`example-tab-${tab.id}`}
          hidden={selected !== tab.id}
        >
          {tab.id}
        </section>
      ))}
    </>
  );
}

describe("AccessibleTabList", () => {
  it("implements roving focus, arrows, Home, and End", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const first = screen.getByRole("tab", { name: "First" });
    expect(first).toHaveAttribute("aria-controls", "panel-first");
    expect(document.getElementById("panel-first")).toHaveAttribute("aria-labelledby", "example-tab-first");
    first.focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Second" })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("second");

    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Third" })).toHaveFocus();

    await user.keyboard("{Home}");
    expect(first).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("tab", { name: "Second" })).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(first).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Third" })).toHaveFocus();
    expect(first).toHaveAttribute("tabindex", "-1");
  });
});
