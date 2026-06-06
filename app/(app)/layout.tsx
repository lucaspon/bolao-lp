import { requireUser } from "@/lib/auth/session";
import { Nav } from "@/components/nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <>
      <Nav username={user.username} isAdmin={user.isAdmin} />
      <main className="mx-auto w-full max-w-[1800px] flex-1 px-4 py-6">
        {children}
      </main>
      <footer className="border-t border-line py-5 text-center text-xs text-mute">
        LCM · Bolão da Copa 2026 · times shown in Brasília time
      </footer>
    </>
  );
}
