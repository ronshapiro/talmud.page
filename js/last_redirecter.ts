if (localStorage.lastUrl === undefined) {
  window.location.replace("/browse");
} else {
  window.location.replace(localStorage.lastUrl);
}
