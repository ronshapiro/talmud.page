/**
 * `Runner`, the object that wires the URL to the API to the `Renderer`.
 *
 * The api layer is replaced with a stub: `ApiCache` speaks to the network over `$.ajax` and
 * persists to IndexedDB, neither of which exists here, and neither of which is what these tests
 * are about. Everything else — the loading placeholder, the URL rewriting, the amud arithmetic,
 * and the resulting render — is the real code.
 */
// @ts-ignore -- page_runner is still plain JS; see "page_runner.js / *_renderer.js are still
// untyped JS" in FrontendTestabilitySuggestions.md.
import {Runner} from "../page_runner";
import {MountedRenderer, mountRenderer} from "./testing/renderer_harness";
import {click, flush, flushAsync, flushTimers, unmountAll} from "./testing/dom";
import {
  GtagCall,
  clearPageEnvironment,
  installPageEnvironment,
} from "./testing/page_environment";
import {page, resetFixtureCounter, segment} from "./testing/fixtures";

let gtagCalls: GtagCall[];

beforeEach(() => {
  gtagCalls = installPageEnvironment({book: "Berakhot", path: "/Berakhot/2a"}).gtagCalls;
  resetFixtureCounter();
});
afterEach(() => {
  unmountAll();
  document.getElementById("main-contents")?.remove();
  clearPageEnvironment();
});

interface FakeApi {
  /** Endpoints requested, in order, e.g. "api/Berakhot/2b". */
  requests: string[];
  /** Makes the next response for `section` fail with `error`. */
  failWith: (error: any) => void;
}

function setUpRunner(app: MountedRenderer): {runner: any, api: FakeApi} {
  const driveClient = {
    commentsForRef: () => undefined,
    highlightsForRef: () => [],
  };
  const runner = new Runner(app.renderer, driveClient);

  const api: FakeApi = {requests: [], failWith: () => {}};
  let nextError: any;
  api.failWith = (error: any) => { nextError = error; };
  runner.apiCache = {
    getAndUpdate: (endpoint: string, errorCallback: (error: any) => void) => {
      api.requests.push(endpoint);
      if (nextError) {
        const error = nextError;
        nextError = undefined;
        errorCallback(error);
        return new Promise(() => {}); // the real code leaves the request pending and retries
      }
      const id = endpoint.split("/").pop()!;
      return Promise.resolve(page({
        id,
        title: `Berakhot ${id}`,
        sections: [segment({ref: `Berakhot ${id}:1`, he: `עברית ${id}`, en: `english ${id}`})],
      }));
    },
    purge: () => {},
  };
  return {runner, api};
}

const visiblePages = (app: MountedRenderer) => app.all(".amudContainer").map(x => x.id);
const path = () => window.location.pathname;

describe("url arithmetic", () => {
  test("a single-section range is just the section", () => {
    const app = mountRenderer([page({id: "2a"})]);
    const {runner} = setUpRunner(app);

    expect(runner.newUrlRange("2a", "2a")).toBe("http://localhost/Berakhot/2a");
  });

  test("a multi-section range uses the to form", () => {
    const app = mountRenderer([page({id: "2a"})]);
    const {runner} = setUpRunner(app);

    expect(runner.newUrlRange("2a", "3b")).toBe("http://localhost/Berakhot/2a/to/3b");
  });

  test("spaces in a book name become underscores", () => {
    installPageEnvironment({book: "Moed Katan", path: "/Moed_Katan/2a"});
    const app = mountRenderer([page({id: "2a"})]);
    const {runner} = setUpRunner(app);

    expect(runner.newUrlRange("2a", "2b")).toBe("http://localhost/Moed_Katan/2a/to/2b");
  });
});

