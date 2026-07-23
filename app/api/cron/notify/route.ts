import { NextResponse } from "next/server";



import { isCronAuthorized } from "@/lib/admin-auth";

import { runNotifyJob } from "@/lib/run-notify-job";



/**

 * Endpoint CRON (Vercel appelle en GET toutes les 30 min).

 * Sur Vercel : CRON_SECRET = même valeur que ADMIN_SECRET.

 */

export async function GET(request: Request) {

  if (!isCronAuthorized(request)) {

    return NextResponse.json({ message: "Non autorisé." }, { status: 401 });

  }



  return runNotifyJob();

}


