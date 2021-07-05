const handler = (event: BeforeUnloadEvent) => {
  const message = "Stay on the page?";
  event.preventDefault();
  (event || window.event).returnValue = message;
  return message;
};

export function enableBackButtonProtection(): void {
  if (window.location.hostname !== "localhost") {
    window.addEventListener("beforeunload", handler);
  }
}

export function disableBackButtonProtection(): void {
  window.removeEventListener("beforeunload", handler);
}
