const VALID_CLICK_KEY_CODES = new Set(["Enter", " "]);

type OnClickType = () => any;
type KeyListener = (e: any) => any;

export function onClickKeyListener(fn: OnClickType): KeyListener {
  return (e: any) => VALID_CLICK_KEY_CODES.has(e.key) && fn();
}
