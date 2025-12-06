import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between px-6 border-b">
        <h1 className="text-2xl font-bold">Padel Sync</h1>
        <nav className="flex gap-4">
          <Link href="/login" className="px-4 py-2 text-sm font-medium transition-colors hover:text-primary">
            Login
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-3xl mx-auto">
        <h2 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
          Padel Court Matchmaking
        </h2>
        <p className="text-xl text-muted-foreground mb-12">
          Automated match organization for padel clubs. Players receive invitations,
          confirm availability, and get game confirmations via SMS.
        </p>

        <div className="bg-card p-8 rounded-xl border shadow-sm max-w-md w-full mb-12">
          <h3 className="text-lg font-semibold mb-4">Join the List</h3>
          <p className="text-2xl font-mono font-bold text-primary mb-2">
            Text START to (888) 419-0992
          </p>
          <p className="text-sm text-muted-foreground">
            Msg & data rates may apply. Msg freq varies. <br />
            Reply STOP to cancel.
          </p>
        </div>
      </main>

      <footer className="py-6 border-t text-center text-sm text-muted-foreground">
        <div className="mb-4 space-x-4">
          <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
          <Link href="/terms" className="hover:underline">Terms of Service</Link>
        </div>
        <p>© {new Date().getFullYear()} Padel Sync. All rights reserved.</p>
      </footer>
    </div>
  );
}
