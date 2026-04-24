import { Link } from 'react-router-dom'
import { Button, Card } from '../components/ui'

export function SplashPage() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 relative overflow-hidden grid place-items-center">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 15%, rgba(30, 88, 224, 0.12), transparent 38%), radial-gradient(circle at 85% 18%, rgba(245, 158, 11, 0.14), transparent 34%), linear-gradient(120deg, rgba(148, 163, 184, 0.12) 0%, rgba(148, 163, 184, 0) 48%)',
        }}
      />

      <Card className="relative z-10 max-w-2xl w-full p-8 space-y-5 bg-background/90 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">HR Survey Pro</p>
        <h1 className="text-3xl md:text-4xl font-semibold leading-tight">Welcome</h1>
        <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
          Disclaimer: This survey tool uses fictional data and is for testing purposes only.
        </p>
        <div>
          <Link to="/dashboard">
            <Button>Continue</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}
