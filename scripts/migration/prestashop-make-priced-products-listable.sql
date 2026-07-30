-- =============================================================================
-- PrestaShop 8 — Faire apparaître TOUS les maillots (avec prix) dans le BO
-- =============================================================================
-- Contexte :
--   • BDD ≈ 540–619 actifs
--   • BO Catalogue → Produits ≈ 207
--   • Les fantômes à 0 € ont été désactivés
--
-- Objectif : rendre listables dans le BO tous les produits ACTIFS avec prix > 0.
--
-- ⚠️ Sauvegarde phpMyAdmin avant les UPDATE.
-- Après : BO → Performances → Vider le cache
--         (+ si dispo : Catalogue → paramètres → reconstruire l’index de recherche)
-- =============================================================================

SET @shop_id := 1;
SET @id_lang := 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) DIAGNOSTIC — combien ont un prix et devraient être dans le BO
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
  COUNT(*) AS actifs_avec_prix
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1
  AND ps.active = 1
  AND p.price > 0
  AND ps.price > 0;

-- Produits avec prix mais potentiellement « cassés » pour le BO
SELECT
  p.id_product,
  pl.name,
  p.active AS p_active,
  ps.active AS shop_active,
  ps.visibility,
  ps.indexed,
  p.price,
  ps.price AS shop_price,
  p.id_category_default,
  (SELECT COUNT(*) FROM ps_category_product cp WHERE cp.id_product = p.id_product) AS nb_cats,
  (SELECT COUNT(*) FROM ps_product_lang x
   WHERE x.id_product = p.id_product AND x.id_lang = @id_lang AND x.id_shop = @shop_id) AS has_lang_shop
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
LEFT JOIN ps_product_lang pl
  ON pl.id_product = p.id_product
 AND pl.id_lang = @id_lang
 AND pl.id_shop = @shop_id
WHERE p.active = 1
  AND p.price > 0
  AND (
    ps.active = 0
    OR ps.visibility NOT IN ('both', 'catalog')
    OR IFNULL(ps.indexed, 0) = 0
    OR p.id_category_default IS NULL
    OR p.id_category_default = 0
    OR NOT EXISTS (
      SELECT 1 FROM ps_category_product cp WHERE cp.id_product = p.id_product
    )
    OR NOT EXISTS (
      SELECT 1 FROM ps_product_lang x
      WHERE x.id_product = p.id_product
        AND x.id_lang = @id_lang
        AND x.id_shop = @shop_id
    )
  )
ORDER BY p.id_product DESC
LIMIT 50;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) RÉPARATION BO — produits actifs AVEC prix > 0 uniquement
-- ─────────────────────────────────────────────────────────────────────────────

-- a) Forcer listable en boutique
UPDATE ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
SET
  p.active = 1,
  ps.active = 1,
  p.visibility = 'both',
  ps.visibility = 'both',
  p.available_for_order = 1,
  ps.available_for_order = 1,
  p.show_price = 1,
  ps.show_price = 1,
  ps.indexed = 1,
  p.date_upd = NOW(),
  ps.date_upd = NOW()
WHERE p.price > 0
  AND ps.price > 0
  AND p.active = 1;

-- b) Langue boutique manquante (copie depuis n’importe quelle ligne lang existante)
INSERT INTO ps_product_lang (
  id_product, id_shop, id_lang, name, link_rewrite, description, description_short, meta_title
)
SELECT
  pl.id_product,
  @shop_id,
  pl.id_lang,
  pl.name,
  pl.link_rewrite,
  pl.description,
  pl.description_short,
  pl.meta_title
FROM ps_product_lang pl
JOIN ps_product p ON p.id_product = pl.id_product
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
LEFT JOIN ps_product_lang pl2
  ON pl2.id_product = pl.id_product
 AND pl2.id_shop = @shop_id
 AND pl2.id_lang = pl.id_lang
WHERE pl.id_lang = @id_lang
  AND pl2.id_product IS NULL
  AND p.active = 1
  AND p.price > 0
  AND ps.price > 0
GROUP BY pl.id_product, pl.id_lang;

-- c) Si pas de catégorie par défaut : rattacher à Accueil (id 2) + association
UPDATE ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
SET
  p.id_category_default = 2,
  ps.id_category_default = 2
WHERE p.active = 1
  AND p.price > 0
  AND ps.price > 0
  AND (p.id_category_default IS NULL OR p.id_category_default = 0);

INSERT INTO ps_category_product (id_category, id_product, position)
SELECT 2, p.id_product, 0
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
LEFT JOIN ps_category_product cp
  ON cp.id_product = p.id_product AND cp.id_category = 2
WHERE p.active = 1
  AND p.price > 0
  AND ps.price > 0
  AND cp.id_product IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) CONTRÔLE
-- ─────────────────────────────────────────────────────────────────────────────

SELECT COUNT(*) AS devraient_apparaitre_dans_bo
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1
  AND ps.active = 1
  AND ps.visibility IN ('both', 'catalog')
  AND p.price > 0
  AND ps.price > 0;

-- Exemple Bayern
SELECT p.id_product, pl.name, p.price, ps.price AS shop_price, ps.visibility, ps.indexed
FROM ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
JOIN ps_product_lang pl ON pl.id_product = p.id_product AND pl.id_lang = @id_lang AND pl.id_shop = @shop_id
WHERE pl.name LIKE '%Bayern%'
ORDER BY p.id_product DESC
LIMIT 15;
