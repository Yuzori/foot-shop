/** Arbre de catégories pour l’admin import / studio (libellés « Parent — Division »). */

export interface AdminCategoryDivision {
  id: string;
  label: string;
  shortLabel: string;
}

export interface AdminCategoryGroup {
  id: string;
  label: string;
  directCategoryId: string | null;
  divisions: AdminCategoryDivision[];
}

export interface AdminCategoryOptGroup {
  label: string;
  options: { id: string; label: string }[];
}

const HOME_CATEGORY_IDS = new Set(["1", "2"]);

type CategoryRow = {
  id: string;
  name: string;
  parentId?: string | null;
};

function normId(id: string | null | undefined): string {
  return String(id ?? "").trim();
}

/** Sélecteur unique avec optgroups — une option = catégorie PrestaShop destination. */
export function buildAdminCategoryOptGroups(
  categories: readonly CategoryRow[],
): AdminCategoryOptGroup[] {
  const usable = categories.filter((c) => !HOME_CATEGORY_IDS.has(normId(c.id)));
  if (!usable.length) return [];

  const byId = new Map(usable.map((c) => [normId(c.id), c]));
  const childIds = new Set<string>();

  for (const category of usable) {
    const parentId = normId(category.parentId);
    if (parentId && !HOME_CATEGORY_IDS.has(parentId)) {
      childIds.add(parentId);
    }
  }

  const topLevel = usable
    .filter((c) => {
      const parentId = normId(c.parentId);
      return HOME_CATEGORY_IDS.has(parentId) || !byId.has(parentId);
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  const groups: AdminCategoryOptGroup[] = [];

  for (const parent of topLevel) {
    const parentId = normId(parent.id);
    const children = usable
      .filter((c) => normId(c.parentId) === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));

    if (!children.length) {
      groups.push({
        label: parent.name,
        options: [{ id: parentId, label: parent.name }],
      });
      continue;
    }

    groups.push({
      label: parent.name,
      options: children.map((child) => ({
        id: normId(child.id),
        label: `${parent.name} — ${child.name}`,
      })),
    });
  }

  if (!groups.length) {
    const leaves = usable
      .filter((c) => !childIds.has(normId(c.id)))
      .map((c) => {
        const parent = byId.get(normId(c.parentId));
        return {
          id: normId(c.id),
          label: parent ? `${parent.name} — ${c.name}` : c.name,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));

    if (leaves.length) {
      return [{ label: "Catégories", options: leaves }];
    }
  }

  return groups;
}

export function flattenAdminCategoryOptGroups(
  groups: readonly AdminCategoryOptGroup[],
): { id: string; label: string }[] {
  return groups.flatMap((g) => g.options);
}

/** @deprecated Préférer buildAdminCategoryOptGroups */
export function buildAdminCategoryGroups(
  categories: readonly CategoryRow[],
): AdminCategoryGroup[] {
  const optGroups = buildAdminCategoryOptGroups(categories);
  return optGroups.map((g) => {
    if (g.options.length === 1 && g.options[0]?.label === g.label) {
      return {
        id: g.options[0].id,
        label: g.label,
        directCategoryId: g.options[0].id,
        divisions: [],
      };
    }
    return {
      id: g.options[0]?.id ?? g.label,
      label: g.label,
      directCategoryId: null,
      divisions: g.options.map((o) => ({
        id: o.id,
        label: o.label,
        shortLabel: o.label.split(" — ").pop() ?? o.label,
      })),
    };
  });
}

export function resolveAdminCategoryId(
  groups: readonly AdminCategoryGroup[],
  groupId: string,
  divisionId: string | null,
  fallbackId: string,
): string {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return fallbackId;
  if (group.directCategoryId) return group.directCategoryId;
  if (divisionId && group.divisions.some((d) => d.id === divisionId)) {
    return divisionId;
  }
  return group.divisions[0]?.id ?? fallbackId;
}

export function findGroupForCategoryId(
  groups: readonly AdminCategoryGroup[],
  categoryId: string,
): { groupId: string; divisionId: string | null } | null {
  const id = normId(categoryId);
  for (const group of groups) {
    if (normId(group.directCategoryId) === id) {
      return { groupId: group.id, divisionId: null };
    }
    const division = group.divisions.find((d) => normId(d.id) === id);
    if (division) {
      return { groupId: group.id, divisionId: division.id };
    }
  }
  return null;
}

export function findCategoryLabel(
  optGroups: readonly AdminCategoryOptGroup[],
  categoryId: string,
): string {
  const id = normId(categoryId);
  for (const group of optGroups) {
    const hit = group.options.find((o) => normId(o.id) === id);
    if (hit) return hit.label;
  }
  return categoryId;
}
