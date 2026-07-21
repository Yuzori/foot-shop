-- =============================================================================
-- PrestaShop 8 — Réparer les produits invisibles dans Catalogue → Produits
-- =============================================================================
-- Symptôme : erreur « Produit #791 créé mais invisible » ou produits visibles
-- dans Catégories → Ligue 1 mais pas dans Catalogue → Produits.
--
-- Cause : ligne manquante ou inactive dans ps_product_shop pour le shop 1.
--
-- ⚠️ Sauvegarde phpMyAdmin obligatoire avant exécution !
--
-- Après ce script :
--   1. Back office → Paramètres avancés → Performances → Vider le cache
--   2. Réessayez l'import depuis Foot Shop → /admin/bbdbuy
-- =============================================================================

SET @shop_id := 1;

-- Diagnostic rapide (optionnel) : remplacez 791 par l'id affiché dans l'erreur
-- SELECT p.id_product, p.active, ps.active AS shop_active, ps.visibility
-- FROM ps_product p
-- LEFT JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
-- WHERE p.id_product = 791;

-- 1) Créer les lignes ps_product_shop manquantes
INSERT INTO ps_product_shop (
  id_product,
  id_shop,
  id_category_default,
  id_tax_rules_group,
  on_sale,
  online_only,
  ecotax,
  minimal_quantity,
  low_stock_threshold,
  low_stock_alert,
  price,
  wholesale_price,
  unity,
  unit_price_ratio,
  additional_shipping_cost,
  customizable,
  uploadable_files,
  text_fields,
  active,
  redirect_type,
  id_type_redirected,
  available_for_order,
  available_date,
  show_condition,
  `condition`,
  show_price,
  indexed,
  visibility,
  cache_default_attribute,
  advanced_stock_management,
  date_add,
  date_upd,
  pack_stock_type
)
SELECT
  p.id_product,
  @shop_id,
  p.id_category_default,
  IFNULL(p.id_tax_rules_group, 1),
  0,
  0,
  0,
  1,
  NULL,
  0,
  p.price,
  p.wholesale_price,
  '',
  0,
  0,
  0,
  0,
  0,
  1,
  'default',
  0,
  1,
  '0000-00-00',
  0,
  'new',
  1,
  1,
  IFNULL(p.visibility, 'both'),
  0,
  0,
  p.date_add,
  p.date_upd,
  0
FROM ps_product p
LEFT JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE ps.id_product IS NULL;

-- 2) Réactiver les produits orphelins (présents en catégorie mais inactifs en shop)
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
  ps.show_price = 1
WHERE p.active = 0 OR ps.active = 0 OR p.visibility = 'none' OR ps.visibility = 'none';

-- 3) Vérifications
SELECT COUNT(*) AS produits_total FROM ps_product;
SELECT COUNT(*) AS produits_shop_1 FROM ps_product_shop WHERE id_shop = @shop_id;
SELECT COUNT(*) AS produits_actifs_shop_1
FROM ps_product_shop
WHERE id_shop = @shop_id AND active = 1;

-- Produits encore sans ligne shop (doit être 0)
SELECT p.id_product, pl.name
FROM ps_product p
LEFT JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
LEFT JOIN ps_product_lang pl
  ON pl.id_product = p.id_product AND pl.id_lang = 1 AND pl.id_shop = @shop_id
WHERE ps.id_product IS NULL
LIMIT 20;
