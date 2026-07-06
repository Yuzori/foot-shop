import { NextResponse } from "next/server";



import { prestashop } from "@/services/prestashop";



export async function GET(

  _request: Request,

  { params }: { params: Promise<{ id: string }> },

) {

  const { id } = await params;

  const product = await prestashop.getProductById(id);



  if (!product) {

    return NextResponse.json({ message: "Produit introuvable" }, { status: 404 });

  }



  return NextResponse.json(product);

}


