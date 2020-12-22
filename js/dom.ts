export function isTextNode(node: Node): node is Text {
  return node.nodeType === Node.TEXT_NODE && (node as Text).data !== undefined;
}

function depthFirstOrdering(node: Node, nodes: Node[] = []): Node[] {
  node.childNodes.forEach(x => depthFirstOrdering(x, nodes));
  nodes.push(node);
  return nodes;
}

export function preOrderTraversal(node: Node, nodes: Node[] = []): Node[] {
  nodes.push(node);
  node.childNodes.forEach(x => preOrderTraversal(x, nodes));
  return nodes;
}

export function findNodeOffset(
  root: Node,
  search: Node,
): number {
  let offset = 0;
  for (const node of depthFirstOrdering(root)) {
    if (node.isSameNode(search)) {
      return offset;
    }
    if (isTextNode(node)) {
      offset += node.data.length;
    }
  }
  throw new Error("not found!");
}
