import componentHandler from "../componentHandler";

afterEach(() => {
  delete (window as any).componentHandler;
  jest.useRealTimers();
});

test("upgradeElement retries once componentHandler exists, instead of throwing", () => {
  jest.useFakeTimers();
  const el = document.createElement("div");
  const upgraded: HTMLElement[] = [];

  expect(() => componentHandler.upgradeElement(el)).not.toThrow();
  expect(upgraded).toEqual([]);

  (window as any).componentHandler = {
    upgradeElement: (x: HTMLElement) => upgraded.push(x),
    upgradeAllRegistered: () => {},
  };
  jest.advanceTimersByTime(10);

  expect(upgraded).toEqual([el]);
});

test("calls through immediately when componentHandler already exists", () => {
  const upgraded: HTMLElement[] = [];
  (window as any).componentHandler = {
    upgradeElement: (x: HTMLElement) => upgraded.push(x),
    upgradeAllRegistered: () => {},
  };
  const el = document.createElement("div");

  componentHandler.upgradeElement(el);

  expect(upgraded).toEqual([el]);
});
