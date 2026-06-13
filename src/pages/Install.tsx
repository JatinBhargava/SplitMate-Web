import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Monitor, CheckCircle2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="mb-2">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to App
        </Button>

        <Card className="border-primary/20">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Install SplitMate</CardTitle>
            <CardDescription>
              Get the full app experience on your device
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isInstalled ? (
              <div className="text-center space-y-3 py-4">
                <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
                <p className="text-lg font-medium text-foreground">SplitMate is installed!</p>
                <p className="text-sm text-muted-foreground">
                  Open it from your home screen or app drawer.
                </p>
              </div>
            ) : (
              <>
                {deferredPrompt ? (
                  <Button onClick={handleInstall} className="w-full" size="lg">
                    <Download className="h-5 w-5 mr-2" /> Install SplitMate
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground text-center">
                      Install SplitMate as an app on your device:
                    </p>

                    <Card className="bg-muted/50">
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <Smartphone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium text-sm">iPhone / iPad (Safari)</p>
                            <p className="text-xs text-muted-foreground">
                              Tap the <strong>Share</strong> button → <strong>Add to Home Screen</strong>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Smartphone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Android (Chrome)</p>
                            <p className="text-xs text-muted-foreground">
                              Tap the <strong>⋮ menu</strong> → <strong>Add to Home Screen</strong> or <strong>Install App</strong>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Monitor className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                          <div>
                            <p className="font-medium text-sm">Desktop (Chrome / Edge)</p>
                            <p className="text-xs text-muted-foreground">
                              Click the <strong>install icon</strong> in the address bar
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <p className="text-xs font-medium text-muted-foreground text-center">Why install?</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>✓ Works offline &amp; loads instantly</li>
                    <li>✓ Full-screen app experience</li>
                    <li>✓ Quick access from home screen</li>
                    <li>✓ No app store needed</li>
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Install;
