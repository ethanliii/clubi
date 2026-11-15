import { getFunctionName } from "convex/server";
// A small in-memory stand-in for a Convex mutation/query ctx, enough to run the Data session's
// handlers in `node --test` (we cannot deploy from a branch). It reads the real index definitions
// from convex/schema.ts, so `withIndex` ranges and ordering behave like the real thing, and it
// rejects fields the schema does not have.
import { load } from "./load.mjs";

const schema = (await load("schema")).default;

const compare = (a, b) => {
  if (a === b) return 0;
  if (a === undefined) return -1;
  if (b === undefined) return 1;
  return a < b ? -1 : 1;
};

/**
 * Why `value` does not satisfy a Convex validator (its `.json` form), or null when it does.
 * Fields set to undefined count as absent, as they do when Convex serialises arguments.
 */
export function violation(type, value, path = "value") {
  switch (type.type) {
    case "any":
      return null;
    case "string":
    case "boolean":
      return typeof value === type.type ? null : `${path}: expected ${type.type}, got ${JSON.stringify(value)}`;
    case "number":
      return typeof value === "number" && !Number.isNaN(value) ? null : `${path}: expected number, got ${JSON.stringify(value)}`;
    case "null":
      return value === null ? null : `${path}: expected null`;
    case "id":
      return typeof value === "string" && value.startsWith(type.tableName + ":") ? null : `${path}: expected an id of "${type.tableName}", got ${JSON.stringify(value)}`;
    case "literal":
      return value === type.value ? null : `${path}: expected ${JSON.stringify(type.value)}`;
    case "union": {
      const problems = type.value.map((option) => violation(option, value, path));
      return problems.includes(null) ? null : `${path}: ${JSON.stringify(value)} matches no option (${problems[problems.length - 1]})`;
    }
    case "array": {
      if (!Array.isArray(value)) return `${path}: expected an array`;
      for (const [index, item] of value.entries()) {
        const problem = violation(type.value, item, `${path}[${index}]`);
        if (problem) return problem;
      }
      return null;
    }
    case "object": {
      if (value === null || typeof value !== "object" || Array.isArray(value)) return `${path}: expected an object`;
      for (const key of Object.keys(value)) {
        if (value[key] !== undefined && !(key in type.value)) return `${path}.${key}: not a field of this validator`;
      }
      for (const [key, field] of Object.entries(type.value)) {
        if (value[key] === undefined) {
          if (!field.optional) return `${path}.${key}: required`;
          continue;
        }
        const problem = violation(field.fieldType, value[key], `${path}.${key}`);
        if (problem) return problem;
      }
      return null;
    }
    default:
      throw new Error(`fakeDb does not know the validator type "${type.type}"`);
  }
}

function tableInfo(table) {
  const definition = schema.tables[table];
  if (!definition) throw new Error(`No table "${table}" in the schema`);
  const exported = definition.export();
  const fields = exported.documentType.type === "object" ? new Set(Object.keys(exported.documentType.value)) : null;
  return {
    fields,
    documentType: exported.documentType,
    indexes: Object.fromEntries(exported.indexes.map((index) => [index.indexDescriptor, index.fields])),
    searchIndexes: Object.fromEntries(exported.searchIndexes.map((index) => [index.indexDescriptor, index.searchField])),
  };
}

