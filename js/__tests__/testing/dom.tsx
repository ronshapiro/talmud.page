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

/** Runs `body` inside `act()`, flushing the state updates and effects it triggers. */
export function flush(body: () => void): void {
  act(body);
}

/**
 * Runs `body` inside an async `act()`, then lets pending promises settle. Use when the code under
 * test renders as the result of a resolved promise, as the api-backed page loads do.
 */
export async function flushAsync(body: () => Promise<void> | void = () => {}): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/await-thenable
  await act(async () => {
    await body();
    await new Promise(resolve => setImmediate(resolve));
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
