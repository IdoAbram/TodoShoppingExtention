import { connection } from "next/server";
import { Suspense } from "react";
import { ShoppingApp } from "@/components/ShoppingApp";
import { SignIn } from "@/components/SignIn";
import { Spinner } from "@/components/icons";
import { isDemoMode } from "@/lib/demo";
import { getPrefs, readSession } from "@/lib/session";

export default function Page({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={<Splash />}>
      <Home searchParams={searchParams} />
    </Suspense>
  );
}

async function Home({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  // Session + database reads: always render per request, never prerender.
  await connection();
  const [session, params] = await Promise.all([readSession(), searchParams]);
  if (!session) {
    const error = typeof params.error === "string" ? params.error : undefined;
    return <SignIn error={error} demo={isDemoMode()} />;
  }
  const prefs = await getPrefs(session.userId);
  return (
    <ShoppingApp
      userName={session.name}
      initialList={prefs ? { id: prefs.listId, name: prefs.listName } : null}
    />
  );
}

function Splash() {
  return (
    <main className="flex min-h-dvh items-center justify-center text-accent" aria-busy>
      <Spinner width={32} height={32} />
    </main>
  );
}
