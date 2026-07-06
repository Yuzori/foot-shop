import "server-only";



import { paymentConfig } from "@/config/payment";

import {

  hasOrderBeenFulfilled,

  markOrderFulfilled,

} from "@/lib/order-fulfillment-store";

import { sendOrderConfirmationEmail } from "@/lib/order-confirmation-email";

import { notifySupplierOfOrder } from "@/lib/supplier-order";

import { prestashop } from "@/services/prestashop";



/** Marque une commande payée, envoie l'email client et notifie le fournisseur. */

export async function fulfillPaidOrder(

  orderId: string,

  customerEmail?: string | null,

): Promise<void> {

  const key = orderId.trim();

  if (!key) return;



  const before = await prestashop.getOrderById(key);

  if (!before) {

    throw new Error(`Commande PrestaShop introuvable (id ${key}).`);

  }



  await prestashop.addOrderHistory(key, paymentConfig.paidStateId);



  if (await hasOrderBeenFulfilled(key)) return;



  const order = (await prestashop.getOrderById(key)) ?? before;

  const email =

    customerEmail?.trim() ||

    (await prestashop.getCustomerEmailByOrderId(key));



  if (email) {

    await sendOrderConfirmationEmail({ to: email, order });

  }



  await notifySupplierOfOrder(order, key);

  await markOrderFulfilled(key);

}

