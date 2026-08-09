-- =============================================================================
-- PrestaShop 8 — Produit fantôme #530 (foot-shop.fr/produit/530)
-- =============================================================================
-- Le site lit PrestaShop en direct (API). Ce produit peut exister en BDD
-- sans apparaître dans le BO (ligne shop manquante, visibility, prix 0…).
--
-- Où exécuter : phpMyAdmin sur la base PrestaShop (bo.foot-shop.fr).
-- Après : BO → Paramètres avancés → Performances → Vider le cache.
-- =============================================================================

SET @shop_id := 1;
SET @id_lang := 1;
SET @product_id := 530;

-- ── 1) DIAGNOSTIC ───────────────────────────────────────────────────────────

SELECT
  p.id_product,
  pl.name,
  p.active AS p_active,
  ps.active AS shop_active,
  ps.visibility,
  p.price AS prix_product,
  IFNULL(ps.price, 0) AS prix_shop,
  (SELECT COUNT(*) FROM ps_image i WHERE i.id_product = p.id_product) AS nb_images,
  (SELECT COUNT(*) FROM ps_category_product cp WHERE cp.id_product = p.id_product) AS nb_categories
FROM ps_product p
LEFT JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
LEFT JOIN ps_product_lang pl
  ON pl.id_product = p.id_product AND pl.id_lang = @id_lang AND pl.id_shop = @shop_id
WHERE p.id_product = @product_id;

-- Si 0 ligne : le produit n'existe plus en BDD (cache navigateur / ancienne URL).

-- ── 2) MASQUER (recommandé) — disparaît du catalogue ET de /produit/530 ─────
--     (le site Next.js ignore active=0 et visibility=none)

UPDATE ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
SET
  p.active = 0,
  ps.active = 0,
  p.visibility = 'none',
  ps.visibility = 'none',
  ps.indexed = 0,
  p.date_upd = NOW(),
  ps.date_upd = NOW()
WHERE p.id_product = @product_id;

-- Si pas de ligne ps_product_shop pour shop 1 :
INSERT INTO ps_product_shop (
  id_product, id_shop, active, visibility, indexed, price, date_add, date_upd
)
SELECT
  p.id_product,
  @shop_id,
  0,
  'none',
  0,
  IFNULL(p.price, 0),
  NOW(),
  NOW()
FROM ps_product p
LEFT JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.id_product = @product_id
  AND ps.id_product IS NULL;

UPDATE ps_product
SET active = 0, visibility = 'none', date_upd = NOW()
WHERE id_product = @product_id;

-- Retirer des catégories (plus de listing)
DELETE FROM ps_category_product WHERE id_product = @product_id;

-- Vérif masquage
SELECT id_product, active, visibility FROM ps_product WHERE id_product = @product_id;

-- ── 3) SUPPRIMER DÉFINITIVEMENT (optionnel — après section 2 si besoin) ─────
--     Décommente uniquement si tu es sûr (commandes passées conservées sans lien produit).

/*
SET FOREIGN_KEY_CHECKS = 0;

DELETE pai FROM ps_product_attribute_image pai
  INNER JOIN ps_image i ON i.id_image = pai.id_image
  WHERE i.id_product = @product_id;

DELETE ish FROM ps_image_shop ish
  INNER JOIN ps_image i ON i.id_image = ish.id_image
  WHERE i.id_product = @product_id;

DELETE il FROM ps_image_lang il
  INNER JOIN ps_image i ON i.id_image = il.id_image
  WHERE i.id_product = @product_id;

DELETE FROM ps_image WHERE id_product = @product_id;

DELETE pac FROM ps_product_attribute_combination pac
  INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pac.id_product_attribute
  WHERE pa.id_product = @product_id;

DELETE pal FROM ps_product_attribute_lang pal
  INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pal.id_product_attribute
  WHERE pa.id_product = @product_id;

DELETE pas FROM ps_product_attribute_shop pas
  INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pas.id_product_attribute
  WHERE pa.id_product = @product_id;

DELETE FROM ps_product_attribute WHERE id_product = @product_id;

DELETE FROM ps_category_product WHERE id_product = @product_id;
DELETE FROM ps_feature_product WHERE id_product = @product_id;
DELETE FROM ps_product_tag WHERE id_product = @product_id;
DELETE FROM ps_specific_price WHERE id_product = @product_id;
DELETE FROM ps_stock_available WHERE id_product = @product_id;
DELETE FROM ps_cart_product WHERE id_product = @product_id;

DELETE FROM ps_product_lang WHERE id_product = @product_id;
DELETE FROM ps_product_shop WHERE id_product = @product_id;
DELETE FROM ps_product WHERE id_product = @product_id;

SET FOREIGN_KEY_CHECKS = 1;

SELECT COUNT(*) AS reste FROM ps_product WHERE id_product = @product_id;
*/
