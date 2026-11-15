// Owner: People session. Not a test file (npm test only runs *.test.mjs): a small in-memory stand-in for
// the Convex runtime, so tests/people.*.test.mjs can call the real query and mutation handlers without a
// deployment. It does three things:
//   1. lets Node import convex/*.ts (extensionless imports, type-only imports) by transpiling on load;
//   2. keeps tables in memory behind the same `ctx.db` calls the handlers make, reading the indexes from
//      convex/schema.ts and refusing an index range the real database would refuse;
//   3. signs a caller in the way `getAuthUserId` expects.
// It does not check argument validators or document validators; `npx tsc --noEmit` covers the shapes.
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONVEX = path.join(ROOT, "convex") + path.sep;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
      const parent = fileURLToPath(context.parentURL);
      if (parent.startsWith(CONVEX) && ![".ts", ".js", ".mjs", ".json"].includes(path.extname(specifier))) {
        const base = path.resolve(path.dirname(parent), specifier);
        for (const extension of [".ts", ".js"]) {
          if (existsSync(base + extension)) {
            return { url: pathToFileURL(base + extension).href, shortCircuit: true };
          }
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith("file:") && url.endsWith(".ts") && fileURLToPath(url).startsWith(CONVEX)) {
      const fileName = fileURLToPath(url);
      const { outputText } = ts.transpileModule(readFileSync(fileName, "utf8"), {
        fileName,
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      });
      return { format: "module", source: outputText, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

/** Imports a Convex module by its path under convex/, e.g. `await load("friends")`. */
export const load = (name) => import(pathToFileURL(path.join(CONVEX, `${name}.ts`)).href);

const schema = (await load("schema")).default;

// Convex orders values of different types: undefined, null, numbers, booleans, strings.
const typeRank = (value) =>
  value === undefined ? 0 : value === null ? 1 : typeof value === "number" ? 2 : typeof value === "boolean" ? 3 : 4;
function compareValues(a, b) {
  const rank = typeRank(a) - typeRank(b);
  if (rank !== 0) return rank;
  return a < b ? -1 : a > b ? 1 : 0;
}

class Query {
  constructor(db, table) {
    this.db = db;
    this.table = table;
    this.fields = [];
    this.conditions = [];
    this.direction = "asc";
    this.searchText = null;
    this.predicates = [];
  }

  // `.filter((q) => ...)`: expressions are built as functions of a document.
  filter(build) {
    const of = (x) => (typeof x === "function" ? x : () => x);
    const compare = (test) => (a, b) => (doc) => test(compareValues(of(a)(doc), of(b)(doc)));
    this.predicates.push(build({
      field: (name) => (doc) => doc[name],
      eq: compare((order) => order === 0),
      neq: compare((order) => order !== 0),
      lt: compare((order) => order < 0),
      lte: compare((order) => order <= 0),
      gt: compare((order) => order > 0),
      gte: compare((order) => order >= 0),
      and: (...parts) => (doc) => parts.every((part) => of(part)(doc)),
      or: (...parts) => (doc) => parts.some((part) => of(part)(doc)),
      not: (part) => (doc) => !of(part)(doc),
    }));
    return this;
  }

  withIndex(name, range) {
    const index = this.db.indexes[this.table]?.[name];
    if (index === undefined) throw new Error(`Table "${this.table}" has no index "${name}"`);
    this.fields = index;
    if (range !== undefined) {
      const used = [];
      const builder = {};
      for (const op of ["eq", "gt", "gte", "lt", "lte"]) {
        builder[op] = (field, value) => {
          used.push({ op, field, value });
          return builder;
        };
      }
      range(builder);
      // The same rule as the real database: equalities on a prefix of the index, in order, then at
      // most one field with bounds, and it must be the next field.
      const allowed = [...index, "_creationTime"];
      let position = 0;
      let bounded = false;
      for (const { op, field } of used) {
        if (op === "eq") {
          if (bounded || field !== allowed[position]) throw new Error(`Index "${name}": eq("${field}") is out of order`);
          position += 1;
        } else {
          if (field !== allowed[position]) throw new Error(`Index "${name}": ${op}("${field}") is not the next index field`);
          bounded = true;
        }
      }
      this.conditions.push(...used);
    }
    return this;
  }

  withSearchIndex(name, build) {
    const index = this.db.searchIndexes[this.table]?.[name];
    if (index === undefined) throw new Error(`Table "${this.table}" has no search index "${name}"`);
    const builder = {
      search: (field, text) => {
        if (field !== index.searchField) throw new Error(`Search index "${name}" searches "${index.searchField}"`);
        this.searchText = { field, text };
        return builder;
      },
      eq: (field, value) => {
        if (!index.filterFields.includes(field)) throw new Error(`Search index "${name}" cannot filter "${field}"`);
        this.conditions.push({ op: "eq", field, value });
        return builder;
      },
    };
    build(builder);
    return this;
  }

  order(direction) {
    this.direction = direction;
    return this;
  }

  rows() {
    const matches = (doc) =>
      this.conditions.every(({ op, field, value }) => {
        const order = compareValues(doc[field], value);
        return op === "eq" ? order === 0 : op === "gt" ? order > 0 : op === "gte" ? order >= 0 : op === "lt" ? order < 0 : order <= 0;
      });
    let rows = [...this.db.table(this.table).values()].filter(matches);
    if (this.searchText !== null) {
      // Close enough to Convex text search for tests: every word typed must start some word of the field.
      const words = (text) => String(text ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      const wanted = words(this.searchText.text);
      rows = rows.filter((doc) => {
        const have = words(doc[this.searchText.field]);
        return wanted.length > 0 && wanted.every((word) => have.some((h) => h.startsWith(word)));
      });
    }
    rows.sort((a, b) => {
      for (const field of this.fields) {
        const order = compareValues(a[field], b[field]);
        if (order !== 0) return order;
      }
      return a._creationTime - b._creationTime;
    });
    if (this.direction === "desc") rows.reverse();
    return rows.map((row) => structuredClone(row));
  }

  passes(doc) {
    return this.predicates.every((predicate) => predicate(doc));
  }
  filtered() {
    return this.rows().filter((doc) => this.passes(doc));
  }
  async collect() {
    return this.filtered();
  }
  async take(n) {
    return this.filtered().slice(0, n);
  }
  async first() {
    return this.filtered()[0] ?? null;
  }
  async unique() {
    const rows = this.filtered();
    if (rows.length > 1) throw new Error("unique() found more than one row");
    return rows[0] ?? null;
  }
  // Like Convex: the cursor is a position in the index, filters run before `numItems` is counted,
  // and `maximumRowsRead` stops the scan early (the page is then short and not done).
  async paginate({ numItems, cursor, maximumRowsRead = Infinity }) {
    const rows = this.rows();
    const start = cursor === null || cursor === undefined ? 0 : Number(cursor);
    const page = [];
    let position = start;
    while (position < rows.length && page.length < numItems && position - start < maximumRowsRead) {
      if (this.passes(rows[position])) page.push(rows[position]);
      position += 1;
    }
    return { page, isDone: position >= rows.length, continueCursor: String(position) };
  }
}

class Database {
  constructor() {
    this.tables = new Map();
    this.indexes = {};
    this.searchIndexes = {};
    this.counter = 0;
    for (const [name, definition] of Object.entries(schema.tables)) {
      const exported = definition.export();
      this.tables.set(name, new Map());
      this.indexes[name] = Object.fromEntries(exported.indexes.map((index) => [index.indexDescriptor, index.fields]));
      this.searchIndexes[name] = Object.fromEntries(exported.searchIndexes.map((index) => [index.indexDescriptor, index]));
    }
  }

  table(name) {
    const rows = this.tables.get(name);
    if (rows === undefined) throw new Error(`No table "${name}" in convex/schema.ts`);
    return rows;
  }

  // Both call styles the codebase uses: (table, id, …) and (id, …).
  locate(args) {
    const [first, second] = args;
    if (this.tables.has(first) && typeof second === "string") return { table: first, id: second, rest: args.slice(2) };
    return { table: String(first).split("|")[0], id: first, rest: args.slice(1) };
  }

  query(table) {
    this.table(table);
    return new Query(this, table);
  }
  async get(...args) {
    const { table, id } = this.locate(args);
    if (String(id).split("|")[0] !== table) return null;
    const doc = this.table(table).get(id);
    return doc === undefined ? null : structuredClone(doc);
  }
  async insert(table, doc) {
    this.counter += 1;
    const id = `${table}|${this.counter}`;
    const clean = Object.fromEntries(Object.entries(doc).filter(([, value]) => value !== undefined));
    this.table(table).set(id, structuredClone({ ...clean, _id: id, _creationTime: 1_700_000_000_000 + this.counter }));
    return id;
  }
  async patch(...args) {
    const { table, id, rest } = this.locate(args);
    const doc = this.table(table).get(id);
    if (doc === undefined) throw new Error(`patch: ${id} does not exist`);
    for (const [key, value] of Object.entries(rest[0])) {
      if (value === undefined) delete doc[key];
      else doc[key] = structuredClone(value);
    }
  }
  async delete(...args) {
    const { table, id } = this.locate(args);
    if (!this.table(table).delete(id)) throw new Error(`delete: ${id} does not exist`);
  }
}

const componentFunction = (ref) => String(ref?.[Symbol.for("toReferencePath")] ?? "");

/**
 * One fake backend. `t.run(fn, userId, args)` calls a registered query or mutation as that user
 * (`null` = signed out); `t.db` is the database for setting things up and checking results.
 */
export function backend() {
  const db = new Database();
  const deletedFiles = new Set();
  const scheduled = [];
  const componentCalls = [];
  let uploads = 0;
  const ctxFor = (userId) => ({
    db,
    auth: { getUserIdentity: async () => (userId === null ? null : { subject: userId }) },
    // Calls into the auth components. getAuthUserId asks for the session; here the session id is the user id.
    runQuery: async (ref, args) => {
      const name = componentFunction(ref);
      if (name.endsWith("/getSession")) return { userId: args.sessionId };
      if (name.endsWith("/listSessions")) return [{ sessionId: args.userId }];
      if (name.endsWith("/getUsername")) return db.table("users").get(args.userId)?.username ?? null;
      return null;
    },
    runMutation: async (ref, args) => {
      componentCalls.push({ name: componentFunction(ref), args });
      return null;
    },
    scheduler: { runAfter: async (delay, ref, args) => void scheduled.push({ delay, ref, args }) },
    storage: {
      generateUploadUrl: async () => `https://upload.test/${(uploads += 1)}`,
      getUrl: async (id) => (deletedFiles.has(id) ? null : `https://files.test/${id}`),
      delete: async (id) => void deletedFiles.add(id),
    },
  });
  return {
    db,
    deletedFiles,
    scheduled,
    componentCalls,
    ctx: ctxFor,
    run: (fn, userId, args = {}) => fn._handler(ctxFor(userId), args),
    all: (table) => [...db.table(table).values()].map((row) => structuredClone(row)),
  };
}

const FEATURES = 13;
export const taste = (set = {}) => Array.from({ length: FEATURES }, (_, k) => set[k] ?? 0.15);

/** Small builders for the rows most tests need. */
export function fixtures(t) {
  return {
    user: (username, extra = {}) => t.db.insert("users", { username, displayName: username, tasteVector: taste(), ...extra }),
    place: (name, extra = {}) =>
      t.db.insert("places", { name, category: "nightlife", lat: 37.76, lng: -122.39, city: "San Francisco", ...extra }),
    event: (title, extra = {}) =>
      t.db.insert("events", { title, category: "live", lat: 37.76, lng: -122.39, city: "San Francisco", start: Date.now() + 3_600_000, ...extra }),
    friends: (userA, userB, status = "accepted") => t.db.insert("friendships", { userA, userB, status }),
  };
}
