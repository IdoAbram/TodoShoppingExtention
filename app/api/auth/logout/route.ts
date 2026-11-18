import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/session";

export async function POST(req: NextRequest) {
  await destroySession();
  // 303 so the browser follows the redirect with GET.
  return NextResponse.redirect(new URL("/", req.url), 303);
}
