let blockImport = false;

export function setBlockHtmlVisitorImports(value: boolean): void {
  blockImport = value;
}

export function checkImportsAreAllowed(): void {
  if (blockImport) {
    throw new Error(
      `source_formatting/html_visitor.ts is being loaded eagerly, but the JSDOM import is really
slow! Prefer to load this lazily using import() statements`);
  }
}
