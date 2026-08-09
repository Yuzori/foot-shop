-- =============================================================================
-- PrestaShop 8 — Tailles S à XXL + stock 20 (catalogue à déclinaisons)
-- =============================================================================
-- ⚠️ Sauvegarde BDD obligatoire !
--
-- ÉTAPES phpMyAdmin :
--   1. Exécutez d'abord : prestashop-diagnose-sizes.sql
--   2. Vérifiez que size_group_id n'est PAS NULL
--   3. Exécutez CE fichier en entier (onglet SQL → tout coller → Exécuter)
--   4. Regardez TOUS les onglets de résultats en bas (pas seulement le dernier)
--   5. Back office → Performances → Vider le cache
--
-- Si ça ne marche toujours pas : utilisez l'API Foot Shop
--   POST https://foot-shop.fr/api/admin/ensure-xxl  (header admin)
-- =============================================================================

SET @id_lang = (SELECT id_lang FROM ps_lang WHERE iso_code = 'fr' OR language_code = 'fr' LIMIT 1);
SET @id_lang = IFNULL(@id_lang, 1);
SET @id_shop = IFNULL((SELECT id_shop FROM ps_shop WHERE active = 1 ORDER BY id_shop LIMIT 1), 1);
SET @stock_qty = 20;

-- Groupe « Taille » : nom FR/EN, sinon le plus utilisé dans les déclinaisons
SET @size_group = (
  SELECT ag.id_attribute_group
  FROM ps_attribute_group ag
  JOIN ps_attribute_group_lang agl ON agl.id_attribute_group = ag.id_attribute_group AND agl.id_lang = @id_lang
  WHERE agl.name LIKE '%Taille%' OR agl.public_name LIKE '%Taille%'
     OR agl.name LIKE '%Size%' OR agl.public_name LIKE '%Size%'
  ORDER BY ag.id_attribute_group LIMIT 1
);

SET @size_group = IFNULL(@size_group, (
  SELECT a.id_attribute_group
  FROM ps_product_attribute_combination pac
  JOIN ps_attribute a ON a.id_attribute = pac.id_attribute
  JOIN ps_attribute_lang al ON al.id_attribute = a.id_attribute AND al.id_lang = @id_lang
  WHERE UPPER(TRIM(al.name)) IN ('XS','S','M','L','XL','XXL')
  GROUP BY a.id_attribute_group
  ORDER BY COUNT(DISTINCT pac.id_product_attribute) DESC
  LIMIT 1
));

SELECT @id_lang AS id_lang, @id_shop AS id_shop, @size_group AS size_group_id;

-- Arrêt visible si groupe introuvable
SELECT IF(
  @size_group IS NULL,
  'ERREUR : groupe Taille introuvable — exécutez prestashop-diagnose-sizes.sql',
  'OK : groupe Taille détecté'
) AS diagnostic_groupe;

-- ---------------------------------------------------------------------------
-- Procédure inline par taille (S, M, L, XL, XXL)
-- ---------------------------------------------------------------------------

