-- Désactiver TOUS les produits (catalogue vide côté site, sans supprimer en BO).
-- Utile pour repartir à zéro avec l'import Foot Shop sans lutter contre les
-- erreurs de suppression d'images après migration.
--
-- Le site n'affiche que les produits actifs → catalogue vide après ce script.
-- Vous pouvez ensuite réimporter via /admin/bbdbuy.

UPDATE ps_product SET active = 0;
UPDATE ps_product_shop SET active = 0;

-- Vérification
SELECT COUNT(*) AS produits_actifs FROM ps_product WHERE active = 1;