describe("requesting a section", () => {
  test("a spinning, titled placeholder is shown while the request is in flight", async () => {
    // `requestSection` registers the placeholder *before* extending the url to cover it, and the
    // renderer only shows pages named by the url range. React's batching is what makes this work:
    // the render is deferred to the end of the surrounding batch, by which point the url covers
    // the new page. The batch is what the test must reproduce, hence `flush`.
    const app = mountRenderer([page({id: "2a"})]);
    const {runner} = setUpRunner(app);

    flush(() => runner.requestSection("2b", {newUrl: runner.newUrlRange("2a", "2b")}));

    expect(visiblePages(app)).toEqual(["amud-2a", "amud-2b"]);
    expect(app.textsOf(".title")).toEqual(["Berakhot 2a", "Berakhot 2b"]);
    expect(app.all(".text-loading-spinner")).toHaveLength(1);

    await flushAsync(); // let the queued request settle before the test ends
  });

  test("the placeholder appears when the reader clicks the load button", async () => {
    // The production trigger. A click handler is a React batch, so the ordering inside
    // `requestSection` is safe here for the same reason as above.
    const app = mountRenderer([page({id: "2a"})]);
    setUpRunner(app);

    click(app.find(".navigation-button-container.next span[role=button]"));

    expect(visiblePages(app)).toEqual(["amud-2a", "amud-2b"]);
    expect(app.all(".text-loading-spinner")).toHaveLength(1);

    await flushAsync();
  });

  test("the response replaces the placeholder", async () => {
    const app = mountRenderer([page({id: "2a"})]);
    const {runner, api} = setUpRunner(app);

    await flushAsync(() => {
      runner.requestSection("2b", {newUrl: runner.newUrlRange("2a", "2b")});
    });

    expect(api.requests).toEqual(["api/Berakhot/2b"]);
    expect(app.all(".text-loading-spinner")).toHaveLength(0);
    expect(app.textsOf(".gemara-container .table-cell.hebrew")).toContain("עברית 2b");
  });

  test("the url is updated as soon as the request starts", async () => {
    const app = mountRenderer([page({id: "2a"})]);
    const {runner} = setUpRunner(app);

    flush(() => runner.requestSection("2b", {newUrl: runner.newUrlRange("2a", "2b")}));

    expect(path()).toBe("/Berakhot/2a/to/2b");

    await flushAsync();
  });

  test("the document title follows the loaded range", async () => {
    const app = mountRenderer([page({id: "2a"})]);
    const {runner} = setUpRunner(app);

    flush(() => runner.requestSection("2b", {newUrl: runner.newUrlRange("2a", "2b")}));

    expect(document.title).toBe("Berakhot 2a - 2b");

    await flushAsync();
  });

  test("an error is surfaced on the placeholder", async () => {
    const app = mountRenderer([page({id: "2a"})]);
    const {runner, api} = setUpRunner(app);
    api.failWith({status: 500, responseText: "Server is down"});

    await flushAsync(() => {
      runner.requestSection("2b", {newUrl: runner.newUrlRange("2a", "2b")});
    });

    expect(app.container.textContent).toContain("Server is down");
    expect(app.all(".text-loading-spinner")).toHaveLength(1);
  });

  test("a 404 is reported as a server error", async () => {
    const app = mountRenderer([page({id: "2a"})]);
    const {runner, api} = setUpRunner(app);
    api.failWith({status: 404, responseText: "not found"});

    await flushAsync(() => {
      runner.requestSection("2b", {newUrl: runner.newUrlRange("2a", "2b")});
    });

    expect(app.container.textContent).toContain("Server Error");
  });
});

describe("loading the next section", () => {
  test("appends the following amud and extends the url", async () => {
    const app = mountRenderer([page({id: "2a"})]);
    const {runner, api} = setUpRunner(app);

    await flushAsync(() => { runner.addNextSection(); });

    expect(api.requests[0]).toBe("api/Berakhot/2b");
    expect(visiblePages(app)).toEqual(["amud-2a", "amud-2b"]);
    expect(path()).toBe("/Berakhot/2a/to/2b");
  });

  test("is reported to analytics", async () => {
    const app = mountRenderer([page({id: "2a"})]);
    const {runner} = setUpRunner(app);

    await flushAsync(() => { runner.addNextSection(); });

    expect(gtagCalls.find(x => x.event === "load_section")!.parameters)
      .toEqual({direction: "next", section: "2b"});
  });

  test("the navigation extension exposes it to the next button", async () => {
    const app = mountRenderer([page({id: "2a"})]);
    const {api} = setUpRunner(app);

    await flushAsync(() => { app.renderer.navigationExtension.loadNext(); });

    expect(visiblePages(app)).toEqual(["amud-2a", "amud-2b"]);
    // Loading a page also warms the cache for the one after it.
    expect(api.requests).toEqual(["api/Berakhot/2b", "api/Berakhot/3a"]);
  });
});