-- >>> S
SET @size_label = 'S';
SET @size_marker = 'FS-SIZE-TMP-S';
SET @size_attr = (SELECT a.id_attribute FROM ps_attribute a JOIN ps_attribute_lang al ON al.id_attribute = a.id_attribute AND al.id_lang = @id_lang WHERE a.id_attribute_group = @size_group AND UPPER(TRIM(al.name)) = @size_label LIMIT 1);
INSERT INTO ps_attribute (id_attribute_group, color, position) SELECT @size_group, '', COALESCE(MAX(a.position), 0) + 1 FROM ps_attribute a WHERE a.id_attribute_group = @size_group AND @size_attr IS NULL AND @size_group IS NOT NULL;
SET @size_attr = (
  SELECT a.id_attribute FROM ps_attribute a
  JOIN ps_attribute_lang al ON al.id_attribute = a.id_attribute AND al.id_lang = @id_lang
  WHERE a.id_attribute_group = @size_group AND UPPER(TRIM(al.name)) = @size_label LIMIT 1
);
INSERT IGNORE INTO ps_attribute_lang (id_attribute, id_lang, name) SELECT @size_attr, @id_lang, @size_label FROM (SELECT 1) x WHERE @size_attr > 0 AND @size_group IS NOT NULL;
INSERT IGNORE INTO ps_attribute_shop (id_attribute, id_shop) SELECT @size_attr, @id_shop FROM (SELECT 1) x WHERE @size_attr > 0;
DELETE sa FROM ps_stock_available sa INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = sa.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pas FROM ps_product_attribute_shop pas INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pas.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pal FROM ps_product_attribute_lang pal INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pal.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pac FROM ps_product_attribute_combination pac INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pac.id_product_attribute WHERE pa.reference = @size_marker;
DELETE FROM ps_product_attribute WHERE reference = @size_marker;
INSERT INTO ps_product_attribute (id_product, reference, supplier_reference, ean13, isbn, upc, mpn, wholesale_price, price, ecotax, weight, unit_price_impact, default_on, minimal_quantity)
SELECT DISTINCT base.id_product, @size_marker, '', '', '', '', '', 0, 0, 0, 0, 0, NULL, 1
FROM (SELECT DISTINCT pa.id_product FROM ps_product_attribute pa JOIN ps_product_attribute_combination pac ON pac.id_product_attribute = pa.id_product_attribute JOIN ps_attribute a ON a.id_attribute = pac.id_attribute AND a.id_attribute_group = @size_group) base
WHERE @size_attr > 0 AND @size_group IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ps_product_attribute pa2 JOIN ps_product_attribute_combination pac2 ON pac2.id_product_attribute = pa2.id_product_attribute WHERE pa2.id_product = base.id_product AND pac2.id_attribute = @size_attr);
INSERT INTO ps_product_attribute_shop (id_product_attribute, id_shop, wholesale_price, price, ecotax, weight, unit_price_impact, default_on, minimal_quantity, available_date) SELECT pa.id_product_attribute, @id_shop, 0, 0, 0, 0, 0, NULL, 1, NULL FROM ps_product_attribute pa WHERE pa.reference = @size_marker AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_shop pas WHERE pas.id_product_attribute = pa.id_product_attribute AND pas.id_shop = @id_shop);
INSERT INTO ps_product_attribute_lang (id_product_attribute, id_lang, available_now, available_later) SELECT pa.id_product_attribute, l.id_lang, '', '' FROM ps_product_attribute pa CROSS JOIN ps_lang l WHERE pa.reference = @size_marker AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_lang pal WHERE pal.id_product_attribute = pa.id_product_attribute AND pal.id_lang = l.id_lang);
INSERT INTO ps_product_attribute_combination (id_attribute, id_product_attribute) SELECT @size_attr, pa.id_product_attribute FROM ps_product_attribute pa WHERE pa.reference = @size_marker AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_combination pac WHERE pac.id_product_attribute = pa.id_product_attribute AND pac.id_attribute = @size_attr);
INSERT INTO ps_stock_available (id_product, id_product_attribute, id_shop, id_shop_group, quantity, depends_on_stock, out_of_stock) SELECT pa.id_product, pa.id_product_attribute, @id_shop, 0, @stock_qty, 0, 2 FROM ps_product_attribute pa WHERE pa.reference = @size_marker AND NOT EXISTS (SELECT 1 FROM ps_stock_available sa WHERE sa.id_product = pa.id_product AND sa.id_product_attribute = pa.id_product_attribute AND sa.id_shop = @id_shop);
UPDATE ps_product_attribute SET reference = '' WHERE reference = @size_marker;
SELECT @size_label AS taille_ajoutee, ROW_COUNT() AS refs_nettoyees;

