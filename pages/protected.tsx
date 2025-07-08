import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function ProtectedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/me");
    }
  }, [status, router]);

  if (status === "loading") {
    return <div>Redirecting...</div>;
  }
  if (!session) {
    return <div>Access Denied. Please sign in.</div>;
  }
  // Optionally, you can return null here since the redirect will happen
  return null;
} 