import { internalMutation } from "./_generated/server";
import type { Category } from "./lib/contract";
import { DEMO_CITY } from "./lib/demo";
import { FEATURES, Feature } from "./lib/recs";

const UNSET_FEATURE = 0.15;
const vec = (set: Partial<Record<Feature, number>>) => FEATURES.map((k) => set[k] ?? UNSET_FEATURE);

type SeedPlace = {
  sourceId: string;
  name: string;
  category: Category;
  subcategory: string;
  lat: number;
  lng: number;
  address?: string;
  blurb: string;
  priceLevel: number;
  tags: string[];
  venueVector: number[];
};

const DEMO_TAG = "demo";

export const SEED_PLACES: SeedPlace[] = [
  { sourceId: "dogpatch-saloon", name: "Dogpatch Saloon", category: "nightlife", subcategory: "bar", lat: 37.758035, lng: -122.388525, address: "2496 3rd St", blurb: "Corner neighborhood bar with a fireplace and Sunday jazz.", priceLevel: 2, tags: ["neighborhood bar", "jazz"], venueVector: vec({ energy: 0.5, loudness: 0.5, crowdAge: 0.4, price: 0.4, liveMusic: 0.4, indie: 0.4 }) },
  { sourceId: "third-rail", name: "Third Rail", category: "nightlife", subcategory: "cocktail bar", lat: 37.760629, lng: -122.388354, address: "628 20th St", blurb: "Craft cocktails and house-made jerky a block from Pier 70.", priceLevel: 3, tags: ["cocktails", "date spot"], venueVector: vec({ energy: 0.5, loudness: 0.45, crowdAge: 0.5, price: 0.6, indie: 0.4, food: 0.3 }) },
  { sourceId: "the-sea-star", name: "The Sea Star", category: "nightlife", subcategory: "bar", lat: 37.760743, lng: -122.388413, address: "2289 3rd St", blurb: "Dog-friendly corner bar with a long history and a good jukebox.", priceLevel: 2, tags: ["dive-ish", "dog friendly"], venueVector: vec({ energy: 0.55, loudness: 0.55, crowdAge: 0.5, price: 0.35, pop: 0.4, indie: 0.5 }) },
  { sourceId: "ungrafted", name: "Ungrafted", category: "nightlife", subcategory: "wine bar", lat: 37.75865, lng: -122.38815, address: "2419 3rd St", blurb: "Sommelier-run wine bar and bottle shop with small plates.", priceLevel: 3, tags: ["wine", "quiet"], venueVector: vec({ energy: 0.3, loudness: 0.25, crowdAge: 0.35, price: 0.75, culture: 0.3, food: 0.6 }) },
  { sourceId: "yield-wine-bar", name: "Yield Wine Bar", category: "nightlife", subcategory: "wine bar", lat: 37.75812, lng: -122.38852, address: "2490 3rd St", blurb: "Low-key organic and biodynamic wine bar.", priceLevel: 3, tags: ["wine", "quiet"], venueVector: vec({ energy: 0.25, loudness: 0.2, crowdAge: 0.35, price: 0.6, culture: 0.3, food: 0.3 }) },
  { sourceId: "harmonic-brewing", name: "Harmonic Brewing", category: "nightlife", subcategory: "brewery", lat: 37.751539, lng: -122.390145, address: "1050 26th St", blurb: "Warehouse taproom pouring beer brewed a few feet away.", priceLevel: 2, tags: ["brewery", "groups"], venueVector: vec({ energy: 0.55, loudness: 0.5, crowdAge: 0.5, price: 0.35, indie: 0.5, outdoors: 0.3, food: 0.2 }) },
  { sourceId: "the-ramp", name: "The Ramp", category: "nightlife", subcategory: "waterfront bar", lat: 37.764218, lng: -122.386768, address: "855 Terry A Francois Blvd", blurb: "Waterfront patio bar with live salsa on weekend afternoons.", priceLevel: 2, tags: ["patio", "salsa", "waterfront"], venueVector: vec({ energy: 0.7, loudness: 0.65, crowdAge: 0.5, price: 0.45, dancing: 0.7, liveMusic: 0.7, pop: 0.5, outdoors: 0.7, food: 0.5 }) },
  { sourceId: "blooms-saloon", name: "Bloom's Saloon", category: "nightlife", subcategory: "dive bar", lat: 37.7626, lng: -122.3957, address: "1318 18th St", blurb: "Potrero Hill dive with cheap drinks and a skyline view out back.", priceLevel: 1, tags: ["dive", "sports", "view"], venueVector: vec({ energy: 0.5, loudness: 0.55, crowdAge: 0.4, price: 0.2, pop: 0.4 }) },
  { sourceId: "thee-parkside", name: "Thee Parkside", category: "nightlife", subcategory: "music bar", lat: 37.765, lng: -122.3994, address: "1600 17th St", blurb: "Punk, garage and country shows with a back patio.", priceLevel: 1, tags: ["live music", "punk", "patio"], venueVector: vec({ energy: 0.75, loudness: 0.8, crowdAge: 0.55, price: 0.25, dancing: 0.35, liveMusic: 0.9, indie: 0.9, outdoors: 0.3, food: 0.3 }) },
  { sourceId: "the-midway", name: "The Midway", category: "nightlife", subcategory: "club", lat: 37.74953, lng: -122.386094, address: "900 Marin St", blurb: "Warehouse club and arts complex for late-night house and techno.", priceLevel: 3, tags: ["club", "techno", "house", "late night"], venueVector: vec({ energy: 0.95, loudness: 0.95, crowdAge: 0.8, price: 0.65, dancing: 0.95, liveMusic: 0.5, pop: 0.3, hiphop: 0.35, electronic: 0.95, culture: 0.35 }) },

  { sourceId: "piccino", name: "Piccino", category: "food", subcategory: "italian", lat: 37.757729, lng: -122.390024, address: "1001 Minnesota St", blurb: "Bright yellow corner spot for thin-crust pizza and seasonal Italian.", priceLevel: 3, tags: ["italian", "date spot"], venueVector: vec({ energy: 0.35, loudness: 0.35, crowdAge: 0.4, price: 0.7, food: 0.95 }) },
  { sourceId: "just-for-you-cafe", name: "Just For You Cafe", category: "food", subcategory: "brunch", lat: 37.75775, lng: -122.38905, address: "732 22nd St", blurb: "Big Southern-leaning breakfasts and beignets.", priceLevel: 2, tags: ["brunch", "casual"], venueVector: vec({ energy: 0.45, loudness: 0.45, crowdAge: 0.45, price: 0.35, food: 0.9 }) },
  { sourceId: "mr-and-mrs-miscellaneous", name: "Mr. and Mrs. Miscellaneous", category: "food", subcategory: "ice cream", lat: 37.75795, lng: -122.3879, address: "699 22nd St", blurb: "Small-batch ice cream in rotating flavors.", priceLevel: 1, tags: ["dessert", "quick"], venueVector: vec({ energy: 0.3, loudness: 0.2, crowdAge: 0.5, price: 0.25, outdoors: 0.2, food: 0.85 }) },
  { sourceId: "long-bridge-pizza", name: "Long Bridge Pizza Company", category: "food", subcategory: "pizza", lat: 37.759477, lng: -122.388276, address: "2347 3rd St", blurb: "Neighborhood pizza by the pie or the slice.", priceLevel: 2, tags: ["pizza", "casual"], venueVector: vec({ energy: 0.4, loudness: 0.4, crowdAge: 0.5, price: 0.3, food: 0.9 }) },
  { sourceId: "neighbor-bakehouse", name: "Neighbor Bakehouse", category: "food", subcategory: "bakery", lat: 37.75952, lng: -122.38828, address: "2343 3rd St", blurb: "Morning pastries that sell out early.", priceLevel: 2, tags: ["bakery", "coffee"], venueVector: vec({ energy: 0.3, loudness: 0.25, crowdAge: 0.5, price: 0.3, food: 0.9 }) },
  { sourceId: "hard-knox-cafe", name: "Hard Knox Cafe", category: "food", subcategory: "soul food", lat: 37.75745, lng: -122.38855, address: "2526 3rd St", blurb: "Fried chicken, waffles and other Southern comfort food.", priceLevel: 2, tags: ["soul food", "casual"], venueVector: vec({ energy: 0.45, loudness: 0.45, crowdAge: 0.45, price: 0.3, hiphop: 0.3, food: 0.9 }) },
  { sourceId: "souvla-dogpatch", name: "Souvla", category: "food", subcategory: "greek", lat: 37.757711, lng: -122.38806, address: "2505 3rd St", blurb: "Fast-casual Greek wraps, salads and frozen yogurt.", priceLevel: 2, tags: ["greek", "quick"], venueVector: vec({ energy: 0.45, loudness: 0.45, crowdAge: 0.55, price: 0.4, food: 0.9 }) },
  { sourceId: "mission-rock-resort", name: "Mission Rock Resort", category: "food", subcategory: "seafood", lat: 37.765439, lng: -122.386603, address: "817 Terry A Francois Blvd", blurb: "Seafood and oysters on a deck over the bay.", priceLevel: 3, tags: ["seafood", "waterfront", "patio"], venueVector: vec({ energy: 0.5, loudness: 0.45, crowdAge: 0.4, price: 0.6, outdoors: 0.6, food: 0.9 }) },

  { sourceId: "museum-of-craft-and-design", name: "Museum of Craft and Design", category: "culture", subcategory: "museum", lat: 37.756927, lng: -122.387959, address: "2569 3rd St", blurb: "Small museum with rotating craft and design exhibitions.", priceLevel: 1, tags: ["museum", "design"], venueVector: vec({ energy: 0.25, crowdAge: 0.4, price: 0.3, culture: 0.95 }) },
  { sourceId: "minnesota-street-project", name: "Minnesota Street Project", category: "culture", subcategory: "galleries", lat: 37.7541, lng: -122.3899, address: "1275 Minnesota St", blurb: "A warehouse of contemporary art galleries, free to walk through.", priceLevel: 1, tags: ["galleries", "free"], venueVector: vec({ energy: 0.25, crowdAge: 0.45, price: 0.1, indie: 0.4, culture: 0.95 }) },
  { sourceId: "letterform-archive", name: "Letterform Archive", category: "culture", subcategory: "museum", lat: 37.759824, lng: -122.388244, address: "2325 3rd St", blurb: "Gallery and library devoted to typography and graphic design.", priceLevel: 1, tags: ["design", "typography"], venueVector: vec({ energy: 0.2, crowdAge: 0.45, price: 0.2, indie: 0.4, culture: 0.9 }) },
  { sourceId: "potrero-stage", name: "Potrero Stage", category: "culture", subcategory: "theater", lat: 37.762248, lng: -122.399371, address: "1695 18th St", blurb: "Intimate theater for new plays.", priceLevel: 2, tags: ["theater", "new work"], venueVector: vec({ energy: 0.4, loudness: 0.3, crowdAge: 0.4, price: 0.45, liveMusic: 0.4, indie: 0.4, culture: 0.85 }) },
  { sourceId: "pier-70-building-12", name: "Building 12 at Pier 70", category: "culture", subcategory: "makers market", lat: 37.758725, lng: -122.384281, address: "420 22nd St", blurb: "Restored shipyard building with local makers, studios and food.", priceLevel: 2, tags: ["makers", "historic"], venueVector: vec({ energy: 0.4, crowdAge: 0.5, price: 0.35, indie: 0.4, culture: 0.7, outdoors: 0.3, food: 0.4 }) },

  { sourceId: "crane-cove-park", name: "Crane Cove Park", category: "outdoors", subcategory: "park", lat: 37.762551, lng: -122.387112, blurb: "Bayfront park with a beach, lawns and two historic shipyard cranes.", priceLevel: 1, tags: ["park", "waterfront", "free"], venueVector: vec({ energy: 0.4, crowdAge: 0.5, price: 0.05, outdoors: 0.95 }) },
  { sourceId: "esprit-park", name: "Esprit Park", category: "outdoors", subcategory: "park", lat: 37.760992, lng: -122.391014, blurb: "Tree-lined neighborhood green in the middle of Dogpatch.", priceLevel: 1, tags: ["park", "dogs", "free"], venueVector: vec({ energy: 0.3, crowdAge: 0.45, price: 0.05, outdoors: 0.9 }) },
  { sourceId: "bayfront-park", name: "Bayfront Park", category: "outdoors", subcategory: "park", lat: 37.768337, lng: -122.38565, blurb: "Open lawn on the water next to Chase Center.", priceLevel: 1, tags: ["park", "waterfront", "free"], venueVector: vec({ energy: 0.35, crowdAge: 0.5, price: 0.05, outdoors: 0.9 }) },

  { sourceId: "chase-center", name: "Chase Center", category: "live", subcategory: "arena", lat: 37.7679, lng: -122.387422, address: "1 Warriors Way", blurb: "Arena for Warriors games and big touring concerts.", priceLevel: 4, tags: ["arena", "concerts", "sports"], venueVector: vec({ energy: 0.9, loudness: 0.9, crowdAge: 0.55, price: 0.85, dancing: 0.4, liveMusic: 0.9, pop: 0.8, hiphop: 0.6, electronic: 0.3 }) },
  { sourceId: "bottom-of-the-hill", name: "Bottom of the Hill", category: "live", subcategory: "music venue", lat: 37.764962, lng: -122.396411, address: "1233 17th St", blurb: "Long-running small club for indie and rock bands.", priceLevel: 2, tags: ["live music", "indie", "rock"], venueVector: vec({ energy: 0.8, loudness: 0.85, crowdAge: 0.6, price: 0.3, dancing: 0.4, liveMusic: 0.95, indie: 0.95 }) },

  { sourceId: "demo-popup-night-market", name: "Pier 70 Night Market (demo pop-up)", category: "popup", subcategory: "night market", lat: 37.7587, lng: -122.3843, blurb: "Demo pop-up: food stalls and makers outside Building 12.", priceLevel: 2, tags: [DEMO_TAG, "market", "food"], venueVector: vec({ energy: 0.65, loudness: 0.5, crowdAge: 0.65, price: 0.3, liveMusic: 0.3, culture: 0.5, outdoors: 0.5, food: 0.8 }) },
  { sourceId: "demo-popup-sunset-dj", name: "Crane Cove Sunset DJ Set (demo pop-up)", category: "popup", subcategory: "dj set", lat: 37.7628, lng: -122.3868, blurb: "Demo pop-up: open-air house set on the beach at sunset.", priceLevel: 1, tags: [DEMO_TAG, "dj", "outdoor"], venueVector: vec({ energy: 0.8, loudness: 0.7, crowdAge: 0.75, price: 0.2, dancing: 0.8, electronic: 0.85, outdoors: 0.8 }) },
  { sourceId: "demo-popup-vinyl-swap", name: "Dogpatch Vinyl Swap (demo pop-up)", category: "popup", subcategory: "record fair", lat: 37.76, lng: -122.3895, blurb: "Demo pop-up: crate digging and local selectors.", priceLevel: 1, tags: [DEMO_TAG, "records"], venueVector: vec({ energy: 0.4, loudness: 0.4, crowdAge: 0.55, price: 0.25, hiphop: 0.4, indie: 0.8, culture: 0.6 }) },
  { sourceId: "demo-popup-natural-wine", name: "22nd Street Natural Wine Pop-up (demo pop-up)", category: "popup", subcategory: "tasting", lat: 37.7579, lng: -122.388, blurb: "Demo pop-up: small producers pouring by the glass.", priceLevel: 3, tags: [DEMO_TAG, "wine"], venueVector: vec({ energy: 0.4, loudness: 0.3, crowdAge: 0.5, price: 0.55, culture: 0.4, food: 0.5 }) },
  { sourceId: "demo-popup-hackathon-afterparty", name: "Hackathon Afterparty (demo pop-up)", category: "popup", subcategory: "party", lat: 37.7606, lng: -122.3868, blurb: "Demo pop-up: post-demo party on 20th Street.", priceLevel: 1, tags: [DEMO_TAG, "party"], venueVector: vec({ energy: 0.85, loudness: 0.8, crowdAge: 0.8, price: 0.2, dancing: 0.7, pop: 0.7, hiphop: 0.6, electronic: 0.6 }) },
];

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    let inserted = 0;
    let updated = 0;
    for (const place of SEED_PLACES) {
      const fields = { ...place, source: "seed" as const, city: DEMO_CITY };
      const existing = await ctx.db
        .query("places")
        .withIndex("by_source", (q) => q.eq("source", "seed").eq("sourceId", place.sourceId))
        .unique();
      if (existing === null) {
        await ctx.db.insert("places", { ...fields, elo: 0, nComparisons: 0 });
        inserted++;
      } else {
        await ctx.db.patch(existing._id, fields);
        updated++;
      }
    }
    return { inserted, updated, total: SEED_PLACES.length };
  },
});