-- >>> M
SET @size_label = 'M';
SET @size_marker = 'FS-SIZE-TMP-M';
SET @size_attr = (SELECT a.id_attribute FROM ps_attribute a JOIN ps_attribute_lang al ON al.id_attribute = a.id_attribute AND al.id_lang = @id_lang WHERE a.id_attribute_group = @size_group AND UPPER(TRIM(al.name)) = @size_label LIMIT 1);
INSERT INTO ps_attribute (id_attribute_group, color, position) SELECT @size_group, '', COALESCE(MAX(a.position), 0) + 1 FROM ps_attribute a WHERE a.id_attribute_group = @size_group AND @size_attr IS NULL AND @size_group IS NOT NULL;
SET @size_attr = (
  SELECT a.id_attribute FROM ps_attribute a
  JOIN ps_attribute_lang al ON al.id_attribute = a.id_attribute AND al.id_lang = @id_lang
  WHERE a.id_attribute_group = @size_group AND UPPER(TRIM(al.name)) = @size_label LIMIT 1
);
INSERT IGNORE INTO ps_attribute_lang (id_attribute, id_lang, name) SELECT @size_attr, @id_lang, @size_label FROM (SELECT 1) x WHERE @size_attr > 0 AND @size_group IS NOT NULL;
INSERT IGNORE INTO ps_attribute_shop (id_attribute, id_shop) SELECT @size_attr, @id_shop FROM (SELECT 1) x WHERE @size_attr > 0;
DELETE sa FROM ps_stock_available sa INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = sa.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pas FROM ps_product_attribute_shop pas INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pas.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pal FROM ps_product_attribute_lang pal INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pal.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pac FROM ps_product_attribute_combination pac INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pac.id_product_attribute WHERE pa.reference = @size_marker;
DELETE FROM ps_product_attribute WHERE reference = @size_marker;
INSERT INTO ps_product_attribute (id_product, reference, supplier_reference, ean13, isbn, upc, mpn, wholesale_price, price, ecotax, weight, unit_price_impact, default_on, minimal_quantity)
SELECT DISTINCT base.id_product, @size_marker, '', '', '', '', '', 0, 0, 0, 0, 0, NULL, 1
FROM (SELECT DISTINCT pa.id_product FROM ps_product_attribute pa JOIN ps_product_attribute_combination pac ON pac.id_product_attribute = pa.id_product_attribute JOIN ps_attribute a ON a.id_attribute = pac.id_attribute AND a.id_attribute_group = @size_group) base
WHERE @size_attr > 0 AND @size_group IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ps_product_attribute pa2 JOIN ps_product_attribute_combination pac2 ON pac2.id_product_attribute = pa2.id_product_attribute WHERE pa2.id_product = base.id_product AND pac2.id_attribute = @size_attr);
INSERT INTO ps_product_attribute_shop (id_product_attribute, id_shop, wholesale_price, price, ecotax, weight, unit_price_impact, default_on, minimal_quantity, available_date) SELECT pa.id_product_attribute, @id_shop, 0, 0, 0, 0, 0, NULL, 1, NULL FROM ps_product_attribute pa WHERE pa.reference = @size_marker AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_shop pas WHERE pas.id_product_attribute = pa.id_product_attribute AND pas.id_shop = @id_shop);
INSERT INTO ps_product_attribute_lang (id_product_attribute, id_lang, available_now, available_later) SELECT pa.id_product_attribute, l.id_lang, '', '' FROM ps_product_attribute pa CROSS JOIN ps_lang l WHERE pa.reference = @size_marker AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_lang pal WHERE pal.id_product_attribute = pa.id_product_attribute AND pal.id_lang = l.id_lang);
INSERT INTO ps_product_attribute_combination (id_attribute, id_product_attribute) SELECT @size_attr, pa.id_product_attribute FROM ps_product_attribute pa WHERE pa.reference = @size_marker AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_combination pac WHERE pac.id_product_attribute = pa.id_product_attribute AND pac.id_attribute = @size_attr);
INSERT INTO ps_stock_available (id_product, id_product_attribute, id_shop, id_shop_group, quantity, depends_on_stock, out_of_stock) SELECT pa.id_product, pa.id_product_attribute, @id_shop, 0, @stock_qty, 0, 2 FROM ps_product_attribute pa WHERE pa.reference = @size_marker AND NOT EXISTS (SELECT 1 FROM ps_stock_available sa WHERE sa.id_product = pa.id_product AND sa.id_product_attribute = pa.id_product_attribute AND sa.id_shop = @id_shop);
UPDATE ps_product_attribute SET reference = '' WHERE reference = @size_marker;

