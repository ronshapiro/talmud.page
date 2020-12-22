import {findNodeOffset} from "../dom";

function createTree(text: string) {
  const element = document.createElement("span");
  element.innerHTML = text;
  return element;
}

function children(node: Node): Node[] {
  return Array.from(node.childNodes);
}

test("start", () => {
  const tree = createTree("start <b>middle</b> end");
  const search = children(tree)[0];
  expect((search as Text).data).toBe("start ");
  expect(findNodeOffset(tree, search)).toBe(0);
});

test("only text", () => {
  const tree = createTree("start <b>middle</b> end");
  const search = children(children(tree)[1])[0];
  expect((search as Text).data).toBe("middle");
  expect(findNodeOffset(tree, search)).toBe(6);
});

test("end", () => {
  const tree = createTree("start <b>middle</b> end");
  const search = children(tree)[2];
  expect((search as Text).data).toBe(" end");
  expect(findNodeOffset(tree, search)).toBe(12);
});

test("complex", () => {
  const tree = createTree("<b>start</b> * <div><b>middle<span></span><i>find me</i></b></div> end");
  const div = children(tree)[2];
  const bold = children(div)[0];
  const italics = children(bold)[2];
  const search = children(italics)[0];
  expect((search as Text).data).toBe("find me");
  expect(findNodeOffset(tree, search)).toBe(14);
});
