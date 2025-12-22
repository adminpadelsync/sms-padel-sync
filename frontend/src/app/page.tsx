'use client'

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MessageSquare, Calendar, Users, CheckCircle, ArrowRight, Menu, X, Zap, Smartphone, ShieldCheck } from 'lucide-react';
import { ContactForm } from '@/components/landing-form';

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground selection:bg-primary/20">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <span className="text-primary">Padel Sync</span>
          </div>
          <nav className="hidden md:flex gap-6 items-center text-sm font-medium">
            <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</Link>
            <Link href="/assessment" className="text-muted-foreground hover:text-foreground transition-colors">Skill Assessment</Link>
            <Link href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How it Works</Link>
            <Link href="/login" className="px-4 py-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              Login
            </Link>
          </nav>
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        {isMenuOpen && (
          <div className="md:hidden border-b bg-background animate-in slide-in-from-top duration-300">
            <nav className="flex flex-col p-4 space-y-4 text-sm font-medium">
              <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsMenuOpen(false)}>Features</Link>
              <Link href="/assessment" className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsMenuOpen(false)}>Skill Assessment</Link>
              <Link href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => setIsMenuOpen(false)}>How it Works</Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Login
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 overflow-hidden">
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8 text-center lg:text-left animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                  <span className="flex h-2 w-2 rounded-full bg-green-500 mr-2"></span>
                  AI-Powered Padel Management
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-balance leading-tight">
                  Maximize Court Utilization with <br className="hidden sm:block" />
                  <span className="text-primary">AI-Driven Matchmaking.</span>
                </h1>
                <p className="text-lg text-muted-foreground max-w-[600px] mx-auto lg:mx-0 text-balance leading-relaxed">
                  Increase booking rates by 5-25% by filling empty slots automatically.
                  Our smart algorithms match players based on skill level, gender, availability, and match feedback—all via SMS.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <Link href="#waitlist" className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
                    Optimize My Club
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                  <Link href="/assessment" className="inline-flex h-12 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
                    Take Skill Assessment
                  </Link>
                </div>
                <div className="pt-4 flex items-center justify-center lg:justify-start gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Algo-based Matching</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>Reduce Downtime</span>
                  </div>
                </div>
              </div>
              <div className="relative mx-auto lg:ml-auto w-full max-w-[500px] lg:max-w-none animate-in fade-in zoom-in duration-1000 delay-200">
                <div className="aspect-[4/3] relative rounded-2xl overflow-hidden shadow-2xl border bg-muted">
                  <Image
                    src="/hero-padel-final.png"
                    alt="Padel Match in Action"
                    fill
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-background/20 to-transparent mix-blend-overlay"></div>
                </div>
                <div className="absolute -bottom-6 -left-6 bg-card border p-4 rounded-xl shadow-lg flex items-center gap-4 max-w-xs animate-in slide-in-from-bottom-4 duration-700 delay-500">
                  <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                    <Zap className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">Utilization +25%</p>
                    <p className="text-xs text-muted-foreground">This Month vs Last Month</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-muted/50">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Intelligent Club Optimization</h2>
              <p className="text-muted-foreground text-lg">
                Stop relying on manual Whatsapp groups. Let our engine analyze player data to create perfect matches that keep players coming back.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-background p-8 rounded-2xl shadow-sm border hover:shadow-md transition-shadow">
                <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mb-6">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Smart Algorithms</h3>
                <p className="text-muted-foreground">
                  We match players by analyzing skill level (ELO), gender preference, past match history, and availability patterns to ensure balanced games.
                </p>
              </div>
              <div className="bg-background p-8 rounded-2xl shadow-sm border hover:shadow-md transition-shadow">
                <div className="h-12 w-12 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center mb-6">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Revenue Growth</h3>
                <p className="text-muted-foreground">
                  Fill last-minute cancellations and hard-to-book slots with targeted SMS blasts. Increase your total court utilization by up to 25%.
                </p>
              </div>
              <div className="bg-background p-8 rounded-2xl shadow-sm border hover:shadow-md transition-shadow">
                <div className="h-12 w-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center mb-6">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">Feedback Loop</h3>
                <p className="text-muted-foreground">
                  Data-driven reliability. Our system collects post-match feedback to refine player ratings and reliability scores automatically.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section id="how-it-works" className="py-24 overflow-hidden">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="order-2 lg:order-1 relative">
                {/* Abstract decorative elements */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-blue-500/5 rounded-full blur-3xl -z-10"></div>
                <Image
                  src="/iphone-showcase-final.png"
                  alt="iPhone Showcase - Onboarding and Match Confirmation"
                  width={800}
                  height={600}
                  className="relative z-10 drop-shadow-2xl hover:scale-[1.02] transition-transform duration-500 transition-opacity rounded-xl"
                />
              </div>
              <div className="order-1 lg:order-2 space-y-8">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">The Algorithm at Work</h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="h-10 w-10 flex-shrink-0 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-lg">1</div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">Identify Opportunities</h3>
                      <p className="text-muted-foreground">Our system scans your calendar for open slots and identifies the best potential players based on skill compatibility and history.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="h-10 w-10 flex-shrink-0 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-lg">2</div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">Targeted Invitations</h3>
                      <p className="text-muted-foreground">Personalized SMS invites are sent. "Hey [Name], we have a spot for a [Level] match this Tuesday. Want in?"</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="h-10 w-10 flex-shrink-0 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold text-lg">3</div>
                    <div>
                      <h3 className="text-xl font-bold mb-2">Automated Confirmation</h3>
                      <p className="text-muted-foreground">As players reply "IN", the algorithm balances the teams. Once full, the court is booked and calendar synced.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section id="waitlist" className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-soft-light"></div>
          <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
            <ContactForm />
          </div>
        </section>

      </main>

      <footer className="py-12 border-t bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <span className="text-xl font-bold text-primary mb-4 block">Padel Sync</span>
              <p className="text-muted-foreground max-w-xs">
                The modern way to organize Padel matches. efficient, automated, and app-free.
              </p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#features" className="hover:text-foreground">Features</Link></li>
                <li><Link href="#pricing" className="hover:text-foreground">Pricing</Link></li>
                <li><Link href="#faq" className="hover:text-foreground">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground">Terms of Service</Link></li>
                <li><Link href="/messaging-terms" className="hover:text-foreground">Messaging Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t text-center md:text-left text-sm text-muted-foreground flex flex-col md:flex-row justify-between items-center">
            <p>© {new Date().getFullYear()} Padel Sync. All rights reserved.</p>
            <div className="flex gap-4 mt-4 md:mt-0">
              {/* Social icons placeholder */}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
