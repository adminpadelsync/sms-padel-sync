import { PadelAssessment } from '@/components/padel-assessment';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function AssessmentPage() {
    return (
        <div className="min-h-screen bg-background">
            <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-4 h-16 flex items-center">
                    <Link
                        href="/"
                        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back to Home
                    </Link>
                </div>
            </header>

            <main className="container mx-auto py-8">
                <div className="max-w-2xl mx-auto text-center mb-12 px-4">
                    <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl mb-4">
                        Assess Your <span className="text-primary">Padel Level</span>
                    </h1>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Take our comprehensive self-assessment to find your official Padel Sync rating.
                        We use a weighted algorithm that considers your background, technique, and competitive history.
                    </p>
                </div>

                <PadelAssessment />

                <div className="max-w-md mx-auto mt-20 text-center pb-20 px-4">
                    <div className="bg-muted/50 rounded-2xl p-6 border italic text-sm text-muted-foreground">
                        &quot;This assessment helps us match you with players of similar skill levels,
                        ensuring every match you play is competitive and fun.&quot;
                    </div>
                </div>
            </main>
        </div>
    );
}
