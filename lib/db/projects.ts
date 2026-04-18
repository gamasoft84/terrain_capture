import { nanoid } from "nanoid";
import { getDb } from "@/lib/db/schema";
import type { LocalProject } from "@/lib/db/schema";

export async function listProjects(): Promise<LocalProject[]> {
  return getDb()
    .projects.orderBy("updatedAt")
    .reverse()
    .toArray();
}

export async function getProject(
  localId: string,
): Promise<LocalProject | undefined> {
  return getDb().projects.get(localId);
}

export async function createProjectWithMainPolygon(input: {
  name: string;
  description?: string;
  locationLabel?: string;
  clientName?: string;
  clientContact?: string;
}): Promise<{ projectLocalId: string }> {
  const db = getDb();
  const projectLocalId = nanoid();
  const polygonLocalId = nanoid();
  const now = new Date();

  await db.transaction("rw", db.projects, db.polygons, async () => {
    await db.projects.add({
      localId: projectLocalId,
      name: input.name,
      description: input.description,
      locationLabel: input.locationLabel,
      clientName: input.clientName,
      clientContact: input.clientContact,
      status: "draft",
      createdAt: now,
      updatedAt: now,
      syncStatus: "pending",
    });
    await db.polygons.add({
      localId: polygonLocalId,
      projectLocalId,
      name: "Terreno principal",
      type: "main",
      color: "#10b981",
      isClosed: false,
      createdAt: now,
      updatedAt: now,
      syncStatus: "pending",
    });
  });

  return { projectLocalId };
}

export async function updateProject(
  localId: string,
  patch: Partial<
    Pick<
      LocalProject,
      | "name"
      | "description"
      | "locationLabel"
      | "clientName"
      | "clientContact"
      | "status"
    >
  >,
): Promise<void> {
  const db = getDb();
  const existing = await db.projects.get(localId);
  if (!existing) throw new Error("Proyecto no encontrado");
  await db.projects.update(localId, {
    ...patch,
    updatedAt: new Date(),
    syncStatus: "pending",
  });
}

export async function deleteProject(localId: string): Promise<void> {
  const db = getDb();
  const polygons = await db.polygons
    .where("projectLocalId")
    .equals(localId)
    .toArray();
  for (const p of polygons) {
    await db.vertices.where("polygonLocalId").equals(p.localId).delete();
  }
  await db.polygons.where("projectLocalId").equals(localId).delete();
  await db.pois.where("projectLocalId").equals(localId).delete();
  await db.projectPhotos.where("projectLocalId").equals(localId).delete();
  await db.projects.delete(localId);
}
