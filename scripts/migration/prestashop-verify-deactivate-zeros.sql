-- =============================================================================
-- PrestaShop — Vérifier si la désactivation a marché + ce qui est compté
-- =============================================================================
-- IMPORTANT : exécute TOUT d’un coup (le SET @shop_id doit être inclus).
-- =============================================================================

SET @shop_id := 1;
SET @id_lang := 1;

-- 1) Est-ce que les « zéros » sont encore ACTIFS ? (doit être 0 si le script a marché)
SELECT COUNT(*) AS encore_actifs_prix_zero
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1
  AND ps.active = 1
  AND (p.price IS NULL OR p.price = 0)
  AND (ps.price IS NULL OR ps.price = 0);

-- 2) Combien de zéros sont maintenant INACTIFS (désactivés par le script)
SELECT COUNT(*) AS zeros_desactives
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE (p.active = 0 OR ps.active = 0)
  AND (p.price IS NULL OR p.price = 0)
  AND (ps.price IS NULL OR ps.price = 0);

-- 3) Ce que le script COMPTE / ne compte PAS
SELECT
  SUM(CASE WHEN p.active = 1 THEN 1 ELSE 0 END) AS actifs_oui,
  SUM(CASE WHEN p.active = 0 THEN 1 ELSE 0 END) AS inactifs_desactives,
  COUNT(*) AS total_en_base
FROM ps_product p;
-- → Les « supprimés » du BO :
--    • soft delete = active=0 → comptés dans inactifs_desactives, PAS dans les 619
--    • hard delete = plus de ligne → PAS dans total_en_base
-- Donc les 619 n’incluent PAS les vrais supprimés ; ce sont des produits encore actifs.

-- 4) Relancer la désactivation (si encore_actifs_prix_zero > 0)
UPDATE ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
SET
  p.active = 0,
  ps.active = 0,
  p.date_upd = NOW(),
  ps.date_upd = NOW()
WHERE p.active = 1
  AND (p.price IS NULL OR p.price = 0)
  AND (ps.price IS NULL OR ps.price = 0);

-- 5) Contrôle immédiat après UPDATE
SELECT COUNT(*) AS encore_actifs_prix_zero_apres
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1
  AND (p.price IS NULL OR p.price = 0)
  AND (ps.price IS NULL OR ps.price = 0);

SELECT COUNT(*) AS actifs_restants
FROM ps_product p
WHERE p.active = 1;
