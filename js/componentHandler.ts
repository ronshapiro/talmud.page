interface ComponentHandler {
  upgradeElement(_el: HTMLInputElement): void;
}

declare const componentHandler: ComponentHandler;

// define a proxy since componentHandler is a defered load
export default {
  upgradeElement(el: HTMLInputElement): void {
    return componentHandler.upgradeElement(el);
  },
};
