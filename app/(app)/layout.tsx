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
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:max-w-[min(70vw,1500px)]">
        {children}
      </main>
      <footer className="border-t border-line py-5 text-center text-xs text-mute">
        Bolão da Copa 2026 · horários no fuso de Brasília
      </footer>
    </>
  );
}
