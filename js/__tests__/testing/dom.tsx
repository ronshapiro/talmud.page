/**
 * Mounting and DOM-interaction helpers for React tests.
 *
 * Everything mounts into a real container attached to `document.body`, because the components
 * under test bind jQuery listeners and measure nodes; a detached or virtual renderer would not
 * exercise that code.
 *
 * All events dispatched here are *native* events, not React's `Simulate`. The components mix
 * React's delegated handlers with jQuery listeners attached directly to nodes (see
 * `betterDoubleClick` in js/jquery.ts), and only native dispatch triggers both.
 */
import * as React from "react";
import {render, unmountComponentAtNode} from "react-dom";
import {act} from "react-dom/test-utils";

const mountedContainers: HTMLElement[] = [];

export function mount(element: React.ReactElement, containerId?: string): HTMLElement {
  const container = document.createElement("div");
  if (containerId) container.id = containerId;
  document.body.append(container);
  mountedContainers.push(container);
  act(() => {
    render(element, container);
  });
  return container;
}

/**
 * Registers a container that something else rendered into (e.g. `Renderer.register`), so that
 * `unmountAll` tears it down too.
 */
export function trackContainer(container: HTMLElement): HTMLElement {
  mountedContainers.push(container);
  return container;
}

/** Re-renders `element` into an already-mounted container, as a prop change would. */
export function rerender(container: HTMLElement, element: React.ReactElement): void {
  act(() => {
    render(element, container);
  });
}

/**
 * Runs `body` inside `act()`, flushing the state updates and effects it triggers.
 *
 * The body's return value is discarded rather than handed to `act`, which warns about anything
 * that is neither undefined nor a promise. Callers routinely pass a concise arrow whose expression
 * happens to evaluate to something (`() => setState(x)`, `() => Mousetrap.trigger("j")`).
 */
export function flush(body: () => unknown): void {
  act(() => {
    body();
  });
}

/**
 * Runs `body` inside an async `act()`, then lets pending promises settle. Use when the code under
 * test renders as the result of a resolved promise, as the api-backed page loads do.
 */
export async function flushAsync(body: () => unknown = () => {}): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/await-thenable
  await act(async () => {
    await body();
    await new Promise(resolve => setImmediate(resolve));
  });
}

/**
 * Lets real timers scheduled by the code under test fire, inside `act()`.
 *
 * Some behavior is deferred with a short `setTimeout` — scroll restoration after a page loads,
 * for instance. Without draining it, the callback runs after the test has torn the DOM down.
 */
export async function flushTimers(milliseconds = 25): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/await-thenable
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, milliseconds));
  });
}

export function unmountAll(): void {
  while (mountedContainers.length > 0) {
    const container = mountedContainers.pop()!;
    act(() => {
      unmountComponentAtNode(container);
    });
    container.remove();
  }
}

function dispatch(node: Element | null | undefined, event: Event): void {
  if (!node) {
    throw new Error(`Cannot dispatch ${event.type} on a missing node`);
  }
  act(() => {
    node.dispatchEvent(event);
  });
}

export function click(node: Element | null | undefined): void {
  dispatch(node, new MouseEvent("click", {bubbles: true, cancelable: true}));
}

export function doubleClick(node: Element | null | undefined): void {
  dispatch(node, new MouseEvent("dblclick", {bubbles: true, cancelable: true}));
}

export function keyUp(node: Element | null | undefined, code: string): void {
  dispatch(node, new KeyboardEvent("keyup", {bubbles: true, cancelable: true, code}));
}

/**
 * Types into a React-controlled input.
 *
 * Assigning `.value` directly is not enough: React tracks the last value it wrote and skips the
 * change event when the DOM value looks unchanged to it. Going through the prototype's setter
 * updates the node without touching React's tracker, so the dispatched event is seen as a change.
 */
export function typeInto(node: Element | null | undefined, value: string): void {
  if (!node) throw new Error("Cannot type into a missing node");
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, "value")!.set!;
  setter.call(node, value);
  dispatch(node, new Event("input", {bubbles: true}));
}

// --- Queries -----------------------------------------------------------------------------------

export function query(root: ParentNode, selector: string): HTMLElement {
  const result = root.querySelector(selector);
  if (!result) {
    throw new Error(`No element matched ${selector}`);
  }
  return result as HTMLElement;
}

export function queryOrNull(root: ParentNode, selector: string): HTMLElement | null {
  return root.querySelector(selector) as HTMLElement | null;
}

export function queryAll(root: ParentNode, selector: string): HTMLElement[] {
  return [...root.querySelectorAll(selector)] as HTMLElement[];
}

export function texts(root: ParentNode, selector: string): string[] {
  return queryAll(root, selector).map(x => x.textContent ?? "");
}

export function classesOf(node: Element): string[] {
  return [...node.classList];
}

/** The value of an attribute that isn't valid HTML and so has no property, e.g. `sefaria-ref`. */
export function attributes(root: ParentNode, selector: string, name: string): (string | null)[] {
  return queryAll(root, selector).map(x => x.getAttribute(name));
}
