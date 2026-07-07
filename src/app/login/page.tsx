import LoginForm from "@/components/LoginForm";

// Server component: reading the error code from searchParams here (instead of
// useSearchParams in the client) lets the full form render in the initial
// HTML — no blank flash while the JS bundle loads.
export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  return <LoginForm initialErrorCode={searchParams.error} />;
}