-- >>> L
SET @size_label = 'L';
SET @size_marker = 'FS-SIZE-TMP-L';
SET @size_attr = (SELECT a.id_attribute FROM ps_attribute a JOIN ps_attribute_lang al ON al.id_attribute = a.id_attribute AND al.id_lang = @id_lang WHERE a.id_attribute_group = @size_group AND UPPER(TRIM(al.name)) = @size_label LIMIT 1);
INSERT INTO ps_attribute (id_attribute_group, color, position) SELECT @size_group, '', COALESCE(MAX(a.position), 0) + 1 FROM ps_attribute a WHERE a.id_attribute_group = @size_group AND @size_attr IS NULL AND @size_group IS NOT NULL;
SET @size_attr = (
  SELECT a.id_attribute FROM ps_attribute a
  JOIN ps_attribute_lang al ON al.id_attribute = a.id_attribute AND al.id_lang = @id_lang
  WHERE a.id_attribute_group = @size_group AND UPPER(TRIM(al.name)) = @size_label LIMIT 1
);
INSERT IGNORE INTO ps_attribute_lang (id_attribute, id_lang, name) SELECT @size_attr, @id_lang, @size_label FROM (SELECT 1) x WHERE @size_attr > 0 AND @size_group IS NOT NULL;
INSERT IGNORE INTO ps_attribute_shop (id_attribute, id_shop) SELECT @size_attr, @id_shop FROM (SELECT 1) x WHERE @size_attr > 0;
DELETE sa FROM ps_stock_available sa INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = sa.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pas FROM ps_product_attribute_shop pas INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pas.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pal FROM ps_product_attribute_lang pal INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pal.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pac FROM ps_product_attribute_combination pac INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pac.id_product_attribute WHERE pa.reference = @size_marker;
DELETE FROM ps_product_attribute WHERE reference = @size_marker;
INSERT INTO ps_product_attribute (id_product, reference, supplier_reference, ean13, isbn, upc, mpn, wholesale_price, price, ecotax, weight, unit_price_impact, default_on, minimal_quantity)
SELECT DISTINCT base.id_product, @size_marker, '', '', '', '', '', 0, 0, 0, 0, 0, NULL, 1
FROM (SELECT DISTINCT pa.id_product FROM ps_product_attribute pa JOIN ps_product_attribute_combination pac ON pac.id_product_attribute = pa.id_product_attribute JOIN ps_attribute a ON a.id_attribute = pac.id_attribute AND a.id_attribute_group = @size_group) base
WHERE @size_attr > 0 AND @size_group IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ps_product_attribute pa2 JOIN ps_product_attribute_combination pac2 ON pac2.id_product_attribute = pa2.id_product_attribute WHERE pa2.id_product = base.id_product AND pac2.id_attribute = @size_attr);
INSERT INTO ps_product_attribute_shop (id_product_attribute, id_shop, wholesale_price, price, ecotax, weight, unit_price_impact, default_on, minimal_quantity, available_date) SELECT pa.id_product_attribute, @id_shop, 0, 0, 0, 0, 0, NULL, 1, NULL FROM ps_product_attribute pa WHERE pa.reference = @size_marker AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_shop pas WHERE pas.id_product_attribute = pa.id_product_attribute AND pas.id_shop = @id_shop);
INSERT INTO ps_product_attribute_lang (id_product_attribute, id_lang, available_now, available_later) SELECT pa.id_product_attribute, l.id_lang, '', '' FROM ps_product_attribute pa CROSS JOIN ps_lang l WHERE pa.reference = @size_marker AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_lang pal WHERE pal.id_product_attribute = pa.id_product_attribute AND pal.id_lang = l.id_lang);
INSERT INTO ps_product_attribute_combination (id_attribute, id_product_attribute) SELECT @size_attr, pa.id_product_attribute FROM ps_product_attribute pa WHERE pa.reference = @size_marker AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_combination pac WHERE pac.id_product_attribute = pa.id_product_attribute AND pac.id_attribute = @size_attr);
INSERT INTO ps_stock_available (id_product, id_product_attribute, id_shop, id_shop_group, quantity, depends_on_stock, out_of_stock) SELECT pa.id_product, pa.id_product_attribute, @id_shop, 0, @stock_qty, 0, 2 FROM ps_product_attribute pa WHERE pa.reference = @size_marker AND NOT EXISTS (SELECT 1 FROM ps_stock_available sa WHERE sa.id_product = pa.id_product AND sa.id_product_attribute = pa.id_product_attribute AND sa.id_shop = @id_shop);
UPDATE ps_product_attribute SET reference = '' WHERE reference = @size_marker;

