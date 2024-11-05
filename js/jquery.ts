// @ts-ignore
import jQuery from "jquery";

export const $ = jQuery;

export function addJqueryExtensionMethods(): void {
  $.fn.extend({
    betterDoubleClick(fn: (event?: any) => void) {
      this.off("betterDoubleClick");
      this.on("betterDoubleClick", fn);
      if (!!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)) {
        let lastTime = 0;
        this.off("click");
        this.click((event: any) => {
          const now = Date.now();
          if (now - lastTime <= 1000) {
            fn(event);
            lastTime = 0;
          } else {
            lastTime = now;
          }
        });
      } else {
        this.off("dblclick");
        this.dblclick(fn);
      }
      return this;
    },
    isInViewport() {
      const elementTop = $(this).offset().top;
      const elementBottom = elementTop + $(this).outerHeight();

      const viewportTop = $(window).scrollTop();
      const viewportBottom = viewportTop + $(window).height();

      return elementBottom > viewportTop && elementTop < viewportBottom;
    },
  });
}
