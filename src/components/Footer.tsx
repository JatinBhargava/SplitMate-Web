import { Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/50 backdrop-blur-sm py-4">
      <p className="text-center text-sm text-muted-foreground flex items-center justify-center gap-1">
        Made with <Heart className="w-3.5 h-3.5 text-destructive fill-destructive" /> by{" "}
        <a
          href="https://sanidhya.in"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-foreground hover:text-primary transition-colors underline underline-offset-2"
        >
          Sanidhya
        </a>
      </p>
    </footer>
  );
}
