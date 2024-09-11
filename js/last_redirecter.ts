if (localStorage.lastUrl === undefined) {
  document.getElementById("progress-bar")!.hidden = true;
  document.getElementById("errors")!.hidden = false;
} else {
  window.location.replace(localStorage.lastUrl);
}
