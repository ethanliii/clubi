/**
 * SAMPLE DATA. Every venue, person, and score here is made up.
 * Ported from the design prototype (V/VD venues, F/FD friends, QUIZ) so screens
 * render without the Convex backend. Replace with real queries as the backend lands.
 */

export const IS_SAMPLE_DATA = true;

export type VenueDetail = {
  photos: number;
  photoBy: string[];
  live: string;
  price: string;
  address: string;
  ratings: number;
  tonight: string[];
  breakdown: Record<string, number>;
  quotes: { text: string; when: string }[];
  moreTags: string[];
  know: { label: string; value: string }[];
  hours: string;
};

export type Venue = {
  id: string;
  name: string;
  type: string;
  area: string;
  dist: string;
  match: number;
  avg: number;
  hue: number;
  tags: string[];
  friendIds: string[];
  peak: number;
  detail?: VenueDetail;
};

export type FriendRecent = {
  venueId: string;
  score: number;
  when: string;
  note: string;
};

export type FriendDetail = {
  school: string;
  bio: string;
  mutualIds: string[];
  dims: Record<string, number>;
  both: string[];
  disagree: string;
  recent: FriendRecent[];
  topVenueIds: string[];
};

export type Friend = {
  id: string;
  name: string;
  initials: string;
  hue: number;
  agree: number;
  detail?: FriendDetail;
};

export type QuizQuestion = {
  id: "music" | "crowd" | "budget" | "timing";
  question: string;
  options: string[];
};

export const venues: Venue[] = [
  {
    id: "0",
    name: "The Patio Room",
    type: "Bar",
    area: "Palo Alto",
    dist: "0.4 mi",
    match: 94,
    avg: 7.1,
    hue: 330,
    tags: ["Chill", "Great music", "Outdoor"],
    friendIds: ["0", "2", "3"],
    peak: 3,
    detail: {
      photos: 12,
      photoBy: ["Alex", "Priya", "Jordan", "You"],
      live: "Open · Busy now",
      price: "$$",
      address: "Emerson St & University Ave",
      ratings: 214,
      tonight: ["DJ Nova · deep house", "10 PM – 1 AM · no cover before 10"],
      breakdown: { Music: 9.2, Crowd: 8.4, Vibe: 9.5, Value: 7.6, Service: 8.1 },
      quotes: [
        { text: "Best patio in PA. Got there at 10:30 and it was perfect.", when: "Last Friday · 3 photos" },
        { text: "Music was great, drinks a little pricey.", when: "2 weeks ago" },
        { text: "Go early, the line gets long after 11.", when: "Last month" },
      ],
      moreTags: ["String lights", "Dance floor", "Heaters"],
      know: [
        { label: "Cover", value: "$10 after 10 PM" },
        { label: "Age", value: "21+, ID checked" },
        { label: "Dress", value: "Casual" },
        { label: "Wait", value: "~15 min at 11 PM" },
      ],
      hours: "Thu–Sat · 6 PM – 1:30 AM",
    },
  },
  { id: "1", name: "Skyline 25", type: "Rooftop", area: "Palo Alto", dist: "0.6 mi", match: 91, avg: 7.6, hue: 265, tags: ["Sunset views", "Dressy", "Cocktails"], friendIds: ["1", "4"], peak: 1 },
  { id: "2", name: "Row Party Friday", type: "Event", area: "Stanford", dist: "0.2 mi", match: 90, avg: 6.8, hue: 10, tags: ["Packed", "Free", "Hip-hop"], friendIds: ["0", "1", "2", "4"], peak: 4 },
  { id: "3", name: "Neon Garden", type: "Bar & lounge", area: "Palo Alto", dist: "0.7 mi", match: 86, avg: 7.9, hue: 160, tags: ["Lively", "Good for groups"], friendIds: ["3"], peak: 2 },
  { id: "4", name: "Basement", type: "Club", area: "SF · SoMa", dist: "31 mi", match: 83, avg: 8.4, hue: 290, tags: ["Techno", "Late night", "Long line"], friendIds: ["2"], peak: 5 },
  { id: "5", name: "Laugh Track", type: "Comedy", area: "SF · North Beach", dist: "33 mi", match: 77, avg: 8.1, hue: 40, tags: ["Seated", "Date spot"], friendIds: [], peak: 2 },
  { id: "6", name: "Velvet", type: "Club", area: "San Jose", dist: "14 mi", match: 71, avg: 8.6, hue: 350, tags: ["EDM", "Bottle service"], friendIds: ["1"], peak: 5 },
  { id: "7", name: "Lucky Fox", type: "Pub", area: "Palo Alto", dist: "0.5 mi", match: 62, avg: 7.4, hue: 200, tags: ["Sports", "Cheap drinks"], friendIds: ["4"], peak: 1 },
];

export const friends: Friend[] = [
  {
    id: "0",
    name: "Alex Chen",
    initials: "AC",
    hue: 200,
    agree: 82,
    detail: {
      school: "Stanford '29 · CS",
      bio: "Will rank every patio in Palo Alto. House and disco, never EDM.",
      mutualIds: ["3", "1"],
      dims: { Music: 91, Crowd: 76, Budget: 83, Timing: 70 },
      both: ["House", "Patios", "Small crowds", "Late dinners"],
      disagree: "Velvet. You 4.1, Alex 8.9.",
      recent: [
        { venueId: "0", score: 9.4, when: "Last Friday", note: "Ranked #1. DJ Nova was unreal." },
        { venueId: "3", score: 8.7, when: "Last Saturday", note: "Great for a group of 8" },
        { venueId: "2", score: 7.9, when: "2 weeks ago", note: "Packed, fun, way too hot" },
      ],
      topVenueIds: ["0", "3", "2", "1"],
    },
  },
  { id: "1", name: "Maya Ruiz", initials: "MR", hue: 20, agree: 74 },
  { id: "2", name: "Jordan Kim", initials: "JK", hue: 140, agree: 69 },
  { id: "3", name: "Priya Shah", initials: "PS", hue: 300, agree: 88 },
  { id: "4", name: "Sam Torres", initials: "ST", hue: 50, agree: 57 },
];

export const quiz: QuizQuestion[] = [
  { id: "music", question: "What music gets you out?", options: ["House", "Hip-hop", "Pop", "Techno", "Latin", "Live bands"] },
  { id: "crowd", question: "Your ideal crowd?", options: ["Intimate", "Lively", "Packed", "Don't care"] },
  { id: "budget", question: "Budget for a night out?", options: ["Under $20", "$20–50", "$50–100", "$100+"] },
  { id: "timing", question: "When does your night peak?", options: ["Before 10", "10 to 12", "After midnight", "Sunrise"] },
];

export const TASTE_TWINS_NEARBY = 214;

export function getVenue(id: string): Venue | undefined {
  return venues.find((venue) => venue.id === id);
}

export function getFriend(id: string): Friend | undefined {
  return friends.find((friend) => friend.id === id);
}
