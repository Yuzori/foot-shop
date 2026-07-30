-- =============================================================================
-- PrestaShop 8 — Pourquoi le BO dit ~200 produits alors que la BDD en a ~619
-- =============================================================================
-- Le back office (Catalogue → Produits) ne liste PAS tous les ps_product.
-- Il filtre souvent : id_shop, active shop, visibility, indexation, etc.
-- Le SITE via l’API webservice lit autrement → plus de produits apparaissent.
--
-- Exécute tout d’un coup (SET @shop_id inclus).
-- =============================================================================

SET @shop_id := 1;
SET @id_lang := 1;

-- 1) Totaux bruts
SELECT
  (SELECT COUNT(*) FROM ps_product) AS total_ps_product,
  (SELECT COUNT(*) FROM ps_product WHERE active = 1) AS actifs_ps_product,
  (SELECT COUNT(*) FROM ps_product_shop WHERE id_shop = @shop_id) AS lignes_shop,
  (SELECT COUNT(*) FROM ps_product_shop WHERE id_shop = @shop_id AND active = 1) AS actifs_shop,
  (SELECT COUNT(*) FROM ps_product_shop WHERE id_shop = @shop_id AND active = 1 AND visibility IN ('both', 'catalog')) AS visibles_catalogue_type_bo;

-- 2) Ce que le BO affiche en gros (= actifs shop + visibility both/catalog)
--    Compare ce chiffre à ton « ~200 » dans Catalogue → Produits
SELECT COUNT(*) AS approx_liste_bo
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1
  AND ps.active = 1
  AND ps.visibility IN ('both', 'catalog');

-- 3) Ce que le SITE peut voir via l’API (souvent plus large : active=1 seulement)
SELECT COUNT(*) AS approx_visibles_api_site
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1
  AND ps.active = 1;

-- 4) ÉCART : actifs en BDD mais PAS dans le filtre « type BO »
SELECT COUNT(*) AS fantomes_hors_liste_bo
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1
  AND ps.active = 1
  AND (
    ps.visibility NOT IN ('both', 'catalog')
    OR ps.visibility IS NULL
    OR p.price = 0
    OR ps.price = 0
  );

-- 5) Détail des « hors BO » (échantillon) — visibility / prix / images
SELECT
  p.id_product,
  pl.name,
  p.active AS p_active,
  ps.active AS shop_active,
  ps.visibility,
  p.price AS prix_product,
  ps.price AS prix_shop,
  (SELECT COUNT(*) FROM ps_image i WHERE i.id_product = p.id_product) AS nb_images
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
LEFT JOIN ps_product_lang pl
  ON pl.id_product = p.id_product
 AND pl.id_lang = @id_lang
 AND pl.id_shop = @shop_id
WHERE p.active = 1
  AND ps.active = 1
  AND (
    ps.visibility NOT IN ('both', 'catalog')
    OR p.price = 0
    OR ps.price = 0
  )
ORDER BY p.id_product DESC
LIMIT 40;

-- 6) Visibilities présentes (comprendre le filtre BO)
SELECT
  IFNULL(ps.visibility, '(NULL)') AS visibility,
  COUNT(*) AS nb
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1 AND ps.active = 1
GROUP BY ps.visibility
ORDER BY nb DESC;
