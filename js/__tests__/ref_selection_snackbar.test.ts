import {onSelectionChangeForTesting} from "../ref_selection_snackbar";
import {snackbars} from "../snackbar";

describe("ref_selection_snackbar text selection search integration", () => {
  let originalGetSelection: typeof document.getSelection;
  let mockSelection: {
    type: string;
    toString: () => string;
    anchorNode: Node | null;
    focusNode: Node | null;
    empty: jest.Mock;
    removeAllRanges: jest.Mock;
  };

  beforeEach(() => {
    originalGetSelection = document.getSelection;
    mockSelection = {
      type: "Range",
      toString: () => "some query",
      anchorNode: document.body,
      focusNode: document.body,
      empty: jest.fn(),
      removeAllRanges: jest.fn(),
    };
    document.getSelection = () => mockSelection as any;
    (window as any).SET_TEMPORARY_SEARCH = jest.fn().mockReturnValue("yellow");
    (window as any).CLEAR_TEMPORARY_SEARCH = jest.fn();
    (window as any).GET_TEMPORARY_SEARCH_COLOR = jest.fn().mockReturnValue("yellow");
    (window as any).SEARCH = jest.fn();
    jest.spyOn(snackbars.textSelection, "show").mockImplementation(async () => {});
    jest.spyOn(snackbars.textSelection, "hide").mockImplementation(async () => {});
  });

  afterEach(() => {
    document.getSelection = originalGetSelection;
    delete (window as any).SET_TEMPORARY_SEARCH;
    delete (window as any).CLEAR_TEMPORARY_SEARCH;
    delete (window as any).GET_TEMPORARY_SEARCH_COLOR;
    delete (window as any).SEARCH;
    jest.restoreAllMocks();
  });

  test("triggers SET_TEMPORARY_SEARCH when text is selected", () => {
    mockSelection.type = "Range";
    mockSelection.toString = () => "selected words";

    onSelectionChangeForTesting();

    expect((window as any).SET_TEMPORARY_SEARCH).toHaveBeenCalledWith("selected words");
    expect((window as any).CLEAR_TEMPORARY_SEARCH).not.toHaveBeenCalled();
  });

  test("triggers CLEAR_TEMPORARY_SEARCH when selection is empty", () => {
    mockSelection.type = "Caret";
    mockSelection.toString = () => "";

    onSelectionChangeForTesting();

    expect((window as any).CLEAR_TEMPORARY_SEARCH).toHaveBeenCalled();
    expect((window as any).SET_TEMPORARY_SEARCH).not.toHaveBeenCalled();
  });

  test("ignores selection change when anchorNode is inside snackbarHost or modal", () => {
    const searchHostElement = document.createElement("div");
    searchHostElement.id = "snackbarHost";
    const textNode = document.createTextNode("in search bar");
    searchHostElement.append(textNode);
    document.body.append(searchHostElement);

    mockSelection.anchorNode = textNode;
    mockSelection.focusNode = textNode;
    mockSelection.toString = () => "in search bar";

    onSelectionChangeForTesting();

    expect((window as any).SET_TEMPORARY_SEARCH).not.toHaveBeenCalled();
    expect((window as any).CLEAR_TEMPORARY_SEARCH).not.toHaveBeenCalled();

    searchHostElement.remove();
  });

  test("renders the search button with the temporary search color class", () => {
    const containerElement = document.createElement("div");
    containerElement.setAttribute("sefaria-ref", "Berakhot 2a:1");
    containerElement.dataset.amud = "2a";
    const hebrewElement = document.createElement("div");
    hebrewElement.className = "hebrew";
    hebrewElement.textContent = "some text";
    containerElement.append(hebrewElement);
    document.body.append(containerElement);

    mockSelection.anchorNode = hebrewElement.firstChild!;
    mockSelection.focusNode = hebrewElement.firstChild!;
    mockSelection.type = "Range";
    mockSelection.toString = () => "some";

    (window as any).GET_TEMPORARY_SEARCH_COLOR = jest.fn().mockReturnValue("purple");

    onSelectionChangeForTesting();

    expect(snackbars.textSelection.show).toHaveBeenCalled();
    const showCall = (snackbars.textSelection.show as jest.Mock).mock.calls[0];
    const buttons = showCall[1];
    const searchButton = buttons.find((button: {text: string}) => button.text.includes("search"));
    expect(searchButton).toBeDefined();
    expect(searchButton.text).toContain("icon-highlight-purple");

    containerElement.remove();
  });
});