-- >>> XL
SET @size_label = 'XL';
SET @size_marker = 'FS-SIZE-TMP-XL';
SET @size_attr = (SELECT a.id_attribute FROM ps_attribute a JOIN ps_attribute_lang al ON al.id_attribute = a.id_attribute AND al.id_lang = @id_lang WHERE a.id_attribute_group = @size_group AND UPPER(TRIM(al.name)) = @size_label LIMIT 1);
INSERT INTO ps_attribute (id_attribute_group, color, position) SELECT @size_group, '', COALESCE(MAX(a.position), 0) + 1 FROM ps_attribute a WHERE a.id_attribute_group = @size_group AND @size_attr IS NULL AND @size_group IS NOT NULL;
SET @size_attr = (
  SELECT a.id_attribute FROM ps_attribute a
  JOIN ps_attribute_lang al ON al.id_attribute = a.id_attribute AND al.id_lang = @id_lang
  WHERE a.id_attribute_group = @size_group AND UPPER(TRIM(al.name)) = @size_label LIMIT 1
);
INSERT IGNORE INTO ps_attribute_lang (id_attribute, id_lang, name) SELECT @size_attr, @id_lang, @size_label FROM (SELECT 1) x WHERE @size_attr > 0 AND @size_group IS NOT NULL;
INSERT IGNORE INTO ps_attribute_shop (id_attribute, id_shop) SELECT @size_attr, @id_shop FROM (SELECT 1) x WHERE @size_attr > 0;
DELETE sa FROM ps_stock_available sa INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = sa.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pas FROM ps_product_attribute_shop pas INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pas.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pal FROM ps_product_attribute_lang pal INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pal.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pac FROM ps_product_attribute_combination pac INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pac.id_product_attribute WHERE pa.reference = @size_marker;
DELETE FROM ps_product_attribute WHERE reference = @size_marker;
INSERT INTO ps_product_attribute (id_product, reference, supplier_reference, ean13, isbn, upc, mpn, wholesale_price, price, ecotax, weight, unit_price_impact, default_on, minimal_quantity)
SELECT DISTINCT base.id_product, @size_marker, '', '', '', '', '', 0, 0, 0, 0, 0, NULL, 1
FROM (SELECT DISTINCT pa.id_product FROM ps_product_attribute pa JOIN ps_product_attribute_combination pac ON pac.id_product_attribute = pa.id_product_attribute JOIN ps_attribute a ON a.id_attribute = pac.id_attribute AND a.id_attribute_group = @size_group) base
WHERE @size_attr > 0 AND @size_group IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ps_product_attribute pa2 JOIN ps_product_attribute_combination pac2 ON pac2.id_product_attribute = pa2.id_product_attribute WHERE pa2.id_product = base.id_product AND pac2.id_attribute = @size_attr);
INSERT INTO ps_product_attribute_shop (id_product_attribute, id_shop, wholesale_price, price, ecotax, weight, unit_price_impact, default_on, minimal_quantity, available_date) SELECT pa.id_product_attribute, @id_shop, 0, 0, 0, 0, 0, NULL, 1, NULL FROM ps_product_attribute pa WHERE pa.reference = @size_marker AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_shop pas WHERE pas.id_product_attribute = pa.id_product_attribute AND pas.id_shop = @id_shop);
INSERT INTO ps_product_attribute_lang (id_product_attribute, id_lang, available_now, available_later) SELECT pa.id_product_attribute, l.id_lang, '', '' FROM ps_product_attribute pa CROSS JOIN ps_lang l WHERE pa.reference = @size_marker AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_lang pal WHERE pal.id_product_attribute = pa.id_product_attribute AND pal.id_lang = l.id_lang);
INSERT INTO ps_product_attribute_combination (id_attribute, id_product_attribute) SELECT @size_attr, pa.id_product_attribute FROM ps_product_attribute pa WHERE pa.reference = @size_marker AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_combination pac WHERE pac.id_product_attribute = pa.id_product_attribute AND pac.id_attribute = @size_attr);
INSERT INTO ps_stock_available (id_product, id_product_attribute, id_shop, id_shop_group, quantity, depends_on_stock, out_of_stock) SELECT pa.id_product, pa.id_product_attribute, @id_shop, 0, @stock_qty, 0, 2 FROM ps_product_attribute pa WHERE pa.reference = @size_marker AND NOT EXISTS (SELECT 1 FROM ps_stock_available sa WHERE sa.id_product = pa.id_product AND sa.id_product_attribute = pa.id_product_attribute AND sa.id_shop = @id_shop);
UPDATE ps_product_attribute SET reference = '' WHERE reference = @size_marker;

