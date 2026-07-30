-- =============================================================================
-- PrestaShop 8 — Ajouter la taille XXL à tous les produits avec déclinaisons
-- =============================================================================
-- Crée l'attribut XXL s'il manque, puis une déclinaison XXL (stock 20) pour
-- chaque produit qui a déjà au moins une taille mais pas encore XXL.
--
-- ⚠️ Sauvegarde phpMyAdmin obligatoire avant exécution !
--
-- Après ce script :
--   1. Back office → Paramètres avancés → Performances → Vider le cache
--   2. Vérifiez un produit au hasard : déclinaisons → XXL, stock 20
-- =============================================================================

SET @id_lang := 1;
SET @id_shop := 1;
SET @stock_qty := 20;

-- Groupe d'attributs « Taille » (ajustez si besoin via diagnostic ci-dessous)
SELECT @size_group := ag.id_attribute_group
FROM ps_attribute_group ag
JOIN ps_attribute_group_lang agl
  ON agl.id_attribute_group = ag.id_attribute_group AND agl.id_lang = @id_lang
WHERE agl.name LIKE '%Taille%'
   OR agl.public_name LIKE '%Taille%'
   OR agl.name LIKE '%Size%'
   OR agl.public_name LIKE '%Size%'
ORDER BY ag.id_attribute_group
LIMIT 1;

-- Diagnostic si @size_group est NULL :
-- SELECT ag.id_attribute_group, agl.name, agl.public_name
-- FROM ps_attribute_group ag
-- JOIN ps_attribute_group_lang agl ON agl.id_attribute_group = ag.id_attribute_group
-- WHERE agl.id_lang = @id_lang;

-- Créer l'attribut XXL s'il n'existe pas
SELECT @xxl_attr := a.id_attribute
FROM ps_attribute a
JOIN ps_attribute_lang al
  ON al.id_attribute = a.id_attribute AND al.id_lang = @id_lang
WHERE a.id_attribute_group = @size_group
  AND UPPER(TRIM(al.name)) = 'XXL'
LIMIT 1;

INSERT INTO ps_attribute (id_attribute_group, color, position)
SELECT @size_group, '', COALESCE(MAX(a.position), 0) + 1
FROM ps_attribute a
WHERE a.id_attribute_group = @size_group
  AND @xxl_attr IS NULL;

SET @xxl_attr := IFNULL(
  @xxl_attr,
  LAST_INSERT_ID()
);

INSERT INTO ps_attribute_lang (id_attribute, id_lang, name)
SELECT @xxl_attr, @id_lang, 'XXL'
FROM DUAL
WHERE @xxl_attr > 0
  AND NOT EXISTS (
    SELECT 1 FROM ps_attribute_lang
    WHERE id_attribute = @xxl_attr AND id_lang = @id_lang
  );

INSERT INTO ps_attribute_shop (id_attribute, id_shop)
SELECT @xxl_attr, @id_shop
FROM DUAL
WHERE @xxl_attr > 0
  AND NOT EXISTS (
    SELECT 1 FROM ps_attribute_shop
    WHERE id_attribute = @xxl_attr AND id_shop = @id_shop
  );

-- Ajouter la déclinaison XXL produit par produit
DROP PROCEDURE IF EXISTS footshop_add_xxl_combinations;

DELIMITER $$

CREATE PROCEDURE footshop_add_xxl_combinations()
BEGIN
  DECLARE done INT DEFAULT FALSE;
  DECLARE v_product_id INT;
  DECLARE v_pa_id INT;

  DECLARE cur CURSOR FOR
    SELECT DISTINCT pa.id_product
    FROM ps_product_attribute pa
    WHERE @xxl_attr > 0
      AND NOT EXISTS (
        SELECT 1
        FROM ps_product_attribute pa2
        JOIN ps_product_attribute_combination pac
          ON pac.id_product_attribute = pa2.id_product_attribute
        WHERE pa2.id_product = pa.id_product
          AND pac.id_attribute = @xxl_attr
      );

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

  OPEN cur;

  read_loop: LOOP
    FETCH cur INTO v_product_id;
    IF done THEN
      LEAVE read_loop;
    END IF;

    INSERT INTO ps_product_attribute (
      id_product, reference, supplier_reference, location,
      ean13, isbn, upc, mpn,
      wholesale_price, price, ecotax, quantity, weight,
      unit_price_impact, default_on, minimal_quantity
    ) VALUES (
      v_product_id, '', '', '', '', '', '', '',
      0, 0, 0, 0, 0, 0, NULL, 1
    );

    SET v_pa_id = LAST_INSERT_ID();

    INSERT INTO ps_product_attribute_shop (
      id_product_attribute, id_shop,
      wholesale_price, price, ecotax, weight,
      unit_price_impact, default_on, minimal_quantity, available_date
    ) VALUES (
      v_pa_id, @id_shop, 0, 0, 0, 0, 0, NULL, 1, '0000-00-00'
    );

    INSERT INTO ps_product_attribute_lang (
      id_product_attribute, id_lang, description, available_now, available_later
    ) VALUES (
      v_pa_id, @id_lang, '', '', ''
    );

    INSERT INTO ps_product_attribute_combination (id_attribute, id_product_attribute)
    VALUES (@xxl_attr, v_pa_id);

    INSERT INTO ps_stock_available (
      id_product, id_product_attribute, id_shop, id_shop_group,
      quantity, depends_on_stock, out_of_stock
    ) VALUES (
      v_product_id, v_pa_id, @id_shop, 0, @stock_qty, 0, 2
    );
  END LOOP;

  CLOSE cur;
END$$

DELIMITER ;

CALL footshop_add_xxl_combinations();
DROP PROCEDURE IF EXISTS footshop_add_xxl_combinations;

-- Vérifications
SELECT @size_group AS size_group_id, @xxl_attr AS xxl_attribute_id;

SELECT COUNT(*) AS produits_avec_declinaisons
FROM (SELECT DISTINCT id_product FROM ps_product_attribute) t;

SELECT COUNT(*) AS combinaisons_xxl
FROM ps_product_attribute_combination
WHERE id_attribute = @xxl_attr;

SELECT p.id_product, pl.name, sa.quantity
FROM ps_product p
JOIN ps_product_lang pl
  ON pl.id_product = p.id_product AND pl.id_lang = @id_lang AND pl.id_shop = @id_shop
JOIN ps_product_attribute pa ON pa.id_product = p.id_product
JOIN ps_product_attribute_combination pac ON pac.id_product_attribute = pa.id_product_attribute
JOIN ps_stock_available sa
  ON sa.id_product = p.id_product
 AND sa.id_product_attribute = pa.id_product_attribute
 AND sa.id_shop = @id_shop
WHERE pac.id_attribute = @xxl_attr
ORDER BY p.id_product DESC
LIMIT 10;
