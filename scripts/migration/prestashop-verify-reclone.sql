-- =============================================================================
-- PrestaShop 8 — Vérifier qu'un re-clonage a bien ajouté un produit au BO
-- =============================================================================
-- Colle tout dans phpMyAdmin → SQL → Exécuter.
-- Compare le chiffre approx_liste_bo avec Catalogue → Produits dans le BO.
-- =============================================================================

SET @shop_id := 1;
SET @id_lang := 1;

-- IDs du dernier test reclone (modifie si besoin)
SET @source_id := 939;   -- ancien produit « fantôme »
SET @new_id    := 1185;  -- nouveau produit créé par le script

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) COMPTEUR BO — même filtre que Catalogue → Produits
--    Si le clone a marché : ce chiffre doit avoir +1 par produit cloné.
-- ─────────────────────────────────────────────────────────────────────────────

SELECT COUNT(*) AS approx_liste_bo
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1
  AND ps.active = 1
  AND ps.visibility IN ('both', 'catalog');

-- Détail : actifs avec prix > 0 (souvent ce que tu vois en boutique)
SELECT COUNT(*) AS actifs_avec_prix_listables_bo
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1
  AND ps.active = 1
  AND ps.visibility IN ('both', 'catalog')
  AND p.price > 0
  AND ps.price > 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) LE NOUVEAU PRODUIT #1185 — est-il bien « listable BO » ?
--    listable_bo = 1  →  il DOIT apparaître dans Catalogue → Produits
--    listable_bo = 0  →  le clone a échoué côté visibilité BO
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
  p.id_product,
  pl.name,
  p.active AS p_active,
  ps.active AS shop_active,
  ps.visibility,
  ps.indexed,
  p.price AS prix_product,
  ps.price AS prix_shop,
  p.id_category_default,
  (SELECT COUNT(*) FROM ps_image i WHERE i.id_product = p.id_product) AS nb_images,
  (SELECT COUNT(*) FROM ps_category_product cp WHERE cp.id_product = p.id_product) AS nb_categories,
  (SELECT COUNT(*) FROM ps_product_lang x
   WHERE x.id_product = p.id_product AND x.id_lang = @id_lang AND x.id_shop = @shop_id) AS has_lang_shop,
  CASE
    WHEN p.active = 1
     AND ps.active = 1
     AND ps.visibility IN ('both', 'catalog')
    THEN 1
    ELSE 0
  END AS listable_bo
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
LEFT JOIN ps_product_lang pl
  ON pl.id_product = p.id_product
 AND pl.id_lang = @id_lang
 AND pl.id_shop = @shop_id
WHERE p.id_product = @new_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) L'ANCIEN #939 — toujours là ? listable ou fantôme ?
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
  p.id_product,
  pl.name,
  p.active AS p_active,
  ps.active AS shop_active,
  ps.visibility,
  p.price AS prix_product,
  ps.price AS prix_shop,
  (SELECT COUNT(*) FROM ps_image i WHERE i.id_product = p.id_product) AS nb_images,
  CASE
    WHEN p.active = 1
     AND ps.active = 1
     AND ps.visibility IN ('both', 'catalog')
    THEN 1
    ELSE 0
  END AS listable_bo
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
LEFT JOIN ps_product_lang pl
  ON pl.id_product = p.id_product
 AND pl.id_lang = @id_lang
 AND pl.id_shop = @shop_id
WHERE p.id_product = @source_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) RÉSUMÉ CLONE — les deux côte à côte
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
  p.id_product,
  pl.name,
  ps.visibility,
  p.price,
  ps.price AS shop_price,
  CASE
    WHEN p.active = 1 AND ps.active = 1 AND ps.visibility IN ('both', 'catalog')
    THEN 'OUI → visible BO'
    ELSE 'NON → hors BO'
  END AS dans_liste_bo
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
LEFT JOIN ps_product_lang pl
  ON pl.id_product = p.id_product
 AND pl.id_lang = @id_lang
 AND pl.id_shop = @shop_id
WHERE p.id_product IN (@source_id, @new_id)
ORDER BY p.id_product;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) DERNIERS PRODUITS CRÉÉS (pour repérer les clones récents)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
  p.id_product,
  pl.name,
  p.date_add,
  p.price,
  ps.visibility,
  CASE
    WHEN p.active = 1 AND ps.active = 1 AND ps.visibility IN ('both', 'catalog')
    THEN 'BO'
    ELSE 'hors BO'
  END AS statut_bo
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
LEFT JOIN ps_product_lang pl
  ON pl.id_product = p.id_product
 AND pl.id_lang = @id_lang
 AND pl.id_shop = @shop_id
ORDER BY p.id_product DESC
LIMIT 15;

-- =============================================================================
-- INTERPRÉTATION RAPIDE
-- =============================================================================
-- ✓ Ça a marché si :
--   • approx_liste_bo a augmenté de 1 (ex. 207 → 208)
--   • #1185 : listable_bo = 1, prix > 0, nb_images > 0
--   • #1185 apparaît dans la requête 5 avec statut_bo = 'BO'
--
-- ✗ Ça n'a pas marché si :
--   • #1185 introuvable (0 ligne requête 2)
--   • listable_bo = 0 sur #1185
--   • approx_liste_bo n'a pas bougé
-- =============================================================================