export function fakeCtx({ userId } = {}) {
  const docs = new Map();
  let counter = 0;
  // Documents handed back by reads, the number Convex's per-transaction limits are about.
  const usage = { reads: 0, writes: 0 };
  const scheduled = [];
  const tableOf = (id) => String(id).split(":")[0];
  const checkFields = (table, fields) => {
    const known = tableInfo(table).fields;
    for (const key of Object.keys(fields)) {
      if (known && !known.has(key)) throw new Error(`Field "${key}" is not in table "${table}"`);
    }
  };
  // Every stored document must satisfy the real schema, as it would on Convex.
  const checkDocument = (table, doc) => {
    const { _id, _creationTime, ...fields } = doc;
    const problem = violation(tableInfo(table).documentType, fields, table);
    if (problem) throw new Error("Schema: " + problem);
  };
  const rowsOf = (table) => [...docs.values()].filter((doc) => tableOf(doc._id) === table);

  function reader(table, rows) {
    let descending = false;
    const ordered = () => (descending ? [...rows].reverse() : rows).map((doc) => structuredClone(doc));
    const counted = (found) => {
      usage.reads += found.length;
      return found;
    };
    const api = {
      order(direction) {
        descending = direction === "desc";
        return api;
      },
      collect: async () => counted(ordered()),
      take: async (n) => counted(ordered().slice(0, n)),
      first: async () => counted(ordered().slice(0, 1))[0] ?? null,
      unique: async () => {
        const all = counted(ordered());
        if (all.length > 1) throw new Error(`unique() found ${all.length} rows in "${table}"`);
        return all[0] ?? null;
      },
    };
    return api;
  }

  const db = {
    get: async (a, b) => {
      const doc = docs.get(b ?? a);
      usage.reads++;
      return doc ? structuredClone(doc) : null;
    },
    insert: async (table, fields) => {
      checkFields(table, fields);
      const _id = `${table}:${++counter}`;
      const clean = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
      checkDocument(table, clean);
      usage.writes++;
      docs.set(_id, structuredClone({ ...clean, _id, _creationTime: counter }));
      return _id;
    },
    patch: async (a, b, c) => {
      const [id, fields] = c === undefined ? [a, b] : [b, c];
      const doc = docs.get(id);
      if (!doc) throw new Error(`patch: no document ${id}`);
      checkFields(tableOf(id), fields);
      for (const [key, value] of Object.entries(structuredClone(fields))) {
        if (value === undefined) delete doc[key];
        else doc[key] = value;
      }
      checkDocument(tableOf(id), doc);
      usage.writes++;
    },
    delete: async (a, b) => {
      docs.delete(b ?? a);
    },
    query: (table) => {
      const info = tableInfo(table);
      const byCreation = () => rowsOf(table).sort((x, y) => x._creationTime - y._creationTime);
      return {
        ...reader(table, byCreation()),
        withIndex(name, range) {
          const fields = info.indexes[name];
          if (!fields) throw new Error(`No index "${name}" on "${table}"`);
          const tests = [];
          let position = 0;
          let ranged = false;
          const builder = {};
          const bound = (op) => (field, value) => {
            const isEq = op === "eq";
            if (ranged && isEq) throw new Error(`${table}.${name}: eq after a range`);
            if (field !== fields[position]) throw new Error(`${table}.${name}: expected "${fields[position]}", got "${field}"`);
            if (isEq) position++;
            else ranged = true;
            tests.push((doc) => {
              const order = compare(doc[field], value);
              return { eq: order === 0, gt: order > 0, gte: order >= 0, lt: order < 0, lte: order <= 0 }[op];
            });
            return builder;
          };
          for (const op of ["eq", "gt", "gte", "lt", "lte"]) builder[op] = bound(op);
          range?.(builder);
          const rows = byCreation()
            .filter((doc) => tests.every((test) => test(doc)))
            .sort((x, y) => {
              for (const field of fields) {
                const order = compare(x[field], y[field]);
                if (order !== 0) return order;
              }
              return x._creationTime - y._creationTime;
            });
          return reader(table, rows);
        },
        withSearchIndex(name, build) {
          const field = info.searchIndexes[name];
          if (!field) throw new Error(`No search index "${name}" on "${table}"`);
          let words = [];
          build({ search: (_field, text) => ((words = text.toLowerCase().split(/\s+/).filter(Boolean)), {}) });
          const rows = byCreation().filter((doc) => {
            const tokens = String(doc[field] ?? "").toLowerCase().split(/[^a-z0-9]+/);
            return words.some((word) => tokens.some((token) => token.startsWith(word)));
          });
          return reader(table, rows);
        },
      };
    },
  };

  // Convex Auth's getAuthUserId asks for the identity, then looks the session up with ctx.runQuery:
  // here the "session id" is simply the user id.
  const signedInAs = (id) => ({
    db,
    auth: { getUserIdentity: async () => (id ? { subject: id } : null) },
    runQuery: async (_ref, args) => (args?.sessionId ? { userId: args.sessionId } : null),
    scheduler: { runAfter: async (...args) => void scheduled.push(args) },
  });
  return {
    ...signedInAs(userId),
    /** Test helpers. */
    all: (table) => rowsOf(table).map((doc) => structuredClone(doc)),
    scheduled,
    /** Documents read and written so far; set the fields to 0 to measure one call. */
    usage,
    /** The same database seen by another signed-in user (or nobody, with null). */
    as: signedInAs,
  };
}

/**
 * Run a registered Convex function's handler against a fake ctx. The arguments are checked against
 * the function's own validators first, as Convex does, with undefined fields dropped.
 */
export const run = (fn, ctx, args = {}) => {
  const validator = JSON.parse(fn.exportArgs());
  const problem = violation(validator, args, "args");
  if (problem) throw new Error("ArgumentValidationError: " + problem);
  return fn._handler(ctx, JSON.parse(JSON.stringify(args)));
};

/**
 * A stand-in for an action's ctx: `ctx.runQuery` / `ctx.runMutation` look the real function up by
 * its reference (internal.ingest.upsertBatch → convex/ingest.ts) and run it against `db`.
 * `onCall(module, name, args, result)` sees every call.
 */
export function actionCtx(db, onCall) {
  const call = async (reference, args = {}) => {
    const [module, name] = getFunctionName(reference).split(":");
    const fn = (await load(module))[name];
    if (!fn) throw new Error(`No function ${module}:${name}`);
    const before = { ...db.usage };
    const result = await run(fn, db, args);
    await onCall?.(module, name, args, result, { reads: db.usage.reads - before.reads, writes: db.usage.writes - before.writes });
    return result;
  };
  return { runQuery: call, runMutation: call, scheduler: { runAfter: async () => {} } };
}
