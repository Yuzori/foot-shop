-- =============================================================================
-- PrestaShop 8 — Pourquoi le BO dit 283 mais le SQL simple dit 616 ?
-- =============================================================================
-- Le BO utilise des critères EN PLUS de visibility (indexation, langue shop, etc.)
-- Colle tout dans phpMyAdmin.
-- =============================================================================

SET @shop_id := 1;
SET @id_lang := 1;

-- 1) Les 3 compteurs côte à côte
SELECT
  (SELECT COUNT(*)
   FROM ps_product p
   JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
   WHERE p.active = 1 AND ps.active = 1
     AND ps.visibility IN ('both', 'catalog')
  ) AS sql_simple_616,

  (SELECT COUNT(*)
   FROM ps_product p
   JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
   WHERE p.active = 1 AND ps.active = 1
     AND ps.visibility IN ('both', 'catalog')
     AND IFNULL(ps.indexed, 0) = 1
     AND p.id_category_default IS NOT NULL AND p.id_category_default > 0
     AND EXISTS (
       SELECT 1 FROM ps_product_lang x
       WHERE x.id_product = p.id_product
         AND x.id_lang = @id_lang
         AND x.id_shop = @shop_id
         AND TRIM(IFNULL(x.name, '')) <> ''
     )
     AND EXISTS (
       SELECT 1 FROM ps_category_product cp WHERE cp.id_product = p.id_product
     )
  ) AS filtre_bo_strict,

  (SELECT COUNT(*)
   FROM ps_product p
   JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
   WHERE p.active = 1 AND ps.active = 1
     AND IFNULL(ps.indexed, 0) = 0
  ) AS non_indexes;

-- 2) Pourquoi les ~333 manquent — répartition des problèmes
SELECT
  SUM(CASE WHEN IFNULL(ps.indexed, 0) = 0 THEN 1 ELSE 0 END) AS sans_indexation,
  SUM(CASE WHEN p.id_category_default IS NULL OR p.id_category_default = 0 THEN 1 ELSE 0 END) AS sans_categorie_defaut,
  SUM(CASE WHEN NOT EXISTS (
    SELECT 1 FROM ps_category_product cp WHERE cp.id_product = p.id_product
  ) THEN 1 ELSE 0 END) AS sans_association_categorie,
  SUM(CASE WHEN NOT EXISTS (
    SELECT 1 FROM ps_product_lang x
    WHERE x.id_product = p.id_product AND x.id_lang = @id_lang AND x.id_shop = @shop_id
      AND TRIM(IFNULL(x.name, '')) <> ''
  ) THEN 1 ELSE 0 END) AS sans_nom_lang_shop
FROM ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1 AND ps.active = 1
  AND ps.visibility IN ('both', 'catalog');

-- 3) Échantillon des produits « SQL oui, BO non »
SELECT
  p.id_product,
  pl.name,
  ps.indexed,
  p.id_category_default,
  (SELECT COUNT(*) FROM ps_category_product cp WHERE cp.id_product = p.id_product) AS nb_cats,
  (SELECT COUNT(*) FROM ps_product_lang x
   WHERE x.id_product = p.id_product AND x.id_lang = @id_lang AND x.id_shop = @shop_id) AS lang_shop
FROM ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
LEFT JOIN ps_product_lang pl
  ON pl.id_product = p.id_product AND pl.id_lang = @id_lang AND pl.id_shop = @shop_id
WHERE p.active = 1 AND ps.active = 1
  AND ps.visibility IN ('both', 'catalog')
  AND (
    IFNULL(ps.indexed, 0) = 0
    OR p.id_category_default IS NULL OR p.id_category_default = 0
    OR NOT EXISTS (SELECT 1 FROM ps_category_product cp WHERE cp.id_product = p.id_product)
    OR NOT EXISTS (
      SELECT 1 FROM ps_product_lang x
      WHERE x.id_product = p.id_product AND x.id_lang = @id_lang AND x.id_shop = @shop_id
        AND TRIM(IFNULL(x.name, '')) <> ''
    )
  )
ORDER BY p.id_product DESC
LIMIT 30;

-- =============================================================================
-- 4) RÉPARATION — forcer indexation + langue + catégorie pour TOUS les actifs
--    ⚠️ Sauvegarde avant. Puis BO → Performances → Vider le cache
--         + Catalogue → reconstruire l’index de recherche si dispo
-- =============================================================================

UPDATE ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
SET ps.indexed = 1, p.date_upd = NOW(), ps.date_upd = NOW()
WHERE p.active = 1 AND ps.active = 1;

INSERT INTO ps_product_lang (id_product, id_shop, id_lang, name, link_rewrite, description, description_short, meta_title)
SELECT pl.id_product, @shop_id, pl.id_lang, pl.name, pl.link_rewrite, pl.description, pl.description_short, pl.meta_title
FROM ps_product_lang pl
JOIN ps_product p ON p.id_product = pl.id_product
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
LEFT JOIN ps_product_lang pl2
  ON pl2.id_product = pl.id_product AND pl2.id_shop = @shop_id AND pl2.id_lang = pl.id_lang
WHERE pl.id_lang = @id_lang AND pl2.id_product IS NULL
  AND p.active = 1 AND ps.active = 1
GROUP BY pl.id_product, pl.id_lang;

UPDATE ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
SET p.id_category_default = 2, ps.id_category_default = 2
WHERE p.active = 1 AND ps.active = 1
  AND (p.id_category_default IS NULL OR p.id_category_default = 0);

INSERT INTO ps_category_product (id_category, id_product, position)
SELECT 2, p.id_product, 0
FROM ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
LEFT JOIN ps_category_product cp ON cp.id_product = p.id_product AND cp.id_category = 2
WHERE p.active = 1 AND ps.active = 1 AND cp.id_product IS NULL;

-- 5) Recontrôle après réparation
SELECT COUNT(*) AS filtre_bo_strict_apres
FROM ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1 AND ps.active = 1
  AND ps.visibility IN ('both', 'catalog')
  AND IFNULL(ps.indexed, 0) = 1
  AND p.id_category_default > 0
  AND EXISTS (SELECT 1 FROM ps_product_lang x WHERE x.id_product = p.id_product AND x.id_lang = @id_lang AND x.id_shop = @shop_id)
  AND EXISTS (SELECT 1 FROM ps_category_product cp WHERE cp.id_product = p.id_product);
