-- =============================================================================
-- PrestaShop 8 — Ajouter la taille XXL à tous les produits avec déclinaisons
-- =============================================================================
-- Version compatible phpMyAdmin (sans DELIMITER / procédure stockée).
--
-- Crée l'attribut XXL s'il manque, puis une déclinaison XXL (stock 20) pour
-- chaque produit qui a déjà au moins une taille mais pas encore XXL.
--
-- ⚠️ Sauvegarde BDD obligatoire avant exécution !
--
-- phpMyAdmin : onglet SQL → coller TOUT le fichier → Exécuter
--
-- Après :
--   1. Back office → Paramètres avancés → Performances → Vider le cache
--   2. Vérifier un produit : déclinaisons → XXL, stock 20
-- =============================================================================

SET @id_lang = 1;
SET @id_shop = 1;
SET @stock_qty = 20;
SET @xxl_marker = 'FS-XXL-TMP';

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

-- Diagnostic : si NULL, décommentez et exécutez seulement cette requête :
-- SELECT ag.id_attribute_group, agl.name, agl.public_name
-- FROM ps_attribute_group ag
-- JOIN ps_attribute_group_lang agl ON agl.id_attribute_group = ag.id_attribute_group
-- WHERE agl.id_lang = @id_lang;

-- Attribut XXL existant ?
SET @xxl_attr = (
  SELECT a.id_attribute
  FROM ps_attribute a
  JOIN ps_attribute_lang al
    ON al.id_attribute = a.id_attribute
   AND al.id_lang = @id_lang
  WHERE a.id_attribute_group = @size_group
    AND UPPER(TRIM(al.name)) = 'XXL'
  LIMIT 1
);

-- Créer XXL si absent
INSERT INTO ps_attribute (id_attribute_group, color, position)
SELECT @size_group, '', COALESCE(MAX(a.position), 0) + 1
FROM ps_attribute a
WHERE a.id_attribute_group = @size_group
  AND @xxl_attr IS NULL
  AND @size_group IS NOT NULL;

SET @xxl_attr = IFNULL(@xxl_attr, LAST_INSERT_ID());

INSERT INTO ps_attribute_lang (id_attribute, id_lang, name)
SELECT @xxl_attr, @id_lang, 'XXL'
FROM (SELECT 1) AS _seed
WHERE @xxl_attr > 0
  AND @size_group IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM ps_attribute_lang
    WHERE id_attribute = @xxl_attr
      AND id_lang = @id_lang
  );

INSERT INTO ps_attribute_shop (id_attribute, id_shop)
SELECT @xxl_attr, @id_shop
FROM (SELECT 1) AS _seed
WHERE @xxl_attr > 0
  AND NOT EXISTS (
    SELECT 1
    FROM ps_attribute_shop
    WHERE id_attribute = @xxl_attr
      AND id_shop = @id_shop
  );

-- Nettoyage d'une exécution précédente interrompue
DELETE sa
FROM ps_stock_available sa
INNER JOIN ps_product_attribute pa
  ON pa.id_product_attribute = sa.id_product_attribute
WHERE pa.reference = @xxl_marker;

DELETE pas
FROM ps_product_attribute_shop pas
INNER JOIN ps_product_attribute pa
  ON pa.id_product_attribute = pas.id_product_attribute
WHERE pa.reference = @xxl_marker;

DELETE pal
FROM ps_product_attribute_lang pal
INNER JOIN ps_product_attribute pa
  ON pa.id_product_attribute = pal.id_product_attribute
WHERE pa.reference = @xxl_marker;

DELETE pac
FROM ps_product_attribute_combination pac
INNER JOIN ps_product_attribute pa
  ON pa.id_product_attribute = pac.id_product_attribute
WHERE pa.reference = @xxl_marker;

DELETE FROM ps_product_attribute
WHERE reference = @xxl_marker;

