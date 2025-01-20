interface ComponentHandler {
  upgradeElement(_el: HTMLElement): void;
  upgradeAllRegistered(): void;
}

declare let componentHandler: ComponentHandler;

export function upgradeElement(el: HTMLElement): void {
  if ("componentHandler" in window) {
    componentHandler.upgradeElement(el);
  } else {
    setTimeout(() => upgradeElement(el), 10);
  }
}

export function upgradeAllRegistered(): void {
  if ("componentHandler" in window) {
    componentHandler.upgradeAllRegistered();
  } else {
    setTimeout(() => upgradeAllRegistered(), 10);
  }
}

// define a proxy since componentHandler is a defered load
export default {
  upgradeElement(el: HTMLElement): void {
    return componentHandler.upgradeElement(el);
  },

  upgradeAllRegistered(): void {
    componentHandler.upgradeAllRegistered();
  },
};