-- >>> XXL (le plus important)
SET @size_label = 'XXL';
SET @size_marker = 'FS-SIZE-TMP-XXL';
SET @xxl_attr = (SELECT a.id_attribute FROM ps_attribute a JOIN ps_attribute_lang al ON al.id_attribute = a.id_attribute AND al.id_lang = @id_lang WHERE a.id_attribute_group = @size_group AND UPPER(TRIM(al.name)) = 'XXL' LIMIT 1);
INSERT INTO ps_attribute (id_attribute_group, color, position) SELECT @size_group, '', COALESCE(MAX(a.position), 0) + 1 FROM ps_attribute a WHERE a.id_attribute_group = @size_group AND @xxl_attr IS NULL AND @size_group IS NOT NULL;
SET @xxl_attr = (
  SELECT a.id_attribute FROM ps_attribute a
  JOIN ps_attribute_lang al ON al.id_attribute = a.id_attribute AND al.id_lang = @id_lang
  WHERE a.id_attribute_group = @size_group AND UPPER(TRIM(al.name)) = 'XXL' LIMIT 1
);
INSERT IGNORE INTO ps_attribute_lang (id_attribute, id_lang, name) SELECT @xxl_attr, @id_lang, 'XXL' FROM (SELECT 1) x WHERE @xxl_attr > 0 AND @size_group IS NOT NULL;
INSERT IGNORE INTO ps_attribute_shop (id_attribute, id_shop) SELECT @xxl_attr, @id_shop FROM (SELECT 1) x WHERE @xxl_attr > 0;

DELETE sa FROM ps_stock_available sa INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = sa.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pas FROM ps_product_attribute_shop pas INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pas.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pal FROM ps_product_attribute_lang pal INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pal.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pac FROM ps_product_attribute_combination pac INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pac.id_product_attribute WHERE pa.reference = @size_marker;
DELETE FROM ps_product_attribute WHERE reference = @size_marker;

INSERT INTO ps_product_attribute (id_product, reference, supplier_reference, ean13, isbn, upc, mpn, wholesale_price, price, ecotax, weight, unit_price_impact, default_on, minimal_quantity)
SELECT DISTINCT base.id_product, @size_marker, '', '', '', '', '', 0, 0, 0, 0, 0, NULL, 1
FROM (
  SELECT DISTINCT pa.id_product
  FROM ps_product_attribute pa
  JOIN ps_product_attribute_combination pac ON pac.id_product_attribute = pa.id_product_attribute
  JOIN ps_attribute a ON a.id_attribute = pac.id_attribute AND a.id_attribute_group = @size_group
) base
WHERE @xxl_attr > 0 AND @size_group IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ps_product_attribute pa2
    JOIN ps_product_attribute_combination pac2 ON pac2.id_product_attribute = pa2.id_product_attribute
    WHERE pa2.id_product = base.id_product AND pac2.id_attribute = @xxl_attr
  );

