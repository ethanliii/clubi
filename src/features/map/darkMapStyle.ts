/**
 * The map's look on Google Maps (Android): the standard light street map with the clutter taken out
 * (no business icons, no transit), so the score pins are the only coloured things on it. Apple Maps
 * on iOS is light through `userInterfaceStyle="light"` and needs none of this.
 * (The file keeps its old name; it used to hold the dark style.)
 */
export const LIGHT_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#f5f5f3" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#6d6d78" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#d9d9de" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }, { color: "#dcefd9" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e6e6ea" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#ececef" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8f8f9a" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#cfe3f2" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#6f8ea8" }] },
];
