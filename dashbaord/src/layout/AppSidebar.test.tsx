import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import AppSidebar from "./AppSidebar";
import { SidebarProvider, useSidebar } from "../context/SidebarContext";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ isSuperAdmin: true, isLoading: false }) }));
vi.mock("./sidebarNav", () => ({
  useSidebarSections: () => [
    { title: "Menu", items: [{ name: "Dashboard", icon: <span />, path: "/" }], type: "main", menuType: "main" },
  ],
}));

const Toggle = () => {
  const { toggleSidebar } = useSidebar();
  return <button onClick={toggleSidebar}>toggle</button>;
};

const setup = () => {
  const { container } = render(
    <MemoryRouter>
      <SidebarProvider>
        <Toggle />
        <AppSidebar />
      </SidebarProvider>
    </MemoryRouter>,
  );
  return container.querySelector("aside") as HTMLElement;
};

describe("AppSidebar collapse and hover", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1440 });
  });

  it("the toggle collapses it and opens it again", () => {
    const aside = setup();
    expect(aside.className).toContain("w-[232px]");

    fireEvent.click(screen.getByText("toggle"));
    expect(aside.className).toContain("w-[72px]");

    fireEvent.click(screen.getByText("toggle"));
    expect(aside.className).toContain("w-[232px]");
  });

  it("opens on hover while collapsed and closes when the mouse leaves", () => {
    const aside = setup();
    fireEvent.click(screen.getByText("toggle"));

    fireEvent.mouseEnter(aside);
    expect(aside.className).toContain("w-[232px]");

    fireEvent.mouseLeave(aside);
    expect(aside.className).toContain("w-[72px]");
  });

  it("the toggle still works after hovering", () => {
    const aside = setup();
    fireEvent.click(screen.getByText("toggle"));
    fireEvent.mouseEnter(aside);
    fireEvent.mouseLeave(aside);

    fireEvent.click(screen.getByText("toggle"));
    expect(aside.className).toContain("w-[232px]");
  });

  it("does not collapse an open sidebar when the mouse leaves it", () => {
    const aside = setup();

    fireEvent.mouseEnter(aside);
    fireEvent.mouseLeave(aside);

    expect(aside.className).toContain("w-[232px]");
  });
});
