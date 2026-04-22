/** URL para “cómo llegar” hasta un punto (origen: ubicación actual del usuario en la app de mapas). */

export function directionsUrlTo(latitude: number, longitude: number): string {
  const dest = `${latitude},${longitude}`;
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) {
      return `https://maps.apple.com/?daddr=${encodeURIComponent(dest)}`;
    }
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
}
