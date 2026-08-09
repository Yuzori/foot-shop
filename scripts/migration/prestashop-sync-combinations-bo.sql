-- =============================================================================
-- PrestaShop 8 — Synchroniser déclinaisons SQL → visible BO + API webservice
-- =============================================================================
-- À lancer si la BDD a bien S/M/L/XL/XXL (requêtes OK) mais le back office
-- ou foot-shop.fr ne reflète pas les changements.
--
-- ⚠️ Sauvegarde BDD avant exécution.
-- Après : BO → Paramètres avancés → Performances → Vider le cache
-- =============================================================================

SET @id_shop = IFNULL((SELECT id_shop FROM ps_shop WHERE active = 1 ORDER BY id_shop LIMIT 1), 1);
SET @id_lang = IFNULL((SELECT id_lang FROM ps_lang WHERE iso_code = 'fr' LIMIT 1), 1);
SET @stock_qty = 20;
SET @size_group = 1;
SET @xxl_attr = 27;

-- ── DIAGNOSTIC ───────────────────────────────────────────────────────────────

SELECT COUNT(*) AS combinaisons_sans_ligne_shop
FROM ps_product_attribute pa
LEFT JOIN ps_product_attribute_shop pas
  ON pas.id_product_attribute = pa.id_product_attribute AND pas.id_shop = @id_shop
WHERE pas.id_product_attribute IS NULL;

SELECT COUNT(*) AS produits_reels_avec_xxl
FROM ps_product_attribute pa
JOIN ps_product_attribute_combination pac
  ON pac.id_product_attribute = pa.id_product_attribute AND pac.id_attribute = @xxl_attr
JOIN ps_product_shop ps
  ON ps.id_product = pa.id_product AND ps.id_shop = @id_shop
WHERE ps.active = 1
  AND ps.price > 0
  AND ps.visibility IN ('both', 'catalog');

SELECT COUNT(*) AS fantomes_avec_xxl
FROM ps_product_attribute pa
JOIN ps_product_attribute_combination pac
  ON pac.id_product_attribute = pa.id_product_attribute AND pac.id_attribute = @xxl_attr
JOIN ps_product_shop ps
  ON ps.id_product = pa.id_product AND ps.id_shop = @id_shop
WHERE ps.active = 1
  AND (ps.price = 0 OR ps.price IS NULL);

-- ── FIX 1 : Lier toutes les déclinaisons à la boutique ─────────────────────

INSERT INTO ps_product_attribute_shop (
  id_product_attribute,
  id_shop,
  wholesale_price,
  price,
  ecotax,
  weight,
  unit_price_impact,
  default_on,
  minimal_quantity,
  available_date
)
SELECT
  pa.id_product_attribute,
  @id_shop,
  0,
  0,
  0,
  0,
  0,
  NULL,
  1,
  NULL
FROM ps_product_attribute pa
WHERE NOT EXISTS (
  SELECT 1 FROM ps_product_attribute_shop pas
  WHERE pas.id_product_attribute = pa.id_product_attribute
    AND pas.id_shop = @id_shop
);

-- ── FIX 2 : Langues déclinaisons manquantes (PS 8.1+) ──────────────────────

INSERT INTO ps_product_attribute_lang (
  id_product_attribute,
  id_lang,
  available_now,
  available_later
)
SELECT pa.id_product_attribute, l.id_lang, '', ''
FROM ps_product_attribute pa
CROSS JOIN ps_lang l
WHERE NOT EXISTS (
  SELECT 1 FROM ps_product_attribute_lang pal
  WHERE pal.id_product_attribute = pa.id_product_attribute
    AND pal.id_lang = l.id_lang
);

-- ── FIX 3 : Stock shop (déclinaisons) ──────────────────────────────────────

INSERT INTO ps_stock_available (
  id_product,
  id_product_attribute,
  id_shop,
  id_shop_group,
  quantity,
  depends_on_stock,
  out_of_stock
)
SELECT
  pa.id_product,
  pa.id_product_attribute,
  @id_shop,
  0,
  @stock_qty,
  0,
  2
FROM ps_product_attribute pa
WHERE NOT EXISTS (
  SELECT 1 FROM ps_stock_available sa
  WHERE sa.id_product = pa.id_product
    AND sa.id_product_attribute = pa.id_product_attribute
    AND sa.id_shop = @id_shop
);

UPDATE ps_stock_available sa
INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = sa.id_product_attribute
SET sa.quantity = @stock_qty,
    sa.depends_on_stock = 0,
    sa.out_of_stock = 2
WHERE sa.id_shop = @id_shop
  AND pa.id_product_attribute > 0;

-- ── FIX 4 : Type produit « combinations » si déclinaisons ──────────────────

UPDATE ps_product p
SET p.product_type = 'combinations',
    p.date_upd = NOW()
WHERE EXISTS (
  SELECT 1 FROM ps_product_attribute pa WHERE pa.id_product = p.id_product
)
AND IFNULL(p.product_type, '') NOT IN ('combinations', 'pack');

UPDATE ps_product_shop ps
INNER JOIN ps_product p ON p.id_product = ps.id_product
SET ps.date_upd = NOW()
WHERE ps.id_shop = @id_shop
  AND EXISTS (
    SELECT 1 FROM ps_product_attribute pa WHERE pa.id_product = p.id_product
  );

-- ── VÉRIFICATION ───────────────────────────────────────────────────────────

SELECT COUNT(*) AS combinaisons_sans_ligne_shop_apres_fix
FROM ps_product_attribute pa
LEFT JOIN ps_product_attribute_shop pas
  ON pas.id_product_attribute = pa.id_product_attribute AND pas.id_shop = @id_shop
WHERE pas.id_product_attribute IS NULL;

SELECT al.name AS taille, COUNT(DISTINCT pa.id_product) AS nb_produits_reels
FROM ps_product_attribute pa
JOIN ps_product_attribute_combination pac ON pac.id_product_attribute = pa.id_product_attribute
JOIN ps_attribute_lang al ON al.id_attribute = pac.id_attribute AND al.id_lang = @id_lang
JOIN ps_product_shop ps ON ps.id_product = pa.id_product AND ps.id_shop = @id_shop
WHERE ps.active = 1
  AND ps.price > 0
  AND ps.visibility IN ('both', 'catalog')
  AND al.name IN ('S','M','L','XL','XXL')
GROUP BY al.name
ORDER BY FIELD(al.name, 'S','M','L','XL','XXL');
