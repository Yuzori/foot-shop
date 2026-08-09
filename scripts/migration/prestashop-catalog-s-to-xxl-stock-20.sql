-- =============================================================================
-- PrestaShop 8 — Tailles S à XXL + stock 20 sur tout le catalogue à déclinaisons
-- =============================================================================
-- Version compatible phpMyAdmin (sans DELIMITER / procédure stockée).
--
-- 1. Crée les attributs S, M, L, XL, XXL s'ils manquent
-- 2. Ajoute les déclinaisons manquantes pour chaque produit avec déclinaisons
-- 3. Met tout le stock des déclinaisons à 20
--
-- ⚠️ Sauvegarde BDD obligatoire avant exécution !
--
-- phpMyAdmin : onglet SQL → coller TOUT le fichier → Exécuter
--
-- Après :
--   1. Back office → Paramètres avancés → Performances → Vider le cache
--   2. Vérifier un produit : déclinaisons S, M, L, XL, XXL — stock 20
-- =============================================================================

SET @id_lang = 1;
SET @id_shop = 1;
SET @stock_qty = 20;

-- Groupe d'attributs « Taille »
SET @size_group = (
  SELECT ag.id_attribute_group
  FROM ps_attribute_group ag
  JOIN ps_attribute_group_lang agl
    ON agl.id_attribute_group = ag.id_attribute_group
   AND agl.id_lang = @id_lang
  WHERE agl.name LIKE '%Taille%'
     OR agl.public_name LIKE '%Taille%'
     OR agl.name LIKE '%Size%'
     OR agl.public_name LIKE '%Size%'
  ORDER BY ag.id_attribute_group
  LIMIT 1
);

-- ---------------------------------------------------------------------------
-- Helper : crée un attribut taille s'il n'existe pas (exécuté 5 fois)
-- ---------------------------------------------------------------------------

-- === S ===
SET @size_label = 'S';
SET @size_marker = 'FS-SIZE-TMP-S';
SET @size_attr = (
  SELECT a.id_attribute
  FROM ps_attribute a
  JOIN ps_attribute_lang al ON al.id_attribute = a.id_attribute AND al.id_lang = @id_lang
  WHERE a.id_attribute_group = @size_group AND UPPER(TRIM(al.name)) = @size_label
  LIMIT 1
);
INSERT INTO ps_attribute (id_attribute_group, color, position)
SELECT @size_group, '', COALESCE(MAX(a.position), 0) + 1 FROM ps_attribute a
WHERE a.id_attribute_group = @size_group AND @size_attr IS NULL AND @size_group IS NOT NULL;
SET @size_attr = IFNULL(@size_attr, LAST_INSERT_ID());
INSERT INTO ps_attribute_lang (id_attribute, id_lang, name)
SELECT @size_attr, @id_lang, @size_label FROM (SELECT 1) x
WHERE @size_attr > 0 AND NOT EXISTS (SELECT 1 FROM ps_attribute_lang WHERE id_attribute = @size_attr AND id_lang = @id_lang);
INSERT INTO ps_attribute_shop (id_attribute, id_shop)
SELECT @size_attr, @id_shop FROM (SELECT 1) x
WHERE @size_attr > 0 AND NOT EXISTS (SELECT 1 FROM ps_attribute_shop WHERE id_attribute = @size_attr AND id_shop = @id_shop);

DELETE sa FROM ps_stock_available sa INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = sa.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pas FROM ps_product_attribute_shop pas INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pas.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pal FROM ps_product_attribute_lang pal INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pal.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pac FROM ps_product_attribute_combination pac INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pac.id_product_attribute WHERE pa.reference = @size_marker;
DELETE FROM ps_product_attribute WHERE reference = @size_marker;

INSERT INTO ps_product_attribute (id_product, reference, supplier_reference, ean13, isbn, upc, mpn, wholesale_price, price, ecotax, weight, unit_price_impact, default_on, minimal_quantity)
SELECT DISTINCT pa.id_product, @size_marker, '', '', '', '', '', 0, 0, 0, 0, 0, NULL, 1
FROM ps_product_attribute pa
WHERE @size_attr > 0 AND @size_group IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ps_product_attribute pa2
    JOIN ps_product_attribute_combination pac ON pac.id_product_attribute = pa2.id_product_attribute
    WHERE pa2.id_product = pa.id_product AND pac.id_attribute = @size_attr
  );

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
SELECT @size_attr, pa.id_product_attribute FROM ps_product_attribute pa
WHERE pa.reference = @size_marker
  AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_combination pac WHERE pac.id_product_attribute = pa.id_product_attribute AND pac.id_attribute = @size_attr);

