#!/usr/bin/env node
/**
 * Borra todos los proyectos en Supabase (Postgres) y vacía el bucket `project-photos`.
 *
 * Requiere la service role (nunca uses esto desde el cliente ni subas la clave al repo).
 *
 * Uso:
 *   # Simulación (solo cuenta objetos y filas; no borra)
 *   node --env-file=.env.local scripts/wipe-supabase-projects.mjs
 *
 *   # Ejecutar borrado real
 *   node --env-file=.env.local scripts/wipe-supabase-projects.mjs --execute
 *
 * Opciones:
 *   --execute          Aplicar borrados (sin esto solo dry-run).
 *   --skip-storage     No tocar el bucket.
 *   --skip-db          No ejecutar DELETE en projects.
 *
 * Variables de entorno:
 *   NEXT_PUBLIC_SUPABASE_URL o SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";

const BUCKET = "project-photos";

function parseArgs(argv) {
  const execute = argv.includes("--execute");
  const skipStorage = argv.includes("--skip-storage");
  const skipDb = argv.includes("--skip-db");
  return { execute, skipStorage, skipDb };
}

function getEnv() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return { url: url.trim(), serviceKey: serviceKey.trim() };
}

/**
 * Lista recursivamente rutas de objetos en el bucket (no carpetas vacías sin objetos).
 */
async function collectObjectPaths(supabase, prefix = "") {
  const paths = [];
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefix || undefined, { limit: 1000 });

  if (error) throw error;
  if (!data?.length) return paths;

  for (const item of data) {
    const next =
      prefix === "" ? item.name : `${prefix}/${item.name}`;
    // Carpetas “virtuales”: sin metadata en la respuesta de list()
    const isFolder = item.metadata == null;
    if (isFolder) {
      const sub = await collectObjectPaths(supabase, next);
      paths.push(...sub);
    } else {
      paths.push(next);
    }
  }
  return paths;
}

/** Supabase suele aceptar ~100 rutas por remove; troceamos por seguridad. */
async function removePathsInChunks(supabase, paths, chunkSize = 80) {
  let removed = 0;
  for (let i = 0; i < paths.length; i += chunkSize) {
    const chunk = paths.slice(i, i + chunkSize);
    const { error } = await supabase.storage.from(BUCKET).remove(chunk);
    if (error) throw error;
    removed += chunk.length;
  }
  return removed;
}

async function countProjects(supabase) {
  const { count, error } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function deleteAllProjects(supabase) {
  const { error } = await supabase
    .from("projects")
    .delete()
    .gte("created_at", "1970-01-01T00:00:00Z");
  if (error) throw error;
}

async function main() {
  const { execute, skipStorage, skipDb } = parseArgs(process.argv.slice(2));
  const { url, serviceKey } = getEnv();

  if (!url || !serviceKey) {
    console.error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL (o SUPABASE_URL) y/o SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Supabase URL: ${url}`);
  console.log(
    execute
      ? "Modo: EJECUCIÓN (se borrarán datos según flags)."
      : "Modo: SIMULACIÓN (añade --execute para borrar de verdad).",
  );
  console.log("");

  let storagePaths = [];
  if (!skipStorage) {
    console.log(`Bucket "${BUCKET}": listando objetos…`);
    storagePaths = await collectObjectPaths(supabase);
    console.log(`  Objetos encontrados: ${storagePaths.length}`);
    if (execute && storagePaths.length > 0) {
      const n = await removePathsInChunks(supabase, storagePaths);
      console.log(`  Eliminados del storage: ${n}`);
    }
  } else {
    console.log("Storage: omitido (--skip-storage).");
  }

  console.log("");

  const projectCount = await countProjects(supabase);
  console.log(`Tabla projects: filas actuales ≈ ${projectCount}`);
  if (!skipDb && execute) {
    await deleteAllProjects(supabase);
    const after = await countProjects(supabase);
    console.log(
      `  DELETE aplicado (CASCADE en hijos). Filas restantes en projects: ${after}`,
    );
  } else if (!skipDb && !execute) {
    console.log(
      "  (Simulación) Se usaría DELETE en projects con filtro siempre verdadero → CASCADE.",
    );
  } else {
    console.log("Base de datos: omitida (--skip-db).");
  }

  console.log("");
  if (!execute) {
    console.log(
      "No se ha borrado nada. Para ejecutar: añade --execute al comando.",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
