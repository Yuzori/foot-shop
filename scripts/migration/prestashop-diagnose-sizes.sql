-- =============================================================================
-- DIAGNOSTIC — À exécuter EN PREMIER dans phpMyAdmin (onglet SQL)
-- =============================================================================
-- Si size_group_id est NULL, le script principal ne peut pas fonctionner.
-- Copiez les résultats si besoin d'aide.
-- =============================================================================

-- 1) Langues
SELECT id_lang, iso_code, language_code, name, active
FROM ps_lang
ORDER BY id_lang;

-- 2) Groupes d'attributs (cherchez « Taille »)
SELECT ag.id_attribute_group, agl.id_lang, agl.name, agl.public_name
FROM ps_attribute_group ag
JOIN ps_attribute_group_lang agl ON agl.id_attribute_group = ag.id_attribute_group
ORDER BY ag.id_attribute_group, agl.id_lang;

-- 3) Valeurs taille existantes (S, M, L, XL, XXL…)
SELECT a.id_attribute_group, al.id_lang, al.name AS taille, a.id_attribute
FROM ps_attribute a
JOIN ps_attribute_lang al ON al.id_attribute = a.id_attribute
WHERE UPPER(TRIM(al.name)) IN ('XS','S','M','L','XL','XXL','2XL','3XL')
ORDER BY a.id_attribute_group, al.name;

-- 4) Groupe « Taille » détecté (comme le script principal)
SET @id_lang = (SELECT id_lang FROM ps_lang WHERE iso_code = 'fr' OR language_code = 'fr' LIMIT 1);
SET @id_lang = IFNULL(@id_lang, 1);

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

SELECT @id_lang AS id_lang_utilise, @size_group AS size_group_id;

-- 5) Combien de produits ont des tailles mais PAS encore XXL ?
SET @xxl_attr = (
  SELECT a.id_attribute FROM ps_attribute a
  JOIN ps_attribute_lang al ON al.id_attribute = a.id_attribute AND al.id_lang = @id_lang
  WHERE a.id_attribute_group = @size_group AND UPPER(TRIM(al.name)) = 'XXL' LIMIT 1
);

SELECT COUNT(DISTINCT pa.id_product) AS produits_avec_tailles_sans_xxl
FROM ps_product_attribute pa
JOIN ps_product_attribute_combination pac ON pac.id_product_attribute = pa.id_product_attribute
JOIN ps_attribute a ON a.id_attribute = pac.id_attribute AND a.id_attribute_group = @size_group
WHERE @size_group IS NOT NULL
  AND (
    @xxl_attr IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM ps_product_attribute pa2
      JOIN ps_product_attribute_combination pac2 ON pac2.id_product_attribute = pa2.id_product_attribute
      WHERE pa2.id_product = pa.id_product AND pac2.id_attribute = @xxl_attr
    )
  );

-- 6) Échantillon produits sans XXL
SELECT p.id_product, pl.name
FROM ps_product p
JOIN ps_product_lang pl ON pl.id_product = p.id_product AND pl.id_lang = @id_lang
JOIN ps_product_attribute pa ON pa.id_product = p.id_product
JOIN ps_product_attribute_combination pac ON pac.id_product_attribute = pa.id_product_attribute
JOIN ps_attribute a ON a.id_attribute = pac.id_attribute AND a.id_attribute_group = @size_group
WHERE @size_group IS NOT NULL
  AND (
    @xxl_attr IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM ps_product_attribute pa2
      JOIN ps_product_attribute_combination pac2 ON pac2.id_product_attribute = pa2.id_product_attribute
      WHERE pa2.id_product = p.id_product AND pac2.id_attribute = @xxl_attr
    )
  )
GROUP BY p.id_product, pl.name
ORDER BY p.id_product DESC
LIMIT 15;
