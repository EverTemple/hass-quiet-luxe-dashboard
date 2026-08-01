/**
 * HA-frontend navigation: pushState + the `location-changed` window event the
 * HA router listens for. Used by the room card's tap-to-drill-in.
 */
export function navigate(path: string): void {
  history.pushState(null, '', path);
  window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
}
