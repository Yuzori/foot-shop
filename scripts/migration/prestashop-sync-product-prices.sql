-- =============================================================================
-- PrestaShop 8 — DIAGNOSTIC + sync des prix (pas de correction manuelle)
-- =============================================================================
-- Objectif : voir OÙ sont les vrais prix, puis les recopier automatiquement
-- entre ps_product et ps_product_shop. Aucune retouche produit par produit.
--
-- ⚠️ Sauvegarde phpMyAdmin avant la partie SYNC (section 2).
-- Après sync : BO → Performances → Vider le cache
-- =============================================================================

SET @shop_id := 1;
SET @id_lang := 1;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) DIAGNOSTIC (lecture seule — exécute ça d'abord)
-- ─────────────────────────────────────────────────────────────────────────────

-- Combien de produits actifs, et combien à 0 € de chaque côté
SELECT
  COUNT(*) AS produits_actifs,
  SUM(CASE WHEN p.price IS NULL OR p.price = 0 THEN 1 ELSE 0 END) AS zero_dans_ps_product,
  SUM(CASE WHEN ps.price IS NULL OR ps.price = 0 THEN 1 ELSE 0 END) AS zero_dans_ps_product_shop,
  SUM(CASE WHEN (p.price IS NULL OR p.price = 0) AND (ps.price IS NULL OR ps.price = 0) THEN 1 ELSE 0 END) AS zero_des_deux_cotes,
  SUM(CASE WHEN p.price > 0 AND (ps.price IS NULL OR ps.price = 0) THEN 1 ELSE 0 END) AS prix_ok_product_mais_shop_a_0,
  SUM(CASE WHEN ps.price > 0 AND (p.price IS NULL OR p.price = 0) THEN 1 ELSE 0 END) AS prix_ok_shop_mais_product_a_0,
  SUM(CASE WHEN p.price > 0 AND ps.price > 0 AND p.price <> ps.price THEN 1 ELSE 0 END) AS prix_differents
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1;

-- Exemples : prix OK dans la boutique (shop) mais 0 sur la table produit
-- → le site lit souvent ps_product → 0 € alors que le BO lit le shop
SELECT
  p.id_product,
  pl.name,
  p.price AS prix_ps_product,
  ps.price AS prix_ps_product_shop
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
JOIN ps_product_lang pl
  ON pl.id_product = p.id_product
 AND pl.id_lang = @id_lang
 AND pl.id_shop = @shop_id
WHERE p.active = 1
  AND (p.price IS NULL OR p.price = 0)
  AND ps.price > 0
ORDER BY p.id_product DESC
LIMIT 30;

-- Exemples : à 0 des deux côtés (là le BO ne devrait PAS afficher un vrai prix)
SELECT
  p.id_product,
  pl.name,
  p.price AS prix_ps_product,
  ps.price AS prix_ps_product_shop
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
ORDER BY p.id_product DESC
LIMIT 30;

-- Aperçu Bayern / derniers produits (pour comparer avec le BO)
SELECT
  p.id_product,
  pl.name,
  p.price AS prix_ps_product,
  ps.price AS prix_ps_product_shop,
  CASE
    WHEN ps.price > 0 THEN ps.price
    WHEN p.price > 0 THEN p.price
    ELSE 0
  END AS prix_qui_devrait_sagir_sur_le_site
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
JOIN ps_product_lang pl
  ON pl.id_product = p.id_product
 AND pl.id_lang = @id_lang
 AND pl.id_shop = @shop_id
WHERE p.active = 1
  AND (
    pl.name LIKE '%Bayern%'
    OR pl.name LIKE '%bayern%'
  )
ORDER BY p.id_product DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) SYNC AUTOMATIQUE (une seule fois après le diagnostic)
--    Recopie le prix non-nul d'une table vers l'autre.
--    Ne touche PAS aux produits déjà cohérents.
-- ─────────────────────────────────────────────────────────────────────────────

-- a) Shop a le prix → on le copie dans ps_product (cas le plus fréquent)
UPDATE ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
SET p.price = ps.price,
    p.date_upd = NOW()
WHERE (p.price IS NULL OR p.price = 0)
  AND ps.price > 0;

-- b) Produit a le prix → on le copie dans ps_product_shop
UPDATE ps_product_shop ps
JOIN ps_product p
  ON p.id_product = ps.id_product
SET ps.price = p.price,
    ps.date_upd = NOW()
WHERE ps.id_shop = @shop_id
  AND (ps.price IS NULL OR ps.price = 0)
  AND p.price > 0;

-- c) Contrôle après sync (doit être proche de 0 pour "zero_des_deux_cotes"
--    si le BO avait bien des prix quelque part)
SELECT
  COUNT(*) AS produits_actifs,
  SUM(CASE WHEN p.price IS NULL OR p.price = 0 THEN 1 ELSE 0 END) AS zero_dans_ps_product,
  SUM(CASE WHEN ps.price IS NULL OR ps.price = 0 THEN 1 ELSE 0 END) AS zero_dans_ps_product_shop,
  SUM(CASE WHEN (p.price IS NULL OR p.price = 0) AND (ps.price IS NULL OR ps.price = 0) THEN 1 ELSE 0 END) AS zero_des_deux_cotes
FROM ps_product p
JOIN ps_product_shop ps
  ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
WHERE p.active = 1;
