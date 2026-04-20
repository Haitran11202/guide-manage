import { LoaderCircle } from "lucide-react";

type LoadingSpinnerProps = {
  className?: string;
};

export function LoadingSpinner({ className = "h-5 w-5" }: LoadingSpinnerProps) {
  return <LoaderCircle className={`${className} animate-spin`} />;
}