INSERT INTO ps_stock_available (id_product, id_product_attribute, id_shop, id_shop_group, quantity, depends_on_stock, out_of_stock)
SELECT pa.id_product, pa.id_product_attribute, @id_shop, 0, @stock_qty, 0, 2
FROM ps_product_attribute pa WHERE pa.reference = @size_marker
  AND NOT EXISTS (SELECT 1 FROM ps_stock_available sa WHERE sa.id_product = pa.id_product AND sa.id_product_attribute = pa.id_product_attribute AND sa.id_shop = @id_shop);

UPDATE ps_product_attribute SET reference = '' WHERE reference = @size_marker;

-- === M ===
SET @size_label = 'M';
SET @size_marker = 'FS-SIZE-TMP-M';
SET @size_attr = (
  SELECT a.id_attribute FROM ps_attribute a
  JOIN ps_attribute_lang al ON al.id_attribute = a.id_attribute AND al.id_lang = @id_lang
  WHERE a.id_attribute_group = @size_group AND UPPER(TRIM(al.name)) = @size_label LIMIT 1
);
INSERT INTO ps_attribute (id_attribute_group, color, position)
SELECT @size_group, '', COALESCE(MAX(a.position), 0) + 1 FROM ps_attribute a
WHERE a.id_attribute_group = @size_group AND @size_attr IS NULL AND @size_group IS NOT NULL;
SET @size_attr = IFNULL(@size_attr, LAST_INSERT_ID());
INSERT INTO ps_attribute_lang (id_attribute, id_lang, name)
SELECT @size_attr, @id_lang, @size_label FROM (SELECT 1) x
WHERE @size_attr > 0 AND NOT EXISTS (SELECT 1 FROM ps_attribute_lang WHERE id_attribute = @size_attr AND id_lang = @id_lang);
INSERT INTO ps_attribute_shop (id_attribute, id_shop)
SELECT @size_attr, @id_shop FROM (SELECT 1) x
WHERE @size_attr > 0 AND NOT EXISTS (SELECT 1 FROM ps_attribute_shop WHERE id_attribute = @size_attr AND id_shop = @id_shop);

DELETE sa FROM ps_stock_available sa INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = sa.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pas FROM ps_product_attribute_shop pas INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pas.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pal FROM ps_product_attribute_lang pal INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pal.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pac FROM ps_product_attribute_combination pac INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pac.id_product_attribute WHERE pa.reference = @size_marker;
DELETE FROM ps_product_attribute WHERE reference = @size_marker;

INSERT INTO ps_product_attribute (id_product, reference, supplier_reference, ean13, isbn, upc, mpn, wholesale_price, price, ecotax, weight, unit_price_impact, default_on, minimal_quantity)
SELECT DISTINCT pa.id_product, @size_marker, '', '', '', '', '', 0, 0, 0, 0, 0, NULL, 1
FROM ps_product_attribute pa
WHERE @size_attr > 0 AND @size_group IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ps_product_attribute pa2
    JOIN ps_product_attribute_combination pac ON pac.id_product_attribute = pa2.id_product_attribute
    WHERE pa2.id_product = pa.id_product AND pac.id_attribute = @size_attr
  );

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
SELECT @size_attr, pa.id_product_attribute FROM ps_product_attribute pa
WHERE pa.reference = @size_marker
  AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_combination pac WHERE pac.id_product_attribute = pa.id_product_attribute AND pac.id_attribute = @size_attr);

INSERT INTO ps_stock_available (id_product, id_product_attribute, id_shop, id_shop_group, quantity, depends_on_stock, out_of_stock)
SELECT pa.id_product, pa.id_product_attribute, @id_shop, 0, @stock_qty, 0, 2
FROM ps_product_attribute pa WHERE pa.reference = @size_marker
  AND NOT EXISTS (SELECT 1 FROM ps_stock_available sa WHERE sa.id_product = pa.id_product AND sa.id_product_attribute = pa.id_product_attribute AND sa.id_shop = @id_shop);

