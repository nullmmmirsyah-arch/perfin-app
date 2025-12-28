import { Spinner } from "@/components/ui/spinner";

export function LoadingScreen() {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-2">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    </div>
  );
}
