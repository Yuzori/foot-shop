-- =============================================================================
-- PrestaShop 8 — Les 79 produits à 0 € (diagnostic + correction EN MASSE)
-- =============================================================================
-- D’après ton diagnostic :
--   619 actifs | 79 à 0 dans ps_product ET ps_product_shop
--   → le site affiche 0 € parce que la BDD a 0 € (pas un bug d’affichage).
--   → le BO peut « sembler » montrer un prix (cache, autre onglet, autre
--     produit) alors que la valeur enregistrée est bien 0.000000.
--
-- ⚠️ Sauvegarde phpMyAdmin avant la section CORRECTION.
-- Après : BO → Performances → Vider le cache, puis recharger le site.
--
-- IMPORTANT : exécute TOUT le script d’un coup (ou refais SET @shop_id
-- à chaque fois). Sinon @shop_id est vide → 0 lignes / faux résultats.
-- =============================================================================

SET @shop_id := 1;
SET @id_lang := 1;
-- Prix à appliquer aux produits encore à 0 (ton prix d’import habituel)
SET @prix_correction := 25.990000;

-- ─────────────────────────────────────────────────────────────────────────────
-- A) Où le BO pourrait encore « voir » un prix (specific_prices)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT
  sp.id_product,
  pl.name,
  sp.price AS prix_specifique,
  sp.reduction,
  sp.from AS date_debut,
  sp.to AS date_fin
FROM ps_specific_price sp
JOIN ps_product p ON p.id_product = sp.id_product AND p.active = 1
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
LEFT JOIN ps_product_lang pl
  ON pl.id_product = p.id_product
 AND pl.id_lang = @id_lang
 AND pl.id_shop = @shop_id
WHERE (p.price IS NULL OR p.price = 0)
  AND (ps.price IS NULL OR ps.price = 0)
LIMIT 50;

-- Combien de ces « zéros » ont quand même une specific_price ?
SELECT COUNT(DISTINCT sp.id_product) AS zeros_avec_specific_price
FROM ps_specific_price sp
JOIN ps_product p ON p.id_product = sp.id_product AND p.active = 1
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE (p.price IS NULL OR p.price = 0)
  AND (ps.price IS NULL OR ps.price = 0);

-- Liste des 79 (aperçu)
SELECT
  p.id_product,
  pl.name,
  p.price AS prix_product,
  ps.price AS prix_shop
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
JOIN ps_product_lang pl
  ON pl.id_product = p.id_product
 AND pl.id_lang = @id_lang
 AND pl.id_shop = @shop_id
WHERE p.active = 1
  AND (p.price IS NULL OR p.price = 0)
  AND (ps.price IS NULL OR ps.price = 0)
ORDER BY p.id_product DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- B) CORRECTION EN MASSE (1 commande — pas produit par produit)
--    Remet @prix_correction sur TOUS les actifs encore à 0 des deux côtés.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
SET
  p.price = @prix_correction,
  ps.price = @prix_correction,
  p.date_upd = NOW(),
  ps.date_upd = NOW()
WHERE p.active = 1
  AND (p.price IS NULL OR p.price = 0)
  AND (ps.price IS NULL OR ps.price = 0);

-- Contrôle : doit afficher 0 (ou presque) dans zero_des_deux_cotes
SELECT
  COUNT(*) AS produits_actifs,
  SUM(CASE WHEN p.price IS NULL OR p.price = 0 THEN 1 ELSE 0 END) AS zero_dans_ps_product,
  SUM(CASE WHEN ps.price IS NULL OR ps.price = 0 THEN 1 ELSE 0 END) AS zero_dans_ps_product_shop,
  SUM(CASE WHEN (p.price IS NULL OR p.price = 0) AND (ps.price IS NULL OR ps.price = 0) THEN 1 ELSE 0 END) AS zero_des_deux_cotes
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1;

-- Bayern après correction (doit être 25.99 pour 969/970/971)
SELECT
  p.id_product,
  pl.name,
  p.price,
  ps.price AS shop_price
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
JOIN ps_product_lang pl
  ON pl.id_product = p.id_product
 AND pl.id_lang = @id_lang
 AND pl.id_shop = @shop_id
WHERE pl.name LIKE '%Bayern%'
ORDER BY p.id_product DESC
LIMIT 20;
