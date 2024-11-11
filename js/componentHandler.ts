interface ComponentHandler {
  upgradeElement(_el: HTMLElement): void;
  upgradeAllRegistered(): void;
}

declare const componentHandler: ComponentHandler;

// define a proxy since componentHandler is a defered load
export default {
  upgradeElement(el: HTMLElement): void {
    return componentHandler.upgradeElement(el);
  },

  upgradeAllRegistered(): void {
    componentHandler.upgradeAllRegistered();
  },
};
