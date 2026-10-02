import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

export interface SchemaUse { table: string; columns: Set<string>; locations: Set<string> }
export interface ContractScan { tables: Map<string, SchemaUse>; rpcs: Map<string, Set<string>>; unresolved: string[]; files: number }

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(root, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : /\.[jt]sx?$/.test(file) && !/\.(test|spec)\./.test(file) ? [file] : [];
  });
}

/** Inspect query syntax and inferred payload types without running application code. */
export function scanContracts(roots = ["src", "supabase/functions"]): ContractScan {
  const files = roots.flatMap(sourceFiles);
  const config = ts.readConfigFile("tsconfig.app.json", ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, process.cwd());
  const program = ts.createProgram(files, { ...parsed.options, allowJs: true, checkJs: false });
  const checker = program.getTypeChecker();
  const result: ContractScan = { tables: new Map(), rpcs: new Map(), unresolved: [], files: files.length };
  const queryVariables = new Map<ts.Symbol, string>();
  const columnMethods = ["eq", "neq", "gt", "gte", "lt", "lte", "in", "is", "order", "like", "ilike", "contains", "not"];
  const functionName = (node: ts.Node): string => {
    for (let parent: ts.Node | undefined = node.parent; parent; parent = parent.parent) {
      if (ts.isFunctionDeclaration(parent) && parent.name) return parent.name.text;
      if ((ts.isArrowFunction(parent) || ts.isFunctionExpression(parent)) && ts.isVariableDeclaration(parent.parent) && ts.isIdentifier(parent.parent.name)) return parent.parent.name.text;
    }
    return "";
  };

  const location = (node: ts.Node) => {
    const file = node.getSourceFile();
    return `${path.relative(process.cwd(), file.fileName).replaceAll("\\", "/")}:${file.getLineAndCharacterOfPosition(node.getStart()).line + 1}`;
  };
  const strings = (node: ts.Node | undefined): string[] => {
    if (!node) return [];
    if (ts.isStringLiteralLike(node)) return [node.text];
    if (ts.isConditionalExpression(node)) return [...strings(node.whenTrue), ...strings(node.whenFalse)];
    const type = checker.getTypeAtLocation(node);
    return (type.isUnion() ? type.types : [type]).flatMap((part) => part.isStringLiteral() ? [part.value] : []);
  };
  const add = (table: string, columns: string[], at: string) => {
    if (!/^[a-z][a-z0-9_]*$/.test(table)) return;
    const use = result.tables.get(table) ?? { table, columns: new Set<string>(), locations: new Set<string>() };
    columns.filter((column) => /^[a-z][a-z0-9_]*$/.test(column)).forEach((column) => use.columns.add(column));
    use.locations.add(at);
    result.tables.set(table, use);
  };
  const objectKeys = (node: ts.Node | undefined): string[] => {
    if (!node) return [];
    let type = checker.getTypeAtLocation(node);
    const item = checker.getIndexTypeOfType(type, ts.IndexKind.Number);
    if (item) type = item;
    return checker.getPropertiesOfType(type).map((property) => property.name).filter((name) => /^[a-z][a-z0-9_]*$/.test(name));
  };
  const propertyKeys = (node: ts.Node | undefined, property: string): string[] => {
    if (!node) return [];
    const symbol = checker.getTypeAtLocation(node).getProperty(property);
    return symbol ? checker.getTypeOfSymbolAtLocation(symbol, node).getProperties().map((key) => key.name) : [];
  };
  const addRpc = (name: string, keys: string[]) => {
    const args = result.rpcs.get(name) ?? new Set<string>();
    keys.forEach((key) => args.add(key)); result.rpcs.set(name, args);
  };
  const selections = (table: string, selection: string, at: string) => {
    // PostgREST selections can include aliases and nested relations.
    let depth = 0, start = 0;
    const parts: string[] = [];
    for (let index = 0; index <= selection.length; index++) {
      if (selection[index] === "(") depth++;
      if (selection[index] === ")") depth--;
      if (index === selection.length || (selection[index] === "," && depth === 0)) {
        parts.push(selection.slice(start, index).trim()); start = index + 1;
      }
    }
    for (const part of parts) {
      const nested = /^(?:\w+:)?(\w+)(?:![\w]+)*\((.*)\)$/.exec(part);
      if (nested) { add(nested[1], [], at); selections(nested[1], nested[2], at); }
      else add(table, [part.split(":").at(-1)?.split("->")[0] ?? ""], at);
    }
  };
  const inspectChain = (table: string, from: ts.CallExpression) => {
    const at = location(from);
    add(table, [], at);
    let current: ts.Node = from;
    while (ts.isPropertyAccessExpression(current.parent) && ts.isCallExpression(current.parent.parent)) {
      const call = current.parent.parent;
      const method = current.parent.name.text;
      if (method === "select") {
        const values = strings(call.arguments[0]);
        values.forEach((select) => selections(table, select, at));
        if (call.arguments[0] && !values.length) result.unresolved.push(`${at} (${table}.select)`);
      }
      if (columnMethods.includes(method)) {
        add(table, strings(call.arguments[0]).map((column) => column.split("->")[0]), at);
      }
      if (["insert", "update", "upsert"].includes(method)) {
        const keys = objectKeys(call.arguments[0]);
        add(table, keys, at);
        const helper = functionName(call);
        if (!keys.length && !["createServiceSlotsFromAvailability", "updateServiceSlot", "updateRegistrationAttempt"].includes(helper)) result.unresolved.push(`${at} (${table}.${method} payload)`);
      }
      current = call;
    }
    if (ts.isVariableDeclaration(current.parent) && ts.isIdentifier(current.parent.name)) {
      const symbol = checker.getSymbolAtLocation(current.parent.name);
      if (symbol) queryVariables.set(symbol, table);
    }
  };

  for (const file of files) {
    const source = program.getSourceFile(file);
    if (!source) continue;
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        const receiver = node.expression.expression.getText(source);
        if (method === "from" && receiver !== "Array" && !/\.storage\b/.test(receiver)) {
          const tables = strings(node.arguments[0]);
          if (tables.length) tables.forEach((table) => inspectChain(table, node));
          else if (functionName(node) !== "fetchRowsByIds") result.unresolved.push(`${location(node)} (dynamic table)`);
        }
        if (method === "rpc") {
          const names = strings(node.arguments[0]);
          if (!names.length && functionName(node) !== "runBookingWorkflowRpc") result.unresolved.push(`${location(node)} (dynamic RPC)`);
          for (const name of names) {
            addRpc(name, objectKeys(node.arguments[1]));
          }
        }
        if (ts.isIdentifier(node.expression.expression)) {
          const symbol = checker.getSymbolAtLocation(node.expression.expression);
          const table = symbol && queryVariables.get(symbol);
          if (table && columnMethods.includes(method)) add(table, strings(node.arguments[0]), location(node));
        }
        if (method === "push" && functionName(node) === "buildServiceSlotRowsFromAvailability") add("service_slots", objectKeys(node.arguments[0]), location(node));
      }
      // Resolve the current legacy adapters at their typed/literal call sites.
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "fetchRowsByIds") {
        for (const table of strings(node.arguments[0])) {
          add(table, strings(node.arguments[1]), location(node));
          strings(node.arguments[3]).forEach((select) => selections(table, select, location(node)));
        }
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text;
        if (name === "runBookingWorkflowRpc") strings(node.arguments[0]).forEach((rpc) => addRpc(rpc, ["p_booking_id", "p_idempotency_key", ...propertyKeys(node.arguments[2], "rpcParams")]));
        if (name === "updateServiceSlot") add("service_slots", propertyKeys(node.arguments[0], "updates"), location(node));
        if (name === "updateRegistrationAttempt") add("registration_attempts", objectKeys(node.arguments[2]), location(node));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }

  // Include the complete typed table contract so incorrect declarations cannot hide behind select('*').
  const db = program.getSourceFile("src/integrations/supabase/database.types.ts");
  const declaration = db?.statements.find((node): node is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(node) && node.name.text === "Database");
  if (declaration) {
    const database = checker.getTypeAtLocation(declaration);
    const pub = database.getProperty("public");
    const publicType = pub && checker.getTypeOfSymbolAtLocation(pub, declaration);
    const tables = publicType?.getProperty("Tables");
    const tableType = tables && checker.getTypeOfSymbolAtLocation(tables, declaration);
    for (const table of tableType?.getProperties() ?? []) {
      const type = checker.getTypeOfSymbolAtLocation(table, declaration);
      const row = type.getProperty("Row");
      if (row) add(table.name, checker.getTypeOfSymbolAtLocation(row, declaration).getProperties().map((property) => property.name), location(declaration));
    }
  }
  return result;
}

export interface ProbeResult { table: string; checked: number; missing: string[]; unavailable?: string }

/** GET with limit=0 checks column names without retrieving rows or invoking RPCs. */
export async function probeTable(use: SchemaUse, url: string, key: string): Promise<ProbeResult> {
  const remaining = [...use.columns];
  const result: ProbeResult = { table: use.table, checked: remaining.length, missing: [] };
  while (true) {
    const endpoint = new URL(`/rest/v1/${use.table}`, url);
    endpoint.searchParams.set("select", remaining.length ? remaining.join(",") : "*");
    endpoint.searchParams.set("limit", "0");
    const response = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
    if (response.ok) return result;
    const error = await response.json() as { code?: string; message?: string };
    const missing = error.code === "42703" ? /column [\w]+\.([\w]+) does not exist/.exec(error.message ?? "")?.[1] : undefined;
    if (missing && remaining.includes(missing)) {
      result.missing.push(missing); remaining.splice(remaining.indexOf(missing), 1); continue;
    }
    // Restrict output to status/error code; server messages can contain private values.
    result.unavailable = `${response.status} ${error.code ?? "unknown"}`;
    return result;
  }
}
