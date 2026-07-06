-- Mise à jour des URLs après migration Kali → Hostinger
-- Exécuter dans phpMyAdmin Hostinger APRÈS import de prestashop.sql
--
-- Préfixe par défaut ps_ — vérifie db-prefix.txt de l'export.

UPDATE ps_shop_url
SET
  domain = 'bo.foot-shop.fr',
  domain_ssl = 'bo.foot-shop.fr',
  physical_uri = '/';

-- PS_SHOP_DOMAIN = nom d'hôte uniquement (sans https://)
UPDATE ps_configuration
SET value = 'bo.foot-shop.fr'
WHERE name IN ('PS_SHOP_DOMAIN', 'PS_SHOP_DOMAIN_SSL');

UPDATE ps_configuration SET value = '1' WHERE name = 'PS_SSL_ENABLED';
UPDATE ps_configuration SET value = '1' WHERE name = 'PS_SSL_ENABLED_EVERYWHERE';

UPDATE ps_configuration
SET value = REPLACE(value, 'http://192.168.1.68', 'https://bo.foot-shop.fr')
WHERE value LIKE '%192.168.1.68%';

UPDATE ps_configuration
SET value = REPLACE(value, '192.168.1.68', 'bo.foot-shop.fr')
WHERE value LIKE '%192.168.1.68%';