UPDATE ps_product_attribute SET reference = '' WHERE reference = @size_marker;

-- === L ===
SET @size_label = 'L';
SET @size_marker = 'FS-SIZE-TMP-L';
SET @size_attr = (
  SELECT a.id_attribute FROM ps_attribute a
  JOIN ps_attribute_lang al ON al.id_attribute = a.id_attribute AND al.id_lang = @id_lang
  WHERE a.id_attribute_group = @size_group AND UPPER(TRIM(al.name)) = @size_label LIMIT 1
);
INSERT INTO ps_attribute (id_attribute_group, color, position)
SELECT @size_group, '', COALESCE(MAX(a.position), 0) + 1 FROM ps_attribute a
WHERE a.id_attribute_group = @size_group AND @size_attr IS NULL AND @size_group IS NOT NULL;
SET @size_attr = IFNULL(@size_attr, LAST_INSERT_ID());
INSERT INTO ps_attribute_lang (id_attribute, id_lang, name)
SELECT @size_attr, @id_lang, @size_label FROM (SELECT 1) x
WHERE @size_attr > 0 AND NOT EXISTS (SELECT 1 FROM ps_attribute_lang WHERE id_attribute = @size_attr AND id_lang = @id_lang);
INSERT INTO ps_attribute_shop (id_attribute, id_shop)
SELECT @size_attr, @id_shop FROM (SELECT 1) x
WHERE @size_attr > 0 AND NOT EXISTS (SELECT 1 FROM ps_attribute_shop WHERE id_attribute = @size_attr AND id_shop = @id_shop);

DELETE sa FROM ps_stock_available sa INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = sa.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pas FROM ps_product_attribute_shop pas INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pas.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pal FROM ps_product_attribute_lang pal INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pal.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pac FROM ps_product_attribute_combination pac INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pac.id_product_attribute WHERE pa.reference = @size_marker;
DELETE FROM ps_product_attribute WHERE reference = @size_marker;

INSERT INTO ps_product_attribute (id_product, reference, supplier_reference, ean13, isbn, upc, mpn, wholesale_price, price, ecotax, weight, unit_price_impact, default_on, minimal_quantity)
SELECT DISTINCT pa.id_product, @size_marker, '', '', '', '', '', 0, 0, 0, 0, 0, NULL, 1
FROM ps_product_attribute pa
WHERE @size_attr > 0 AND @size_group IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ps_product_attribute pa2
    JOIN ps_product_attribute_combination pac ON pac.id_product_attribute = pa2.id_product_attribute
    WHERE pa2.id_product = pa.id_product AND pac.id_attribute = @size_attr
  );

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
SELECT @size_attr, pa.id_product_attribute FROM ps_product_attribute pa
WHERE pa.reference = @size_marker
  AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_combination pac WHERE pac.id_product_attribute = pa.id_product_attribute AND pac.id_attribute = @size_attr);

INSERT INTO ps_stock_available (id_product, id_product_attribute, id_shop, id_shop_group, quantity, depends_on_stock, out_of_stock)
SELECT pa.id_product, pa.id_product_attribute, @id_shop, 0, @stock_qty, 0, 2
FROM ps_product_attribute pa WHERE pa.reference = @size_marker
  AND NOT EXISTS (SELECT 1 FROM ps_stock_available sa WHERE sa.id_product = pa.id_product AND sa.id_product_attribute = pa.id_product_attribute AND sa.id_shop = @id_shop);

UPDATE ps_product_attribute SET reference = '' WHERE reference = @size_marker;