SELECT CONCAT('Déclinaisons XXL créées (marqueur temporaire) : ', COUNT(*)) AS resultat_xxl
FROM ps_product_attribute WHERE reference = @size_marker;

INSERT INTO ps_product_attribute_shop (id_product_attribute, id_shop, wholesale_price, price, ecotax, weight, unit_price_impact, default_on, minimal_quantity, available_date)
SELECT pa.id_product_attribute, @id_shop, 0, 0, 0, 0, 0, NULL, 1, NULL
FROM ps_product_attribute pa WHERE pa.reference = @size_marker
  AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_shop pas WHERE pas.id_product_attribute = pa.id_product_attribute AND pas.id_shop = @id_shop);

INSERT INTO ps_product_attribute_lang (id_product_attribute, id_lang, available_now, available_later)
SELECT pa.id_product_attribute, l.id_lang, '', ''
FROM ps_product_attribute pa CROSS JOIN ps_lang l
WHERE pa.reference = @size_marker
  AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_lang pal WHERE pal.id_product_attribute = pa.id_product_attribute AND pal.id_lang = l.id_lang);

INSERT INTO ps_product_attribute_combination (id_attribute, id_product_attribute)
SELECT @xxl_attr, pa.id_product_attribute FROM ps_product_attribute pa
WHERE pa.reference = @size_marker
  AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_combination pac WHERE pac.id_product_attribute = pa.id_product_attribute AND pac.id_attribute = @xxl_attr);

INSERT INTO ps_stock_available (id_product, id_product_attribute, id_shop, id_shop_group, quantity, depends_on_stock, out_of_stock)
SELECT pa.id_product, pa.id_product_attribute, @id_shop, 0, @stock_qty, 0, 2
FROM ps_product_attribute pa WHERE pa.reference = @size_marker
  AND NOT EXISTS (SELECT 1 FROM ps_stock_available sa WHERE sa.id_product = pa.id_product AND sa.id_product_attribute = pa.id_product_attribute AND sa.id_shop = @id_shop);

UPDATE ps_product_attribute SET reference = '' WHERE reference = @size_marker;

-- Stock 20 sur toutes les déclinaisons
UPDATE ps_stock_available sa
INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = sa.id_product_attribute
SET sa.quantity = @stock_qty
WHERE sa.id_shop = @id_shop AND pa.id_product_attribute > 0;

UPDATE ps_product p
SET p.date_upd = NOW()
WHERE p.id_product IN (SELECT DISTINCT id_product FROM ps_product_attribute);

-- ---------------------------------------------------------------------------
-- RÉSULTATS (plusieurs onglets — lisez-les tous)
-- ---------------------------------------------------------------------------
SELECT @xxl_attr AS xxl_attribute_id;

SELECT al.name AS taille, COUNT(DISTINCT pa.id_product) AS nb_produits
FROM ps_attribute_lang al
JOIN ps_attribute a ON a.id_attribute = al.id_attribute
JOIN ps_product_attribute_combination pac ON pac.id_attribute = a.id_attribute
JOIN ps_product_attribute pa ON pa.id_product_attribute = pac.id_product_attribute
WHERE al.id_lang = @id_lang AND a.id_attribute_group = @size_group
  AND UPPER(TRIM(al.name)) IN ('S','M','L','XL','XXL')
GROUP BY al.name
ORDER BY FIELD(UPPER(TRIM(al.name)), 'S','M','L','XL','XXL');

SELECT COUNT(DISTINCT pa.id_product) AS produits_encore_sans_xxl
FROM ps_product_attribute pa
JOIN ps_product_attribute_combination pac ON pac.id_product_attribute = pa.id_product_attribute
JOIN ps_attribute a ON a.id_attribute = pac.id_attribute AND a.id_attribute_group = @size_group
WHERE @xxl_attr > 0
  AND NOT EXISTS (
    SELECT 1 FROM ps_product_attribute pa2
    JOIN ps_product_attribute_combination pac2 ON pac2.id_product_attribute = pa2.id_product_attribute
    WHERE pa2.id_product = pa.id_product AND pac2.id_attribute = @xxl_attr
  );