-- Déclinaisons XXL manquantes (marqueur temporaire sur reference)
-- PS 8+ : pas de colonnes location / quantity sur ps_product_attribute
INSERT INTO ps_product_attribute (
  id_product,
  reference,
  supplier_reference,
  ean13,
  isbn,
  upc,
  mpn,
  wholesale_price,
  price,
  ecotax,
  weight,
  unit_price_impact,
  default_on,
  minimal_quantity
)
SELECT DISTINCT
  pa.id_product,
  @xxl_marker,
  '',
  '',
  '',
  '',
  '',
  0,
  0,
  0,
  0,
  0,
  NULL,
  1
FROM ps_product_attribute pa
WHERE @xxl_attr > 0
  AND @size_group IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM ps_product_attribute pa2
    JOIN ps_product_attribute_combination pac
      ON pac.id_product_attribute = pa2.id_product_attribute
    WHERE pa2.id_product = pa.id_product
      AND pac.id_attribute = @xxl_attr
  );

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
WHERE pa.reference = @xxl_marker
  AND NOT EXISTS (
    SELECT 1
    FROM ps_product_attribute_shop pas
    WHERE pas.id_product_attribute = pa.id_product_attribute
      AND pas.id_shop = @id_shop
  );

-- PS 8.1+ : ps_product_attribute_lang = available_now / available_later uniquement
-- (PS 8.0 sans cette table : commentez ce bloc si erreur « table inexistante »)
INSERT INTO ps_product_attribute_lang (
  id_product_attribute,
  id_lang,
  available_now,
  available_later
)
SELECT
  pa.id_product_attribute,
  l.id_lang,
  '',
  ''
FROM ps_product_attribute pa
CROSS JOIN ps_lang l
WHERE pa.reference = @xxl_marker
  AND NOT EXISTS (
    SELECT 1
    FROM ps_product_attribute_lang pal
    WHERE pal.id_product_attribute = pa.id_product_attribute
      AND pal.id_lang = l.id_lang
  );

INSERT INTO ps_product_attribute_combination (id_attribute, id_product_attribute)
SELECT @xxl_attr, pa.id_product_attribute
FROM ps_product_attribute pa
WHERE pa.reference = @xxl_marker
  AND NOT EXISTS (
    SELECT 1
    FROM ps_product_attribute_combination pac
    WHERE pac.id_product_attribute = pa.id_product_attribute
      AND pac.id_attribute = @xxl_attr
  );

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
WHERE pa.reference = @xxl_marker
  AND NOT EXISTS (
    SELECT 1
    FROM ps_stock_available sa
    WHERE sa.id_product = pa.id_product
      AND sa.id_product_attribute = pa.id_product_attribute
      AND sa.id_shop = @id_shop
  );

UPDATE ps_product_attribute
SET reference = ''
WHERE reference = @xxl_marker;

-- Vérifications
SELECT @size_group AS size_group_id, @xxl_attr AS xxl_attribute_id;

SELECT COUNT(*) AS produits_avec_declinaisons
FROM (
  SELECT DISTINCT id_product
  FROM ps_product_attribute
) AS t;

SELECT COUNT(*) AS combinaisons_xxl
FROM ps_product_attribute_combination
WHERE id_attribute = @xxl_attr;

SELECT p.id_product, pl.name, sa.quantity
FROM ps_product p
JOIN ps_product_lang pl
  ON pl.id_product = p.id_product
 AND pl.id_lang = @id_lang
 AND pl.id_shop = @id_shop
JOIN ps_product_attribute pa
  ON pa.id_product = p.id_product
JOIN ps_product_attribute_combination pac
  ON pac.id_product_attribute = pa.id_product_attribute
JOIN ps_stock_available sa
  ON sa.id_product = p.id_product
 AND sa.id_product_attribute = pa.id_product_attribute
 AND sa.id_shop = @id_shop
WHERE pac.id_attribute = @xxl_attr
ORDER BY p.id_product DESC
LIMIT 10;