describe("loading the previous section", () => {
  test("prepends the preceding amud and extends the url backwards", async () => {
    installPageEnvironment({book: "Berakhot", path: "/Berakhot/3a"});
    const app = mountRenderer([page({id: "3a"})]);
    const {runner, api} = setUpRunner(app);

    await flushAsync(() => { runner.addPreviousSection(); });

    expect(api.requests[0]).toBe("api/Berakhot/2b");
    expect(visiblePages(app)).toEqual(["amud-2b", "amud-3a"]);
    expect(path()).toBe("/Berakhot/2b/to/3a");

    // Loading a previous page schedules a scroll back to where the reader was.
    await flushTimers();
  });

  test("is reported to analytics", async () => {
    // Re-installing the environment replaces the gtag capture, so rebind it.
    gtagCalls = installPageEnvironment({book: "Berakhot", path: "/Berakhot/3a"}).gtagCalls;
    const app = mountRenderer([page({id: "3a"})]);
    const {runner} = setUpRunner(app);

    await flushAsync(() => { runner.addPreviousSection(); });

    expect(gtagCalls.find(x => x.event === "load_section")!.parameters)
      .toEqual({direction: "previous", section: "2b"});

    await flushTimers();
  });
});

describe("removing sections", () => {
  const threeLoaded = async () => {
    installPageEnvironment({book: "Berakhot", path: "/Berakhot/2a"});
    const app = mountRenderer([page({id: "2a"})]);
    const setup = setUpRunner(app);
    await flushAsync(() => { setup.runner.addNextSection(); });
    await flushAsync(() => { setup.runner.addNextSection(); });
    return {app, ...setup};
  };

  test("three sections load into a single range", async () => {
    const {app} = await threeLoaded();

    expect(visiblePages(app)).toEqual(["amud-2a", "amud-2b", "amud-3a"]);
    expect(path()).toBe("/Berakhot/2a/to/3a");
  });

  test("removing the first drops it from the url and the page", async () => {
    const {app, runner} = await threeLoaded();

    await flushAsync(() => { runner.removeFirstSection(); });

    expect(path()).toBe("/Berakhot/2b/to/3a");
    expect(visiblePages(app)).toEqual(["amud-2b", "amud-3a"]);
  });

  test("removing the last drops it from the url and the page", async () => {
    const {app, runner} = await threeLoaded();

    await flushAsync(() => { runner.removeLastSection(); });

    expect(path()).toBe("/Berakhot/2a/to/2b");
    expect(visiblePages(app)).toEqual(["amud-2a", "amud-2b"]);
  });

  test("removing down to one section uses the single-section url", async () => {
    const {app, runner} = await threeLoaded();

    await flushAsync(() => { runner.removeLastSection(); });
    await flushAsync(() => { runner.removeLastSection(); });

    expect(path()).toBe("/Berakhot/2a");
    expect(visiblePages(app)).toEqual(["amud-2a"]);
  });

  test("the remove button on the page removes the section", async () => {
    const {app} = await threeLoaded();

    await flushAsync(() => { app.all(".remove-section-button")[0].click(); });

    expect(path()).toBe("/Berakhot/2b/to/3a");
  });
});

describe("precaching neighbors", () => {
  test("the next section is fetched ahead of time", async () => {
    const app = mountRenderer([page({id: "2a"})]);
    const {runner, api} = setUpRunner(app);

    await flushAsync(() => { runner.preloadNextSection(); });

    expect(api.requests).toEqual(["api/Berakhot/2b"]);
  });

  test("precaching does not add the section to the page", async () => {
    const app = mountRenderer([page({id: "2a"})]);
    const {runner} = setUpRunner(app);

    await flushAsync(() => { runner.preloadNextSection(); });

    expect(visiblePages(app)).toEqual(["amud-2a"]);
  });

  test("precaching can be turned off", async () => {
    localStorage.disablePrecaching = "true";
    const app = mountRenderer([page({id: "2a"})]);
    const {runner, api} = setUpRunner(app);

    await flushAsync(() => {
      runner.preloadNextSection();
      runner.preloadPreviousSection();
    });

    expect(api.requests).toEqual([]);
  });

  test("nothing is precached past the end of the book", async () => {
    const app = mountRenderer([page({id: "2a"})]);
    const {runner, api} = setUpRunner(app);
    app.renderer.navigationExtension.hasNext = () => false;

    await flushAsync(() => { runner.preloadNextSection(); });

    expect(api.requests).toEqual([]);
  });
});
