/** Détecte une référence de commande de test (emails admin, essais). */
export function isTestOrderReference(reference: string): boolean {
  const ref = reference.trim().toUpperCase();
  return ref.startsWith("TEST-") || ref.startsWith("TEST_");
}

export function isTestArchiveRecord(record: {
  status?: string;
  source?: string;
  reference: string;
}): boolean {
  return (
    record.status === "test" ||
    record.source === "admin_test" ||
    isTestOrderReference(record.reference)
  );
}
