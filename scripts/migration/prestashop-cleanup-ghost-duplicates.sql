-- =============================================================================
-- PrestaShop 8 — Pourquoi le BO reste à 283 alors que le SQL dit 616
-- =============================================================================
-- Les 333 "Produit #862" etc. sont des DOUBLONS fantômes (anciens imports cassés).
-- Les vrais maillots sont soit dans les 283 visibles, soit dans les clones #1185+.
--
-- Ce script :
--   1) Montre la répartition
--   2) Désactive les fantômes "Produit #..." qui ont déjà un clone
--   3) Liste ceux sans clone (à traiter manuellement ou re-cloner)
--
-- ⚠️ Sauvegarde avant UPDATE. Puis vider le cache PrestaShop.
-- =============================================================================

SET @shop_id := 1;
SET @id_lang := 1;

-- ── 1) RÉPARTITION ───────────────────────────────────────────────────────────

SELECT
  SUM(CASE WHEN pl.name LIKE 'Produit #%' THEN 1 ELSE 0 END) AS noms_generiques_produit_hash,
  SUM(CASE WHEN pl.name NOT LIKE 'Produit #%' AND TRIM(IFNULL(pl.name,'')) <> '' THEN 1 ELSE 0 END) AS vrais_noms,
  COUNT(*) AS total_actifs
FROM ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
JOIN ps_product_lang pl
  ON pl.id_product = p.id_product AND pl.id_lang = @id_lang AND pl.id_shop = @shop_id
WHERE p.active = 1 AND ps.active = 1;

-- Le BO affiche surtout les "vrais_noms" → ~283

-- ── 2) FANTÔMES QUI ONT DÉJÀ UN CLONE (sourceId du manifest) ─────────────────
-- Remplace la liste si tu as ajouté des clones depuis.

SELECT COUNT(*) AS fantomes_avec_clone_a_desactiver
FROM ps_product p
JOIN ps_product_lang pl
  ON pl.id_product = p.id_product AND pl.id_lang = @id_lang AND pl.id_shop = @shop_id
WHERE p.active = 1
  AND pl.name LIKE 'Produit #%'
  AND p.id_product IN (
    469,502,939,953,954,955,957,958,959,961,962,963,964,965,966,967,968,969,970,971,
    972,973,974,975,976,979,980,981,982,983,984,985,986,987,988,989,990,991,992,993,
    994,995,997,998,999,1000,1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,
    1013,1015,1016,1017,1018,1019,1020,1028,1030,1031,1032,1037,1045,1118,1119,1130,
    1131,1132,1133
  );

-- ── 3) DÉSACTIVER les fantômes "Produit #..." qui ont un clone ───────────────

UPDATE ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
JOIN ps_product_lang pl
  ON pl.id_product = p.id_product AND pl.id_lang = @id_lang AND pl.id_shop = @shop_id
SET
  p.active = 0,
  ps.active = 0,
  p.date_upd = NOW(),
  ps.date_upd = NOW()
WHERE p.active = 1
  AND pl.name LIKE 'Produit #%'
  AND p.id_product IN (
    469,502,939,953,954,955,957,958,959,961,962,963,964,965,966,967,968,969,970,971,
    972,973,974,975,976,979,980,981,982,983,984,985,986,987,988,989,990,991,992,993,
    994,995,997,998,999,1000,1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,
    1013,1015,1016,1017,1018,1019,1020,1028,1030,1031,1032,1037,1045,1118,1119,1130,
    1131,1132,1133
  );

-- ── 4) Fantômes "Produit #..." SANS clone — encore actifs ───────────────────

SELECT
  p.id_product,
  pl.name,
  p.price,
  (SELECT COUNT(*) FROM ps_image i WHERE i.id_product = p.id_product) AS nb_images
FROM ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
JOIN ps_product_lang pl
  ON pl.id_product = p.id_product AND pl.id_lang = @id_lang AND pl.id_shop = @shop_id
WHERE p.active = 1 AND ps.active = 1
  AND pl.name LIKE 'Produit #%'
ORDER BY p.id_product
LIMIT 50;

-- ── 5) Compteur BO après nettoyage ───────────────────────────────────────────

SELECT COUNT(*) AS approx_liste_bo_apres_nettoyage
FROM ps_product p
JOIN ps_product_shop ps ON ps.id_product = p.id_product AND ps.id_shop = @shop_id
JOIN ps_product_lang pl
  ON pl.id_product = p.id_product AND pl.id_lang = @id_lang AND pl.id_shop = @shop_id
WHERE p.active = 1 AND ps.active = 1
  AND ps.visibility IN ('both', 'catalog')
  AND pl.name NOT LIKE 'Produit #%';

-- =============================================================================
-- INTERPRÉTATION
-- =============================================================================
-- • BO ~283 = NORMAL : ce sont les maillots avec un vrai nom (dont tes 76 clones).
-- • Les "Produit #862" = doublons cassés, pas de vrais maillots à récupérer ainsi.
-- • Après étape 3 : les 76 doublons sources sont désactivés → BO plus propre.
-- • Étape 4 : liste ceux sans clone — il faudra les re-cloner ou les désactiver.
-- =============================================================================
