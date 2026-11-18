// Lets the app shell refresh the signed-in user's name/avatar after the profile page saves changes.
const EVENT = "repcarparts:profile-updated";

export function notifyProfileUpdated() {
  window.dispatchEvent(new Event(EVENT));
}

export function onProfileUpdated(fn) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
