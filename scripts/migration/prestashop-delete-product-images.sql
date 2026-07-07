-- PrestaShop 8 — supprimer les images d'un produit quand le BO échoue avec
-- CannotDeleteProductImageException (ex. image #703, produit #192).
--
-- PS8 : pas de colonne id_default_image — la couverture est dans ps_image.cover
--
-- 1) Remplacez @id_product par l'ID concerné.
-- 2) Exécutez dans phpMyAdmin.
-- 3) BO → Catalogue → Produits → supprimez le produit (ou désactivez-le).

SET @id_product = 192;

-- Liens déclinaisons ↔ images
DELETE pai
FROM ps_product_attribute_image pai
INNER JOIN ps_image i ON i.id_image = pai.id_image
WHERE i.id_product = @id_product;

DELETE ish
FROM ps_image_shop ish
INNER JOIN ps_image i ON i.id_image = ish.id_image
WHERE i.id_product = @id_product;

DELETE il
FROM ps_image_lang il
INNER JOIN ps_image i ON i.id_image = il.id_image
WHERE i.id_product = @id_product;

DELETE FROM ps_image WHERE id_product = @id_product;

-- Vérification (doit retourner 0 ligne)
SELECT id_image, id_product, cover FROM ps_image WHERE id_product = @id_product;