-- === XL ===
SET @size_label = 'XL';
SET @size_marker = 'FS-SIZE-TMP-XL';
SET @size_attr = (
  SELECT a.id_attribute FROM ps_attribute a
  JOIN ps_attribute_lang al ON al.id_attribute = a.id_attribute AND al.id_lang = @id_lang
  WHERE a.id_attribute_group = @size_group AND UPPER(TRIM(al.name)) = @size_label LIMIT 1
);
INSERT INTO ps_attribute (id_attribute_group, color, position)
SELECT @size_group, '', COALESCE(MAX(a.position), 0) + 1 FROM ps_attribute a
WHERE a.id_attribute_group = @size_group AND @size_attr IS NULL AND @size_group IS NOT NULL;
SET @size_attr = IFNULL(@size_attr, LAST_INSERT_ID());
INSERT INTO ps_attribute_lang (id_attribute, id_lang, name)
SELECT @size_attr, @id_lang, @size_label FROM (SELECT 1) x
WHERE @size_attr > 0 AND NOT EXISTS (SELECT 1 FROM ps_attribute_lang WHERE id_attribute = @size_attr AND id_lang = @id_lang);
INSERT INTO ps_attribute_shop (id_attribute, id_shop)
SELECT @size_attr, @id_shop FROM (SELECT 1) x
WHERE @size_attr > 0 AND NOT EXISTS (SELECT 1 FROM ps_attribute_shop WHERE id_attribute = @size_attr AND id_shop = @id_shop);

DELETE sa FROM ps_stock_available sa INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = sa.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pas FROM ps_product_attribute_shop pas INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pas.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pal FROM ps_product_attribute_lang pal INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pal.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pac FROM ps_product_attribute_combination pac INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pac.id_product_attribute WHERE pa.reference = @size_marker;
DELETE FROM ps_product_attribute WHERE reference = @size_marker;

INSERT INTO ps_product_attribute (id_product, reference, supplier_reference, ean13, isbn, upc, mpn, wholesale_price, price, ecotax, weight, unit_price_impact, default_on, minimal_quantity)
SELECT DISTINCT pa.id_product, @size_marker, '', '', '', '', '', 0, 0, 0, 0, 0, NULL, 1
FROM ps_product_attribute pa
WHERE @size_attr > 0 AND @size_group IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ps_product_attribute pa2
    JOIN ps_product_attribute_combination pac ON pac.id_product_attribute = pa2.id_product_attribute
    WHERE pa2.id_product = pa.id_product AND pac.id_attribute = @size_attr
  );

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
SELECT @size_attr, pa.id_product_attribute FROM ps_product_attribute pa
WHERE pa.reference = @size_marker
  AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_combination pac WHERE pac.id_product_attribute = pa.id_product_attribute AND pac.id_attribute = @size_attr);

INSERT INTO ps_stock_available (id_product, id_product_attribute, id_shop, id_shop_group, quantity, depends_on_stock, out_of_stock)
SELECT pa.id_product, pa.id_product_attribute, @id_shop, 0, @stock_qty, 0, 2
FROM ps_product_attribute pa WHERE pa.reference = @size_marker
  AND NOT EXISTS (SELECT 1 FROM ps_stock_available sa WHERE sa.id_product = pa.id_product AND sa.id_product_attribute = pa.id_product_attribute AND sa.id_shop = @id_shop);

UPDATE ps_product_attribute SET reference = '' WHERE reference = @size_marker;

-- === XXL ===
SET @size_label = 'XXL';
SET @size_marker = 'FS-SIZE-TMP-XXL';
SET @size_attr = (
  SELECT a.id_attribute FROM ps_attribute a
  JOIN ps_attribute_lang al ON al.id_attribute = a.id_attribute AND al.id_lang = @id_lang
  WHERE a.id_attribute_group = @size_group AND UPPER(TRIM(al.name)) = @size_label LIMIT 1
);
INSERT INTO ps_attribute (id_attribute_group, color, position)
SELECT @size_group, '', COALESCE(MAX(a.position), 0) + 1 FROM ps_attribute a
WHERE a.id_attribute_group = @size_group AND @size_attr IS NULL AND @size_group IS NOT NULL;
SET @size_attr = IFNULL(@size_attr, LAST_INSERT_ID());
INSERT INTO ps_attribute_lang (id_attribute, id_lang, name)
SELECT @size_attr, @id_lang, @size_label FROM (SELECT 1) x
WHERE @size_attr > 0 AND NOT EXISTS (SELECT 1 FROM ps_attribute_lang WHERE id_attribute = @size_attr AND id_lang = @id_lang);
INSERT INTO ps_attribute_shop (id_attribute, id_shop)
SELECT @size_attr, @id_shop FROM (SELECT 1) x
WHERE @size_attr > 0 AND NOT EXISTS (SELECT 1 FROM ps_attribute_shop WHERE id_attribute = @size_attr AND id_shop = @id_shop);

