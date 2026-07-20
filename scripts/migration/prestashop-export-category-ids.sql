-- =============================================================================
-- PrestaShop 8 — Export de tous les IDs catégories Foot Shop
-- Copiez le résultat dans .env.local (voir commentaires en bas du script).
-- =============================================================================

SET @id_lang = 1;

-- Arborescence complète
SELECT
  c.id_category AS id,
  c.id_parent AS parent_id,
  parent_cl.name AS parent_name,
  cl.name,
  cl.link_rewrite,
  c.position,
  c.active
FROM ps_category c
JOIN ps_category_lang cl
  ON cl.id_category = c.id_category AND cl.id_lang = @id_lang
LEFT JOIN ps_category_lang parent_cl
  ON parent_cl.id_category = c.id_parent AND parent_cl.id_lang = @id_lang
WHERE c.id_category NOT IN (1)
ORDER BY c.id_parent, c.position, cl.name;

-- Variables .env suggérées (adaptez les IDs selon votre base)
SELECT '--- Variables .env.local ---' AS info;

SELECT
  MAX(CASE WHEN cl.name = 'Maillots' AND c.id_parent = 2 THEN c.id_category END) AS NEXT_PUBLIC_MAILLOTS_CATEGORY_ID,
  MAX(CASE WHEN cl.name = 'Shorts' AND c.id_parent = 2 THEN c.id_category END) AS NEXT_PUBLIC_SHORTS_CATEGORY_ID,
  MAX(CASE WHEN cl.name IN ('Maillot - Enfant', 'Maillots - Enfant') AND c.id_parent = 2 THEN c.id_category END) AS NEXT_PUBLIC_ENFANT_MAILLOTS_CATEGORY_ID,
  MAX(CASE WHEN cl.name IN ('Enfant - Short', 'Enfant - Shorts') AND c.id_parent = 2 THEN c.id_category END) AS NEXT_PUBLIC_ENFANT_SHORTS_CATEGORY_ID,
  MAX(CASE WHEN cl.name IN ('World Cup', 'Coupe du monde') AND c.id_parent = 2 THEN c.id_category END) AS PRODUCT_IMPORT_CATEGORY_ID
FROM ps_category c
JOIN ps_category_lang cl ON cl.id_category = c.id_category AND cl.id_lang = @id_lang;

-- Divisions adultes sous Maillots
SELECT '--- Divisions Maillots (adulte) ---' AS info;

SELECT c.id_category AS id, cl.name, cl.link_rewrite
FROM ps_category c
JOIN ps_category_lang cl ON cl.id_category = c.id_category AND cl.id_lang = @id_lang
WHERE c.id_parent = (
  SELECT id_category FROM ps_category_lang
  WHERE id_lang = @id_lang AND name = 'Maillots' LIMIT 1
)
ORDER BY c.position, cl.name;

-- Divisions enfant sous Maillot - Enfant
SELECT '--- Divisions Maillot - Enfant ---' AS info;

SELECT c.id_category AS id, cl.name, cl.link_rewrite
FROM ps_category c
JOIN ps_category_lang cl ON cl.id_category = c.id_category AND cl.id_lang = @id_lang
WHERE c.id_parent = (
  SELECT id_category FROM ps_category_lang
  WHERE id_lang = @id_lang AND (name = 'Maillot - Enfant' OR name LIKE '%Maillot%Enfant%')
  LIMIT 1
)
ORDER BY c.position, cl.name;
