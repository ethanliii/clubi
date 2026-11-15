/**
 * A dark look for Google Maps (Android), in the app's purple-black. Apple Maps on iOS goes dark
 * through `userInterfaceStyle="dark"` and needs none of this.
 */
export const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#17141d" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8d869b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#141119" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2f2a3a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }, { color: "#182219" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2533" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1b1822" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a3346" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9a92a9" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0c1420" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4a5a70" }] },
];