DELETE sa FROM ps_stock_available sa INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = sa.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pas FROM ps_product_attribute_shop pas INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pas.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pal FROM ps_product_attribute_lang pal INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pal.id_product_attribute WHERE pa.reference = @size_marker;
DELETE pac FROM ps_product_attribute_combination pac INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = pac.id_product_attribute WHERE pa.reference = @size_marker;
DELETE FROM ps_product_attribute WHERE reference = @size_marker;

INSERT INTO ps_product_attribute (id_product, reference, supplier_reference, ean13, isbn, upc, mpn, wholesale_price, price, ecotax, weight, unit_price_impact, default_on, minimal_quantity)
SELECT DISTINCT pa.id_product, @size_marker, '', '', '', '', '', 0, 0, 0, 0, 0, NULL, 1
FROM ps_product_attribute pa
WHERE @size_attr > 0 AND @size_group IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ps_product_attribute pa2
    JOIN ps_product_attribute_combination pac ON pac.id_product_attribute = pa2.id_product_attribute
    WHERE pa2.id_product = pa.id_product AND pac.id_attribute = @size_attr
  );

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
SELECT @size_attr, pa.id_product_attribute FROM ps_product_attribute pa
WHERE pa.reference = @size_marker
  AND NOT EXISTS (SELECT 1 FROM ps_product_attribute_combination pac WHERE pac.id_product_attribute = pa.id_product_attribute AND pac.id_attribute = @size_attr);

INSERT INTO ps_stock_available (id_product, id_product_attribute, id_shop, id_shop_group, quantity, depends_on_stock, out_of_stock)
SELECT pa.id_product, pa.id_product_attribute, @id_shop, 0, @stock_qty, 0, 2
FROM ps_product_attribute pa WHERE pa.reference = @size_marker
  AND NOT EXISTS (SELECT 1 FROM ps_stock_available sa WHERE sa.id_product = pa.id_product AND sa.id_product_attribute = pa.id_product_attribute AND sa.id_shop = @id_shop);

UPDATE ps_product_attribute SET reference = '' WHERE reference = @size_marker;

-- ---------------------------------------------------------------------------
-- Stock uniforme à 20 pour toutes les déclinaisons
-- ---------------------------------------------------------------------------
UPDATE ps_stock_available sa
INNER JOIN ps_product_attribute pa ON pa.id_product_attribute = sa.id_product_attribute
SET sa.quantity = @stock_qty
WHERE sa.id_shop = @id_shop
  AND pa.id_product_attribute > 0;

-- Vérifications
SELECT @size_group AS size_group_id;

SELECT COUNT(DISTINCT pa.id_product) AS produits_avec_declinaisons
FROM ps_product_attribute pa;

SELECT al.name AS taille, COUNT(DISTINCT pa.id_product) AS nb_produits
FROM ps_attribute_lang al
JOIN ps_attribute a ON a.id_attribute = al.id_attribute
JOIN ps_product_attribute_combination pac ON pac.id_attribute = a.id_attribute
JOIN ps_product_attribute pa ON pa.id_product_attribute = pac.id_product_attribute
WHERE al.id_lang = @id_lang
  AND a.id_attribute_group = @size_group
  AND UPPER(TRIM(al.name)) IN ('S', 'M', 'L', 'XL', 'XXL')
GROUP BY al.name
ORDER BY FIELD(UPPER(TRIM(al.name)), 'S', 'M', 'L', 'XL', 'XXL');

SELECT p.id_product, pl.name, al.name AS taille, sa.quantity
FROM ps_product p
JOIN ps_product_lang pl ON pl.id_product = p.id_product AND pl.id_lang = @id_lang AND pl.id_shop = @id_shop
JOIN ps_product_attribute pa ON pa.id_product = p.id_product
JOIN ps_product_attribute_combination pac ON pac.id_product_attribute = pa.id_product_attribute
JOIN ps_attribute_lang al ON al.id_attribute = pac.id_attribute AND al.id_lang = @id_lang
JOIN ps_stock_available sa ON sa.id_product = p.id_product AND sa.id_product_attribute = pa.id_product_attribute AND sa.id_shop = @id_shop
WHERE UPPER(TRIM(al.name)) = 'XXL'
ORDER BY p.id_product DESC
LIMIT 10;
